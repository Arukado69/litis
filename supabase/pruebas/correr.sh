#!/usr/bin/env bash
#
# Corre las migraciones sobre un Postgres de usar y tirar y ejecuta las pruebas
# de la base. No toca el proyecto de Supabase.
#
#   supabase/pruebas/correr.sh
#
# Requiere Postgres instalado en la máquina (initdb, pg_ctl, psql). No requiere
# Docker ni conexión a internet.
#
# ⚠️ La `0010` se omite: crea políticas sobre `storage.objects`, que solo existe
# en Supabase. Ninguna otra migración depende de ella.
set -euo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRACIONES="$AQUI/.."
BASE="${TMPDIR:-/tmp}/litis-pruebas-bd"

BIN="$(dirname "$(command -v pg_ctl || ls /usr/lib/postgresql/*/bin/pg_ctl | tail -1)")"

# initdb se niega a correr como root; si estamos ahí, se usa el usuario postgres.
if [ "$(id -u)" = 0 ] && id postgres >/dev/null 2>&1; then
  COMO=(su postgres -c)
  rm -rf "$BASE"; mkdir -p "$BASE/data" "$BASE/sock"; chown -R postgres:postgres "$BASE"
else
  COMO=(bash -c)
  rm -rf "$BASE"; mkdir -p "$BASE/data" "$BASE/sock"
fi

"${COMO[@]}" "$BIN/initdb -D $BASE/data -U postgres --auth=trust" >/dev/null
"${COMO[@]}" "$BIN/pg_ctl -D $BASE/data -o \"-k $BASE/sock -c listen_addresses=''\" -l $BASE/log start" >/dev/null
trap '"${COMO[@]}" "$BIN/pg_ctl -D $BASE/data stop -m immediate" >/dev/null 2>&1 || true' EXIT

export PGHOST="$BASE/sock" PGUSER=postgres
# Las migraciones son idempotentes (`drop ... if exists`) y eso llena la salida
# de avisos de "no existe, se omite". Aquí solo interesan los errores.
export PGOPTIONS='-c client_min_messages=warning'
sleep 1

psql -q -c "create database litis;"
psql -q -d litis -v ON_ERROR_STOP=1 -f "$AQUI/andamio.sql" >/dev/null

for f in "$MIGRACIONES"/migrations/*.sql; do
  case "$(basename "$f")" in 0010_*) continue ;; esac
  psql -q -d litis -v ON_ERROR_STOP=1 -f "$f" >/dev/null
done
echo "migraciones aplicadas"

psql -q -d litis -c "create schema pruebas; grant usage on schema pruebas to authenticated, service_role;" >/dev/null
psql -q -d litis -v ON_ERROR_STOP=1 -f "$AQUI/ayudantes.sql" >/dev/null
# Las afirmaciones se reportan con `raise notice`, así que aquí sí se escuchan.
PGOPTIONS='-c client_min_messages=notice' \
  psql -d litis -v ON_ERROR_STOP=1 -f "$AQUI/0012_topes.sql" 2>&1 |
  sed -n 's/.*NOTICE:  //p'
