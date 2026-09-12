# Plan de construcción

Una rebanada = un objetivo demostrable = un commit. El orden no es caprichoso:
está puesto para que **lo primero que exista sea lo que un litigante pagaría**,
y para poder enseñárselo a un abogado real lo antes posible.

---

## Hecho

### R0 — Núcleo de dominio y esquema ✅

Motor de plazos con traza auditable · calendarios de inhábiles · catálogo
semilla con verificación · alertas por ventanas en días hábiles · materias,
vías y etapas · partes · conflicto de interés · migraciones `0001`–`0005` con
RLS multi-tenant.

### R0-bis — Lógica de aplicación y plomería ✅

Apertura de expediente (número interno, clonado de etapas, qué bloquea y qué
solo advierte) · motor del panel "qué vence" con detección de choques de agenda
· clientes de Supabase, tipos de la base y proxy de sesión.

### R1 — Entrar y tener un despacho ✅

Registro, acceso, cierre de sesión y panel, con freno anti-fuerza-bruta en dos
dimensiones. El alta de despacho va por una función transaccional de la base
(`0006`) en vez de clave de servicio.

### R2 — Abrir un expediente ✅

Lista, alta y detalle. Revisión de conflicto de interés en el alta, con
constancia en la bitácora de quién la revisó. Etapas clonadas de la plantilla
de la vía. El consecutivo interno lo asigna la base, con reintento.

### R3 — Registrar una notificación y que el plazo se calcule solo ✅

**La rebanada que vende el producto.** Se captura la notificación, se elige el
plazo del catálogo (o se captura a mano), y el sistema propone el vencimiento
**con su traza completa a la vista**. El abogado confirma o ajusta con motivo.
La traza se guarda para poder auditarla después.

### R4 — "Qué vence" ✅

El panel de arranque con datos reales: plazos y audiencias en una lista
ordenada por urgencia en días hábiles, choques de agenda arriba y lo que no
tiene responsable resaltado. Cada pendiente se cuenta con su propio calendario.

### R4-bis — Cerrar el plazo ✅

Los plazos ya salen del panel: se presentó la promoción, o dejó de aplicar. La
presentación **extemporánea** se detecta contra el vencimiento releído de la
base, se advierte antes de guardar, exige reconocimiento expreso y queda
asentada como tal en la bitácora inmutable. Cancelar exige motivo y es de
`titular` o `abogado`. No hizo falta migración: las columnas de cierre ya
estaban en la `0005`.

### R2-bis — Editar el expediente ✅

Número del juzgado, instancia, entidad, cuantía, responsable, etapa, situación
y resultado; y alta de partes sobre un expediente ya abierto, con el cotejo de
conflicto de interés corriendo otra vez. La materia, la vía y el fuero quedan
fuera a propósito. Cerrar un asunto con plazos corriendo se bloquea. Los
cambios que importan van a la bitácora en una sola anotación.

### Identidad visual ✅

Sistema de diseño propio a partir del material de un litigante mexicano, con
la **cinta de días hábiles** como elemento de firma — el gráfico que hace
visible que "faltan veinte días" pueden ser dos de trabajo. Detalle en
[`docs/DISENO.md`](DISENO.md).

### R1-bis — Invitar al equipo ✅

Invitación por correo con papel, aceptación, cambio de papel y baja. El token
se guarda hasheado y caduca en siete días; el enlace por sí solo no basta, el
correo de la sesión tiene que coincidir. La baja suspende, no borra — la
bitácora tiene que seguir firmada. Un pendiente a nombre de alguien dado de
baja pasa a contar como huérfano en el panel. Migración `0009`.

Trae también el módulo de correo (`src/lib/email/`), que R5 va a reusar:
plantilla en tablas con versión de texto plano, y envío por Resend que degrada
a simulación sin API key.

### R5 — Alertas por correo ✅

