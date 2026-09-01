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

**485 pruebas.** Typecheck, lint y build limpios.
Migraciones `0001`–`0010` aplicadas; **falta aplicar la `0011`**.

---

## Siguiente

### R11 — Suscripción
Stripe por usuario/mes con nivel gratuito. Tope de asientos y de expedientes
activos en el plan gratuito.

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
