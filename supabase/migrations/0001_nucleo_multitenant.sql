-- =============================================================================
-- Litis — Migración 0001: Núcleo multi-tenant
-- =============================================================================
-- Despachos, personas del despacho, membresías y las funciones de seguridad
-- sobre las que se apoya TODA la RLS del sistema.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EL MULTI-TENANT ES LA MIGRACIÓN 0001 Y NO LA 0038
-- ─────────────────────────────────────────────────────────────────────────────
-- Añadir `despacho_id` después significa reescribir cada política de cada
-- tabla, y basta que una se quede sin reescribir para que un despacho vea los
-- expedientes de otro. En cualquier producto eso sería una fuga de datos; aquí
-- además es una violación del secreto profesional del abogado, que responde
-- por ella ante su cliente y ante su barra.
--
-- Así que el aislamiento es la base, no una capa encima: ninguna tabla de
-- dominio existe sin `despacho_id`, y ninguna política se escribe sin filtrar
-- por él.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ LAS FUNCIONES SON `security definer`
-- ─────────────────────────────────────────────────────────────────────────────
-- Una política sobre `membresias` que consulte `membresias` para saber si
-- puedes leer `membresias` es recursión infinita, y Postgres la corta con un
-- error en tiempo de consulta. Las funciones auxiliares corren con los
-- permisos del dueño, saltan la RLS y rompen el ciclo. Por eso llevan
-- `set search_path = ''` y referencias calificadas: una función security
-- definer con search_path abierto es un vector de escalación de privilegios.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1) ENUMERACIONES
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.rol_membresia as enum (
    'titular',    -- dueño del despacho: factura, invita y da de baja
    'abogado',    -- lleva expedientes con firma
    'pasante',    -- apoya, sin facultad de cerrar etapas críticas
    'asistente',  -- captura y agenda
    'cliente'     -- portal de solo lectura de SUS expedientes
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.estado_membresia as enum ('invitada', 'activa', 'suspendida');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.plan_suscripcion as enum ('gratuito', 'profesional', 'despacho');
exception when duplicate_object then null; end $$;


-- ---------------------------------------------------------------------------
-- 2) TABLAS
-- ---------------------------------------------------------------------------

-- 2.1 despachos — el inquilino. Todo cuelga de aquí.
create table if not exists public.despachos (
  id                uuid primary key default gen_random_uuid(),
  nombre            text not null,
  -- Identificador para URLs y correos. Único en todo el sistema.
  slug              text not null unique,
  rfc               text,
  -- Sede principal; determina el calendario de inhábiles por omisión.
  entidad           text,
  telefono          text,
  correo_contacto   text,

  plan              public.plan_suscripcion not null default 'gratuito',
  -- Se cobra por usuario/mes. El nivel gratuito tiene tope de asientos y de
  -- expedientes activos; se valida en la aplicación y se apoya aquí.
  asientos_incluidos int not null default 1,
  expedientes_tope   int,

  creado_el         timestamptz not null default now(),
  actualizado_el    timestamptz not null default now()
);

comment on column public.despachos.expedientes_tope is
  'Tope de expedientes activos del plan. NULL = sin tope.';

-- 2.2 perfiles — extiende auth.users. NO lleva rol: el rol vive en la
--     membresía, porque una misma persona puede ser abogado en un despacho y
--     cliente en otro.
create table if not exists public.perfiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  nombre         text not null default '',
  correo         text,
  telefono       text,
  -- Cédula profesional: se muestra en escritos y sirve para distinguir a quien
  -- puede firmar de quien no.
  cedula         text,
  creado_el      timestamptz not null default now(),
  actualizado_el timestamptz not null default now()
);

-- 2.3 membresias — la relación persona ↔ despacho, con su rol.
create table if not exists public.membresias (
  id           uuid primary key default gen_random_uuid(),
  despacho_id  uuid not null references public.despachos(id) on delete cascade,
  perfil_id    uuid not null references public.perfiles(id) on delete cascade,
  rol          public.rol_membresia not null default 'abogado',
  estado       public.estado_membresia not null default 'activa',
  -- Solo para rol 'cliente': a qué persona del padrón corresponde.
  -- La llave foránea se agrega en la 0003, cuando existe `personas`.
  persona_id   uuid,
  invitada_por uuid references public.perfiles(id) on delete set null,
  creado_el    timestamptz not null default now(),
  unique (despacho_id, perfil_id)
);

create index if not exists membresias_perfil_idx on public.membresias (perfil_id);
create index if not exists membresias_despacho_idx on public.membresias (despacho_id);


-- ---------------------------------------------------------------------------
-- 3) FUNCIONES DE SEGURIDAD
--    Base de toda la RLS. `security definer` + `search_path = ''` + nombres
--    calificados: sin eso, cualquiera que pueda crear un objeto en el
--    search_path podría secuestrar la resolución de nombres dentro de la
--    función y correr código con permisos del dueño.
-- ---------------------------------------------------------------------------

