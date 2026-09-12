# Herramientas de desarrollo conectadas

Servidores MCP que este repositorio declara en [`.mcp.json`](../.mcp.json). No
son parte del producto: son herramientas del dev. Nada de aquí se despliega ni
toca datos de un despacho.

---

## NotebookLM — `notebooklm`

[`PleasePrompto/notebooklm-mcp`](https://github.com/PleasePrompto/notebooklm-mcp).
Permite consultar un cuaderno de NotebookLM (Gemini 2.5 sobre las fuentes que se
le carguen) desde Claude Code, y cargarle fuentes.

Herramientas: `ask_question` · `add_source` · `add_notebook`, `list_notebooks`,
`select_notebook`, `search_notebooks`, `update_notebook` · `generate_audio`,
`download_audio` · `list_sessions`, `close_session`, `reset_session` ·
`setup_auth`, `get_health`, `cleanup_data`.

### Cómo se conecta

No hay que instalar nada: `npx` baja el paquete en el primer arranque. Basta con
abrir Claude Code en la raíz del repositorio y aprobar el servidor cuando lo
pregunte.

### La autenticación es el paso que cuesta

⚠️ **No hay API. El servidor maneja un Chrome de verdad contra la interfaz web
de NotebookLM**, así que la sesión de Google se abre a mano una sola vez:

```
setup_auth
```

Abre una ventana de Chrome donde se entra a la cuenta de Google. Las cookies
quedan en `~/.local/share/notebooklm-mcp/chrome_profile/` y las corridas
siguientes ya no preguntan.

⚠️ **Ese paso exige pantalla.** En una máquina sin escritorio se corre una vez
bajo `xvfb-run`, pero entonces nadie ve la ventana para teclear la contraseña:
en la práctica, `setup_auth` se hace en la máquina local, no en un servidor.

⚠️ **Por eso no funciona en una sesión de Claude Code en la nube.** El
contenedor es efímero —el perfil de Chrome se va con él— y no hay pantalla donde
completar el acceso a Google. Ahí el servidor arranca, pero toda consulta
contesta que no hay sesión. La conexión sirve en local.

### Requisitos

Node ≥ 18 · Chrome estable, o el Chromium que trae Patchright como respaldo ·
Linux, macOS o Windows (WSL2 sí, WSL1 no).

### Variables de entorno útiles

| Variable | Para qué | Por omisión |
|---|---|---|
| `NOTEBOOKLM_PROFILE` | Cuántas herramientas expone: `minimal`, `standard`, `full` | `full` (20) |
| `HEADLESS` | Ver el navegador mientras trabaja, para depurar | `true` |
| `ANSWER_TIMEOUT_MS` | Espera máxima por respuesta | `600000` |
| `NOTEBOOKLM_TRANSPORT` | `stdio` o `http` | `stdio` |
| `NOTEBOOKLM_PORT` | Puerto si el transporte es `http` | `3000` |

### Qué NO se le sube

⚠️ **Nada de un expediente real.** Cargar una fuente a NotebookLM es mandarla a
Google. Los expedientes de este producto están cubiertos por el secreto
profesional del abogado —y el aviso de privacidad dice que del padrón y de los
expedientes responde el despacho, no Litis (ver
[`src/lib/legal/tratamiento.ts`](../src/lib/legal/tratamiento.ts))—. A este
cuaderno se le suben códigos, criterios, acuerdos publicados y documentación
técnica; nunca datos de una persona ni de un asunto.

---

## Stripe — `stripe` · **pendiente de autorizar**

No está en `.mcp.json`: es un **conector de la cuenta de claude.ai**, no un
servidor del repositorio. Por eso aparece en la sesión sin que este archivo lo
declare, y por eso conectarlo no es editar un archivo sino autorizarlo una vez.

### Por qué se quiere

Para cerrar lo que falta de R11 sin ir y volver del panel de Stripe: crear el
endpoint del webhook y traer su `whsec_`, consultar el producto y el precio ya
creados (`prod_VBQnHcXM3sIe2J` / `price_1UB3wHRD2Fg2YJsu3660vmro`) y leer los
eventos que llegan cuando se pruebe el cobro de punta a punta.

### Cómo se conecta

⚠️ **No se puede desde una sesión en la nube.** Pide OAuth y el flujo se abre en
un navegador; una sesión no interactiva no puede completarlo, y **nunca hay que
pasarle un código de autorización ni un token por el chat**. Se autoriza desde
los conectores de claude.ai, o con `/mcp` en una sesión interactiva. Hasta
entonces sus herramientas están ahí pero no responden.

### Lo que NO resuelve

- ⚠️ **La configuración del portal de facturación sigue siendo a mano.** Se crea
  en Ajustes → Facturación → Portal de clientes y la llave del conector **no**
  puede crearla por API (ver [`CLAUDE.md`](../CLAUDE.md) §5.23). El conector no
  cambia eso.
- ⚠️ **Autorizarlo es darle la cuenta real de Stripe**, no un entorno de
  pruebas. Ahí viven el producto, el precio y —el día que haya— los cobros de
  despachos que pagan. Lo que se le pida crear o borrar hay que leerlo dos
  veces, y lo que se pueda hacer en modo de prueba se hace en modo de prueba.
