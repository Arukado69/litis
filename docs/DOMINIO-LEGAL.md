# El dominio: cómo trabaja realmente un litigante en México

> Este documento existe porque quien construye el producto no es abogado. Es el
> modelo mental que hay que tener para no diseñar pantallas que un litigante
> mire y descarte en diez segundos.
>
> **Advertencia de alcance:** esto es una descripción operativa para diseñar
> software, no una fuente de derecho. Los artículos citados son referencias de
> partida y deben verificarse contra el texto vigente. Ver
> [`PLAZOS.md`](PLAZOS.md) §5.

---

## 1. Lo que un despacho pequeño hace todos los días

El usuario objetivo no es el socio de una firma de doscientos abogados. Es el
litigante solo, o el despacho de tres a ocho personas: un titular, uno o dos
abogados, un pasante y quien contesta el teléfono. Su día se va en cinco cosas:

1. **Revisar qué se acordó** en cada uno de sus asuntos. Antes era ir al
   juzgado a "ver la lista"; hoy es abrir tres o cuatro sistemas distintos.
2. **Computar plazos** de lo que se notificó, y no perderlos.
3. **Redactar y presentar** promociones antes del vencimiento.
4. **Ir a audiencias**, que se agendan con semanas de anticipación y se
   difieren con horas.
5. **Contestarle al cliente** que pregunta cómo va, por décima vez.

Nada de eso lo resuelve un gestor de tareas genérico, y por una razón concreta:
**las fechas no se ponen a mano, se calculan**, y calcularlas mal tiene
consecuencias que no tiene entregar tarde un ticket de software.

## 2. El miedo que vende el producto

Un término vencido no es un retraso. Es:

- La pérdida definitiva del derecho — no se puede contestar después, no se
  puede apelar después.
- Responsabilidad civil frente al cliente por el daño causado.
- Una queja ante el colegio o barra, con la sanción que corresponda.
- En el peor caso, responsabilidad penal si hubo dolo.

Por eso el corazón del producto es el cómputo de plazos y no el tablero bonito.
Un litigante paga por dormir tranquilo, no por organizar tarjetas.

---

## 3. El expediente

Es la unidad central. Reemplaza por completo la idea de "caso derivado de un
paquete de servicios" que tenía el producto anterior.

### 3.1 Identificación

| Dato | Por qué importa |
|---|---|
| **Número interno** | El consecutivo del despacho. Existe desde antes de que haya juzgado; es como el equipo se refiere al asunto de viva voz |
| **Número del órgano** (`123/2026`) | Lo asigna el juzgado al admitir. **Nace vacío**: exigirlo al alta obliga a inventarlo |
| **Carátula** | `Pérez vs. Constructora XYZ`. Se deriva de las partes, pero se guarda: el nombre con el que se conoce un asunto no siempre es el literal |
| **Toca** | En segunda instancia el expediente tiene otro número. No sustituye al de primera: conviven |

### 3.2 Clasificación

- **Materia** — civil, mercantil, familiar, laboral, penal, administrativo,
  fiscal, amparo, corporativo.
- **Vía** — *la unidad que de verdad manda*. Ver §4.
- **Fuero** — federal o común. Determina el órgano, el calendario de días
  inhábiles y a veces el plazo. **No es un adorno**: un expediente sin fuero no
  puede computar plazos con confianza.
- **Entidad federativa** — porque los códigos locales difieren.
- **Instancia** — primera, apelación, amparo directo, amparo indirecto,
  revisión.

### 3.3 Las partes

El rol de cada parte **depende de la materia**, y no es cosmético:

| Materia | Roles |
|---|---|
| Civil / mercantil | actor, demandado, tercero llamado a juicio |
| Familiar | promovente, contraparte, y el Ministerio Público cuando hay menores |
| Laboral | trabajador, patrón, sindicato, beneficiarios |
| Penal | imputado, víctima u ofendido, Ministerio Público, defensor, asesor jurídico |
| Administrativo / fiscal | actor, autoridad demandada, tercero interesado |
| **Amparo** | **quejoso, autoridad responsable, tercero interesado, MP federal** |

El caso del amparo es el que obliga a modelarlo bien: **de qué lado estás
cambia cuándo surte efectos la notificación**, y con eso, la fecha de
vencimiento. Un modelo que solo distinga "cliente" y "contraparte" calcula mal.

También hay que guardar **con qué carácter interviene el despacho**: apoderado,
abogado patrono, defensor, asesor jurídico de la víctima, o simple autorizado
para oír notificaciones. No todos pueden hacer lo mismo.

Y hay que guardar **al abogado de la contraparte**. Es con quien se negocia, y
es un dato central para el conflicto de interés.

---

## 4. Por qué la **vía** es la unidad y no la materia

Decir que un asunto es "mercantil" no determina casi nada operativo:

- En el **ejecutivo mercantil** se requiere de pago, se embarga y *después* se
  emplaza. El embargo es la etapa que define el asunto.
- En el **ordinario mercantil** no existe esa etapa.

Misma materia, procedimientos distintos. Por eso las etapas, los plazos
sugeridos y los roles cuelgan de la vía.

Ejemplos de plantillas reales, implementadas en `src/lib/expedientes/etapas.ts`:

**Ejecutivo mercantil** → preparación · demanda · auto de exequendo ·
**requerimiento y embargo** · contestación y excepciones · pruebas · alegatos ·
sentencia · remate.

**Amparo indirecto** → preparación · demanda · admisión o prevención ·
*suspensión provisional* · *incidente de suspensión* · informes justificados ·
audiencia constitucional · sentencia · revisión · cumplimiento.

