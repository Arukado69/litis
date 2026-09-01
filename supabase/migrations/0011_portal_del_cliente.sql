-- =============================================================================
-- Litis — Migración 0011: Acceso del cliente al portal
-- =============================================================================
-- La RLS para el cliente existe desde la `0003`: ve los expedientes donde
-- `cliente_persona_id` coincide con SU persona del padrón, y de la bitácora,
-- los documentos y las audiencias solo lo marcado `visible_cliente`.
--
-- Lo que faltaba era la puerta. La `0009` sabe invitar personal, pero una
-- membresía de cliente necesita además a QUÉ PERSONA del padrón corresponde:
-- sin `persona_id`, `persona_del_usuario()` devuelve null y ese cliente entra
-- al portal a no ver absolutamente nada.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ LA PERSONA SE FIJA EN LA INVITACIÓN Y NO AL ACEPTAR
-- ─────────────────────────────────────────────────────────────────────────────
-- Es el despacho quien sabe que este correo es el del representante legal de
-- Constructora XYZ. Si la persona se eligiera al aceptar, quien recibe el
-- enlace podría —por error o a propósito— vincularse a otro cliente del padrón
-- y leer un expediente ajeno. La eligió quien invitó; el enlace solo la
-- transporta.
-- =============================================================================

alter table public.invitaciones
  add column if not exists persona_id uuid references public.personas(id) on delete cascade;

comment on column public.invitaciones.persona_id is
  'Solo en invitaciones de rol cliente: a qué persona del padrón se vincula.';

-- Un cliente SIN persona es un cliente que no puede ver nada, y una invitación
-- de personal CON persona es un dato que confunde. Se cierra por los dos lados.
alter table public.invitaciones
  drop constraint if exists invitaciones_persona_coherente;
alter table public.invitaciones
  add constraint invitaciones_persona_coherente check (
    (rol = 'cliente' and persona_id is not null)
    or (rol <> 'cliente' and persona_id is null)
  );


-- ---------------------------------------------------------------------------
-- ACEPTAR, AHORA TAMBIÉN PARA CLIENTES
-- ---------------------------------------------------------------------------
-- Mismo contrato que la `0009` —correo que coincide, vigencia, una cuenta un
-- despacho—, más el traslado de `persona_id` a la membresía.
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

  -- La persona viaja desde la invitación, NUNCA desde quien acepta. Ver el
  -- encabezado: elegirla al aceptar dejaría que alguien se vincule a otro
  -- cliente del padrón y lea un expediente ajeno.
  insert into public.membresias
    (despacho_id, perfil_id, rol, estado, invitada_por, persona_id)
  values
    (v_inv.despacho_id, v_usuario, v_inv.rol, 'activa', v_inv.invitada_por,
     v_inv.persona_id);

  update public.invitaciones
  set estado = 'aceptada', aceptada_el = now(), aceptada_por = v_usuario
  where id = v_inv.id;

  return v_inv.despacho_id;
end;
$$;

revoke all on function public.aceptar_invitacion(text, text) from public;
revoke all on function public.aceptar_invitacion(text, text) from anon;
grant execute on function public.aceptar_invitacion(text, text) to authenticated;


-- ---------------------------------------------------------------------------
-- LO QUE EL CLIENTE **NO** VE, DICHO OTRA VEZ
-- ---------------------------------------------------------------------------
-- `plazos` no tiene política para clientes y no la va a tener (ver la `0005`).
-- El cliente ve el avance de su asunto y sus audiencias; la lista de términos
-- que su abogado trae encima es información que no puede interpretar y que solo
-- produce llamadas de angustia a las once de la noche.
--
-- Esta migración NO abre nada nuevo de lectura: se apoya en las políticas que
-- ya existen desde la `0003` y la `0004`.
-- =============================================================================
-- FIN — 0011
-- =============================================================================
