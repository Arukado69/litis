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
**485 pruebas.** Acceso, registro, equipo, expedientes, cómputo y cierre de
plazos, el panel "qué vence", la agenda, **el tablero de etapas**, la edición
del expediente, las alertas por correo, la bitácora con sus documentos y la
verificación del catálogo y **el portal del cliente** ya funcionan contra
Supabase, con identidad visual propia (ver
[`docs/DISENO.md`](docs/DISENO.md)) y portada pública con precios.

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

### 5.10 Equipo e invitaciones — `src/lib/despachos/invitaciones.ts`, `/panel/equipo`, `/invitacion/[token]`

El registro deja dentro al titular; esto mete a los demás. Migración `0009`.

- ⚠️ **El token se guarda HASHEADO (sha-256), nunca en claro.** Es la llave de
  un despacho entero: todos los expedientes, los datos de los clientes, los
  términos. En claro, cualquiera que llegue a leer la tabla —un respaldo viejo,
  una consulta mal hecha, una fuga— entra a cualquier despacho con invitación
  abierta. El claro existe UNA vez: en la respuesta de la acción que lo generó,
  de donde va al correo y a la pantalla. Perderlo obliga a revocar y reinvitar,
  que es el comportamiento correcto.
- ⚠️ **El enlace NO basta: el correo de la sesión tiene que coincidir.** Lo
  verifica `aceptar_invitacion` en la base, y el formulario ni siquiera deja
  editar el correo. Un enlace reenviado —a propósito o por descuido— le daría a
  un tercero los expedientes y los datos fiscales de los clientes del despacho.
- **Caduca en siete días.** Un enlace eterno en un correo viejo es una puerta
  abierta que nadie está viendo.
- **Solo el titular invita y da de baja**, en la RLS (`0009`) y en la acción. Un
  abogado que pudiera invitar podría meter a cualquiera a ver el despacho
  completo sin que el dueño se entere.
- **No se invita como `titular`** (habría dos y "quién manda" se quedaría sin
  respuesta) ni como `cliente` (ese entra por el portal).
- ⚠️ **La baja NO borra: suspende.** Las actuaciones de la bitácora y los plazos
  cerrados apuntan a ese perfil; borrarlo dejaría la historia del despacho
  firmada por nadie. Con `suspendida` deja de pasar `es_miembro()` y no ve un
  solo expediente, pero su nombre sigue ligado a lo que hizo.
- ⚠️ **Un pendiente a nombre de alguien dado de baja cuenta como SIN
  responsable** en el panel (`perfilesInactivos` en `lib/despachos/equipo.ts`).
  Si no, se vería con nombre y apellido y pasaría desapercibido — en la lista
  que existe justamente para que nada pase desapercibido. La pantalla de equipo
  muestra la carga viva de cada quien antes de darlo de baja.
- Una sola invitación pendiente por correo y despacho (índice único parcial):
  reinvitar sin cerrar la anterior deja dos enlaces vivos y revocar uno no
  cierra el otro.
- Freno anti-fuerza-bruta en la aceptación: es una ruta pública que escribe y
  cuya llave es un token.

### 5.11 Correo — `src/lib/email/`

- `plantilla.ts` — puro, sin red. ⚠️ **Tablas, no flex**: Outlook de escritorio
  compone con el motor de Word. Y **siempre** versión de texto plano: un correo
  solo-HTML puntúa peor en spam, y este es el que abre la puerta del despacho.
  Escapa todo lo que teclea una persona.
- `envio.ts` — Resend con **degradación a simulación**: sin `RESEND_API_KEY` el
  correo se escribe en consola y el flujo entero se puede probar sin contratar
  nada. ⚠️ **Nunca lanza**: quien lo llama ya escribió en la base, y tirar la
  acción ahí dejaría la invitación creada y una pantalla de error.
- ⚠️ **El origen de los enlaces sale de `NEXT_PUBLIC_SITE_URL`**, nunca del
  header `Host` (regla 9).

