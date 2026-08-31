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
**275 pruebas.** Acceso, registro, expedientes, cómputo y cierre de plazos, el
panel "qué vence" y la edición del expediente ya funcionan contra Supabase, con
identidad visual propia (ver [`docs/DISENO.md`](docs/DISENO.md)).

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
- `registro.ts` — captura de la notificación. Admite plazo del catálogo **o
  capturado a mano**: el catálogo nunca cubrirá todas las vías de las 32
  entidades, y un sistema que solo acepte lo de fábrica obliga a llevar el
  resto en un papel aparte. Un plazo a mano sale marcado sin fundamento.
- `carga.ts` — único puente entre la base y el motor: filas → `Calendario`.
- ⚠️ **Los calendarios y el catálogo viven en la BASE, no en el código.** Las
  constantes de `calendarios-semilla.ts` y `catalogo.ts` son la **semilla** con
  la que se generó la migración `0008`; en tiempo de ejecución solo se lee la
  tabla. `semilla.test.ts` falla si el SQL y el código se separan.

### 5.2 Expedientes — `src/lib/expedientes/`

- `materias.ts` — materias, vías y a qué régimen de cómputo mapea cada vía. ⚠️
  **La vía manda, no la materia**: el ejecutivo mercantil embarga antes de
  emplazar y el ordinario no tiene esa etapa.
- `etapas.ts` — plantillas de etapas por vía. Las etapas `paralela: true` (la
  suspensión en amparo) no cuentan para el avance.
- `partes.ts` — roles por materia y validación. Exactamente una parte propia por
  expediente.
- `apertura.ts` — convierte la captura del alta en el grafo de filas a insertar:
  clonado de etapas y validación. ⚠️ Distingue lo que **bloquea** (sin vía no hay
  régimen de cómputo; sin parte propia no se sabe desde qué lado corren los
  plazos) de lo que solo **advierte** (el número del órgano no existe hasta la
  admisión; exigirlo obliga a inventarlo).
- `captura.ts` — la frontera entre lo que teclea una persona y el dominio.
  Parseo de cuantía y fecha, y validación de que el rol exista en esa materia
  («quejoso» no significa nada en un juicio mercantil).
- `datos.ts` — consultas. El padrón para conflictos se arma con dos consultas
  unidas en memoria, no con un join anidado: así no depende de los metadatos de
  relaciones, que hoy están escritos a mano.
- ⚠️ **El número interno NO se calcula en TypeScript.** Lo asigna
  `abrir_expediente` (migración `0007`) dentro de la transacción y con
  reintento: calcularlo en el cliente le daría el mismo número a dos altas
  simultáneas.

### 5.3 Panel "qué vence" — `src/lib/panel/`, `/panel`

Plazos y audiencias en **una sola lista**, porque para quien tiene que estar en
un lugar a una hora compiten por el mismo día.

- **Choques de agenda** —misma persona, mismo día, dos compromisos— arriba de
  todo. Lo que arruina una semana no es un plazo apretado, es descubrir tarde
  que dos cosas caen el mismo día.
- Lo que **no tiene responsable** se resalta: nadie lo está viendo, así que
  nadie lo va a reclamar.
- ⚠️ **Cada pendiente se cuenta con SU calendario.** Un despacho con asuntos
  federales y locales tiene por lo menos dos, con vacaciones distintas; contar
  el portafolio entero con uno solo diría "faltan 5" donde faltan 2, justo en
  el dato que decide qué se trabaja hoy. Los calendarios se cargan en lote
  (`cargarCalendariosPorId`) para no hacer N+1 consultas.
- Solo entra lo `pendiente`: un plazo atendido en la lista enseña a ignorarla.

### 5.4 Conflicto de interés — `src/lib/conflictos/deteccion.ts`

Cruza las partes de un asunto nuevo contra el padrón. Devuelve `impedimento` o
`revisar` con su evidencia; **nunca "puedes aceptarlo"**.

