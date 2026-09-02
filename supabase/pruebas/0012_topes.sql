-- =============================================================================
-- Pruebas de la migración 0012 — topes del plan y blindaje del cobro
-- =============================================================================
-- Los topes viven en disparadores de la base y no en la aplicación, porque la
-- aplicación se puede rodear llamando a PostgREST directo. Un candado que solo
-- existe en la base tiene que probarse en la base: esto corre las migraciones
-- sobre un Postgres de usar y tirar y verifica el comportamiento real.
--
-- Se corre con `supabase/pruebas/correr.sh`.
--
-- Lo que se fija aquí, en orden de importancia:
--   · Con el plan al tope se puede SEGUIR TRABAJANDO (asentar en la bitácora).
--     Es la regla que manda sobre todas las demás.
--   · Cancelar no suspende a nadie ni archiva nada.
--   · El titular no puede regalarse el plan editando su propio despacho.
--   · Los clientes del portal no ocupan asiento.
-- =============================================================================

\set ON_ERROR_STOP on
\pset pager off
set client_min_messages = notice;

do $$
declare
  v_despacho uuid;
  v_conteo int;
  v_codigo text;
  v_i int;
begin
  perform set_config('pruebas.hubo_falla', 'no', false);

  -- ── Alta del despacho, como el titular ───────────────────────────────────
  perform pruebas.como('11111111-1111-1111-1111-111111111111');
  v_despacho := public.crear_mi_despacho(
    'Ana Titular', 'titular@prueba.mx', 'Despacho de Prueba', 'despacho-prueba');
  reset role;

  perform pruebas.verificar(
    'el despacho nace en gratuito, con 1 asiento y 10 expedientes',
    (select plan = 'gratuito' and asientos_incluidos = 1 and expedientes_tope = 10
       and estado_suscripcion = 'gratuita'
       from public.despachos where id = v_despacho));

  -- ── Tope de expedientes ──────────────────────────────────────────────────
  perform pruebas.como('11111111-1111-1111-1111-111111111111');
  for v_i in 1..10 loop
    insert into public.expedientes (despacho_id, numero_interno, caratula, materia, via, fuero)
    values (v_despacho, '2026-' || lpad(v_i::text, 3, '0'), 'Asunto ' || v_i,
            'civil', 'civ.ordinario', 'comun');
  end loop;

  perform pruebas.verificar('caben los 10 del plan gratuito',
    public.expedientes_activos(v_despacho) = 10);

  begin
    insert into public.expedientes (despacho_id, numero_interno, caratula, materia, via, fuero)
    values (v_despacho, '2026-011', 'El que no cabe', 'civil', 'civ.ordinario', 'comun');
    perform pruebas.verificar('el 11º expediente se rechaza', false);
  exception when others then
    get stacked diagnostics v_codigo = returned_sqlstate;
    perform pruebas.verificar('el 11º expediente se rechaza con LIT01', v_codigo = 'LIT01');
  end;

  -- Archivar libera lugar.
  update public.expedientes set estado = 'archivado'
   where despacho_id = v_despacho and numero_interno = '2026-001';

  insert into public.expedientes (despacho_id, numero_interno, caratula, materia, via, fuero)
  values (v_despacho, '2026-011', 'El que sí cabe', 'civil', 'civ.ordinario', 'comun');
  perform pruebas.verificar('archivar libera un lugar',
    public.expedientes_activos(v_despacho) = 10);

  -- Revivir el archivado, ya sin cupo, se rechaza.
  begin
    update public.expedientes set estado = 'activo'
     where despacho_id = v_despacho and numero_interno = '2026-001';
    perform pruebas.verificar('revivir un archivado sin cupo se rechaza', false);
  exception when others then
    get stacked diagnostics v_codigo = returned_sqlstate;
    perform pruebas.verificar('revivir un archivado sin cupo se rechaza con LIT01',
      v_codigo = 'LIT01');
  end;

  -- Cerrar un plazo, asentar y leer NO se topan: se prueba lo que el tope no
  -- puede frenar, que es la regla que manda sobre todas las demás.
  insert into public.actuaciones (expediente_id, tipo, fecha, titulo)
  select id, 'promocion', current_date, 'Se presentó en tiempo'
    from public.expedientes where despacho_id = v_despacho limit 1;
  perform pruebas.verificar('con el plan al tope se puede seguir asentando',
    (select count(*) from public.actuaciones a
      join public.expedientes e on e.id = a.expediente_id
     where e.despacho_id = v_despacho) = 1);
  reset role;

  -- ── Blindaje de las columnas de cobro ────────────────────────────────────
  perform pruebas.como('11111111-1111-1111-1111-111111111111');
  begin
    update public.despachos set plan = 'despacho', expedientes_tope = null
     where id = v_despacho;
    perform pruebas.verificar('el titular NO puede regalarse el plan', false);
  exception when others then
    get stacked diagnostics v_codigo = returned_sqlstate;
    perform pruebas.verificar('el titular NO puede regalarse el plan (42501)',
      v_codigo = '42501');
  end;

  -- Lo que sí puede cambiar de su despacho sigue funcionando.
  update public.despachos set telefono = '5555555555' where id = v_despacho;
  perform pruebas.verificar('el titular sí puede editar lo suyo',
    (select telefono = '5555555555' from public.despachos where id = v_despacho));
  reset role;

  -- ── La clave de servicio sí mueve el plan ────────────────────────────────
  perform pruebas.como(null, 'service_role');
  update public.despachos
     set plan = 'despacho', estado_suscripcion = 'activa',
         asientos_incluidos = 3, expedientes_tope = null,
         stripe_cliente_id = 'cus_prueba', stripe_suscripcion_id = 'sub_prueba'
   where id = v_despacho;
  reset role;

  perform pruebas.verificar('la clave de servicio sí escribe el plan',
    (select plan = 'despacho' and asientos_incluidos = 3 and expedientes_tope is null
       from public.despachos where id = v_despacho));

  perform pruebas.como('11111111-1111-1111-1111-111111111111');
  insert into public.expedientes (despacho_id, numero_interno, caratula, materia, via, fuero)
  values (v_despacho, '2026-012', 'Ya sin tope', 'civil', 'civ.ordinario', 'comun');
  perform pruebas.verificar('sin tope se abren los que sean',
    public.expedientes_activos(v_despacho) = 11);

  -- ── Asientos ─────────────────────────────────────────────────────────────
  -- Los perfiles de los demás los crea el alta de cada quien (clave de
  -- servicio), no el titular: por eso van con ese papel.
  reset role;
  perform pruebas.como(null, 'service_role');
  insert into public.perfiles (id, nombre, correo) values
    ('22222222-2222-2222-2222-222222222222', 'Beto Abogado', 'abogado@prueba.mx'),
    ('33333333-3333-3333-3333-333333333333', 'Caro Pasante', 'pasante@prueba.mx'),
    ('44444444-4444-4444-4444-444444444444', 'Dora Cliente', 'cliente@prueba.mx')
  on conflict do nothing;
  reset role;

  perform pruebas.como('11111111-1111-1111-1111-111111111111');
  insert into public.membresias (despacho_id, perfil_id, rol, estado)
  values (v_despacho, '22222222-2222-2222-2222-222222222222', 'abogado', 'activa');
  insert into public.membresias (despacho_id, perfil_id, rol, estado)
  values (v_despacho, '33333333-3333-3333-3333-333333333333', 'pasante', 'activa');
  perform pruebas.verificar('caben los 3 asientos contratados',
    public.asientos_ocupados(v_despacho) = 3);

  -- El cliente del portal NO ocupa asiento, aunque el plan esté lleno.
  insert into public.personas (despacho_id, nombre, tipo, relacion)
  values (v_despacho, 'Dora Cliente', 'fisica', 'cliente_activo');

  insert into public.membresias (despacho_id, perfil_id, rol, estado, persona_id)
  values (v_despacho, '44444444-4444-4444-4444-444444444444', 'cliente', 'activa',
          (select id from public.personas where despacho_id = v_despacho limit 1));
  perform pruebas.verificar('el cliente del portal no ocupa asiento',
    public.asientos_ocupados(v_despacho) = 3);
  reset role;

  -- Bajar el plan no expulsa a nadie: los tres siguen dentro.
  perform pruebas.como(null, 'service_role');
  update public.despachos
     set plan = 'gratuito', estado_suscripcion = 'cancelada',
         asientos_incluidos = 1, expedientes_tope = 10
   where id = v_despacho;
  reset role;

  perform pruebas.verificar('cancelar NO suspende a nadie',
    (select count(*) from public.membresias
      where despacho_id = v_despacho and estado = 'activa' and rol <> 'cliente') = 3);
  perform pruebas.verificar('cancelar NO archiva ningún expediente',
    (select count(*) from public.expedientes
      where despacho_id = v_despacho and estado not in ('concluido','archivado')) = 11);

  -- Pero ya no cabe nadie más.
  perform pruebas.como(null, 'service_role');
  insert into public.perfiles (id, nombre, correo)
  values ('55555555-5555-5555-5555-555555555555', 'Emo Quinto', 'quinto@prueba.mx')
  on conflict do nothing;
  reset role;

  perform pruebas.como('11111111-1111-1111-1111-111111111111');
  begin
    insert into public.membresias (despacho_id, perfil_id, rol, estado)
    values (v_despacho, '55555555-5555-5555-5555-555555555555', 'abogado', 'activa');
    perform pruebas.verificar('sin asientos no entra nadie más', false);
  exception when others then
    get stacked diagnostics v_codigo = returned_sqlstate;
    perform pruebas.verificar('sin asientos no entra nadie más (LIT02)', v_codigo = 'LIT02');
  end;

  -- Cambiarle el papel a alguien que ya está dentro no vuelve a pedir asiento.
  update public.membresias set rol = 'pasante'
   where despacho_id = v_despacho
     and perfil_id = '22222222-2222-2222-2222-222222222222';
  perform pruebas.verificar('cambiar el papel de quien ya está dentro no pide asiento',
    (select rol = 'pasante' from public.membresias
      where despacho_id = v_despacho
        and perfil_id = '22222222-2222-2222-2222-222222222222'));
  reset role;

  -- ── El cliente del portal no puede contar el despacho ────────────────────
  perform pruebas.como('44444444-4444-4444-4444-444444444444');
  begin
    v_conteo := public.expedientes_activos(v_despacho);
    perform pruebas.verificar('el cliente no puede contar los expedientes del despacho', false);
  exception when others then
    get stacked diagnostics v_codigo = returned_sqlstate;
    perform pruebas.verificar('el cliente no puede contar los expedientes (42501)',
      v_codigo = '42501');
  end;
  reset role;

  -- ── Un despacho ajeno no puede contar el mío ─────────────────────────────
  perform pruebas.como('55555555-5555-5555-5555-555555555555');
  begin
    v_conteo := public.asientos_ocupados(v_despacho);
    perform pruebas.verificar('un extraño no puede contar asientos ajenos', false);
  exception when others then
    perform pruebas.verificar('un extraño no puede contar asientos ajenos', true);
  end;
  reset role;

  if current_setting('pruebas.hubo_falla', true) = 'si' then
    raise exception 'HAY PRUEBAS EN FALLA';
  end if;
  raise notice '── todas las pruebas de la 0012 pasan ──';
end $$;