### 5.12 Alertas por correo — `src/lib/alertas/`, `GET /api/cron/alertas-plazos`

**La promesa central del producto.** Hasta aquí el sistema solo avisaba si
alguien abría el panel; esto avisa aunque nadie lo abra. Detalle completo en
[`docs/PLAZOS.md`](docs/PLAZOS.md).

- ⚠️ **Sin `CRON_SECRET` el endpoint contesta 503 y NO corre.** Abierto sería un
  cañón de spam apuntando a los clientes del despacho. El secreto se compara en
  tiempo constante (`lib/seguridad/comparar.ts`, la única implementación de esa
  regla: la comparten el cron y el token de invitación).
- ⚠️ **Si no se puede leer `plazo_alertas_enviadas`, la corrida se detiene, avisa
  al operador y no manda nada.** Seguir con el registro vacío le reenvía el
  mismo aviso a TODOS los de la ventana, cada día, hasta quemar el correo del
  despacho. Es preferible no avisar hoy. (La lección que costó caro en el
  proyecto anterior.)
- ⚠️ **Se manda primero y se registra después.** Al revés, un envío fallido
  quedaría marcado como dado y ese término se queda sin avisar para siempre.
  Entre un término perdido y un correo duplicado no hay comparación.
- ⚠️ **Un envío simulado NO se registra.** Sin `RESEND_API_KEY` el correo no
  sale; si contara como enviado, un despliegue con la llave mal puesta diría
  que avisó de todo sin que saliera uno solo. La corrida lo reporta con
  `modoSimulacion: true`.
- **Un correo por persona, no uno por plazo.** Cinco correos idénticos en el
  mismo minuto se archivan sin abrir, y el que importaba también. Lo que no
  tiene responsable le llega al titular, marcado como huérfano.
- **Cada plazo se cuenta con SU calendario** (misma lección que el panel). Un
  aviso contado con el calendario equivocado llega tarde, y esta es la pieza
  donde ese error no se puede permitir.
- ⚠️ **La corrida no usa joins de PostgREST.** El cliente de servicio no infiere
  las relaciones desde los tipos escritos a mano, y forzarlo con un cast
  escondería la deriva del esquema. Tres consultas en un proceso diario no
  cuestan nada; un tipo que miente sí.

### 5.13 Bitácora y documentos — `src/lib/bitacora/`, `src/lib/documentos/`

Las actuaciones ya se escribían desde tres lugares (notificación, cierre de
plazo, edición) y no había dónde leerlas. Ahora se leen, y se pueden asentar a
mano. Migración `0010` para el almacén.

- ⚠️ **La bitácora no se reescribe.** `actuaciones` no tiene política de UPDATE
  ni DELETE (migración `0004`). Corregir es asentar otra actuación que
  rectifique, como se agrega una foja en vez de tachar la anterior. La pantalla
  lo dice en voz alta en vez de dejar que alguien lo descubra.
- ⚠️ **`visible_cliente` se decide al escribir y NO se puede deshacer.** La fila
  no se edita — y aunque se pudiera, el cliente ya lo vio.
- ⚠️ **Una nota interna NUNCA se marca visible.** Es la única categoría cuyo
  nombre le promete al despacho que el cliente no la va a ver; dejar que una
  casilla mal marcada rompa esa promesa convertiría el campo en una trampa. Se
  fuerza en `leerActuacion` **y** en la acción: ocultar la casilla no detiene a
  quien llame la Server Action directo.
- **La fecha es cuándo OCURRIÓ, no cuándo se capturó.** Se captura el lunes lo
  que pasó el viernes. Una fecha futura se rechaza: la bitácora registra
  hechos, y un plan va en la agenda.
- ⚠️ **El bucket `documentos` es PRIVADO y no hay una sola ruta pública.** Ahí
  vive la identificación oficial de un cliente y las pruebas del asunto. Se
  descarga con URL firmada de **un minuto**, generada en el servidor con la
  sesión de quien pide (no con clave de servicio), así que la RLS sigue
  decidiendo.