**Laboral** → **conciliación prejudicial** · demanda ante Tribunal Laboral ·
admisión · contestación · audiencia preliminar · audiencia de juicio ·
sentencia · amparo directo · ejecución.

**Sucesorio** → cuatro secciones que corren juntas, no una secuencia.

### 4.1 Etapas paralelas

En amparo, el **incidente de suspensión** corre al mismo tiempo que el cuaderno
principal, con su propia audiencia y sus propios plazos. Un expediente no *está
en* suspensión: la *tiene*. Modelarlo como columna del tablero haría que mover
el asunto a "suspensión" perdiera de vista el principal.

Por eso las etapas llevan `paralela: true` y quedan fuera de la barra de avance.

### 4.2 Las etapas se clonan

Al abrir un expediente se copian las etapas de la plantilla. A partir de ahí son
suyas. Si se referenciara la plantilla, corregir una etiqueta reescribiría el
histórico de trescientos asuntos ya cerrados.

---

## 5. La bitácora de actuaciones

Es el expediente en el sentido literal: qué pasó y cuándo.

Tipos: promoción, acuerdo, notificación, resolución, audiencia, diligencia,
comunicación con el cliente, nota interna.

Dos reglas de diseño, ambas con consecuencia jurídica:

**Es inmutable.** No hay política de UPDATE ni de DELETE en la base. Una
bitácora editable hacia atrás no prueba nada el día que haya que acreditar que
el asunto se llevó con diligencia. Corregir se hace agregando una actuación que
rectifique, con su fecha y su autor.

**Tiene dos caras.** `visible_cliente` separa lo que el cliente puede leer de lo
que no. El abogado necesita anotar su valoración honesta del asunto y que el
cliente no la lea; el cliente necesita ver el avance sin llamar cada semana. La
bandera se respeta en la RLS, no en la consulta de la aplicación.

**La fecha de la actuación no es la de captura.** Se captura el lunes lo que
pasó el viernes, y el cómputo de plazos depende de la fecha real.

---

## 6. Conflicto de interés

Aceptar un asunto contra quien ya es cliente del despacho es de las pocas cosas
que pueden costar la cédula. En un despacho chico se "resuelve" preguntando en
voz alta si a alguien le suena el nombre — hasta que hay cuatrocientos
expedientes.

Por eso **clientes y contrapartes viven en la misma tabla**: sin registrar a la
contraparte no hay forma de detectar el conflicto.

El motor (`src/lib/conflictos/deteccion.ts`) cruza las partes del asunto nuevo
contra el padrón y devuelve hallazgos con su evidencia — RFC idéntico, nombre
idéntico, nombre contenido — para que un homónimo se descarte en cinco
segundos.

Tres decisiones de diseño que importan:

1. **No decide.** Devuelve `impedimento` o `revisar`, nunca "puedes
   aceptarlo". Si el conflicto es dispensable, si los asuntos son conexos o si
   basta el consentimiento informado es juicio profesional, no salida de una
   función.
2. **Sin puntajes difusos.** Cada hallazgo dice en qué coincidió. Un porcentaje
   que nadie puede auditar produce dos conductas malas: ignorar todo, o
   paralizarse con cada falso positivo.
3. **El cliente que regresa no es hallazgo.** Volver a representar a un cliente
   activo es el caso más común que hay; marcarlo llenaría de ruido cada alta y
   enseñaría a ignorar la alerta.

---

## 7. Honorarios (etapa posterior, pero el modelo debe admitirlo)

Un despacho mexicano cobra de cuatro formas, y a menudo mezcla varias en el
mismo asunto:

- **Iguala** — cuota mensual por disponibilidad.
- **Cuota litis** — porcentaje del resultado.
- **Por hora** — exige registro de tiempos.
- **Fijo por asunto o por etapa** — lo más común en despachos chicos.

Más **gastos y costas** reembolsables: copias, notificaciones, peritos,
viáticos, derechos. Se anticipan y se recuperan, y llevarlos mal es la primera
fuente de fricción con el cliente.

Lo único que este modelo no puede hacer es asumir "una cuota mensual y ya" —
que es justo lo que asumía el producto anterior.

---

## 8. Protección de datos: el SaaS es *encargado*, el despacho es *responsable*

Un expediente contiene datos personales, y en materia penal y familiar, **datos
personales sensibles**. Bajo la ley mexicana de protección de datos en posesión
de particulares, el despacho es el **responsable** del tratamiento y la
plataforma es **encargado**.

Consecuencias concretas para el producto, no para el abogado del proveedor:

- Hace falta un **contrato de encargado** con cada despacho. No es opcional.
- El aislamiento entre despachos no es higiene de software: es la condición
  para que el despacho pueda cumplir su deber de secreto profesional. Por eso
  el multi-tenant es la migración `0001` y no un añadido posterior.
- Debe existir forma de **exportar y de borrar** todo lo de un despacho.
- Los binarios van en bucket privado con URL firmada de vida corta, nunca
  servidos directo.

---

## 9. Lo que este producto **no** debe hacer

Vale la pena dejarlo escrito para que no se cuele por buenas intenciones:

- **No dictamina.** No dice si una acción procede, si un plazo aplica ni si
  conviene apelar.
- **No redacta escritos que se presenten sin revisión.** Puede armar plantillas;
  el que firma responde.
- **No calcula plazos en horas** (control de detención, plazo constitucional).
  Está fuera de alcance y hay que decirlo, no aproximarlo.
- **No promete que su catálogo esté vigente.** Ver [`PLAZOS.md`](PLAZOS.md) §5.
