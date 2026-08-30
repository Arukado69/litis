# Arquitectura

## 1. Principio rector

**La solución más simple que resuelva el problema gana.** Un dev solo; cada
dependencia y cada capa extra es deuda de mantenimiento. Se hereda tal cual del
proyecto anterior porque ahí funcionó.

Con una excepción explícita, y solo una: **el multi-tenant y la RLS no se
simplifican**. En un producto cualquiera un fallo de aislamiento es una fuga de
datos; aquí es la violación del secreto profesional de un abogado, que responde
por ella ante su cliente y ante su barra. Esa es la única parte del sistema
donde se paga complejidad por adelantado.

## 2. Stack

Igual al de NS Hub, porque está probado y no hay razón para reaprender nada:

- **Next.js 16** App Router · **TypeScript estricto** · **React 19**
- **Tailwind CSS v4**
- **Supabase** — PostgreSQL, Auth, Storage, RLS
- **Server Actions** para mutaciones de usuario; **Route Handlers** solo para
  webhooks y crons
- **Vitest** para la lógica pura
- **Stripe** para la suscripción, con degradación a modo simulación sin llaves
- **Resend** para correo, con simulación sin API key

Añadido sobre la config anterior: `noUncheckedIndexedAccess` en `tsconfig`.
Cuesta unos guards de más y a cambio impide la clase de bug donde un índice
fuera de rango se propaga como `undefined` hasta una fecha de vencimiento.

## 3. Seguridad en tres capas

Se hereda el modelo que ya estaba maduro:

```
proxy (redirección)  →  layout de route group (guardia de rol)  →  RLS
```

La RLS es la red final. Reglas que no se negocian:

- **Ninguna tabla de dominio sin `despacho_id`.** Ninguna política sin filtrar
  por él.
- **Las funciones auxiliares son `security definer` con `set search_path = ''`**
  y nombres calificados. Sin eso, quien pueda crear un objeto en el search_path
  secuestra la resolución de nombres dentro de una función que corre con
  permisos del dueño.
- **`security definer` también evita la recursión**: una política sobre
  `membresias` que consulte `membresias` es recursión infinita y Postgres la
  corta en tiempo de consulta.
- **La bitácora no tiene UPDATE ni DELETE.** Ver `DOMINIO-LEGAL.md` §5.
- **Los binarios van en bucket privado** con URL firmada de vida corta.
- **El origen de los enlaces de correo sale de `NEXT_PUBLIC_SITE_URL`**, nunca
  del header `Host`: quien manda la petición controla ese header y puede hacer
  que un correo legítimo de recuperación lleve el token a su servidor.
- **Toda puerta de acceso lleva freno anti-fuerza-bruta**, y toda ruta pública
  que escriba, límite de tasa.

### Funciones de acceso

| Función | Para qué |
|---|---|
| `despachos_del_usuario()` | Los despachos con membresía activa |
| `es_miembro(despacho)` | Pertenece, con cualquier rol |
| `es_personal(despacho)` | Pertenece y **no** es cliente |
| `tiene_rol(despacho, roles[])` | Rol específico |
| `persona_del_usuario(despacho)` | La persona del padrón ligada a la cuenta cliente |
| `puede_ver_expediente(id)` | Contempla `restringido` y el caso cliente |
| `puede_editar_expediente(id)` | Igual, pero el cliente nunca edita |

Las dos últimas existen para **no copiar la misma condición en diez políticas**.
Repetirla garantizaría que algún día una copia se quede sin la parte del
`restringido`.

## 4. Qué se rescató de NS Hub y qué no

El repositorio anterior sirve de referencia, no de base. Lo que se trae es
conocimiento y patrones, no archivos.

### Se rescata (patrones probados)