- ⚠️ **La descarga es un enlace GET, no un formulario.** La CSP lleva
  `form-action 'self'` y los navegadores no coinciden en si eso alcanza a la
  redirección que sigue al envío; un botón que unos bloquean en silencio es
  peor que uno feo. Vive en `GET /api/documentos/[id]`.
- ⚠️ **La ruta es `{despacho}/{expediente}/{uuid}-{nombre}` y el orden importa.**
  Las políticas de Storage (`0010`) leen el SEGUNDO segmento. Cambiar el orden
  aquí sin cambiarlas allá abriría los archivos de todos los despachos. El
  despacho sale de la sesión, nunca del formulario.
- ⚠️ **No se sobrescribe: se sube otra versión.** Cada subida tiene su uuid, y
  el mismo nombre suma versión. En un juicio el borrador y lo presentado son
  dos documentos distintos y los dos importan por separado. Sin política de
  UPDATE en `storage.objects`.
- **Primero el archivo, después la fila.** Al revés, la lista mostraría un
  documento que al oprimirlo no existe. Si la fila falla, el archivo se limpia.
- El nombre del archivo se sanea (`nombreSeguro`) y **nunca decide permisos**:
  lo teclea quien sube. Quien decide es el id del expediente, que pone el
  servidor. Tope de 25 MB y lista blanca de tipos; el límite de cuerpo de las
  Server Actions se levantó a 30 MB para que el rechazo lo dé nuestra
  validación, con su mensaje, y no el runtime.

### 5.14 Agenda de audiencias — `src/lib/audiencias/`, `/panel/agenda`

- **Audiencias y vencimientos en la MISMA lista.** Compiten por el mismo día;
  separarlos obliga a hacer el cruce de cabeza cada mañana.
- ⚠️ **Un día con audiencia es un día TOMADO**, no "un pendiente más". El
  traslado, la espera y el desahogo se llevan la jornada; lo que venza ese día
  se trabaja antes. Los vencimientos que caen ahí se marcan.
- ⚠️ **Diferir NO cambia la fecha encima.** El día señalado ocurrió como hecho:
  se fue al juzgado y se esperó. Quedan DOS registros —la vieja `diferida` con
  su motivo y la nueva `programada`— más la actuación en la bitácora.
- **Celebrar exige el resultado.** Qué pasó en la audiencia ES la audiencia; sin
  eso queda un día en blanco irreconstruible.
- **Lo que falta al señalar advierte pero no bloquea.** Se señala con lo que
  dice el acuerdo. La advertencia que importa: sin responsable, es una audiencia
  a la que no va nadie.
- La agenda enseña **todos** los días, también los vacíos e inhábiles: una que
  solo muestra lo que tiene algo esconde cuántos días de trabajo quedan.
- El tipo de audiencia es **lista abierta**: entre 32 entidades y todas las
  materias no cabe en un catálogo cerrado.

### 5.15 Portada pública — `src/app/page.tsx`, `src/components/marketing/`

- ⚠️ **Todo lo que se enseña sale del motor de verdad.** La cinta y la traza del
  cómputo los produce el mismo código que corre en el panel, no un dibujo. Una
  portada que promete un cómputo y enseña una imagen del cómputo puede mentir
  sin que nadie se entere — justo en el producto cuyo argumento es "no finge
  certeza". Si se corrige un calendario, la portada se corrige sola.
- **Los precios viven en `src/lib/marketing/planes.ts`**, en un solo lugar, y la
  página dice que son una **hipótesis** y no una medición: no hay un despacho
  pagando todavía.
- Hay una sección de **lo que NO hace**. Quien lo descubre en la semana tres se
  siente engañado, y con razón; decirlo antes cuesta registros y ahorra bajas.

### 5.16 Verificación del catálogo — `src/lib/catalogo/`, `/panel/catalogo`

