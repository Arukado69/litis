# Litis

**Gestión de expedientes, plazos procesales y audiencias para abogados
litigantes en México.**

Un litigante solo o un despacho de tres personas lleva hoy sus asuntos con
Excel, WhatsApp y memoria. Lo que se le puede perder no es una tarea: es un
término. Y un término vencido no se recupera — se pierde el derecho, y con él,
el cliente y a veces la cédula.

Litis existe para eso: **computa los plazos con su fundamento a la vista y avisa
antes de que venzan.**

> *Litis* es el nombre de trabajo. Se cambia editando `src/lib/brand`.

---

## Qué hace distinto

**Calcula el plazo y muestra el porqué.** No entrega una fecha: entrega el
razonamiento — cuándo surtió efectos la notificación, cuál fue el primer día,
qué días se saltaron y con qué fundamento. Un abogado no puede firmar
confiando en una caja negra.

**Sabe que hay dos saltos, no uno.** En mercantil, notificado el lunes el plazo
corre desde el miércoles. Quien cuenta desde el lunes presenta fuera de término.

**Cuenta en días hábiles, con el calendario del órgano.** Entre el 15 de julio y
el 3 de agosto de 2026 hay 19 días naturales y **un** día hábil, porque el
órgano está de vacaciones. Un aviso en días naturales llega tarde justo cuando
más se confía uno.

**No finge certeza.** Todo el catálogo se entrega marcado como no verificado, y
así se muestra hasta que un abogado del despacho lo confirme y quede la
constancia. Los ordenamientos se reforman; el Código Nacional de Procedimientos
Civiles y Familiares está desplazando a los códigos locales hasta 2027. Un
catálogo estático miente.

**Detecta conflicto de interés** cruzando las partes del asunto nuevo contra
clientes y contrapartes ya registrados — y no decide por ti.

---

## Estado

**Núcleo de dominio probado. Acceso, registro y panel ya funcionan.**

- Motor de cómputo de plazos con traza auditable
- Calendarios de días inhábiles (PJF y laboral 2026)
- Catálogo de plazos con rastro de verificación
- Alertas escalonadas en días hábiles
- Materias, vías y etapas procesales reales por vía
- Apertura de expediente con número interno y clonado de etapas
- Panel "qué vence" con detección de choques de agenda
- Detección de conflicto de interés
- Esquema completo con RLS multi-tenant
- Registro, acceso y panel, con freno anti-fuerza-bruta

**163 pruebas.** Plan completo en [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Arrancar

```bash
npm install
cp .env.example .env.local   # y llénalo
npm run check                # typecheck + lint + pruebas
npm run dev
```

Las migraciones de `supabase/migrations/` se aplican en orden desde el SQL
Editor de Supabase.

---

## Documentación

| Documento | Para qué |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Estado real del proyecto y reglas que no se negocian |
| [`docs/DOMINIO-LEGAL.md`](docs/DOMINIO-LEGAL.md) | Cómo trabaja un litigante mexicano. **Léelo antes de diseñar cualquier pantalla** |
| [`docs/PLAZOS.md`](docs/PLAZOS.md) | El cómputo, sus trampas y la política de verificación |
| [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) | Stack, seguridad y qué se rescató de NS Hub |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | Las rebanadas, en orden |

---

## Aviso

Litis es una **herramienta de control interno**. No es asesoría jurídica y no
emite dictámenes. Los cómputos son sugerencias que el abogado debe verificar
contra el ordenamiento aplicable y el calendario del órgano. La responsabilidad
profesional es de quien firma la promoción.
