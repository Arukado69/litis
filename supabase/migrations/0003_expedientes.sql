-- =============================================================================
-- Litis — Migración 0003: Padrón de personas, expedientes, partes y etapas
-- =============================================================================
-- El corazón del dominio.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ CLIENTES Y CONTRAPARTES VIVEN EN LA MISMA TABLA
-- ─────────────────────────────────────────────────────────────────────────────
-- Porque el conflicto de interés no se puede detectar de otra forma. Un
-- despacho que solo registra a sus clientes no tiene manera de saber que el
-- asunto que está por aceptar es CONTRA alguien a quien ya representa: la
-- contraparte de hoy es el cliente de hace tres años, escrito distinto.
--
-- Así que `personas` es el padrón completo —clientes, contrapartes, terceros—
-- y la relación con el despacho es un atributo, no una tabla aparte.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ LAS ETAPAS SE CLONAN Y NO SE REFERENCIAN
-- ─────────────────────────────────────────────────────────────────────────────
-- Al abrir un expediente se copian las etapas de la plantilla de su vía. A
-- partir de ahí son suyas: el despacho puede renombrarlas, agregar o quitar
-- sin que cambie el histórico de los expedientes viejos. Si se referenciara la
-- plantilla, corregir una etiqueta reescribiría el pasado de trescientos
-- asuntos ya cerrados.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- `restringido` — LOS ASUNTOS QUE NO TODO EL DESPACHO PUEDE VER
-- ─────────────────────────────────────────────────────────────────────────────
-- Un despacho real tiene asuntos que no todo el personal debe abrir: el
-- divorcio de un socio, una investigación interna, un asunto penal delicado.
-- Se resuelve desde la RLS y no ocultando botones, porque ocultar el botón no
-- detiene a quien consulta la API.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) ENUMERACIONES
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.tipo_persona as enum ('fisica', 'moral');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.relacion_persona as enum (
    'cliente_activo', 'cliente_anterior', 'contraparte', 'tercero'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_expediente as enum (
    'prospecto',   -- todavía no se acepta el asunto
    'activo',
    'suspendido',
    'concluido',
    'archivado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.resultado_expediente as enum (
    'favorable', 'parcialmente_favorable', 'desfavorable',
    'convenio', 'desistimiento', 'caducidad', 'sobreseimiento', 'otro'
  );
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 2) PADRÓN DE PERSONAS
-- ---------------------------------------------------------------------------

create table if not exists public.personas (
  id             uuid primary key default gen_random_uuid(),
  despacho_id    uuid not null references public.despachos(id) on delete cascade,
  tipo           public.tipo_persona not null default 'fisica',
  nombre         text not null,
  -- Forma normalizada para cotejo de conflictos: sin acentos, sin puntuación y
  -- sin sufijo societario. La calcula la aplicación con el mismo motor que usa
  -- la pantalla de alta, para que la búsqueda y la alerta coincidan siempre.
  nombre_cotejo  text not null default '',
  rfc            text,
  curp           text,
  relacion       public.relacion_persona not null default 'cliente_activo',
  correo         text,
  telefono       text,
  domicilio      text,
  -- Para personas morales.
  representante  text,
  notas          text,
  creado_el      timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);

create index if not exists personas_despacho_idx on public.personas (despacho_id);
-- Índices del cotejo de conflictos: es la consulta que corre en cada alta.
create index if not exists personas_cotejo_idx on public.personas (despacho_id, nombre_cotejo);
create index if not exists personas_rfc_idx on public.personas (despacho_id, rfc) where rfc is not null;

drop trigger if exists personas_tocar on public.personas;
create trigger personas_tocar before update on public.personas
  for each row execute function public.tocar_actualizado_el();

-- Ahora que existe `personas`, se cierra la llave que la 0001 dejó pendiente.
do $$ begin
  alter table public.membresias
    add constraint membresias_persona_fk
    foreign key (persona_id) references public.personas(id) on delete set null;
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 3) EXPEDIENTES
-- ---------------------------------------------------------------------------

