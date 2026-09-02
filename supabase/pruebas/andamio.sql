-- =============================================================================
-- Andamio mínimo de Supabase para correr las migraciones en un Postgres pelón
-- =============================================================================
-- Supabase trae de fábrica los roles (`anon`, `authenticated`, `service_role`),
-- el esquema `auth` y `auth.uid()`. En un Postgres recién instalado no existen,
-- así que aquí se levantan los mínimos que las migraciones tocan.
--
-- `auth.uid()` se implementa como en Supabase: leyendo el claim `sub` de
-- `request.jwt.claims`. Eso es lo que permite que las pruebas se hagan pasar por
-- una persona u otra con `pruebas.como(...)`.
-- =============================================================================

-- Andamio mínimo de Supabase para poder correr las migraciones en un Postgres
-- pelón: roles, esquema auth y auth.uid() leyendo el claim de la petición.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid;
$$;

grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