**La promesa central.** Corrida diaria por `GET /api/cron/alertas-plazos`,
protegida con `CRON_SECRET` (sin él: 503). Un correo por persona con todo lo
suyo ordenado por urgencia; lo que no tiene responsable le llega al titular.
Si no se puede leer el registro de envíos, la corrida se detiene y avisa en vez
de reenviarle el mismo aviso a todos. Un envío simulado no se registra. Sin
migración: `plazo_alertas_enviadas` ya estaba en la `0005`.

### R6 — Bitácora y documentos ✅

La bitácora se lee y se puede asentar a mano, con la advertencia de que no se
edita ni se borra. Documentos en bucket **privado** con URL firmada de un
minuto, tipo, versión y acuse ligado al escrito que ampara. Una nota interna
nunca se marca visible para el cliente. Migración `0010`.

### R7 — Agenda de audiencias ✅

Alta, diferimiento y celebración. Audiencias y vencimientos en el mismo
calendario, con los días imposibles arriba. Un día con audiencia queda marcado
como tomado. Diferir deja dos registros: la vieja asentada y la nueva. Sin
migración.

### Portada pública ✅

Encabezado con la cinta, el problema, la traza del cómputo **producida por el
motor real**, qué hace, qué NO hace, y precios por usuario al mes con nivel
gratuito. Los precios viven en `src/lib/marketing/planes.ts` y la página dice
que son una hipótesis, no una medición.

### R10 — Verificación del catálogo ✅

La pantalla donde un abogado revisa cada plazo y lo firma. Verificar **adopta**
la entrada al despacho: la semilla compartida queda intacta y sin verificar para
los demás, porque la firma vale para quien la pone. Se distingue verificada de
corregida, y una corrección que cambia los números avisa cuántos plazos vivos
quedaron mal computados —sin recalcularlos solos—. Sin migración.

### R8 — Tablero de etapas ✅

Seis columnas universales que le quedan a cualquier vía, con la etapa real en
cada tarjeta. Los estancados —sin plazo y sin movimiento en 60 días— van
arriba, y los sin etapa aparte. Sin arrastrar y soltar: mover escribe en la
bitácora inmutable. Sin migración.

### R9 — Portal del cliente ✅

Solo lectura: en qué va el asunto en lenguaje llano, próximas audiencias, lo
que el despacho marcó visible en la bitácora y en los documentos. Nunca los
plazos. No promete fechas ni resultados, y sí dice cuándo se movió por última
vez. El acceso se abre desde el expediente y la persona del padrón la fija la
invitación. Migración `0011`.

### R11 — Suscripción ✅

Cobro por asiento al mes con nivel gratuito, por Stripe Checkout hospedado y con
degradación a simulación sin llaves. El tope del plan gratuito —un asiento y
diez expedientes activos— lo aplican disparadores de la base, no la Server
Action: la comprobación de la aplicación existe para dar un mensaje que diga
cómo salir. Las columnas de plan quedaron blindadas contra la sesión del propio
titular, que hasta ahora podía escribírselas.

La decisión que ordena todo lo demás: **el tope solo frena abrir un expediente y
sumar un asiento**. Cerrar un plazo, asentar, subir documentos y recibir alertas
funcionan con la suscripción morosa o cancelada, y bajar de plan no suspende a
nadie ni archiva nada. Migración `0012`.

**530 pruebas** en Vitest y **32 afirmaciones sobre la base** corriendo las
migraciones contra un Postgres de verdad (`supabase/pruebas/correr.sh`): 18 de
los topes de la `0012` y 14 de la semilla de la `0008`.
Typecheck, lint y build limpios.
Migraciones `0001`–`0012` aplicadas y comprobadas contra el esquema vivo. La
`0008` llevaba tiempo sin aplicar sin que nada lo dijera; ya está, con la
semilla de calendarios y catálogo dentro y sin una sola entrada verificada.

---

## Siguiente

