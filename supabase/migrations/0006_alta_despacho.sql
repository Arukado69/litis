-- =============================================================================
-- Litis — Migración 0006: Alta de despacho en una sola transacción
-- =============================================================================
-- ─────────────────────────────────────────────────────────────────────────────
-- EL PROBLEMA DEL HUEVO Y LA GALLINA
-- ─────────────────────────────────────────────────────────────────────────────
-- Quien acaba de registrarse tiene cuenta de auth pero ninguna membresía, así
-- que no pasa ninguna política: no puede crear su propio despacho. Hay dos
-- salidas y solo una es buena.
--
--   ✗ Hacerlo desde la aplicación con la clave de servicio. Funciona, pero
--     mete un camino que salta TODA la RLS en el flujo más expuesto del
--     sistema —una pantalla pública sin sesión— y con eso cualquier descuido
--     ahí se vuelve acceso total a la base de todos los despachos.
--
--   ✓ Esta función. Corre `security definer`, así que puede escribir, pero
--     ella misma verifica `auth.uid()` y solo actúa sobre el usuario que la
--     llama. El alcance está acotado por dentro, no por confianza en quien
--     llama.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ EL SLUG SE RESUELVE AQUÍ Y NO EN LA APLICACIÓN
-- ─────────────────────────────────────────────────────────────────────────────
-- Desempatar "perez" contra "perez-2" exige leer los slugs de TODOS los
-- despachos, y la política `despachos_leer` —con razón— solo deja ver el
-- propio. La aplicación calcula la base a partir del nombre; el desempate vive
-- aquí, que es el único lugar que puede verlos y además está dentro de la
-- transacción que inserta.
--
-- Esta es la ÚNICA implementación de la regla de numeración. Duplicarla en
-- TypeScript garantizaría que las dos versiones se separen con el tiempo.
-- =============================================================================

create or replace function public.crear_mi_despacho(
  p_nombre_titular  text,
  p_correo          text,
  p_despacho_nombre text,
  p_slug_base       text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario  uuid := (select auth.uid());
  v_despacho uuid;
  v_slug     text;
  v_n        int := 2;
begin
  if v_usuario is null then
    raise exception 'Se necesita una sesión para crear un despacho'
      using errcode = '42501';
  end if;

  -- Una cuenta pertenece a un despacho por esta vía. A los demás se entra por
  -- invitación. Sin este candado, la pantalla de registro sería una fábrica de
  -- despachos vacíos.
  if exists (select 1 from public.membresias m where m.perfil_id = v_usuario) then
    raise exception 'La cuenta ya pertenece a un despacho'
      using errcode = '23505';
  end if;

  if length(btrim(coalesce(p_despacho_nombre, ''))) < 3 then
    raise exception 'El nombre del despacho es obligatorio'
      using errcode = '22023';
  end if;

  -- Desempate del slug: perez, perez-2, perez-3… Empieza en 2 porque el
  -- original es, de hecho, el 1. Se recorta la base para no rebasar 40.
  v_slug := coalesce(nullif(btrim(p_slug_base), ''), 'despacho');
  while exists (select 1 from public.despachos d where d.slug = v_slug) loop
    if v_n > 1000 then
      raise exception 'No se halló un slug libre para %', p_slug_base
        using errcode = '23505';
    end if;
    v_slug := regexp_replace(
      left(coalesce(nullif(btrim(p_slug_base), ''), 'despacho'),
           40 - (length(v_n::text) + 1)),
      '-+$', ''
    ) || '-' || v_n;
    v_n := v_n + 1;
  end loop;

  -- El perfil puede existir ya (registro reintentado, o alta por invitación
  -- previa), así que se hace upsert en vez de insert.
  insert into public.perfiles (id, nombre, correo)
  values (v_usuario, btrim(p_nombre_titular), lower(btrim(p_correo)))
  on conflict (id) do update
    set nombre = excluded.nombre,
        correo = excluded.correo;

  insert into public.despachos (nombre, slug)
  values (btrim(p_despacho_nombre), v_slug)
  returning id into v_despacho;

  -- Quien crea el despacho es su titular. No hay despacho sin titular.
  insert into public.membresias (despacho_id, perfil_id, rol, estado)
  values (v_despacho, v_usuario, 'titular', 'activa');

  return v_despacho;
end;
$$;

-- Se cierra a todo el mundo y se abre solo a las sesiones autenticadas. Una
-- función security definer accesible a `anon` sería escribible sin cuenta.
revoke all on function public.crear_mi_despacho(text, text, text, text) from public;
revoke all on function public.crear_mi_despacho(text, text, text, text) from anon;
grant execute on function public.crear_mi_despacho(text, text, text, text) to authenticated;

comment on function public.crear_mi_despacho(text, text, text, text) is
  'Crea perfil, despacho y membresía de titular en una transacción para el usuario de la sesión. Resuelve la colisión de slug.';

-- =============================================================================
-- FIN — 0006
-- =============================================================================
