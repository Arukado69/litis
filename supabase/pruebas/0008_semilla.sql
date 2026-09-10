-- =============================================================================
-- Pruebas de la migración 0008 — la semilla de calendarios y catálogo
-- =============================================================================
-- Sin calendario cargado el motor de plazos no computa nada, y los calendarios
-- viven en la BASE, no en el código (CLAUDE.md §5.1). Así que que la `0008`
-- corra no basta: tiene que DEJAR FILAS, y las correctas.
--
-- ⚠️ ALCANCE, Y ES IMPORTANTE ENTENDERLO. Esto corre sobre el Postgres de usar
-- y tirar de `correr.sh`, donde TODAS las migraciones se aplican siempre. Por
-- eso prueba que la `0008` **funciona**, no que esté **aplicada** en el
-- proyecto de Supabase. Son preguntas distintas: la `0008` estuvo sin aplicar
-- mucho tiempo mientras este andamio pasaba en verde.
--
-- Para la otra pregunta está `npm run verificar:semilla`, que cuenta filas
-- contra el proyecto de verdad.
--
-- Lo que se fija aquí:
--   · Que la semilla deje las filas que promete, no cero.
--   · Que el PJF y el laboral NO sean el mismo calendario (el contraste de
--     marzo: la LOPJF fija el 21, la LFT recorre al tercer lunes, el 16).
--   · Que NADA nazca verificado (regla 4).
--   · Que reaplicarla no duplique.
-- =============================================================================

\set ON_ERROR_STOP on
\pset pager off
set client_min_messages = notice;

do $$
declare
  v_pjf uuid;
  v_laboral uuid;
  v_conteo int;
  v_antes int;
  v_marzo_pjf date;
  v_marzo_laboral date;
