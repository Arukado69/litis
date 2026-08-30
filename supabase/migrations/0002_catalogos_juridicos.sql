-- =============================================================================
-- Litis — Migración 0002: Catálogos jurídicos
-- =============================================================================
-- Órganos jurisdiccionales, calendarios de días inhábiles y el catálogo de
-- plazos, con su rastro de verificación.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL PATRÓN `despacho_id IS NULL` = CATÁLOGO COMPARTIDO
-- ─────────────────────────────────────────────────────────────────────────────
-- Estas tablas conviven en dos capas:
--
--   · `despacho_id IS NULL`  → catálogo del sistema, de solo lectura para
--     todos. Es la semilla que evita que cada despacho capture desde cero los
--     mismos 40 juzgados y los mismos feriados.
--   · `despacho_id = <uuid>` → lo que ese despacho agregó o corrigió. Solo él
--     lo ve y solo él lo edita.
--
-- Un catálogo compartido y editable por cualquiera sería peor que no tenerlo:
-- un despacho podría corromper el calendario de otro y hacerle perder un
-- término. Por eso la semilla es inmutable desde la aplicación y las
-- correcciones nacen como filas propias del despacho.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- LA VERIFICACIÓN ES UN DATO, NO UN COMENTARIO
-- ─────────────────────────────────────────────────────────────────────────────
-- Ningún plazo de fábrica puede presentarse como verdad: los ordenamientos se
-- reforman y el Código Nacional de Procedimientos Civiles y Familiares está
-- desplazando a los códigos locales de forma escalonada hasta 2027. Así que
-- cada entrada guarda quién la verificó y cuándo. Mientras eso esté vacío, la
-- interfaz muestra el cómputo marcado como no verificado.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) ENUMERACIONES
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.fuero as enum ('federal', 'comun');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.motivo_inhabil as enum ('feriado', 'vacaciones', 'suspension');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 2) CALENDARIOS DE DÍAS INHÁBILES
-- ---------------------------------------------------------------------------

create table if not exists public.calendarios (
  id                   uuid primary key default gen_random_uuid(),
  -- NULL = calendario compartido del sistema.
  despacho_id          uuid references public.despachos(id) on delete cascade,
  nombre               text not null,
  -- Fuera de este rango el motor no puede prometer nada y lo dice.
  vigencia_desde       date not null,
  vigencia_hasta       date not null,
  fin_de_semana_inhabil boolean not null default true,
  notas                text,
  creado_el            timestamptz not null default now(),
  constraint calendarios_vigencia_coherente check (vigencia_hasta >= vigencia_desde)
);

create index if not exists calendarios_despacho_idx on public.calendarios (despacho_id);

create table if not exists public.dias_inhabiles (
  id            uuid primary key default gen_random_uuid(),
  calendario_id uuid not null references public.calendarios(id) on delete cascade,
  -- Un solo día se guarda con desde = hasta. Así los feriados sueltos y los
  -- periodos vacacionales usan la misma forma y no hay dos caminos que probar.
  desde         date not null,
  hasta         date not null,
  motivo        public.motivo_inhabil not null,
  descripcion   text not null,
  fundamento    text,
  constraint dias_inhabiles_rango_coherente check (hasta >= desde)
);

create index if not exists dias_inhabiles_calendario_idx
  on public.dias_inhabiles (calendario_id, desde);


-- ---------------------------------------------------------------------------
-- 3) ÓRGANOS JURISDICCIONALES
-- ---------------------------------------------------------------------------

create table if not exists public.organos (
  id            uuid primary key default gen_random_uuid(),
  despacho_id   uuid references public.despachos(id) on delete cascade,
  -- "Juzgado Décimo Segundo de lo Civil de la Ciudad de México"
  nombre        text not null,
  fuero         public.fuero not null,
  entidad       text,
  -- Distrito o circuito judicial.
  distrito      text,
  materia       text,
  -- Cada órgano tiene SU calendario: los periodos vacacionales de un tribunal
  -- local no coinciden con los del Poder Judicial de la Federación, y de ahí
  -- salen los cómputos equivocados que nadie detecta hasta que es tarde.
  calendario_id uuid references public.calendarios(id) on delete set null,
  domicilio     text,
  -- Hora de cierre de oficialía de partes. Un plazo no vence a medianoche si
  -- hay que presentar en ventanilla.
  cierre_oficialia time,
  notas         text,
  creado_el     timestamptz not null default now()
);

create index if not exists organos_despacho_idx on public.organos (despacho_id);
create index if not exists organos_busqueda_idx on public.organos (fuero, entidad);


-- ---------------------------------------------------------------------------
-- 4) CATÁLOGO DE PLAZOS Y SU VERIFICACIÓN
-- ---------------------------------------------------------------------------

