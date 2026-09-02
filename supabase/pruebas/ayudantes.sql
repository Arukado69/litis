-- =============================================================================
-- Ayudantes de prueba: hacerse pasar por alguien y afirmar
-- =============================================================================

\set ON_ERROR_STOP on
\pset pager off

-- ── Personas de prueba en auth.users ───────────────────────────────────────
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'titular@prueba.mx'),
  ('22222222-2222-2222-2222-222222222222', 'abogado@prueba.mx'),
  ('33333333-3333-3333-3333-333333333333', 'pasante@prueba.mx'),
  ('44444444-4444-4444-4444-444444444444', 'cliente@prueba.mx'),
  ('55555555-5555-5555-5555-555555555555', 'quinto@prueba.mx')
on conflict do nothing;

create or replace function pruebas.como(p_sub text, p_role text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    case when p_sub is null then format('{"role":"%s"}', p_role)
         else format('{"sub":"%s","role":"%s"}', p_sub, p_role) end, false);
  execute format('set role %I', p_role);
end $$;

create or replace function pruebas.verificar(p_nombre text, p_ok boolean)
returns void language plpgsql as $$
begin
  raise notice '%  %', case when p_ok then 'PASA ' else 'FALLA' end, p_nombre;
  if not p_ok then
    perform set_config('pruebas.hubo_falla', 'si', false);
  end if;
end $$;
