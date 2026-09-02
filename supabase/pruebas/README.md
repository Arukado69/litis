# Pruebas de la base

Los topes del plan y el blindaje de las columnas de cobro viven en
disparadores de Postgres, no en la aplicación: la aplicación se puede rodear
llamando a PostgREST directo. Un candado que solo existe en la base tiene que
probarse en la base.

```bash
supabase/pruebas/correr.sh
```

Levanta un Postgres de usar y tirar, aplica todas las migraciones en orden y
corre las afirmaciones. No toca el proyecto de Supabase ni necesita internet.

- `andamio.sql` — lo mínimo que Supabase da de fábrica y un Postgres pelón no:
  los roles `anon`/`authenticated`/`service_role`, el esquema `auth` y
  `auth.uid()` leyendo el claim de la petición.
- `ayudantes.sql` — `pruebas.como(usuario, papel)` para hacerse pasar por
  alguien, y `pruebas.verificar(nombre, condición)`.
- `0012_topes.sql` — las afirmaciones de la migración `0012`.

⚠️ La `0010` se omite: crea políticas sobre `storage.objects`, que solo existe
en Supabase. Ninguna otra migración depende de ella.
