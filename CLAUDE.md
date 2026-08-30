# Litis — Contexto del proyecto (para Claude Code)

> **Este archivo describe SOLO lo que existe hoy.** El plan de lo que sigue vive
> en [`docs/ROADMAP.md`](docs/ROADMAP.md). No se mezcla visión con estado:
> cuando una rebanada del roadmap se construye, se mueve aquí.

---

## 1. Qué es

**Litis** es un SaaS de gestión de expedientes, plazos procesales y audiencias
para **abogados litigantes y despachos pequeños en México**.

El usuario objetivo es el litigante solo o el despacho de 3 a 8 personas, que
hoy trabaja con Excel, WhatsApp y memoria. Lo que vende no es un tablero bonito:
es **no perder un término**.

**Etapa:** construcción del núcleo. Cero usuarios. Un solo dev.

**Nombre de trabajo.** "Litis" no es definitivo. Todo el código lo consume desde
`src/lib/brand` para que cambiarlo sea editar un archivo y renombrar el repo.

### De dónde viene

Este proyecto sucede a **NS Hub**, una gestoría de servicios legales por
suscripción para PYMEs que dejó de ser viable. NS Hub queda como **repositorio
de referencia, no como base**: se traen patrones probados, no archivos. El
detalle de qué se rescató está en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md)
§4.

## 2. Quién lo usa

Roles, en `membresias.rol`:

- **titular** — dueño del despacho. Factura, invita, da de baja, ve todo.
- **abogado** — lleva expedientes con firma. Puede verificar plazos del catálogo.
- **pasante** — apoya; no verifica plazos.
- **asistente** — captura y agenda.
- **cliente** — portal de **solo lectura** de SUS expedientes.

Una misma persona puede ser abogado en un despacho y cliente en otro: por eso el
rol vive en la membresía, no en el perfil.

## 3. Stack

Next.js 16 App Router · TypeScript estricto (con `noUncheckedIndexedAccess`) ·
React 19 · Tailwind v4 · Supabase (Postgres + Auth + Storage + RLS) · Vitest ·
Stripe y Resend, ambos con degradación a modo simulación sin llaves.

Server Actions para mutaciones de usuario; Route Handlers solo para webhooks y
crons.

## 4. Principio rector

**La solución más simple que resuelva el problema gana.**

Excepción única y explícita: **el multi-tenant y la RLS no se simplifican**. Un
fallo de aislamiento aquí no es una fuga de datos, es la violación del secreto
profesional de un abogado.

## 5. Lo construido hoy

La lógica de dominio (§5.1 a §5.4) es **pura, sin base de datos y sin reloj**.
**163 pruebas.** Ya hay acceso, registro y panel funcionando contra Supabase
(§5.7); las pantallas de expedientes todavía no.

### 5.1 Motor de plazos — `src/lib/plazos/`

El corazón del producto. Lee [`docs/PLAZOS.md`](docs/PLAZOS.md) antes de tocarlo.

- `fecha.ts` — aritmética de fechas civiles en UTC. ⚠️ **Nunca uses `Date`
  directo para un plazo**: `new Date('2026-03-15')` es medianoche UTC y en
  `America/Mexico_City` se imprime como el 14. Ese error de un día es el que
  hace perder un término.
- `calendario.ts` — días inhábiles y conteo de hábiles.
- `calendarios-semilla.ts` — PJF 2026 y laboral 2026. ⚠️ **No son el mismo
  calendario**: la LFT recorre feriados al lunes (tercer lunes de marzo = 16 en
  2026) y la LOPJF los fija en su fecha (21 de marzo). Hay prueba que fija el
  contraste; no los fundas.
- `regimenes.ts` — **cuándo surte efectos cada notificación**, por régimen. Aquí
  vive el conocimiento jurídico del doble salto.
- `computo.ts` — el motor. Devuelve la fecha **y su traza auditable**.
- `catalogo.ts` — catálogo semilla de plazos.
- `alertas.ts` — ventanas de aviso, contadas en **días hábiles**.

