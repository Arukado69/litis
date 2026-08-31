-- =============================================================================
-- Litis — Migración 0009: Invitaciones al despacho
-- =============================================================================
-- Hasta aquí, una cuenta llega a un despacho por una sola vía: creándolo. Un
-- despacho de tres personas necesita la otra — que el titular meta a los demás.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ UNA TABLA APARTE Y NO UNA MEMBRESÍA 'invitada'
-- ─────────────────────────────────────────────────────────────────────────────
-- `membresias.perfil_id` apunta a `perfiles`, que apunta a `auth.users`. Quien
-- todavía no tiene cuenta no tiene fila ahí, así que no se le puede crear la
-- membresía por adelantado. La invitación vive por su cuenta hasta que alguien
-- la acepta; ahí nace la membresía.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL TOKEN SE GUARDA HASHEADO. SIEMPRE.
-- ─────────────────────────────────────────────────────────────────────────────
-- El token es la credencial que abre un despacho entero: todos los expedientes,
-- los datos de los clientes, los términos. Guardarlo en claro significa que
-- cualquiera que llegue a leer esta tabla —un respaldo viejo, una consulta mal
-- hecha, una fuga— puede entrar a cualquier despacho con invitación pendiente.
--
-- Aquí solo vive el sha-256. El token en claro existe una vez, en la respuesta
-- de la Server Action que lo generó, y de ahí se va al correo. Ni la base ni
-- los registros lo vuelven a ver. Perder el enlace significa reinvitar, que es
-- exactamente el comportamiento correcto.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CADUCA
-- ─────────────────────────────────────────────────────────────────────────────
-- Un enlace eterno en un correo de hace dos años es una puerta abierta a la que
-- nadie está viendo. Siete días: alcanza para que alguien conteste su correo y
-- no alcanza para olvidarse.
-- =============================================================================

do $$ begin
  create type public.estado_invitacion as enum (
    'pendiente',
    'aceptada',
    'revocada'   -- el titular se arrepintió, o la persona ya no va a entrar
  );
exception when duplicate_object then null; end $$;


create table if not exists public.invitaciones (
  id           uuid primary key default gen_random_uuid(),
  despacho_id  uuid not null references public.despachos(id) on delete cascade,

  -- A quién se invitó. En minúsculas y recortado: se compara contra el correo
  -- de la sesión al aceptar, y "Nadia@X.com" no debe fallar contra "nadia@x.com".
  correo       text not null,
  rol          public.rol_membresia not null default 'abogado',

  -- sha-256 del token en hexadecimal. NUNCA el token.
  token_hash   text not null,

  estado       public.estado_invitacion not null default 'pendiente',
  expira_el    timestamptz not null,

  invitada_por uuid references public.perfiles(id) on delete set null,
  aceptada_el  timestamptz,
  aceptada_por uuid references public.perfiles(id) on delete set null,
  creado_el    timestamptz not null default now(),

  constraint invitaciones_correo_valido check (position('@' in correo) > 1),
  -- El titular no se invita: se es titular por crear el despacho, y transferir
  -- la titularidad es otra operación con otras consecuencias.
  constraint invitaciones_rol_invitable check (rol <> 'titular'),
  constraint invitaciones_token_hash check (token_hash ~ '^[0-9a-f]{64}$')
);

-- Una sola invitación pendiente por correo y despacho. Sin esto, reinvitar
-- cinco veces deja cinco enlaces vivos, y revocar uno no cierra los otros
-- cuatro.
create unique index if not exists invitaciones_pendiente_unica
  on public.invitaciones (despacho_id, lower(correo))
  where estado = 'pendiente';

-- Por donde entra la aceptación.
create unique index if not exists invitaciones_token_idx
  on public.invitaciones (token_hash);


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
alter table public.invitaciones enable row level security;

-- Las lee y las escribe el TITULAR de ese despacho, nadie más. Un abogado que
-- pudiera invitar podría meter a quien quisiera a ver todos los expedientes
-- del despacho, incluidos los restringidos que no son suyos.
drop policy if exists invitaciones_titular on public.invitaciones;
create policy invitaciones_titular on public.invitaciones
  for all using (public.tiene_rol(despacho_id, array['titular']::public.rol_membresia[]))
  with check (public.tiene_rol(despacho_id, array['titular']::public.rol_membresia[]));

-- Quien acepta NO lee esta tabla: no tiene membresía todavía, así que ninguna
-- política lo deja. La aceptación entra por la función de abajo.


