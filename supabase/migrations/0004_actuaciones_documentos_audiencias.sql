-- =============================================================================
-- Litis — Migración 0004: Actuaciones, documentos y audiencias
-- =============================================================================
-- ─────────────────────────────────────────────────────────────────────────────
-- LA BITÁCORA ES INMUTABLE, Y ES A PROPÓSITO
-- ─────────────────────────────────────────────────────────────────────────────
-- `actuaciones` no tiene política de UPDATE ni de DELETE. No es un descuido:
-- sin RLS que lo permita, la operación se rechaza aunque alguien la intente
-- desde la aplicación.
--
-- Un registro de actuaciones que se puede editar hacia atrás no sirve para lo
-- único que importa: acreditar qué se supo y cuándo. El día que un cliente
-- reclame que no le avisaron de una notificación, o que haya que sostener ante
-- un colegio de abogados que el asunto se llevó con diligencia, una bitácora
-- editable no prueba nada.
--
-- Corregir se hace agregando una actuación que rectifique, con su propia
-- fecha y su propio autor. Es como funciona un expediente de verdad.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- `visible_cliente` — LA COLUMNA QUE SEPARA DOS BITÁCORAS
-- ─────────────────────────────────────────────────────────────────────────────
-- El abogado necesita anotar cosas que el cliente no debe leer: la valoración
-- honesta de sus posibilidades, la estrategia, el hecho de que no paga. Y el
-- cliente necesita ver el avance sin llamar cada semana. Una sola bitácora con
-- una bandera resuelve las dos, siempre que la bandera se respete en la RLS y
-- no solo en la consulta de la aplicación.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) ENUMERACIONES
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.tipo_actuacion as enum (
    'promocion',     -- escrito que presentamos
    'acuerdo',       -- proveído del órgano
    'notificacion',  -- notificación recibida (dispara el cómputo de plazos)
    'resolucion',    -- sentencia, laudo, interlocutoria
    'audiencia',     -- lo ocurrido en una audiencia
    'diligencia',    -- actuación del actuario fuera del local
    'comunicacion',  -- trato con el cliente o la contraparte
    'nota_interna'   -- solo para el despacho
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.tipo_documento as enum (
    'escrito_inicial', 'promocion', 'anexo', 'acuse', 'acuerdo',
    'resolucion', 'poder', 'identificacion', 'prueba', 'contrato', 'otro'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_audiencia as enum (
    'programada', 'celebrada', 'diferida', 'cancelada'
  );
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 2) ACTUACIONES — la bitácora
-- ---------------------------------------------------------------------------

create table if not exists public.actuaciones (
  id              uuid primary key default gen_random_uuid(),
  expediente_id   uuid not null references public.expedientes(id) on delete cascade,
  tipo            public.tipo_actuacion not null,
  -- Cuándo OCURRIÓ, que no es cuándo se capturó. Se captura el lunes lo que
  -- pasó el viernes, y el cómputo de plazos depende de la fecha real.
  fecha           date not null,
  titulo          text not null,
  detalle         text,
  visible_cliente boolean not null default false,
  -- Si la actuación movió la etapa, queda el rastro.
  etapa_clave     text,
  creado_por      uuid references public.perfiles(id) on delete set null,
  creado_el       timestamptz not null default now()
);

create index if not exists actuaciones_exp_idx
  on public.actuaciones (expediente_id, fecha desc, creado_el desc);


-- ---------------------------------------------------------------------------
-- 3) DOCUMENTOS
--    Los binarios viven en el bucket PRIVADO `expedientes` de Storage; aquí
--    solo van los metadatos. La descarga se hace con URL firmada de vida
--    corta, nunca con el archivo servido directo.
-- ---------------------------------------------------------------------------