create table if not exists public.plazos_catalogo (
  id             uuid primary key default gen_random_uuid(),
  despacho_id    uuid references public.despachos(id) on delete cascade,
  -- Llave estable del catálogo semilla en código (p. ej. 'merc.contestacion.ordinario').
  clave          text,
  regimen        text not null,
  etiqueta       text not null,
  dias           int not null,
  unidad         text not null default 'habiles',
  fundamento     text not null,
  nota           text,

  -- El rastro de verificación. Vacío = de fábrica, y así se muestra.
  verificado_por uuid references public.perfiles(id) on delete set null,
  verificado_el  timestamptz,
  -- Qué revisó y contra qué texto. Sin esto, "verificado" no significa nada
  -- dentro de seis meses.
  verificacion_notas text,

  creado_el      timestamptz not null default now(),
  actualizado_el timestamptz not null default now(),

  constraint plazos_catalogo_dias_validos check (dias >= 1),
  constraint plazos_catalogo_unidad_valida check (unidad in ('habiles', 'naturales')),
  -- Si hay verificador tiene que haber fecha, y viceversa: media verificación
  -- es peor que ninguna porque aparenta rigor.
  constraint plazos_catalogo_verificacion_completa check (
    (verificado_por is null and verificado_el is null)
    or (verificado_por is not null and verificado_el is not null)
  )
);

create index if not exists plazos_catalogo_despacho_idx
  on public.plazos_catalogo (despacho_id, regimen);

drop trigger if exists plazos_catalogo_tocar on public.plazos_catalogo;
create trigger plazos_catalogo_tocar before update on public.plazos_catalogo
  for each row execute function public.tocar_actualizado_el();

-- Verificación de las REGLAS de cómputo por régimen (cuándo surte efectos una
-- notificación). Las reglas viven en código porque son lógica; su estado de
-- verificación vive aquí porque es del despacho.
create table if not exists public.regimenes_verificados (
  id             uuid primary key default gen_random_uuid(),
  despacho_id    uuid not null references public.despachos(id) on delete cascade,
  regimen        text not null,
  verificado_por uuid not null references public.perfiles(id) on delete restrict,
  verificado_el  timestamptz not null default now(),
  notas          text,
  unique (despacho_id, regimen)
);


-- ---------------------------------------------------------------------------
-- 5) ROW LEVEL SECURITY
--    Patrón repetido: se lee la semilla compartida (despacho_id is null) más
--    lo propio; solo se escribe lo propio.
-- ---------------------------------------------------------------------------
alter table public.calendarios          enable row level security;
alter table public.dias_inhabiles       enable row level security;
alter table public.organos              enable row level security;
alter table public.plazos_catalogo      enable row level security;
alter table public.regimenes_verificados enable row level security;

drop policy if exists calendarios_leer on public.calendarios;
create policy calendarios_leer on public.calendarios
  for select using (despacho_id is null or public.es_miembro(despacho_id));

drop policy if exists calendarios_escribir on public.calendarios;
create policy calendarios_escribir on public.calendarios
  for all using (despacho_id is not null and public.es_personal(despacho_id))
  with check (despacho_id is not null and public.es_personal(despacho_id));

-- Los días heredan el permiso de su calendario.
drop policy if exists dias_inhabiles_leer on public.dias_inhabiles;
create policy dias_inhabiles_leer on public.dias_inhabiles
  for select using (
    exists (
      select 1 from public.calendarios c
      where c.id = calendario_id
        and (c.despacho_id is null or public.es_miembro(c.despacho_id))
    )
  );

drop policy if exists dias_inhabiles_escribir on public.dias_inhabiles;
create policy dias_inhabiles_escribir on public.dias_inhabiles
  for all using (
    exists (
      select 1 from public.calendarios c
      where c.id = calendario_id
        and c.despacho_id is not null
        and public.es_personal(c.despacho_id)
    )
  )
  with check (
    exists (
      select 1 from public.calendarios c
      where c.id = calendario_id
        and c.despacho_id is not null
        and public.es_personal(c.despacho_id)
    )
  );

drop policy if exists organos_leer on public.organos;
create policy organos_leer on public.organos
  for select using (despacho_id is null or public.es_miembro(despacho_id));

drop policy if exists organos_escribir on public.organos;
create policy organos_escribir on public.organos
  for all using (despacho_id is not null and public.es_personal(despacho_id))
  with check (despacho_id is not null and public.es_personal(despacho_id));

drop policy if exists plazos_catalogo_leer on public.plazos_catalogo;
create policy plazos_catalogo_leer on public.plazos_catalogo
  for select using (despacho_id is null or public.es_miembro(despacho_id));

-- Solo quien puede firmar verifica un plazo. Un asistente captura expedientes;
-- declarar que un plazo legal es correcto es acto de abogado.
drop policy if exists plazos_catalogo_escribir on public.plazos_catalogo;
create policy plazos_catalogo_escribir on public.plazos_catalogo
  for all using (
    despacho_id is not null
    and public.tiene_rol(despacho_id, array['titular','abogado']::public.rol_membresia[])
  )
  with check (
    despacho_id is not null
    and public.tiene_rol(despacho_id, array['titular','abogado']::public.rol_membresia[])
  );

drop policy if exists regimenes_verificados_leer on public.regimenes_verificados;
create policy regimenes_verificados_leer on public.regimenes_verificados
  for select using (public.es_miembro(despacho_id));

drop policy if exists regimenes_verificados_escribir on public.regimenes_verificados;
create policy regimenes_verificados_escribir on public.regimenes_verificados
  for all using (
    public.tiene_rol(despacho_id, array['titular','abogado']::public.rol_membresia[])
  )
  with check (
    public.tiene_rol(despacho_id, array['titular','abogado']::public.rol_membresia[])
  );

-- =============================================================================
-- FIN — 0002
-- =============================================================================
