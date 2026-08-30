-- =============================================================================
-- Litis — Migración 0007: Apertura de expediente en una sola transacción
-- =============================================================================
-- ─────────────────────────────────────────────────────────────────────────────
-- POR QUÉ UNA FUNCIÓN Y NO TRES INSERTS DESDE LA APLICACIÓN
-- ─────────────────────────────────────────────────────────────────────────────
-- Abrir un expediente escribe tres tablas: `expedientes`, `expediente_partes` y
-- `expediente_etapas`. Hechos por separado, si el segundo falla queda un
-- expediente sin partes — y un expediente sin parte propia rompe la invariante
-- del dominio: no se sabe desde qué lado corren los plazos. Es basura que
-- además aparece en los listados.
--
-- Aquí las tres van en la misma transacción: o quedan las tres, o ninguna.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- `security invoker`, NO `definer`
-- ─────────────────────────────────────────────────────────────────────────────
-- A diferencia de `crear_mi_despacho` —que existe porque el usuario todavía no
-- tiene membresía y no puede pasar ninguna política—, aquí quien llama YA es
-- personal del despacho. La RLS puede y debe aplicar tal cual: las tres
-- inserciones pasan por `expedientes_crear` y `expediente_*_escribir`.
--
-- Usar `definer` habría sido más cómodo y habría abierto un agujero: cualquier
-- error en la validación de parámetros se convertiría en escritura sobre
-- despachos ajenos. Con `invoker`, aunque alguien llamara la función con un
-- `p_despacho_id` de otro despacho, la política lo rechaza.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- EL CONSECUTIVO SE CALCULA AQUÍ, Y CON REINTENTO
-- ─────────────────────────────────────────────────────────────────────────────
-- Dos personas del mismo despacho abriendo un expediente en el mismo segundo
-- leerían las dos el mismo máximo y pedirían el mismo `2026-005`. El índice
-- único lo impide, pero sin reintento una de las dos ve un error feo por algo
-- que el sistema puede resolver solo.
--
-- Esta es la ÚNICA implementación de la numeración. Tenerla también en
-- TypeScript garantizaría que las dos versiones se separen con el tiempo, y
-- además la de TypeScript no podría ser transaccional.
-- =============================================================================

create or replace function public.abrir_expediente(
  p_despacho_id        uuid,
  p_caratula           text,
  p_materia            text,
  p_via                text,
  p_fuero              public.fuero,
  -- [{persona_id, rol, es_nuestra_parte, abogado_contrario, notas}]
  p_partes             jsonb,
  -- [{clave, nombre, descripcion, orden, paralela}]
  p_etapas             jsonb,
  p_etapa_actual       text    default null,
  p_cliente_persona_id uuid    default null,
  p_entidad            text    default null,
  p_organo_id          uuid    default null,
  p_numero_organo      text    default null,
  p_instancia          text    default null,
  p_cuantia            numeric default null,
  p_responsable_id     uuid    default null,
  p_restringido        boolean default false,
  p_fecha_inicio       date    default null,
  p_notas              text    default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expediente  uuid;
  v_anio        int := extract(year from coalesce(p_fecha_inicio, current_date));
  v_consecutivo int;
  v_numero      text;
  v_intentos    int := 0;
begin
  if jsonb_typeof(p_partes) <> 'array' or jsonb_array_length(p_partes) = 0 then
    raise exception 'El expediente necesita al menos una parte'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_etapas) <> 'array' or jsonb_array_length(p_etapas) = 0 then
    raise exception 'El expediente necesita sus etapas'
      using errcode = '22023';
  end if;

  loop
    -- Se recalcula en cada vuelta: si otra alta se metió en medio, el máximo
    -- ya cambió.
    select coalesce(
             max((regexp_match(e.numero_interno, '^(\d{4})-(\d+)$'))[2]::int),
             0
           )
      into v_consecutivo
      from public.expedientes e
     where e.despacho_id = p_despacho_id
       and e.numero_interno like v_anio::text || '-%';

    v_numero := v_anio::text || '-' || lpad((v_consecutivo + 1)::text, 3, '0');

    begin
      insert into public.expedientes (
        despacho_id, numero_interno, numero_organo, caratula,
        cliente_persona_id, materia, via, fuero, entidad, organo_id,
        instancia, etapa_actual, cuantia, responsable_id, restringido,
        fecha_inicio, notas, creado_por
      ) values (
        p_despacho_id, v_numero, nullif(btrim(p_numero_organo), ''), btrim(p_caratula),
        p_cliente_persona_id, p_materia, p_via, p_fuero, nullif(btrim(p_entidad), ''),
        p_organo_id, nullif(btrim(p_instancia), ''), p_etapa_actual, p_cuantia,
        p_responsable_id, coalesce(p_restringido, false),
        p_fecha_inicio, nullif(btrim(p_notas), ''), (select auth.uid())
      )
      returning id into v_expediente;

      exit;
    exception when unique_violation then
      -- Solo puede venir de (despacho_id, numero_interno): otra alta ganó la
      -- carrera. Se vuelve a intentar con el siguiente número.
      v_intentos := v_intentos + 1;
      if v_intentos > 5 then
        raise exception 'No se pudo asignar número interno tras % intentos', v_intentos
          using errcode = '40001';
      end if;
    end;
  end loop;

  insert into public.expediente_partes (
    expediente_id, persona_id, rol, es_nuestra_parte, abogado_contrario, notas
  )
  select
    v_expediente,
    (parte->>'persona_id')::uuid,
    parte->>'rol',
    coalesce((parte->>'es_nuestra_parte')::boolean, false),
    nullif(btrim(coalesce(parte->>'abogado_contrario', '')), ''),
    nullif(btrim(coalesce(parte->>'notas', '')), '')
  from jsonb_array_elements(p_partes) as parte;

  insert into public.expediente_etapas (
    expediente_id, clave, nombre, descripcion, orden, paralela
  )
  select
    v_expediente,
    etapa->>'clave',
    etapa->>'nombre',
    nullif(btrim(coalesce(etapa->>'descripcion', '')), ''),
    (etapa->>'orden')::int,
    coalesce((etapa->>'paralela')::boolean, false)
  from jsonb_array_elements(p_etapas) as etapa;

  return v_expediente;
end;
$$;

revoke all on function public.abrir_expediente(
  uuid, text, text, text, public.fuero, jsonb, jsonb, text, uuid, text, uuid,
  text, text, numeric, uuid, boolean, date, text
) from public;
revoke all on function public.abrir_expediente(
  uuid, text, text, text, public.fuero, jsonb, jsonb, text, uuid, text, uuid,
  text, text, numeric, uuid, boolean, date, text
) from anon;
grant execute on function public.abrir_expediente(
  uuid, text, text, text, public.fuero, jsonb, jsonb, text, uuid, text, uuid,
  text, text, numeric, uuid, boolean, date, text
) to authenticated;

comment on function public.abrir_expediente is
  'Crea expediente, partes y etapas en una transacción. Asigna el consecutivo interno del año con reintento ante carrera. security invoker: la RLS aplica.';

-- =============================================================================
-- FIN — 0007
-- =============================================================================