Es la pieza que quita el "cómputo sin verificar" de las pantallas — pero sin
regalarlo. Sin migración: la `0002` ya traía las columnas de firma.

- ⚠️ **Verificar es ADOPTAR, no bendecir lo compartido.** Las entradas semilla
  viven con `despacho_id IS NULL` y ningún despacho puede escribirlas (política
  de la `0002`), y eso es la semántica correcta: verificar es un acto
  profesional, y que el titular de un despacho revise el ordinario mercantil no
  puede volver esa entrada "verificada" para otro que nunca la vio. Menos con el
  CNPCyF desplazando códigos locales a ritmos distintos por entidad. Verificar
  **copia** la entrada al despacho con su firma.
- ⚠️ **La copia propia GANA sobre la compartida** (`resolverCatalogo`). Sin esa
  regla el selector de plazos enseñaría el mismo término dos veces —uno
  verificado y otro no— y quien capture elegiría cualquiera, que es peor que no
  haber verificado. `catalogoDeRegimen` ya lo aplica.
- **Se distingue "verificada" de "corregida".** "La revisé y estaba bien" no es
  lo mismo que "la revisé y decía 15 donde son 9", y la pantalla enseña el antes.
- ⚠️ **Una corrección NO recalcula los plazos ya computados.** Cambiarle la fecha
  de vencimiento a un plazo sin que nadie lo vea es lo que este producto no
  hace: el abogado ya agendó, ya avisó al cliente y quizá ya redactó contra esa
  fecha. Se le enseñan cuáles son —con enlace a cada expediente— y decide uno
  por uno.
- ⚠️ **La búsqueda de plazos afectados usa el id propio Y el de la semilla.** Al
  adoptar se crea una copia con id nuevo, pero los plazos computados antes
  siguen apuntando al id compartido — y esos son justo los que llevan más
  tiempo con la fecha equivocada.
- **La nota de verificación es obligatoria** (contra qué texto y de qué fecha).
  Sin ella "verificado" no significa nada dentro de seis meses.
- **Solo `titular` o `abogado`.** Un asistente captura y agenda; declarar que un
  plazo legal es correcto es acto de quien puede firmar. En la RLS y en la
  acción.
- **Retirar la verificación borra solo copias con clave de semilla**: sin ese
  filtro, retirarla de una entrada capturada a mano la borraría del catálogo con
  todo y su contenido.
- Verificar **no toca los plazos ya computados**: cada uno guardó su
  confiabilidad el día del cálculo y esa constancia no se reescribe hacia atrás.

### 5.17 Tablero de etapas — `src/lib/tablero/`, `/panel/tablero`

- ⚠️ **Columnas universales, etiqueta real en la tarjeta.** Cada vía tiene sus
  propias etapas —un ordinario mercantil y un amparo indirecto no comparten
  ninguna—, así que no hay un juego de columnas que le quede a las dos. Un
  tablero por vía sería correcto e inútil: un litigante lleva mercantil,
  laboral y amparo a la vez y quiere ver su cartera completa. Las seis fases
  (`preparacion`, `presentacion`, `instruccion`, `resolucion`, `impugnacion`,
  `ejecucion`) son la forma de cualquier proceso mexicano; debajo del asunto va
  SIEMPRE su etapa real.
- ⚠️ **La misma clave no siempre significa lo mismo.** `revision` en amparo es
  el recurso; en un asunto corporativo es revisar el documento antes de
  entregarlo. Por eso el mapa admite excepciones por vía — sin ellas un dictamen
  a punto de entregarse aparecería entre las impugnaciones.
- ⚠️ **Hay una prueba que exige que TODAS las etapas del catálogo estén
  mapeadas.** Sin ella, agregar una etapa a una plantilla y olvidar mapearla
  tira esos expedientes fuera del tablero en silencio. Ya cazó dos
  (`requerimiento_embargo` y `conciliacion_prejudicial`) al escribirse.