| De NS Hub | Aquí |
|---|---|
| Auth de 3 capas + guardias por rol | Igual, con `despacho_id` añadido |
| Storage privado + URL firmada | `documentos` del expediente |
| Sistema de diseño propio (no shadcn) | Igual |
| Kanban con drag & drop nativo | Tablero de etapas procesales |
| Bitácora `case_updates` inmutable | `actuaciones`, con `visible_cliente` |
| **Motor de recordatorios por ventanas** | **Alertas de plazos** — el diseño por ventanas, para que un cron que no corrió no pierda el aviso, era exactamente lo que hacía falta |
| Alertas de fallo por correo, sin bloquear | Igual |
| Correos con tablas + versión de texto plano | Igual |
| Rate limit y freno anti-fuerza-bruta | Igual |
| Cabeceras de seguridad en `next.config.ts` | Igual |
| Portal del cliente de solo lectura | Portal del cliente del despacho |
| Módulo Stripe con modo simulación | Suscripción del SaaS: ahora paga el despacho |
| Motores puros y testeados, aislados de la BD | Toda la lógica de plazos y conflictos |

### No se rescata

Membresías NS Protect y el motor de arancel · el triage y el check-up
empresarial · el catálogo de 75 trámites de gestoría · leads y su tablero · el
reporte ejecutivo de riesgos · el flujo fijo de 7 fases · el sitio público de la
gestoría · la bandeja "por facturar" del CFDI.

Todo eso resolvía el problema de vender igualas a PYMEs. No es este problema.

### La lección que sí se trae

El proyecto anterior escribió su visión multi-tenant en un documento y decidió
construirla "cuando llegue el primer despacho externo". Cuando llegó el momento,
la migración era reescribir todas las políticas de todas las tablas. **Aquí es
la migración `0001`.**

## 5. Modelo de datos

```
despachos ─┬─ membresias ── perfiles (auth.users)
           ├─ personas ────────────────┐  padrón: clientes Y contrapartes
           ├─ calendarios ── dias_inhabiles
           ├─ organos
           ├─ plazos_catalogo
           └─ expedientes ─┬─ expediente_partes ── personas
                           ├─ expediente_etapas
                           ├─ expediente_accesos
                           ├─ actuaciones      (inmutable)
                           ├─ documentos
                           ├─ audiencias
                           └─ plazos ── plazo_alertas_enviadas
```

`calendarios`, `organos` y `plazos_catalogo` usan el patrón
**`despacho_id IS NULL` = catálogo compartido del sistema**: se lee la semilla
más lo propio, se escribe solo lo propio. Un catálogo compartido editable por
cualquiera sería peor que no tenerlo — un despacho podría corromper el
calendario de otro y hacerle perder un término.

## 6. Convenciones de código

- TypeScript estricto, sin `any` salvo caso justificado.
- Server Components por defecto.
- **Nombres de esquema en español.** Rompe con NS Hub, que tenía columnas en
  inglés y dominio en español y obligaba a traducir mentalmente en cada
  consulta. `expedientes.fecha_vencimiento` se lee igual que se habla.
- **Toda mutación con lógica de negocio lleva prueba.**
- **La lógica de dominio va en funciones puras**, fuera de la fila de BD. Todo
  lo de `src/lib/plazos`, `expedientes` y `conflictos` corre sin base de datos y
  sin reloj.
- **El nombre de la marca no se escribe a mano.** Sale de `src/lib/brand`.
- Un commit por rebanada funcional.

## 7. Estado actual

Construido y probado (87 pruebas):

- Motor de cómputo de plazos con traza auditable
- Calendarios de días inhábiles (PJF y laboral 2026)
- Catálogo semilla de plazos con estado de verificación
- Alertas por ventanas en días hábiles
- Materias, vías y plantillas de etapas por vía
- Partes y validación de integridad
- Detección de conflicto de interés
- Esquema completo con RLS multi-tenant (migraciones `0001`–`0005`)

Sin construir: interfaz, autenticación, Server Actions, portal del cliente,
cobro. Ver [`ROADMAP.md`](ROADMAP.md).
