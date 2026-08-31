# Identidad visual — "el expediente cosido"

Litis no se parece a un panel de SaaS a propósito. Lo usa un litigante que
lleva treinta asuntos y abre la computadora a las siete de la mañana con una
pregunta: **qué se me vence hoy**. Todo lo de aquí está puesto para contestar
eso rápido y sin adornos.

---

## 1. De dónde sale la forma

Del material con el que trabaja un litigante mexicano, no de una plantilla:

| Del mundo real | En pantalla |
|---|---|
| El archivero verde-gris de un juzgado | El fondo (`--color-archivo`) |
| La foja del expediente | Las superficies (`--color-foja`) |
| La tinta azul-negra de una pluma de oficio | El texto (`--color-tinta`) |
| El sello de recibido, en violeta de metilo | El único acento (`--color-sello`) |
| El margen rojo de la hoja de máquina | La urgencia (`--color-urgente`) |

Los tokens viven en `src/app/globals.css`, bajo `@theme`.

---

## 2. La cinta de días

**Es el único gráfico del sistema, y ahí se gasta toda la audacia.**

Cada casilla es un día natural entre hoy y el vencimiento: llena si es hábil,
vacía si no, y la última —más alta y en rojo— es el vencimiento.

Existe porque el error que hace perder términos es exactamente ese. *"Faltan
veinte días"* suena holgado hasta que se ve que dieciocho casillas están vacías
porque el órgano está de vacaciones y solo quedan dos de trabajo. Ese caso no
es hipotético: es julio en el Poder Judicial de la Federación, y está fijado en
una prueba.

No es adorno. Cada casilla es un día real del calendario **de ese plazo**, no
de un calendario general: un asunto federal y uno local no comparten periodo
vacacional, y pintarlos con el mismo haría que la cinta mintiera.

- Motor: `tramoDeDias` en `src/lib/plazos/calendario.ts` (puro, con pruebas).
- Componente: `CintaDias` en `src/components/ui/primitivos.tsx`.
- Lleva descripción para lector de pantalla: un gráfico que solo funciona
  viendo colores no funciona.

La portada la usa en grande, con datos del motor real. Si algún día se corrige
el calendario, la portada se corrige sola — no hay manera de que la promesa y
el motor se separen.

---

## 3. Tipografía

Dos familias, auto-hospedadas con `next/font` (`src/app/fuentes.ts`):

- **Archivo** (Omnibus-Type, Buenos Aires) para la obra. Grotesca variable
  pensada para texto denso en pantalla y dibujada para el español. Se llama
  como se llama por una razón que aquí encaja.
- **Petrona** (Huerta Tipográfica) para los títulos. Serif variable diseñada
  para el español latinoamericano; da autoridad de documento sin caer en la
  serif de alto contraste que se reparte por defecto.

Escala de tercera mayor (1.25) sobre 15px, recortada a seis tamaños:
`--text-nota` · `--text-menor` · `--text-obra` · `--text-guia` ·
`--text-rotulo` · `--text-portada`.

⚠️ **Cifras tabulares en todo el `body`.** Este producto son columnas de fechas
("3 de septiembre"), de números de expediente ("431/2026") y de días
restantes. Con cifras proporcionales el «1» mide menos que el «8», las columnas
bailan, y comparar dos renglones de un vistazo deja de funcionar solo.

---

## 4. Las reglas del sistema

1. **Sin sombras.** El papel no tiene sombra. La separación es una regla de un
   pixel o un cambio de fondo. En las listas el fondo ES la regla, y los
   renglones son las fojas encima.
2. **El color solo informa.** Violeta = el sistema hizo algo. Rojo = un término
   en riesgo. Verde = en tiempo. Ningún color decora.
3. **Sin versalitas rastreadas de rótulo.** Gritar «FECHA» encima de una fecha
   no aclara nada, y es el tic más repetido de una pantalla de plantilla.
4. **Numerar solo lo que es secuencia.** Las etapas del juicio van numeradas
   porque a la cuatro no se llega sin pasar por la tres. Las paralelas van
   aparte y sin número, justamente porque no ocupan lugar en esa cuenta.
5. **Densidad antes que aire.** Un litigante escanea cuarenta asuntos; no
   contempla tres tarjetas.
6. **El foco se ve.** Esto se navega con teclado todo el día.

---

## 5. Lo que se descartó, y por qué

Los tres caminos fáciles, rechazados a propósito:

- **Crema cálido + serif de alto contraste + acento terracota.** Es el aspecto
  por defecto de casi cualquier página generada hoy. Se ve igual en un
  despacho que en una cafetería, así que no dice nada de este producto.
- **El juego de tarjetas de SaaS:** todo troceado en rectángulos redondeados
  idénticos, la misma sombra gris debajo de cada uno, degradados de adorno. Es
  cromo ocupando el lugar donde cabría un renglón más de expediente.
- **Cromo de plantilla:** rótulos en versalitas rastreadas, cadenas de datos
  unidas por puntos medios, flechitas «→» pegadas a cada botón.

---

## 6. Dónde está

| Archivo | Qué tiene |
|---|---|
| `src/app/globals.css` | Tokens, tipografía base, la cinta y el margen |
| `src/app/fuentes.ts` | Las dos familias |
| `src/components/ui/primitivos.tsx` | Foja, Boton, Campo, Selector, Area, Casilla, Aviso, Sello, Dato, Rotulo, CintaDias |
| `src/lib/plazos/calendario.ts` | `tramoDeDias`, el motor de la cinta |