Antes de seguir agregando: **un litigante real usando esto**. Lo que falta para
poder cobrarle está identificado y no es código —el catálogo de plazos sin
verificar y el precio sin medir—, así que la siguiente rebanada se elige con lo
que ese despacho diga.

### Pendientes que no son rebanada

- **Terminar de conectar Stripe.** El producto y el precio ya existen en la
  cuenta real (`$390 MXN` por asiento al mes); faltan el endpoint del webhook
  con su `whsec_`, la configuración del portal de facturación —que la llave del
  conector no puede crear por API— y decidir si el precio lleva IVA incluido o
  por encima.

  **Antes de eso: autorizar el conector de Stripe.** Está disponible en la
  sesión pero sin autorizar, y el flujo es OAuth en un navegador: no se puede
  completar desde una sesión en la nube. Se hace desde los conectores de
  claude.ai o con `/mcp` en una sesión interactiva, una sola vez. Con él, el
  endpoint del webhook y su `whsec_` se crean desde aquí; la configuración del
  portal sigue siendo a mano. Detalle en
  [`docs/HERRAMIENTAS.md`](HERRAMIENTAS.md).
- **Llenar los datos del responsable** en `src/lib/legal/responsable.ts` y que
  un abogado revise el aviso de privacidad y los términos. Mientras falten, las
  dos páginas se anuncian solas como borrador.
- **Exportar el despacho con un botón.** Los términos dicen que los datos son
  del despacho y que se entregan a solicitud; hoy ese camino es manual, y
  haberlo escrito obliga a construirlo.
- **Que un abogado verifique el catálogo de plazos.** Todo sigue saliendo como
  `semilla_no_verificada`, a propósito. R10 construyó la pantalla; falta la
  firma.
- **Recorrer el panel con una cuenta de verdad.** Ninguna pantalla con sesión
  —panel, expediente, tablero, portal— se ha visto corriendo contra Supabase:
  las pruebas son de dominio puro y no cubren esas páginas.

  Para hacerlo hay que **registrarse con un correo real**: el proyecto tiene
  `mailer_autoconfirm: false`, así que exige confirmar por correo y con una
  dirección inventada no se pasa de ahí. Lo que sí quedó comprobado en el
  intento: el segundo camino de registro funciona —el alta cae en
  `/bienvenida` y `crear_mi_despacho` deja perfil, despacho y membresía—.

  ⚠️ **Lo que quedó sin resolver:** con un usuario insertado a mano en
  `auth.users` el acceso prospera (Supabase devuelve token, la Server Action
  responde `error: null` con 303 y la cookie `sb-…-auth-token` se pone) pero
  toda ruta protegida rebota a `/acceso`. **No se sabe si es un defecto del
  proxy o un artefacto del usuario sintético**, al que pudo faltarle algún
  campo que espera `@supabase/ssr`. Con una cuenta nacida del alta real se
  despeja en un minuto: si entra, era el usuario falso; si rebota, hay que
  mirar `src/proxy.ts`.

---

## Después, cuando haya uso real

- **Honorarios y gastos** — iguala, cuota litis, por hora, fijo por etapa.
  Registro de tiempos.
- **Plantillas de escritos** con datos del expediente.
- **Consulta automática de boletines judiciales.** El mayor ahorro de tiempo
  posible y también lo más frágil: depende de sistemas que cambian sin avisar.
  Va después de que el resto sea sólido, nunca antes.
- **Materia corporativa a fondo** — el objetivo declarado es cubrir litigio y
  corporativo; el litigio va primero porque ahí está el dolor caro.
- **Aplicación móvil o PWA** para consultar en el juzgado.

---

## Criterios para no adelantarse

| Pieza | Se construye cuando… |
|---|---|
| Consulta de boletines | R1–R9 estén en uso por un despacho real |
| Firma electrónica | Un despacho la exija |
| IA sobre expedientes | Haya un caso de uso concreto, con SDK directo y sin framework de por medio |
| Colas asíncronas | El volumen de correo lo justifique |
| Aplicación móvil | La web se use a diario |