- ⚠️ **NO hay arrastrar y soltar, a propósito.** Mover la etapa escribe en la
  bitácora, que es inmutable: un arrastre accidental deja asentado para siempre
  que el asunto pasó a pruebas el día que no pasó. Selector y botón. El rastro
  se arma con el MISMO motor que `/editar` (`cambiosDeEdicion` +
  `anotacionDeCambios`), o la bitácora tendría dos formas de decir lo mismo.
- **Los sin etapa van aparte y arriba**, no repartidos en "Preparación": "no sé
  en qué va" es un estado real y esconderlo en una columna legítima lo vuelve
  invisible.
- **Los estancados van hasta arriba**: sin plazo corriendo y sin moverse en 60
  días. Los dos filtros juntos importan — uno con un término encima está
  esperando, no dormido. El que se cae por caducidad es el que no tiene nada
  que lo delate.
- Solo entran los asuntos vivos (activo, suspendido, prospecto). Uno concluido
  volvería el tablero un inventario.

### 5.18 Portal del cliente — `src/lib/portal/`, `/portal`

Ataca el "¿cómo va lo mío?" semanal. Migración `0011` para la puerta; la
visibilidad ya existía desde la `0003` y la `0004`.

- ⚠️ **El cliente NUNCA ve plazos.** No es un pendiente: la `0005` no le da
  política y no se la va a dar. La lista de términos que su abogado trae encima
  es información que no puede interpretar y que solo produce llamadas de
  angustia a las once de la noche. `lib/portal/datos.ts` ni siquiera tiene la
  consulta, para que nadie la "arregle" después.
- ⚠️ **Se traduce la FASE, no la etapa.** "Citación para sentencia" no le dice
  nada a quien no es abogado, y peor: suena a que ya se resolvió. Se traducen
  las seis fases universales del tablero —ya vía-agnósticas y ya probadas contra
  todo el catálogo— en vez de treinta y ocho frases que se desincronizarían a la
  primera reforma. Hay prueba de que ninguna etapa se queda sin traducción.
- ⚠️ **Aquí no se promete nada.** Ni fechas de terminación, ni "ya falta poco",
  ni pronósticos del resultado: un litigante no puede saber cuándo termina un
  juicio, y un portal que lo insinúe convierte una expectativa del sistema en
  una promesa del abogado. Hay pruebas que prohíben esas palabras.
- **Sí se dice cuándo se movió por última vez**, sin disculparse: la pregunta
  real detrás del "¿cómo va?" casi nunca es "¿cuándo termina?" sino "¿siguen
  trabajando en esto?". Y se cuenta desde el último movimiento VISIBLE, no
  desde cualquier cambio interno.
- ⚠️ **La persona del padrón la fija la invitación, no quien acepta.** Es el
  despacho quien sabe que ese correo es el del representante de Constructora
  XYZ; elegirla al aceptar dejaría que alguien se vincule a otro cliente y lea
  un expediente ajeno.
- **Dar acceso es de `titular` o `abogado`**: abrirle el expediente a alguien de
  fuera del despacho es una decisión sobre el secreto profesional, no una
  captura.
- El aviso del portal **explica por qué no está todo**, en vez de dejar que el
  cliente suponga que se le esconde algo.
- `exigirPortal` rechaza al personal: sin `persona_id` no verían nada y creerían
  que algo se rompió.

### 5.19 Seguridad de acceso — `src/lib/seguridad/`

- `limite-intentos.ts` — freno anti-fuerza-bruta en **dos dimensiones**:
  (IP + correo) con mano dura y (IP) con holgura. Solo por correo, el atacante
  rota IPs; solo por IP, una oficina tras un NAT se bloquea sola. Únicamente
  cuentan los fallos: `perdonarAcceso` limpia tras entrar bien.
- `peticion.ts` — la IP del cliente. ⚠️ `x-forwarded-for` es fiable **solo**
  detrás de un proxy de confianza.

⚠️ El registro vive en memoria del proceso. Alcanza con UN contenedor; con
varias réplicas hay que mudarlo a Redis o a una tabla.