### 5.5 Plomería — `src/lib/supabase/`, `src/types/db.ts`, `src/proxy.ts`

Clientes de servidor, navegador y servicio; validación de variables de entorno;
proxy que refresca la sesión y bloquea `/panel` y `/portal`.

⚠️ `src/types/db.ts` sigue **escrito a mano** y ya son ocho migraciones. El
esquema está aplicado, así que lo correcto es sustituirlo por
`npx supabase gen types typescript --project-id <id>` a la primera oportunidad.
Mientras tanto la regla es estricta: **toda migración que cambie una tabla lo
actualiza en el mismo commit.**

⚠️ El cliente de servicio salta toda la RLS. Tras mover el alta de despacho a
`crear_mi_despacho` (§5.9), **hoy no lo usa ningún camino**; queda para el cron
de alertas, que corre sin sesión. Si aparece la tentación de usarlo "porque la
RLS estorba", lo que hay que arreglar es la política.

### 5.6 Alta de expediente — `src/app/(panel)/panel/expedientes/`

`/panel/expedientes` (lista) · `/nuevo` (alta) · `/[id]` (detalle).

- ⚠️ **El cotejo de conflictos va ANTES de crear las personas.** Si se crearan
  primero, cada persona nueva se encontraría a sí misma en el padrón y toda
  alta reportaría un conflicto consigo misma.
- ⚠️ **La constancia de la revisión se asienta en la bitácora** como actuación
  `nota_interna`. Es inmutable, así que queda quién revisó, cuándo y qué se le
  mostró — justo lo que hace falta el día que haya que sostener que el
  conflicto se valoró.
- ⚠️ **React 19 resetea el formulario tras una Server Action.** Por eso el
  estado devuelve `valores` y cada campo los usa como `defaultValue`: sin eso,
  al aparecer el aviso de conflicto la pantalla se vaciaría, con la tentación
  obvia de ignorar el aviso la segunda vez.
- Vía y roles dependen de la materia elegida, en el cliente.

### 5.7 Cómputo de plazos en pantalla — `.../expedientes/[id]/notificacion/`

**La rebanada que vende el producto.**

- ⚠️ **Dos pasos, siempre.** El primer envío calcula y muestra la traza sin
  guardar nada; el segundo, con la casilla marcada, guarda. La herramienta
  propone y el abogado confirma — esa secuencia es lo que deja la
  responsabilidad donde debe estar.
- Se enseña el razonamiento completo: cuándo surtió efectos, cuál fue el primer
  día, **qué días se saltaron y por qué**, y con qué fundamento.
- Se puede **ajustar la fecha a mano**, y ajustar exige motivo (lo fuerza un
  `check` en la base). El motor no conoce el acuerdo que habilitó días ni la
  suspensión de ayer; sin poder corregir, el abogado llevaría el plazo bueno en
  un papel aparte y el sistema sobraría.
- La traza completa se guarda en `plazos.computo` (jsonb) para poder auditarla
  a seis meses vista.
- ⚠️ Al listar plazos se lee `fecha_vencimiento_efectiva`, la columna generada.
  Leer `fecha_vencimiento` mostraría la del motor aunque se haya corregido.

### 5.8 Cierre del plazo — `src/lib/plazos/cierre.ts`, `.../expedientes/[id]/`

Un plazo sale de la vigilancia por dos caminos y solo dos: **presentada** (se
presentó la promoción) o **cancelada** (dejó de aplicar: desistimiento,
acumulación, quedó sin materia).

- ⚠️ **La presentación extemporánea no se maquilla.** Si el plazo vencía el 16 y
  la promoción se presentó el 18, marcarlo "atendido" y ya dejaría el panel en
  verde y el expediente diciendo que todo salió bien. No salió bien: se perdió
  el término. El sistema lo detecta, lo advierte **antes** de guardar, exige que
  alguien lo reconozca de forma expresa y lo asienta en la bitácora —que es
  inmutable— como `Presentación EXTEMPORÁNEA`, con las dos fechas escritas. Un
  registro tranquilizador sobre un hecho grave es peor que no tener registro.