-- 3.1 Los despachos donde el usuario tiene membresía ACTIVA.
create or replace function public.despachos_del_usuario()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select m.despacho_id
  from public.membresias m
  where m.perfil_id = (select auth.uid())
    and m.estado = 'activa';
$$;

-- 3.2 ¿Es miembro activo de ese despacho?
create or replace function public.es_miembro(p_despacho uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.membresias m
    where m.despacho_id = p_despacho
      and m.perfil_id = (select auth.uid())
      and m.estado = 'activa'
  );
$$;

-- 3.3 ¿Es personal del despacho? (todo menos el rol 'cliente')
--     La distinción importa: el cliente entra al mismo sistema pero NO puede
--     ver el padrón, ni otros expedientes, ni la bitácora interna.
create or replace function public.es_personal(p_despacho uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.membresias m
    where m.despacho_id = p_despacho
      and m.perfil_id = (select auth.uid())
      and m.estado = 'activa'
      and m.rol <> 'cliente'
  );
$$;

-- 3.4 ¿Tiene alguno de esos roles en el despacho?
create or replace function public.tiene_rol(
  p_despacho uuid,
  p_roles public.rol_membresia[]
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.membresias m
    where m.despacho_id = p_despacho
      and m.perfil_id = (select auth.uid())
      and m.estado = 'activa'
      and m.rol = any(p_roles)
  );
$$;

-- 3.5 La persona del padrón ligada a la cuenta, en ese despacho.
--     Es la llave con la que el portal del cliente filtra sus expedientes.
create or replace function public.persona_del_usuario(p_despacho uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select m.persona_id
  from public.membresias m
  where m.despacho_id = p_despacho
    and m.perfil_id = (select auth.uid())
    and m.estado = 'activa'
  limit 1;
$$;


-- ---------------------------------------------------------------------------
-- 4) `actualizado_el` automático
-- ---------------------------------------------------------------------------
create or replace function public.tocar_actualizado_el()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_el = now();
  return new;
end;
$$;

drop trigger if exists despachos_tocar on public.despachos;
create trigger despachos_tocar before update on public.despachos
  for each row execute function public.tocar_actualizado_el();

drop trigger if exists perfiles_tocar on public.perfiles;
create trigger perfiles_tocar before update on public.perfiles
  for each row execute function public.tocar_actualizado_el();


-- ---------------------------------------------------------------------------
-- 5) ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.despachos  enable row level security;
alter table public.perfiles   enable row level security;
alter table public.membresias enable row level security;

-- 5.1 despachos: se ve el propio; solo el titular lo modifica.
drop policy if exists despachos_leer on public.despachos;
create policy despachos_leer on public.despachos
  for select using (public.es_miembro(id));

drop policy if exists despachos_actualizar on public.despachos;
create policy despachos_actualizar on public.despachos
  for update using (public.tiene_rol(id, array['titular']::public.rol_membresia[]))
  with check (public.tiene_rol(id, array['titular']::public.rol_membresia[]));

-- El alta de un despacho la hace la aplicación con service role durante el
-- registro: quien todavía no tiene membresía no puede pasar ninguna política,
-- y un `with check (true)` aquí dejaría que cualquiera cree despachos a
-- discreción.

-- 5.2 perfiles: cada quien lee y edita el suyo. Además, el personal de un
--     despacho lee los perfiles de sus compañeros — sin eso no se puede
--     mostrar quién es el responsable de un expediente.
drop policy if exists perfiles_propio on public.perfiles;
create policy perfiles_propio on public.perfiles
  for all using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists perfiles_companeros on public.perfiles;
create policy perfiles_companeros on public.perfiles
  for select using (
    exists (
      select 1
      from public.membresias mia
      join public.membresias suya on suya.despacho_id = mia.despacho_id
      where mia.perfil_id = (select auth.uid())
        and mia.estado = 'activa'
        and mia.rol <> 'cliente'
        and suya.perfil_id = public.perfiles.id
        and suya.estado = 'activa'
    )
  );

-- 5.3 membresias: el personal ve las de su despacho; el titular las gestiona.
--     Todas pasan por las funciones security definer para no recursar.
drop policy if exists membresias_leer on public.membresias;
create policy membresias_leer on public.membresias
  for select using (
    perfil_id = (select auth.uid()) or public.es_personal(despacho_id)
  );

drop policy if exists membresias_gestionar on public.membresias;
create policy membresias_gestionar on public.membresias
  for all using (public.tiene_rol(despacho_id, array['titular']::public.rol_membresia[]))
  with check (public.tiene_rol(despacho_id, array['titular']::public.rol_membresia[]));

-- =============================================================================
-- FIN — 0001
-- =============================================================================