### 5.20 Acceso y alta de despacho — `src/app/(publico)/`, `src/lib/despachos/`

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

### 5.21 Esquema — `supabase/migrations/`

`0001` núcleo multi-tenant · `0002` catálogos jurídicos · `0003` expedientes,
partes y etapas · `0004` actuaciones, documentos y audiencias · `0005` plazos y
alertas · `0006` alta de despacho transaccional · `0007` apertura de expediente
transaccional · `0008` semilla de calendarios y catálogo de plazos · `0009`
invitaciones al despacho · `0010` almacén privado de documentos · `0011`
acceso del cliente al portal · `0012` suscripción, topes del plan y blindaje de
las columnas de cobro.

**Estado en el proyecto de Supabase:** aplicadas `0001`–`0011`. **Pendiente la
`0012`** — sin ella no hay topes ni cobro, y el titular puede escribirse el plan
que quiera. Ni R5 ni R7 necesitaron migración: `plazo_alertas_enviadas` y
`audiencias` ya estaban en la `0005` y la `0004`. Las nuevas se aplican pegando el archivo en el SQL Editor, en
orden.

⚠️ `src/types/db.ts` está **escrito a mano** y lleva doce migraciones de
posible deriva. Cuando el conector de Supabase esté disponible, regenerarlo con
`npx supabase gen types typescript --project-id <id>`.

### 5.22 Identidad visual — `src/app/globals.css`, `src/app/fuentes.ts`

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

### 5.23 Suscripción y topes — `src/lib/suscripcion/`, `/panel/suscripcion`

Cobro **por asiento al mes** con nivel gratuito, por Stripe Checkout hospedado
(los datos de tarjeta no pasan por este servidor). Sin llaves, todo el módulo
degrada a **simulación**.

- **La regla que manda sobre todas las demás:** el tope solo puede frenar
  **abrir un expediente** y **sumar un asiento**. Nada más. Cerrar un plazo,
  asentar, subir documentos, computar, recibir alertas y leer lo capturado
  funcionan igual con la suscripción morosa, vencida o cancelada. Un cobro que
  impide registrar que se presentó en tiempo convierte un problema de tarjeta
  en un término perdido. `ACCIONES_TOPADAS` es una lista cerrada con prueba, y
  la pantalla arma con ella la lista de "lo que el tope nunca frena": si algún
  día una acción se vuelve topada, la pantalla deja de prometerla sola.
- **Al bajar de plan no se suspende a nadie ni se archiva nada.** El despacho
  que se queda por encima del tope conserva sus expedientes y su equipo; lo que
  pierde es crecer. Sale más caro cobrar de menos un mes que dejar a un pasante
  fuera de un expediente que vence mañana.
- **El candado está en la base, no en la Server Action** (`0012`). Los
  disparadores `expedientes_exigir_cupo` y `membresias_exigir_cupo` corren
  dentro de la transacción y rechazan con `LIT01`/`LIT02`; la aplicación
  consulta antes solo para dar un mensaje que diga cómo salir, y traduce esos
  códigos por si pierde la carrera. Contar va por función `security definer`:
  con la RLS del usuario, un expediente restringido no se contaría y el tope se
  saltaría solo por no poder ver lo que se cuenta.
- ⚠️ **Las columnas de cobro están blindadas.** `despachos_actualizar` (0001)
  deja al titular actualizar su despacho y no distingue columnas: sin el
  disparador `blindar_cobro`, un `PATCH` a PostgREST desde la consola del
  navegador se regala el plan. Solo la clave de servicio las mueve.
- **El asiento se aparta al invitar, no al aceptar.** Si no, se mandan veinte
  invitaciones con un asiento pagado y el tope aparece cuando ya están todos
  adentro. **Los clientes del portal no ocupan asiento**: cobrar por ellos
  empujaría al despacho a no darles acceso.