- ⚠️ **El vencimiento se relee de la base, nunca del formulario.** Si viniera
  del campo oculto, cambiarlo convertiría una presentación tardía en una en
  tiempo y se cae toda la razón de ser de la pantalla.
- **Cancelar exige motivo** (mínimo real, no "n/a"): sin él, cancelar sería la
  forma cómoda de desaparecer del panel cualquier plazo incómodo.
- **Cancelar es de `titular` o `abogado`.** ⚠️ Se hace cumplir en la acción
  (capa 2), **no en la RLS**: la policy de `plazos` deja escribir a todo el
  personal con acceso al expediente. No es un agujero de aislamiento —nadie sale
  de su despacho— sino política interna sin respaldo en la base. Queda anotado
  para convertirlo en policy cuando un despacho real lo pida.
- **Primero la bitácora, después el estado.** Si el segundo paso falla queda un
  plazo abierto con su actuación asentada: molesto pero honesto. Al revés
  quedaría un plazo cerrado sin constancia de por qué.
- Se rechaza la fecha futura (sacaría de la vigilancia un plazo que sigue
  corriendo) y la anterior a la notificación (el error de captura más común es
  el año, y un 2025 volvería "anticipada" una presentación tardía).
- La extemporánea igual queda `atendido`: el plazo dejó de correr. Que se haya
  presentado tarde **lo dice la bitácora**, no el estado — ahí no se puede
  borrar.
- ⚠️ **`estado = 'vencido'` no lo escribe nadie todavía.** El panel deriva el
  atraso de la fecha, que es más simple y no se puede desincronizar. El valor
  existe en el enum por si algún día un cron lo marca; hasta entonces, un plazo
  vencido sigue siendo `pendiente` y así aparece en rojo.

### 5.9 Edición del expediente — `src/lib/expedientes/edicion.ts`, `.../[id]/editar/`

El alta escribe una vez; un asunto cambia todo el tiempo. Aquí se captura el
número que asigna el juzgado al admitir, se reasigna al responsable, se mueve
la etapa, se agregan partes y se concluye.

- ⚠️ **La materia, la vía y el fuero NO se editan.** De la vía sale el régimen
  con el que ya se computaron los plazos de ese expediente; cambiarla en
  caliente dejaría fechas calculadas con una regla y un expediente que declara
  otra, sin que nada avise. Si se capturó mal, se cierra ese asunto y se abre
  el correcto.
- ⚠️ **Una etapa paralela no puede ser la etapa actual.** El asunto no "está
  en" la suspensión ni en el incidente: los TIENE mientras sigue en su etapa.
  Ponerla como actual rompe el avance y hace creer que el juicio se detuvo
  donde no se detuvo. Ni siquiera se ofrece en el selector.
- ⚠️ **No se concluye ni se archiva con plazos corriendo.** Si no, los términos
  de un asunto cerrado siguen pidiendo atención en el panel para siempre. Cada
  plazo tiene que decir antes si se presentó o si dejó de aplicar.
- **Concluir exige resultado**, y reabrir **borra** resultado y fecha de
  conclusión: un expediente activo con "desfavorable" pegado es un dato que
  contradice al otro.
- **Solo los cambios que importan van a la bitácora**, y en UNA anotación por
  edición: número del órgano, responsable, etapa, estado, resultado, acceso
  restringido. Una nota o la cuantía se guardan sin anotar nada — una bitácora
  que registra cada tecleo es una bitácora que nadie lee.
- ⚠️ **El "antes" del comparativo se relee de la base, no viene del
  formulario.** Con un campo oculto, dos personas editando el mismo asunto
  dejarían anotaciones que afirman cambios que ya había hecho otro, y la
  bitácora no se corrige después. Por lo mismo, la anotación se inserta
  DESPUÉS de guardar.