create table if not exists public.expedientes (
  id                 uuid primary key default gen_random_uuid(),
  despacho_id        uuid not null references public.despachos(id) on delete cascade,

  -- Consecutivo interno del despacho. Es como el equipo se refiere al asunto
  -- de viva voz, y existe desde antes de que el juzgado asigne el suyo.
  numero_interno     text not null,
  -- El del órgano, "123/2026". Nace vacío: hasta que no se admite la demanda
  -- no existe. Un modelo que lo exija obliga a inventarlo.
  numero_organo      text,
  -- "Pérez vs. Constructora XYZ". Se deriva de las partes pero se guarda,
  -- porque el nombre con el que se conoce un asunto no siempre es el literal.
  caratula           text not null,

  cliente_persona_id uuid references public.personas(id) on delete restrict,

  materia            text not null,
  via                text not null,
  fuero              public.fuero not null,
  entidad            text,
  organo_id          uuid references public.organos(id) on delete set null,
  -- "Primera instancia", "Toca 456/2026", "Amparo directo".
  instancia          text,

  etapa_actual       text,
  estado             public.estado_expediente not null default 'activo',
  resultado          public.resultado_expediente,

  cuantia            numeric(14, 2),
  moneda             text not null default 'MXN',

  responsable_id     uuid references public.perfiles(id) on delete set null,

  -- Solo el responsable, el titular y quien esté en `expediente_accesos`.
  restringido        boolean not null default false,

  fecha_inicio       date,
  fecha_conclusion   date,
  notas              text,

  creado_por         uuid references public.perfiles(id) on delete set null,
  creado_el          timestamptz not null default now(),
  actualizado_el     timestamptz not null default now(),

  unique (despacho_id, numero_interno)
);

create index if not exists expedientes_despacho_idx on public.expedientes (despacho_id, estado);
create index if not exists expedientes_responsable_idx on public.expedientes (responsable_id);
create index if not exists expedientes_cliente_idx on public.expedientes (cliente_persona_id);
create index if not exists expedientes_numero_organo_idx
  on public.expedientes (despacho_id, numero_organo) where numero_organo is not null;

drop trigger if exists expedientes_tocar on public.expedientes;
create trigger expedientes_tocar before update on public.expedientes
  for each row execute function public.tocar_actualizado_el();

-- Quién más puede abrir un expediente restringido.
create table if not exists public.expediente_accesos (
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  perfil_id     uuid not null references public.perfiles(id) on delete cascade,
  otorgado_por  uuid references public.perfiles(id) on delete set null,
  otorgado_el   timestamptz not null default now(),
  primary key (expediente_id, perfil_id)
);


-- ---------------------------------------------------------------------------
-- 4) PARTES
-- ---------------------------------------------------------------------------

create table if not exists public.expediente_partes (
  id                uuid primary key default gen_random_uuid(),
  expediente_id     uuid not null references public.expedientes(id) on delete cascade,
  persona_id        uuid not null references public.personas(id) on delete restrict,
  -- 'actor', 'demandado', 'quejoso', 'autoridad_responsable'… El conjunto
  -- válido depende de la materia y lo valida la aplicación: meterlo aquí como
  -- enum obligaría a una migración cada vez que se agregue una materia.
  rol               text not null,
  es_nuestra_parte  boolean not null default false,
  -- Quién la representa del otro lado. Dato de oro para el conflicto de
  -- interés y para saber con quién se negocia.
  abogado_contrario text,
  notas             text,
  creado_el         timestamptz not null default now(),
  unique (expediente_id, persona_id, rol)
);

create index if not exists expediente_partes_exp_idx on public.expediente_partes (expediente_id);
create index if not exists expediente_partes_persona_idx on public.expediente_partes (persona_id);

-- Exactamente una parte propia por expediente. Sin ella no se sabe desde qué
-- lado corren los plazos; con dos, el sistema no sabría cuál usar. Es un
-- índice parcial único, que es la forma de decir "solo un true por grupo".
create unique index if not exists expediente_una_parte_propia
  on public.expediente_partes (expediente_id)
  where es_nuestra_parte;


-- ---------------------------------------------------------------------------
-- 5) ETAPAS (clonadas de la plantilla al abrir el expediente)
-- ---------------------------------------------------------------------------

create table if not exists public.expediente_etapas (
  id            uuid primary key default gen_random_uuid(),
  expediente_id uuid not null references public.expedientes(id) on delete cascade,
  clave         text not null,
  nombre        text not null,
  descripcion   text,
  orden         int not null,
  -- Corre en paralelo al hilo principal (la suspensión en amparo, por ejemplo)
  -- y por eso no cuenta para la barra de avance.
  paralela      boolean not null default false,
  completada_el timestamptz,
  completada_por uuid references public.perfiles(id) on delete set null,
  unique (expediente_id, clave)
);

create index if not exists expediente_etapas_exp_idx
  on public.expediente_etapas (expediente_id, orden);