### 5.2 Expedientes — `src/lib/expedientes/`

- `materias.ts` — materias, vías y a qué régimen de cómputo mapea cada vía. ⚠️
  **La vía manda, no la materia**: el ejecutivo mercantil embarga antes de
  emplazar y el ordinario no tiene esa etapa.
- `etapas.ts` — plantillas de etapas por vía. Las etapas `paralela: true` (la
  suspensión en amparo) no cuentan para el avance.
- `partes.ts` — roles por materia y validación. Exactamente una parte propia por
  expediente.
- `apertura.ts` — convierte la captura del alta en el grafo de filas a insertar:
  número interno consecutivo por año, clonado de etapas y validación. ⚠️ Distingue
  lo que **bloquea** (sin vía no hay régimen de cómputo; sin parte propia no se
  sabe desde qué lado corren los plazos) de lo que solo **advierte** (el número
  del órgano no existe hasta la admisión; exigirlo obliga a inventarlo).

### 5.3 Panel — `src/lib/panel/pendientes.ts`

"Qué vence": plazos y audiencias en **una sola lista**, porque para quien tiene
que estar en un lugar a una hora compiten por el mismo día. Incluye detección de
**choques de agenda** —misma persona, mismo día, dos compromisos— que es lo que
arruina una semana cuando se descubre tarde.

### 5.4 Conflicto de interés — `src/lib/conflictos/deteccion.ts`

Cruza las partes de un asunto nuevo contra el padrón. Devuelve `impedimento` o
`revisar` con su evidencia; **nunca "puedes aceptarlo"**.

### 5.5 Plomería — `src/lib/supabase/`, `src/types/db.ts`, `src/proxy.ts`

Clientes de servidor, navegador y servicio; validación de variables de entorno;
proxy que refresca la sesión y bloquea `/panel` y `/portal`.

⚠️ `src/types/db.ts` sigue **escrito a mano**. Ya hay proyecto de Supabase, así
que en cuanto se apliquen las migraciones pendientes debe sustituirse por
`npx supabase gen types typescript --project-id <id>`. Mientras dure lo hecho a
mano: **toda migración que cambie una tabla lo actualiza en el mismo commit.**

⚠️ El cliente de servicio salta toda la RLS. Tras mover el alta de despacho a
`crear_mi_despacho` (§5.7), **hoy no lo usa ningún camino**; queda para el cron
de alertas, que corre sin sesión. Si aparece la tentación de usarlo "porque la
RLS estorba", lo que hay que arreglar es la política.

### 5.6 Seguridad de acceso — `src/lib/seguridad/`

- `limite-intentos.ts` — freno anti-fuerza-bruta en **dos dimensiones**:
  (IP + correo) con mano dura y (IP) con holgura. Solo por correo, el atacante
  rota IPs; solo por IP, una oficina tras un NAT se bloquea sola. Únicamente
  cuentan los fallos: `perdonarAcceso` limpia tras entrar bien.
- `peticion.ts` — la IP del cliente. ⚠️ `x-forwarded-for` es fiable **solo**
  detrás de un proxy de confianza.

⚠️ El registro vive en memoria del proceso. Alcanza con UN contenedor; con
varias réplicas hay que mudarlo a Redis o a una tabla.

### 5.7 Acceso y alta de despacho — `src/app/(publico)/`, `src/lib/despachos/`

`/acceso` · `/registro` · `/bienvenida` · `/panel`, con guardias en
`src/lib/auth/sesion.ts`.

- ⚠️ **El alta de despacho NO usa clave de servicio.** Va por
  `crear_mi_despacho` (migración `0006`), una función transaccional
  `security definer` que verifica `auth.uid()` y solo actúa sobre quien la
  llama. Meter un camino que salta toda la RLS en una pantalla pública sin
  sesión no vale la comodidad.
- ⚠️ **El desempate del slug vive en SQL, no en TypeScript.** Resolverlo exige
  leer los slugs de todos los despachos, y la RLS —con razón— no deja. Hay UNA
  sola implementación de esa regla, a propósito.