create table if not exists public.documentos (
  id             uuid primary key default gen_random_uuid(),
  expediente_id  uuid not null references public.expedientes(id) on delete cascade,
  tipo           public.tipo_documento not null default 'otro',
  nombre         text not null,
  -- Ruta dentro del bucket. Se arma con despacho_id/expediente_id/… para que
  -- una política de Storage mal escrita no alcance a cruzar despachos.
  ruta_storage   text not null,
  tamano_bytes   bigint,
  mime           text,
  -- Un escrito se corrige varias veces antes de presentarse; la versión evita
  -- que "demanda_final_final_v3.pdf" sea el sistema de control de versiones.
  version        int not null default 1,
  -- El acuse sellado del que este documento es la presentación.
  acuse_de_id    uuid references public.documentos(id) on delete set null,
  visible_cliente boolean not null default false,
  notas          text,
  subido_por     uuid references public.perfiles(id) on delete set null,
  creado_el      timestamptz not null default now()
);

create index if not exists documentos_exp_idx on public.documentos (expediente_id, creado_el desc);


-- ---------------------------------------------------------------------------
-- 4) AUDIENCIAS
-- ---------------------------------------------------------------------------

create table if not exists public.audiencias (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  tipo          text not null,
  fecha         date not null,
  hora          time,
  lugar         text,
  -- Quién del despacho tiene que estar. Una audiencia sin responsable es una
  -- audiencia a la que no va nadie.
  responsable_id uuid references public.perfiles(id) on delete set null,
  estado        public.estado_audiencia not null default 'programada',
  resultado     text,
  notas         text,
  visible_cliente boolean not null default true,
  creado_por    uuid references public.perfiles(id) on delete set null,
  creado_el     timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);

create index if not exists audiencias_exp_idx on public.audiencias (expediente_id, fecha);
create index if not exists audiencias_agenda_idx on public.audiencias (fecha, estado);

drop trigger if exists audiencias_tocar on public.audiencias;
create trigger audiencias_tocar before update on public.audiencias
  for each row execute function public.tocar_actualizado_el();


-- ---------------------------------------------------------------------------
-- 5) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.actuaciones enable row level security;
alter table public.documentos  enable row level security;
alter table public.audiencias  enable row level security;

-- 5.1 actuaciones — SELECT e INSERT y nada más.
--     El personal lee todo lo del expediente; el cliente solo lo marcado como
--     visible. La condición del cliente va aquí y no en la consulta: si algún
--     día alguien escribe una consulta sin el filtro, la base lo detiene.
drop policy if exists actuaciones_leer on public.actuaciones;
create policy actuaciones_leer on public.actuaciones
  for select using (
    public.puede_ver_expediente(expediente_id)
    and (
      visible_cliente
      or exists (
        select 1 from public.expedientes e
        where e.id = expediente_id and public.es_personal(e.despacho_id)
      )
    )
  );

drop policy if exists actuaciones_crear on public.actuaciones;
create policy actuaciones_crear on public.actuaciones
  for insert with check (public.puede_editar_expediente(expediente_id));

-- Sin políticas de UPDATE ni DELETE: la bitácora no se reescribe. Ver el
-- encabezado de esta migración.

-- 5.2 documentos
drop policy if exists documentos_leer on public.documentos;
create policy documentos_leer on public.documentos
  for select using (
    public.puede_ver_expediente(expediente_id)
    and (
      visible_cliente
      or exists (
        select 1 from public.expedientes e
        where e.id = expediente_id and public.es_personal(e.despacho_id)
      )
    )
  );

drop policy if exists documentos_escribir on public.documentos;
create policy documentos_escribir on public.documentos
  for all using (public.puede_editar_expediente(expediente_id))
  with check (public.puede_editar_expediente(expediente_id));

-- 5.3 audiencias
drop policy if exists audiencias_leer on public.audiencias;
create policy audiencias_leer on public.audiencias
  for select using (
    public.puede_ver_expediente(expediente_id)
    and (
      visible_cliente
      or exists (
        select 1 from public.expedientes e
        where e.id = expediente_id and public.es_personal(e.despacho_id)
      )
    )
  );

drop policy if exists audiencias_escribir on public.audiencias;
create policy audiencias_escribir on public.audiencias
  for all using (public.puede_editar_expediente(expediente_id))
  with check (public.puede_editar_expediente(expediente_id));

-- =============================================================================
-- FIN — 0004
-- =============================================================================