-- ---------------------------------------------------------------------------
-- ACEPTAR UNA INVITACIÓN
-- ---------------------------------------------------------------------------
-- El mismo huevo y la gallina que en la 0006: quien acepta no pertenece a
-- ningún despacho, así que no pasa ninguna política. `security definer`, con el
-- alcance acotado por dentro.
--
-- ⚠️ **Se exige que el correo de la sesión coincida con el invitado.** El
-- enlace por sí solo NO basta. Un enlace reenviado —a propósito o por
-- descuido— le daría a un tercero acceso a los expedientes, los datos fiscales
-- y los términos de los clientes de un despacho. El titular invitó a una
-- persona concreta; que entre esa.
-- ---------------------------------------------------------------------------

create or replace function public.aceptar_invitacion(
  p_token_hash text,
  p_nombre     text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_correo  text;
  v_inv     public.invitaciones%rowtype;
begin
  if v_usuario is null then
    raise exception 'Se necesita una sesión para aceptar una invitación'
      using errcode = '42501';
  end if;

  select lower(btrim(u.email)) into v_correo
  from auth.users u where u.id = v_usuario;

  -- `for update` para que dos pestañas no acepten la misma invitación y creen
  -- dos membresías, o peor, una membresía y un error a medio camino.
  select * into v_inv
  from public.invitaciones i
  where i.token_hash = p_token_hash
  for update;

  if not found then
    raise exception 'La invitación no existe' using errcode = 'P0002';
  end if;

  if v_inv.estado <> 'pendiente' then
    raise exception 'La invitación ya no está vigente' using errcode = 'P0002';
  end if;

  if v_inv.expira_el < now() then
    raise exception 'La invitación caducó' using errcode = 'P0002';
  end if;

  if lower(btrim(v_inv.correo)) is distinct from v_correo then
    raise exception 'La invitación es para otro correo' using errcode = '42501';
  end if;

  -- Una cuenta pertenece a UN despacho. Cambiar de despacho es darse de baja
  -- del anterior; aceptar una invitación con la sesión de otro despacho abierta
  -- dejaría a la persona viendo dos padrones a la vez, y el conflicto de
  -- interés se calcula por despacho.
  if exists (select 1 from public.membresias m where m.perfil_id = v_usuario) then
    raise exception 'La cuenta ya pertenece a un despacho' using errcode = '23505';
  end if;

  insert into public.perfiles (id, nombre, correo)
  values (v_usuario, btrim(p_nombre), v_correo)
  on conflict (id) do update
    set nombre = case
                   when length(btrim(excluded.nombre)) > 0 then excluded.nombre
                   else public.perfiles.nombre
                 end,
        correo = excluded.correo;

  insert into public.membresias (despacho_id, perfil_id, rol, estado, invitada_por)
  values (v_inv.despacho_id, v_usuario, v_inv.rol, 'activa', v_inv.invitada_por);

  update public.invitaciones
  set estado = 'aceptada', aceptada_el = now(), aceptada_por = v_usuario
  where id = v_inv.id;

  return v_inv.despacho_id;
end;
$$;

revoke all on function public.aceptar_invitacion(text, text) from public;
revoke all on function public.aceptar_invitacion(text, text) from anon;
grant execute on function public.aceptar_invitacion(text, text) to authenticated;

comment on function public.aceptar_invitacion(text, text) is
  'Convierte una invitación vigente en membresía para el usuario de la sesión. Exige que el correo de la sesión coincida con el invitado.';


-- ---------------------------------------------------------------------------
-- QUÉ VE QUIEN LLEGA CON UN ENLACE
-- ---------------------------------------------------------------------------
-- Antes de pedirle que se registre hay que decirle a qué despacho lo invitan y
-- con qué papel; si no, la pantalla es "crea una cuenta" sin contexto y nadie
-- la completa. Pero esa persona no puede leer la tabla.
--
-- Esta función devuelve lo MÍNIMO —nombre del despacho, rol, correo invitado y
-- vigencia—, y solo contra el hash del token, que ya es la credencial. No
-- expone ni el id del despacho ni quién invitó.
-- ---------------------------------------------------------------------------

create or replace function public.mirar_invitacion(p_token_hash text)
returns table (
  despacho_nombre text,
  correo          text,
  rol             public.rol_membresia,
  vigente         boolean
)
language sql
security definer
set search_path = ''
as $$
  select d.nombre,
         i.correo,
         i.rol,
         (i.estado = 'pendiente' and i.expira_el >= now())
  from public.invitaciones i
  join public.despachos d on d.id = i.despacho_id
  where i.token_hash = p_token_hash;
$$;

revoke all on function public.mirar_invitacion(text) from public;
grant execute on function public.mirar_invitacion(text) to anon, authenticated;

comment on function public.mirar_invitacion(text) is
  'Datos mínimos de una invitación para pintar la pantalla de aceptación, sin exponer la tabla.';

-- =============================================================================
-- FIN — 0009
-- =============================================================================