- ⚠️ **Dos caminos de registro.** Si el proyecto exige confirmar el correo,
  `signUp` no devuelve sesión y `crear_mi_despacho` no puede correr todavía: el
  despacho se crea en `/bienvenida` tras el primer acceso.
- Los mensajes de error **no revelan si un correo existe**. Distinguir "no
  existe" de "contraseña mala" convierte el acceso en un verificador de cuentas.

### 5.8 Esquema — `supabase/migrations/`

`0001` núcleo multi-tenant · `0002` catálogos jurídicos · `0003` expedientes,
partes y etapas · `0004` actuaciones, documentos y audiencias · `0005` plazos y
alertas · `0006` alta de despacho transaccional.

**Estado en el proyecto de Supabase:** aplicadas `0001`–`0003`. **Pendientes
`0004`, `0005` y `0006`** — se aplican pegando el archivo en el SQL Editor, en
orden. Sin `0006` el registro falla.

## 6. Reglas que no se negocian

1. **Ninguna tabla de dominio sin `despacho_id`.** Ninguna política de RLS sin
   filtrar por él.
2. **Las funciones de seguridad son `security definer` con
   `set search_path = ''`** y nombres calificados. Sin eso hay escalación de
   privilegios; sin `security definer` hay recursión infinita en las políticas.
3. **La bitácora (`actuaciones`) es inmutable.** No tiene política de UPDATE ni
   DELETE, a propósito. Corregir es agregar una actuación que rectifique.
4. **Nada del catálogo de plazos sale de fábrica como verificado.** Hay una
   prueba que falla si alguna entrada llegara marcada. El flujo es: la
   herramienta propone → el abogado verifica → queda la constancia.
5. **Todo cómputo se muestra con su traza y su aviso** (`AVISO_COMPUTO` en
   `src/lib/brand`). La plataforma calcula y avisa; **no dictamina**.
6. **Ajustar un vencimiento a mano exige motivo.** Lo fuerza un `check` en la
   base.
7. **Las alertas se cuentan en días hábiles.** Entre el 15 de julio y el 3 de
   agosto de 2026 hay 19 días naturales y 1 día hábil.
8. **El nombre de la marca no se escribe a mano.** Sale de `src/lib/brand`.
9. **Los enlaces de correo salen de `NEXT_PUBLIC_SITE_URL`**, nunca del header
   `Host`.
10. **En `src/types/db.ts` todo se declara con `type`, jamás con `interface`.**
    No es estilo. En TypeScript una `interface` no recibe índice implícito, así
    que no es asignable a `Record<string, unknown>` — lo que exige el
    `GenericSchema` de supabase-js. Con interfaces el esquema deja de conformar
    **en silencio**, el cliente cae al genérico y cada `.rpc()` y cada join se
    tipan como `undefined` o `never`. Ya costó una depuración.
11. **Un archivo `'use server'` solo exporta funciones async.** El estado
    inicial y los tipos de un formulario van en un `estado.ts` aparte, o el
    build se cae.
12. **Nombres de esquema y código en español.** NS Hub mezclaba columnas en
    inglés con dominio en español y obligaba a traducir en cada consulta.

## 7. Convenciones

- Server Components por defecto; cliente solo con interactividad.
- **Toda mutación con lógica de negocio lleva prueba** (Vitest).
- La lógica de dominio va en funciones puras, fuera de la fila de BD.
- Textos de interfaz en español, sin palabras domingueras.
- Un commit por rebanada funcional.
- `npm run check` corre typecheck + lint + pruebas.

## 8. Disciplina

- Una sesión = un objetivo único y demostrable.
- Lo que falte de un abogado real se anota como bloqueo, **no se inventa**. En
  particular: **ningún artículo, plazo ni regla de cómputo se da por bueno sin
  verificar.** El catálogo semilla es un punto de partida, y el sistema está
  diseñado para decirlo en voz alta.
- Este archivo es la fuente de verdad. Si una decisión cambia, se actualiza.
