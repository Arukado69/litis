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
RLS multi-tenant. **87 pruebas.**

---

## Siguiente

### R1 — Entrar y tener un despacho
Registro, acceso, alta de despacho, invitación de miembros por rol. Freno
anti-fuerza-bruta desde el primer día. Sin esto no hay nada que probar.

### R2 — Abrir un expediente
Alta con materia, vía, fuero, órgano y partes. Clonado de etapas de la
plantilla. Revisión de conflicto de interés en el alta, con constancia de quién
la revisó. Consecutivo interno automático.

### R3 — Registrar una notificación y que el plazo se calcule solo
**La rebanada que vende el producto.** Se captura la notificación como
actuación, se elige el plazo del catálogo y el sistema propone el vencimiento
**con su traza a la vista**. El abogado confirma o ajusta con motivo.

Al terminar R3 hay algo que enseñar.

### R4 — "Qué vence esta semana"
El panel de arranque: plazos ordenados por urgencia en días hábiles, audiencias
de la semana y expedientes sin movimiento. No un Kanban donde haya que adivinar
por dónde empezar.

### R5 — Alertas por correo
Cron protegido con `CRON_SECRET`. Si no se puede leer el registro de envíos, la
corrida **se detiene y alerta** en vez de reenviarle el mismo aviso a todos —
la lección de la migración `0037` del proyecto anterior.

### R6 — Bitácora y documentos
Actuaciones con `visible_cliente`. Documentos en bucket privado con URL firmada,
tipo, versión y acuse.

### R7 — Agenda de audiencias
Vista de calendario con audiencias y vencimientos juntos. Es la vista que un
litigante abre primero en la mañana.

### R8 — Tablero de etapas
Ahora sí el Kanban, con las etapas reales de cada vía y las paralelas fuera del
avance.

### R9 — Portal del cliente
Solo lectura: en qué va su asunto en lenguaje llano, próxima audiencia,
documentos compartidos. Ataca el "¿cómo va lo mío?" semanal.

### R10 — Verificación del catálogo
La pantalla donde un abogado revisa cada plazo y lo marca verificado con notas.
Sin esto, todo el sistema opera marcado como no verificado — que es correcto,
pero no puede ser el estado permanente.

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