- ⚠️ **Agregar una parte vuelve a correr el cotejo de conflictos.** Un tercero
  llamado a juicio o un codemandado que apareció en la contestación puede ser
  cliente del despacho en otro asunto — y ese es justo el impedimento que llega
  por sorpresa. Revisar solo al abrir el expediente deja ciego ese caso.

### 5.10 Seguridad de acceso — `src/lib/seguridad/`

- `limite-intentos.ts` — freno anti-fuerza-bruta en **dos dimensiones**:
  (IP + correo) con mano dura y (IP) con holgura. Solo por correo, el atacante
  rota IPs; solo por IP, una oficina tras un NAT se bloquea sola. Únicamente
  cuentan los fallos: `perdonarAcceso` limpia tras entrar bien.
- `peticion.ts` — la IP del cliente. ⚠️ `x-forwarded-for` es fiable **solo**
  detrás de un proxy de confianza.

⚠️ El registro vive en memoria del proceso. Alcanza con UN contenedor; con
varias réplicas hay que mudarlo a Redis o a una tabla.

### 5.11 Acceso y alta de despacho — `src/app/(publico)/`, `src/lib/despachos/`

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

### 5.12 Esquema — `supabase/migrations/`

`0001` núcleo multi-tenant · `0002` catálogos jurídicos · `0003` expedientes,
partes y etapas · `0004` actuaciones, documentos y audiencias · `0005` plazos y
alertas · `0006` alta de despacho transaccional · `0007` apertura de expediente
transaccional · `0008` semilla de calendarios y catálogo de plazos.

**Estado en el proyecto de Supabase:** aplicadas `0001`–`0008`; el esquema está
al corriente. Las nuevas se aplican pegando el archivo en el SQL Editor, en
orden.

⚠️ `src/types/db.ts` está **escrito a mano** y lleva ocho migraciones de
posible deriva. Cuando el conector de Supabase esté disponible, regenerarlo con
`npx supabase gen types typescript --project-id <id>`.

### 5.13 Identidad visual — `src/app/globals.css`, `src/app/fuentes.ts`

Sistema propio, documentado en [`docs/DISENO.md`](docs/DISENO.md). El
vocabulario sale del material de un litigante mexicano: el archivero
verde-gris, la foja, la tinta azul-negra, el sello violeta de recibido, el
margen rojo de la hoja de máquina.

- **La cinta de días es el único gráfico y el elemento de firma.** Una casilla
  por día natural entre hoy y el vencimiento, llena si es hábil. Sale del motor
  real (`tramoDeDias`), no de un dibujo, y la portada la usa en grande: si el
  calendario se corrige, la portada se corrige sola.
- Tipografía: **Archivo** (obra) y **Petrona** (títulos), auto-hospedadas,
  las dos de talleres latinoamericanos y dibujadas para el español.
- ⚠️ **Cifras tabulares en todo el `body`.** Esto son columnas de fechas y de
  números de expediente; con cifras proporcionales las columnas bailan.
- Sin sombras, sin tarjetas idénticas, sin versalitas rastreadas de rótulo, sin
  cadenas de puntos medios. Están descartados por escrito en `docs/DISENO.md`
  para que no vuelvan de contrabando.

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
12. **Un plazo perdido se escribe con todas sus letras.** Ninguna pantalla, ni
    ninguna redacción, puede dejar una presentación extemporánea con el mismo
    aspecto que una en tiempo. Hay pruebas que fijan el título de la actuación.
13. **Un gráfico nunca es adorno.** Si algo se pinta, lleva un dato real detrás
    y una descripción para lector de pantalla. La cinta de días sale del motor,
    no de constantes escritas a mano.
14. **Nombres de esquema y código en español.** NS Hub mezclaba columnas en
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
