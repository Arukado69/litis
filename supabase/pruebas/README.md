# Pruebas de la base

Hay **dos preguntas distintas** y cada una tiene su herramienta. Confundirlas es
lo que dejó la migración `0008` sin aplicar durante mucho tiempo con todo en
verde.

## 1. ¿Las migraciones funcionan?

```bash
supabase/pruebas/correr.sh
```

Levanta un Postgres de usar y tirar, aplica todas las migraciones en orden y
corre las afirmaciones. No toca el proyecto de Supabase ni necesita internet.

Los topes del plan y el blindaje de las columnas de cobro viven en disparadores
de Postgres, no en la aplicación: la aplicación se puede rodear llamando a
PostgREST directo. Un candado que solo existe en la base tiene que probarse en
la base.

- `andamio.sql` — lo mínimo que Supabase da de fábrica y un Postgres pelón no:
  los roles `anon`/`authenticated`/`service_role`, el esquema `auth` y
  `auth.uid()` leyendo el claim de la petición.
- `ayudantes.sql` — `pruebas.como(usuario, papel)` para hacerse pasar por
  alguien, y `pruebas.verificar(nombre, condición)`.
- `0008_semilla.sql` — que la semilla deje las filas que promete, que el PJF y
  el laboral **no** sean el mismo calendario, que nada nazca verificado y que
  reaplicarla no duplique.
- `0012_topes.sql` — las afirmaciones de la migración `0012`.

⚠️ La `0010` se omite: crea políticas sobre `storage.objects`, que solo existe
en Supabase. Ninguna otra migración depende de ella.

## 2. ¿Están aplicadas en el proyecto de verdad?

```bash
npm run verificar:semilla
```

Cuenta filas contra el proyecto configurado. **Esto es lo único que contesta esa
pregunta.**

`correr.sh` aplica todas las migraciones a su Postgres desechable, así que ahí
la semilla siempre está: pasa en verde aunque el proyecto real esté vacío. Y
`semilla.test.ts` coteja el SQL contra las constantes de TypeScript —los dos en
el repositorio— así que pasa aunque ese SQL nunca se haya ejecutado. Las dos
cosas estaban en verde mientras `calendarios`, `dias_inhabiles` y
`plazos_catalogo` estaban vacías y el motor de plazos no tenía con qué contar.

**Una migración de datos solo se verifica contando filas.** Córrelo después de
aplicar migraciones y después de cada despliegue.

Usa la clave anónima, no la de servicio: así es como la aplicación lee el
catálogo compartido de verdad, así que además de que las filas existan comprueba
que sean **alcanzables**. Sin llaves no pasa — se detiene con estado 2, porque
una verificación que se declara conforme sin haber podido preguntar es
precisamente el fallo que esto existe para evitar.