- **La simulación no activa el plan.** Sin llaves la pantalla se recorre entera,
  dice qué se cobraría y no cambia nada. Si activara, un despliegue con la llave
  mal escrita regalaría el producto sin que nadie se enterara.
- **Webhook:** `POST /api/webhooks/suscripcion`, cuatro eventos
  (`checkout.session.completed` y `customer.subscription.created/updated/
  deleted`). Firma verificada a mano (`firma.ts`: HMAC-SHA256 sobre el cuerpo
  **crudo**, comparación en tiempo constante, ventana de cinco minutos contra
  reenvíos). Idempotencia por `evento_id` único en `suscripcion_eventos`. Sin
  `STRIPE_WEBHOOK_SECRET` contesta 503. Sin el SDK de Stripe: son dos POST
  form-encoded y una verificación de firma.
- ⚠️ `current_period_end` **se movió** al renglón de la suscripción en las
  versiones recientes de la API; `eventos.ts` lo lee en los dos lugares porque
  la versión de API la fija la cuenta, no este código.
- **Los números del plan gratuito viven en `TOPES_POR_PLAN`** y de ahí los toma
  la portada: si cambian, la promesa pública cambia con ellos. La `0012` los
  repite solo como valor por omisión de la columna, con el comentario que lo
  dice.
- **Los disparadores se prueban contra un Postgres de verdad.**
  `supabase/pruebas/correr.sh` levanta un Postgres de usar y tirar, aplica todas
  las migraciones en orden y corre 18 afirmaciones sobre el comportamiento real:
  que el 11º expediente se rechace con `LIT01`, que **con el plan al tope se
  pueda seguir asentando en la bitácora**, que cancelar no suspenda a nadie ni
  archive nada, y que el titular no pueda regalarse el plan. Un candado que solo
  vive en la base no se puede probar con Vitest. La `0010` se omite ahí: crea
  políticas sobre `storage.objects`, que solo existe en Supabase.
- ⚠️ **El portal de facturación exige una configuración creada en el panel de
  Stripe** (Ajustes → Facturación → Portal de clientes) y, en modo real, aviso
  de privacidad y términos publicados. Sin ella Stripe rechaza cada sesión, así
  que el botón falla siempre. La llave del conector de Stripe **no** puede
  crearla por API: hay que hacerlo desde el panel. El fallo se anuncia en
  pantalla (`?portal=error`) en vez de dejar el botón sin hacer nada.
- **Bloqueos:** el producto y el precio ya existen en la cuenta real
  (`prod_VBQnHcXM3sIe2J` / `price_1UB3wHRD2Fg2YJsu3660vmro`, $390 MXN por
  asiento al mes); faltan el endpoint del webhook con su `whsec_`, la
  configuración del portal, y decidir el IVA —el precio quedó con
  `tax_behavior: unspecified`, que Stripe deja cambiar una sola vez—. Litis
  todavía no tiene páginas de aviso de privacidad ni de términos, y el portal
  en modo real las pide. El precio sigue siendo una hipótesis, no una medición.

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
14. **Ningún secreto se guarda en claro.** Un token de invitación, y cualquier
    credencial que venga después, va a la base como hash y se compara en tiempo
    constante. El claro vive una vez, en la respuesta que lo generó.
15. **Un aviso que no salió no está dado.** Nada se marca como notificado sin
    haber salido de verdad, y si el registro de envíos no se puede leer, la
    corrida se detiene en vez de repetirlo todo.
16. **Ningún archivo de cliente vive en un bucket público.** Se descarga con URL
    firmada de vida corta, generada con la sesión de quien pide.
17. **El tope del plan nunca frena el trabajo con un término encima.** Solo
    puede impedir abrir un expediente y sumar un asiento; cerrar un plazo,
    asentar, subir un documento y recibir las alertas funcionan con la
    suscripción morosa o cancelada. Bajar de plan no suspende a nadie ni
    archiva nada. Hay pruebas que fijan la lista.
18. **Nombres de esquema y código en español.** NS Hub mezclaba columnas en
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