begin
  -- ── Los dos calendarios compartidos existen ──────────────────────────────
  -- `despacho_id is null` es lo que los hace compartidos: los lee todo
  -- despacho y no los edita ninguno.
  select id into v_pjf
    from public.calendarios where clave = 'pjf-2026' and despacho_id is null;
  select id into v_laboral
    from public.calendarios where clave = 'laboral-2026' and despacho_id is null;

  perform pruebas.verificar('el calendario del PJF quedó sembrado y compartido',
    v_pjf is not null);
  perform pruebas.verificar('el calendario laboral quedó sembrado y compartido',
    v_laboral is not null);

  -- ── Cada uno con sus días inhábiles ──────────────────────────────────────
  -- Un calendario sin días inhábiles cuenta como si todo fuera hábil, que es
  -- justo el error que hace perder un término en los puentes.
  select count(*) into v_conteo
    from public.dias_inhabiles where calendario_id = v_pjf;
  perform pruebas.verificar('el PJF trae sus días inhábiles', v_conteo = 9);

  select count(*) into v_conteo
    from public.dias_inhabiles where calendario_id = v_laboral;
  perform pruebas.verificar('el laboral trae sus días inhábiles', v_conteo = 7);

  -- ── EL CONTRASTE DE MARZO ────────────────────────────────────────────────
  -- La afirmación que más importa de este archivo. La LOPJF fija el natalicio
  -- de Juárez en su fecha (21 de marzo) y la LFT lo recorre al tercer lunes
  -- (16 en 2026). Si alguien "unifica" los dos calendarios, los plazos
  -- laborales se cuentan con los inhábiles federales y al revés — y el error
  -- no se ve hasta que un término ya se venció.
  select desde into v_marzo_pjf
    from public.dias_inhabiles
   where calendario_id = v_pjf and desde between '2026-03-01' and '2026-03-31';
  select desde into v_marzo_laboral
    from public.dias_inhabiles
   where calendario_id = v_laboral and desde between '2026-03-01' and '2026-03-31';

  perform pruebas.verificar('el PJF fija marzo en su fecha (21, LOPJF)',
    v_marzo_pjf = date '2026-03-21');
  perform pruebas.verificar('el laboral recorre marzo al tercer lunes (16, LFT)',
    v_marzo_laboral = date '2026-03-16');
  perform pruebas.verificar('NO son el mismo calendario',
    v_marzo_pjf <> v_marzo_laboral);

  -- ── Los periodos vacacionales entran como rango, no día por día ──────────
  select count(*) into v_conteo
    from public.dias_inhabiles
   where calendario_id = v_pjf and motivo = 'vacaciones' and hasta > desde;
  perform pruebas.verificar('los dos periodos vacacionales del PJF son rangos',
    v_conteo = 2);

  -- ── El catálogo de plazos ────────────────────────────────────────────────
  select count(*) into v_conteo
    from public.plazos_catalogo where despacho_id is null;
  perform pruebas.verificar('el catálogo compartido quedó sembrado',
    v_conteo = 16);

  -- ── REGLA 4: NADA sale de fábrica verificado ─────────────────────────────
  -- "La herramienta propone → el abogado verifica → queda la constancia."
  -- Una entrada que naciera verificada saltaría el único paso que le da valor
  -- a la palabra.
  select count(*) into v_conteo
    from public.plazos_catalogo
   where verificado_por is not null
      or verificado_el is not null
      or verificacion_notas is not null;
  perform pruebas.verificar('NINGUNA entrada nace verificada (regla 4)',
    v_conteo = 0);

  -- Y todas traen fundamento: un plazo sin de dónde sale no se puede verificar.
  select count(*) into v_conteo
    from public.plazos_catalogo
   where despacho_id is null and coalesce(trim(fundamento), '') = '';
  perform pruebas.verificar('toda entrada del catálogo cita su fundamento',
    v_conteo = 0);

  -- ── La clave compartida es única ─────────────────────────────────────────
  -- El índice parcial es lo que deja que la aplicación pida "el del PJF" sin
  -- conocer el uuid. Con dos, `cargarCalendarioPorClave` elegiría cualquiera.
  begin
    insert into public.calendarios
      (despacho_id, clave, nombre, vigencia_desde, vigencia_hasta)
    values (null, 'pjf-2026', 'Duplicado', '2026-01-01', '2026-12-31');
    perform pruebas.verificar('no caben dos calendarios compartidos con la misma clave', false);
  exception when unique_violation then
    perform pruebas.verificar('no caben dos calendarios compartidos con la misma clave', true);
  end;

  -- ── Reaplicar la migración no duplica ────────────────────────────────────
  -- Se aplica pegando el archivo en el SQL Editor, y eso se hace dos veces con
  -- toda facilidad. Se reproducen aquí las guardas reales de la `0008`.
  select count(*) into v_antes from public.calendarios;

  insert into public.calendarios
    (despacho_id, clave, nombre, vigencia_desde, vigencia_hasta, fin_de_semana_inhabil)
  values (null, 'pjf-2026', 'Poder Judicial de la Federación 2026 (semilla)',
          '2026-01-01', '2026-12-31', true)
  on conflict (clave) where despacho_id is null do nothing;

  select count(*) into v_conteo from public.calendarios;
  perform pruebas.verificar('reaplicar la semilla no duplica calendarios',
    v_conteo = v_antes);

  select count(*) into v_antes from public.plazos_catalogo;
  insert into public.plazos_catalogo
    (despacho_id, clave, regimen, etiqueta, dias, unidad, fundamento, nota)
  select null, 'merc.revocacion', 'mercantil', 'Recurso de revocación', 3,
         'habiles', 'Código de Comercio, art. 1079', null
   where not exists (select 1 from public.plazos_catalogo
                      where clave = 'merc.revocacion' and despacho_id is null);

  select count(*) into v_conteo from public.plazos_catalogo;
  perform pruebas.verificar('reaplicar la semilla no duplica el catálogo',
    v_conteo = v_antes);

  if current_setting('pruebas.hubo_falla', true) = 'si' then
    raise exception 'HAY PRUEBAS EN FALLA';
  end if;
  raise notice '── todas las pruebas de la 0008 pasan ──';
end $$;
