# Cómputo de plazos procesales

> El módulo más importante del producto y el único donde un error tiene
> consecuencias que no se pueden deshacer.

---

## 1. El error que este módulo existe para evitar

Entre la notificación y el primer día del plazo hay **dos saltos**, no uno:

```
notificación ──▶ surte efectos ──▶ empieza a correr el plazo
```

En materia mercantil la notificación surte efectos al día siguiente, y el plazo
empieza a correr al día siguiente de que surtió.

> Notificado el **lunes** → surte efectos el **martes** → el plazo corre desde
> el **miércoles**.

Quien cuenta desde el lunes se equivoca por dos días y presenta fuera de
término. Quien cuenta desde el martes, por uno.

En amparo la cosa cambia: hay notificaciones que surten efectos **el mismo día**
en que se practican, según a quién se notifique. Ahí el salto es uno solo.

Esa asimetría entre ordenamientos es la razón de que las reglas vivan en una
tabla explícita (`src/lib/plazos/regimenes.ts`) y no en un `if` escondido.

## 2. Las tres reglas que se aplican siempre

1. **El plazo corre desde el día siguiente** a aquel en que surtió efectos la
   notificación.
2. **El día del vencimiento se cuenta** dentro del plazo. Está dicho con todas
   sus letras en los ordenamientos, y es donde más se equivoca quien cuenta a
   mano: un plazo de 9 días que arranca el lunes vence el jueves de la semana
   siguiente, no el viernes.
3. **Se cuentan días hábiles**, salvo que la ley diga naturales. En días
   naturales, si el vencimiento cae en día inhábil se recorre al siguiente
   hábil, porque el órgano no recibe promociones ese día.

## 3. El calendario: cuatro capas que no coinciden

No existe "el" calendario de días inhábiles en México. Conviven al menos cuatro
y las cuatro cambian:

1. **Feriados de ley.** Y aquí hay una trampa fina: la Ley Federal del Trabajo
   recorre varios feriados al **lunes** más cercano (primer lunes de febrero,
   tercer lunes de marzo, tercer lunes de noviembre), mientras que la Ley
   Orgánica del Poder Judicial de la Federación los fija en su **fecha
   original** (5 de febrero, 21 de marzo, 20 de noviembre).

   > En 2026 se ve a simple vista: el tercer lunes de marzo es el **16** y es
   > inhábil en materia laboral; para el PJF el inhábil es el **21**, que cae
   > sábado y ya era inhábil de todos modos. **Un plazo de 9 días corrido sobre
   > uno u otro calendario vence en días distintos.** Hay una prueba que fija
   > exactamente ese contraste para que nadie funda los dos calendarios
   > "simplificando".

2. **Periodos vacacionales**, que cada órgano fija por acuerdo cada año. El del
   Poder Judicial de la Federación no coincide con el del Tribunal Superior de
   Justicia de cada entidad, ni con el del TFJA, ni con el de los Tribunales
   Laborales.

3. **Suspensiones de labores** por acuerdo del propio órgano: contingencias,
   jornadas electorales, cambios de sistema.

4. **Lo que suspenda ese tribunal en particular.**

Por eso el calendario se guarda **por órgano** y es dato editable, no código. Un
calendario incompleto produce un vencimiento **adelantado** respecto del real —
error conservador, pero error — y por eso todo resultado viaja con la cobertura
del calendario usado: si el plazo aterriza fuera de la vigencia capturada, el
motor lo dice.

## 4. Qué entrega el motor

`computarPlazo()` no devuelve una fecha: devuelve el **razonamiento completo**.

```ts
{
  fechaSurteEfectos, primerDia, fechaVencimiento,
  diasContados,      // los días hábiles que integraron el plazo, en orden
  diasOmitidos,      // los que se saltaron, con su motivo
  pasos,             // la traza auditable, paso por paso
  fundamentos,       // los artículos aplicados
  advertencias,
  confiabilidad,     // 'semilla_no_verificada' | 'verificado_por_despacho'
  coberturaCompleta, // ¿el calendario cubría todo el tramo?
}
```

Un abogado no puede firmar una promoción confiando en una fecha que le escupió
una caja negra: si el cómputo está mal, el que responde ante el cliente y ante
la barra es él. La traza permite auditar en treinta segundos y corregir cuando
haga falta.

La traza se guarda en la columna `plazos.computo` (jsonb). Eso da tres cosas:
auditoría a seis meses vista, reproducibilidad (corregir el calendario mañana
no cambia solo los plazos ya computados) y defensa documentada.

## 5. ⚠️ Verificación: por qué nada sale de fábrica como verdad

**Todo el catálogo se entrega marcado `semilla_no_verificada`.** Hay una prueba
que falla si alguna entrada llegara marcada como verificada.

No es humildad decorativa. Son tres razones concretas:

- **Los ordenamientos se reforman**, y los plazos son de lo primero que se
  toca.
- **El Código Nacional de Procedimientos Civiles y Familiares** (DOF
  07/06/2023) está sustituyendo de forma escalonada a los códigos procesales
  civiles y familiares de las entidades, con fecha límite de entrada en vigor el
  **1 de abril de 2027**. Durante esa transición conviven dos regímenes según la
  entidad y según la fecha de inicio del asunto. Un catálogo estático miente.
- **Las reglas locales varían** por entidad, y un mismo recurso tiene plazos
  distintos según la vía y la cuantía.

Por eso el flujo del producto es, sin excepción:

> **la herramienta propone → el abogado verifica → queda la constancia**

`plazos_catalogo` guarda `verificado_por`, `verificado_el` y
`verificacion_notas`, con un check que impide media verificación. Solo los roles
`titular` y `abogado` pueden verificar: un asistente captura expedientes, pero
declarar que un plazo legal es correcto es acto de abogado.

Mientras la verificación esté vacía, la interfaz muestra el cómputo marcado. Y
la cadena vale su eslabón más débil: si el régimen está verificado pero el plazo
no, el resultado sigue siendo no verificado.

## 6. El abogado manda sobre el motor

`plazos.fecha_vencimiento_ajustada` permite sobrescribir el resultado a mano.
**Tiene que existir**: el motor no conoce el acuerdo que habilitó días y horas,
ni la suspensión que decretó el juez ayer. Un sistema que no deja corregir
obliga a llevar el plazo bueno en un papel aparte — y entonces el sistema sobra.

Pero ajustar **exige motivo** (lo fuerza un `check` en la base) y deja quién y
cuándo. La fecha que manda es la columna generada
`fecha_vencimiento_efectiva`, para que ninguna consulta se equivoque de columna.

## 7. Alertas

Se cuentan en **días hábiles**, no naturales.

> "Faltan 3 días" no significa nada para quien tiene que redactar, imprimir,
> firmar y presentar. Si esos tres días son viernes, sábado y domingo, falta
> **un** día de trabajo.

El caso extremo está fijado en una prueba: entre el 15 de julio y el 3 de agosto
de 2026 hay **19 días naturales** y, con el periodo vacacional del órgano de por
medio, **un solo día hábil**. Un aviso en días naturales llega tarde justo en
los puentes y las vacaciones, que es cuando la gente se confía.

Niveles: `t_menos_5`, `t_menos_3`, `t_menos_1`, `vence_hoy`, `vencido`.

Son **ventanas**, no días exactos: si el aviso de "faltan 3" solo se disparara
cuando faltan exactamente 3, un cron que no corrió ese día lo pierde para
siempre. Cada nivel se manda una sola vez por plazo; la idempotencia entra como
parámetro y el índice único `(plazo_id, nivel)` es la red final.

Un plazo `atendido` no genera alertas. Llenar de avisos lo que ya está hecho
enseña a ignorar los avisos.

## 8. Fuera de alcance, dicho en voz alta

- **Plazos en horas.** El sistema penal acusatorio tiene plazos que corren en
  horas (control de detención, plazo constitucional). No se calculan aquí y no
  se van a aproximar.
- **Término de la distancia.** Se puede sumar como días adicionales, pero el
  motor no decide si procede ni cuántos: eso lo captura el abogado y el
  resultado lo deja asentado en las advertencias.
- **Determinar qué plazo aplica.** El motor computa el plazo que se le dé. Cuál
  corresponde a este asunto es criterio profesional.

## 9. Dónde está el código

| Archivo | Qué hace |
|---|---|
| `src/lib/plazos/fecha.ts` | Aritmética de fechas civiles en UTC, sin husos |
| `src/lib/plazos/calendario.ts` | Días inhábiles y conteo de hábiles |
| `src/lib/plazos/calendarios-semilla.ts` | PJF 2026 y laboral 2026 |
| `src/lib/plazos/regimenes.ts` | Cuándo surte efectos cada notificación |
| `src/lib/plazos/computo.ts` | El motor |
| `src/lib/plazos/catalogo.ts` | Catálogo semilla de plazos |
| `src/lib/plazos/alertas.ts` | Ventanas de aviso en días hábiles |

Todo es puro y sin efectos. 45 pruebas cubren el módulo.

### Una nota sobre `fecha.ts`

Un plazo es una fecha de calendario, no un instante. `new Date('2026-03-15')` se
interpreta como medianoche UTC y, al imprimirla en `America/Mexico_City`
(UTC−6), se corre al día 14. **Ese error de un día es exactamente el que hace
perder un término.** Por eso todo se representa como `yyyy-mm-dd` y la
aritmética ocurre en UTC; la conversión a hora local pasa solo al formatear.
