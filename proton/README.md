# proton

Vigila la bandeja de entrada de Proton Mail en segundo plano y muestra en el prompt de la terminal cuántos correos no leídos hay: `— 📬 (N)`, igual que el `— 🔄 (N)` de las actualizaciones de brew.

No usa Proton Mail Bridge ni dependencias de npm. `proton_watch.mjs` abre Brave sin ventana (modo headless), usa una sesión de Proton guardada en su propio perfil y lee la bandeja cada cierto tiempo.

**Por qué Brave y no Google Chrome:** con un segundo Chrome invisible, macOS ve dos apps "Google Chrome" y a veces manda los links de Slack y otras apps a la instancia invisible, así que no se abren. Brave es otra app, así que nunca los recibe. **Usa Brave solo para esto**, no como navegador.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `proton_watch.mjs` | El script que vigila la bandeja |
| `proton-perfil-brave/` | Perfil de Brave con la sesión de Proton. Se crea con `--login`. **No está en el repo** (`.gitignore`) |

## Instalar en una Mac nueva

Requisitos que **no** están en el repo:

1. **Node.js 22 o más nuevo.** El script usa el `WebSocket` que trae Node desde la versión 22, así que no hace falta `npm install`:
```bash
brew install node
```
2. **Brave.** El script lo busca en `~/Applications/Brave Browser.app` (donde lo instala `brew-apps`) y después en `/Applications`:
```bash
brew install --cask brave-browser
```
3. **Starship**, para ver el sobre en el prompt (ver la sección de Starship en `macsync/README.md`).

Después:

1. Clona el repo en `~/dotfiles-gmddk`. Los alias de `.aliases` usan esa ruta.
2. Inicia sesión en Proton una vez:
```bash
node ~/dotfiles-gmddk/proton/proton_watch.mjs --login
```
Se abre una ventana de Brave normal. Inicia sesión (con CAPTCHA y 2FA si los pide) y, cuando veas tu bandeja de entrada, **sal de Brave con `Cmd + Q`**. En macOS, cerrar la ventana no cierra Brave, y mientras siga abierto el perfil queda bloqueado.
3. Arranca el watcher con el alias `proton` (o a mano, ver más abajo).

**No copies `proton-perfil-brave/` de otra Mac.** Brave en macOS cifra las cookies con una clave guardada en el Llavero de cada Mac, así que la sesión copiada no funciona en otra máquina. Además contiene tu sesión de Proton: trátala como una contraseña.

## Uso

Alias definidos en `.aliases`:

| Alias | Qué hace |
|---|---|
| `proton` | Arranca el watcher en segundo plano, revisando cada 5 minutos |
| `protonkill` | Lo para |
| `protoncheck` | Dice si queda algo corriendo (el watcher o su Brave) |

Sin alias:

```bash
# En una pestaña de la terminal, viendo los avisos de cada correo nuevo (se para con Ctrl+C)
node ~/dotfiles-gmddk/proton/proton_watch.mjs

# En segundo plano, guardando los avisos en un log
INTERVALO=300 nohup node ~/dotfiles-gmddk/proton/proton_watch.mjs > ~/dotfiles-gmddk/proton/proton_watch.log 2>&1 &
```

Variables de entorno:

| Variable | Por defecto | Qué hace |
|---|---|---|
| `INTERVALO` | `60` | Segundos entre revisiones |
| `PROTON_PERFIL` | `proton-perfil-brave/` junto al script | Carpeta del perfil de Brave con la sesión |

## Cómo llega el número al prompt

- Al arrancar y en cada revisión, el script escribe el número de no leídos en `~/.cache/proton-unread-count`.
- Si hay 0, borra el archivo. También lo borra al pararse, así que el prompt nunca muestra un número viejo.
- El módulo `[custom.proton]` de `macsync/starship/starship.toml` muestra `— 📬 (N)` solo si el archivo existe y no está vacío.
- El prompt se actualiza cada vez que pulsas Enter.

## Problemas comunes

- **El sobre no aparece:** corre `protoncheck`. Si dice que no hay nada corriendo, la sesión pudo caducar y el script se cerró solo. Con la salida a `/dev/null` no ves el aviso, así que arráncalo en una pestaña (sin `nohup`) para leerlo.
- **"La sesión no está iniciada o caducó":** repite el paso de `--login`.
- **"Brave no arrancó":** hay un Brave usando `proton-perfil-brave/`, normalmente el del `--login`. Sal de él con `Cmd + Q`.
- **"No encuentro Brave":** instálalo con `brew install --cask brave-browser`.
- **"Se perdió la conexión con Brave. Reconectando...":** no es un error. Brave cerró o descartó la pestaña de Proton y el script abrió otra. Solo usa una pestaña: al arrancar cierra las que Brave restaura de la sesión del `--login`.
- **Aparece "?" en vez del remitente, o la bandeja nunca termina de cargar:** Proton cambió el HTML de su web. Hay que actualizar los selectores de `EXTRAER` en `proton_watch.mjs` (`data-shortcut-target="item-container"`, la clase `unread` y los `data-testid` de remitente y asunto).
- Solo cuenta los no leídos de la **primera página** de la bandeja de entrada.
- Avisa una sola vez por correo: si marcas como no leído un correo que ya avisó, no vuelve a avisar.