-- ---------------------------------------------------------------------------
-- 6) VISIBILIDAD — una función y no la misma condición copiada diez veces
--    Las tablas hijas (actuaciones, documentos, plazos, audiencias) reusan
--    esta función. Repetir la condición garantizaría que algún día una copia
--    se quede sin la parte del `restringido`.
-- ---------------------------------------------------------------------------

create or replace function public.puede_ver_expediente(p_expediente uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.expedientes e
    where e.id = p_expediente
      and public.es_miembro(e.despacho_id)
      and (
        -- Personal, siempre que el asunto no esté restringido…
        (
          public.es_personal(e.despacho_id)
          and (
            not e.restringido
            or e.responsable_id = (select auth.uid())
            or public.tiene_rol(e.despacho_id, array['titular']::public.rol_membresia[])
            or exists (
              select 1 from public.expediente_accesos a
              where a.expediente_id = e.id and a.perfil_id = (select auth.uid())
            )
          )
        )
        -- …o el cliente, solo sobre SUS expedientes.
        or e.cliente_persona_id = public.persona_del_usuario(e.despacho_id)
      )
  );
$$;

/*
  Ojo con `puede_editar_expediente`: el cliente NUNCA edita. Su portal es de
  lectura, y la separación se hace aquí abajo y no en la interfaz.
*/
create or replace function public.puede_editar_expediente(p_expediente uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.expedientes e
    where e.id = p_expediente
      and public.es_personal(e.despacho_id)
      and (
        not e.restringido
        or e.responsable_id = (select auth.uid())
        or public.tiene_rol(e.despacho_id, array['titular']::public.rol_membresia[])
        or exists (
          select 1 from public.expediente_accesos a
          where a.expediente_id = e.id and a.perfil_id = (select auth.uid())
        )
      )
  );
$$;


-- ---------------------------------------------------------------------------
-- 7) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.personas            enable row level security;
alter table public.expedientes         enable row level security;
alter table public.expediente_accesos  enable row level security;
alter table public.expediente_partes   enable row level security;
alter table public.expediente_etapas   enable row level security;

-- personas: el padrón es información interna. El cliente NO lo ve — enseñarle
-- la lista de clientes del despacho sería revelar la cartera entera.
drop policy if exists personas_personal on public.personas;
create policy personas_personal on public.personas
  for all using (public.es_personal(despacho_id))
  with check (public.es_personal(despacho_id));

drop policy if exists expedientes_leer on public.expedientes;
create policy expedientes_leer on public.expedientes
  for select using (public.puede_ver_expediente(id));

drop policy if exists expedientes_actualizar on public.expedientes;
create policy expedientes_actualizar on public.expedientes
  for update using (public.puede_editar_expediente(id))
  with check (public.puede_editar_expediente(id));

-- El alta no puede apoyarse en `puede_editar_expediente`: la fila todavía no
-- existe. Se valida contra el despacho de la fila entrante.
drop policy if exists expedientes_crear on public.expedientes;
create policy expedientes_crear on public.expedientes
  for insert with check (public.es_personal(despacho_id));

-- Borrar un expediente no es una operación normal: se archiva. Solo el titular.
drop policy if exists expedientes_borrar on public.expedientes;
create policy expedientes_borrar on public.expedientes
  for delete using (
    public.tiene_rol(despacho_id, array['titular']::public.rol_membresia[])
  );

drop policy if exists expediente_accesos_gestionar on public.expediente_accesos;
create policy expediente_accesos_gestionar on public.expediente_accesos
  for all using (public.puede_editar_expediente(expediente_id))
  with check (public.puede_editar_expediente(expediente_id));

drop policy if exists expediente_partes_leer on public.expediente_partes;
create policy expediente_partes_leer on public.expediente_partes
  for select using (public.puede_ver_expediente(expediente_id));

drop policy if exists expediente_partes_escribir on public.expediente_partes;
create policy expediente_partes_escribir on public.expediente_partes
  for all using (public.puede_editar_expediente(expediente_id))
  with check (public.puede_editar_expediente(expediente_id));

drop policy if exists expediente_etapas_leer on public.expediente_etapas;
create policy expediente_etapas_leer on public.expediente_etapas
  for select using (public.puede_ver_expediente(expediente_id));

drop policy if exists expediente_etapas_escribir on public.expediente_etapas;
create policy expediente_etapas_escribir on public.expediente_etapas
  for all using (public.puede_editar_expediente(expediente_id))
  with check (public.puede_editar_expediente(expediente_id));

-- =============================================================================
-- FIN — 0003
-- =============================================================================
