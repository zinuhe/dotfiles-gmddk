# macsync

Configuración personal de Mac, sincronizada entre máquinas con git.

## Tabs: `Ctrl + PgUp` / `Ctrl + PgDn`

Mismo atajo para cambiar de tab en Zed, VSCode, Obsidian e iTerm2:

| Acción | Atajo |
|---|---|
| Tab siguiente | `Ctrl + PgUp` |
| Tab anterior | `Ctrl + PgDn` |

En un MacBook sin teclas `PgUp` y `PgDn`, se escriben como `Ctrl + Fn + ↑` y `Ctrl + Fn + ↓`.

Es la dirección contraria a la convención habitual (donde `PgDn` avanza), elegida a propósito para que `PgUp` vaya de izquierda a derecha.

**Chrome:** su `Ctrl + PgUp` y `Ctrl + PgDn` vienen fijos en el navegador y van al revés (`PgUp` = anterior, `PgDn` = siguiente), y no se pueden cambiar en sus ajustes. Por eso `hammerspoon/init.lua` intercepta esas dos teclas cuando Chrome está activo y envía la contraria, para que quede igual que en las demás apps. Esto **requiere Hammerspoon con los permisos de Accesibilidad e Input Monitoring** (ver la sección de Hammerspoon); sin ellos, en Chrome el teclado vuelve a ir al revés.

### Archivos

| Archivo | Para qué sirve |
|---|---|
| `tabs/install.sh` | Aplica la configuración en la Mac donde se corre |
| `tabs/zed-keymap.json` | Keymap de Zed |
| `tabs/zed-settings.json` | Settings de Zed (fuentes, minimap, tema y color del tab activo) |
| `starship/starship.toml` | Configuración del prompt Starship (ver sección más abajo) |
| `hammerspoon/init.lua` | Botones laterales del mouse a atajos de teclado (ver sección más abajo) |
| `tabs/vscode-keybindings.json` | Atajos de VSCode (incluye `Cmd+1/2/3`) |

### Cómo se aplica a cada app

| App | Método | Destino |
|---|---|---|
| Zed (keymap) | Enlace simbólico al archivo completo | `~/.config/zed/keymap.json` |
| Zed (settings) | Enlace simbólico al archivo completo | `~/.config/zed/settings.json` |
| Starship | Enlace simbólico al archivo completo | `~/.config/starship.toml` |
| Hammerspoon | Enlace simbólico al archivo completo | `~/.hammerspoon/init.lua` |
| VSCode | Enlace simbólico al archivo completo | `~/Library/Application Support/Code/User/keybindings.json` |
| Obsidian | Parche de solo los dos hotkeys de tabs | `<vault>/.obsidian/hotkeys.json` |
| iTerm2 | Parche de solo los dos atajos globales | `~/Library/Preferences/com.googlecode.iterm2.plist` (`GlobalKeyMap`) |

- **Zed y VSCode:** un cambio en un Mac llega al otro con `git pull`, porque ambos leen el archivo del repo.
- **Obsidian e iTerm2:** el script no reemplaza el archivo, solo cambia los atajos de tabs y respeta el resto de la configuración. Obsidian guarda sus atajos dentro de cada vault, por eso se pasa la ruta del vault.
- **Respaldos:** antes de cambiar un archivo, el script guarda una copia `.bak-fecha` al lado.

### Instalar en una Mac nueva

1. Cierra Obsidian e iTerm2. Si están abiertos, el script los salta y avisa.
2. Clona y corre el script:

```bash
git clone <URL-del-repo> ~/macsync && ~/macsync/tabs/install.sh
```

Si el vault de Obsidian no está en `~/Documents/remote`, pasa la ruta como argumento:

```bash
~/macsync/tabs/install.sh /ruta/al/vault
```

Si ya estás dentro de la carpeta `tabs`, el script se corre con `./install.sh`. El `./` es necesario: zsh no busca comandos en la carpeta actual, y sin él da `zsh: command not found: install.sh`.

```bash
cd ~/macsync/tabs
./install.sh
```

El script se puede correr varias veces sin problema.

### Subir cambios al repo

```bash
cd ~/macsync && git add . && git commit -m "Descripción del cambio" && git push
```

En la otra Mac:

```bash
cd ~/macsync && git pull
```

### Detalles técnicos

- **Zed:** el keymap usa el contexto `Workspace || Pane || Editor || Terminal`. Con solo `Workspace` o `Pane` el atajo no funcionaba, porque el `base_keymap` VSCode que tiene activo asigna esa combinación en el contexto `Editor`, que tiene prioridad.
- **Obsidian:** además de `Ctrl+PgUp/PgDn`, conserva `Ctrl+Tab` (siguiente) y `Ctrl+Shift+Tab` (anterior).
- **iTerm2:** `Next Tab` es la acción `0` y `Previous Tab` es la acción `2` en `GlobalKeyMap`. Las claves son `0xf72d-0x40000-0x79` (`Ctrl+PgDn`, asignada a `Previous Tab`) y `0xf72c-0x40000-0x74` (`Ctrl+PgUp`, asignada a `Next Tab`). iTerm2 también guarda una variante de cada una con el sufijo `-0x1` (por ejemplo `0xf72c-0x40000-0x74-0x1`), y parece ser la que usa: el script configura **las dos** con la misma acción, porque si solo se cambia la clave sin sufijo el atajo no cambia.
### Color del tab activo en Zed

`zed-settings.json` define el fondo del tab activo con `theme_overrides`, para el tema One Dark:

```json
"theme_overrides": {
  "One Dark": {
    "tab.active_background": "#2f5d9e"
  }
}
```

- Para cambiar el color, edita el valor `#2f5d9e`.
- El override aplica solo al tema indicado. Si cambias de tema, copia el bloque con el nombre del nuevo tema.
- Otras claves útiles en el mismo bloque: `tab.inactive_background` (tabs inactivos) y `tab_bar.background` (toda la barra de tabs).
- Como el archivo completo se sincroniza, en la otra Mac también se aplican las demás opciones de `settings.json` (fuentes, minimap, tema). El script guarda una copia `.bak-fecha` del archivo anterior.

### Prompt de la terminal: Starship

`starship/starship.toml` configura el prompt de la terminal:

- Muestra solo las últimas **2 carpetas** del path (`…/Documents/remote`). En la carpeta home muestra `~`.
- Símbolo del prompt `➜` en verde.
- Módulo `package` desactivado.

```toml
[directory]
truncation_length = 2
truncate_to_repo = false
truncation_symbol = '…/'
```

`install.sh` solo enlaza el archivo de configuración. En una Mac nueva también hacen falta dos cosas que **no** están en el repo:

1. Instalar Starship:
```bash
brew install starship
```
2. Activarlo en `~/.zshrc`:
```bash
eval "$(starship init zsh)"
```

Después abre una terminal nueva (o corre `exec zsh`). Las pestañas abiertas antes del cambio no recargan la configuración.

### Botones del mouse: Hammerspoon

**Ctrl + rueda** en Zed, VSCode, Obsidian, iTerm2 y Chrome: girar la rueda hacia adelante con `Ctrl` presionado va al tab siguiente, y hacia atrás va al anterior. Aplica a las mismas apps que los botones laterales, las que usan las tablas `tabs` o `tabsChrome` en `porApp`. Solo se dispara un tab cada 0.15 segundos, para que una vuelta rápida de la rueda no salte muchos tabs. Si la dirección queda al revés, pon `INVERTIR_RUEDA = true` en `init.lua`.

`hammerspoon/init.lua` convierte los botones laterales del mouse (Logitech Lift) en atajos de teclado, según la app activa:

| Botón | Atajo | Apps |
|---|---|---|
| Atrás | Tab anterior (`Ctrl + PgDn`) | Zed, VSCode, Obsidian, iTerm2 |
| Adelante | Tab siguiente (`Ctrl + PgUp`) | Zed, VSCode, Obsidian, iTerm2 |
| Atrás | Tab anterior (envía `Ctrl + PgUp`, el nativo de Chrome) | Chrome |
| Adelante | Tab siguiente (envía `Ctrl + PgDn`, el nativo de Chrome) | Chrome |

Para invertir el sentido, intercambia las reglas `"3"` y `"4"` de la tabla `tabs` en `init.lua`. Este cambio solo afecta a los botones laterales, no a `Ctrl` + rueda.

En las demás apps, como Finder, los botones siguen haciendo Atrás y Adelante normal.

**Requisitos (no están en el repo):**

1. Instalar Hammerspoon:
```bash
brew install --cask hammerspoon
```
2. Darle permiso de **Accesibilidad** (mouse) y de **Input Monitoring** (invertir el teclado en Chrome) en Configuración del Sistema → Privacidad y seguridad. Después de dar Input Monitoring hay que cerrar Hammerspoon por completo y abrirlo de nuevo.
3. **Apagar el agente de Logi Options+.** Aunque los botones estén en su acción por defecto, el agente los desvía por su protocolo propio y Hammerspoon no los ve (con el agente activo no llega ningún evento, ni de mouse ni de teclado). Con el agente apagado, el Lift manda `button3` (atrás) y `button4` (adelante). Para apagarlo ahora y que no arranque solo en el próximo inicio de sesión:
```bash
launchctl bootout gui/$(id -u)/com.logi.cp-dev-mgr
launchctl disable gui/$(id -u)/com.logi.cp-dev-mgr
pkill -f LogiPluginService
```
Para volver a usar Options+:
```bash
launchctl enable gui/$(id -u)/com.logi.cp-dev-mgr
launchctl bootstrap gui/$(id -u) /Library/LaunchAgents/com.logi.optionsplus.plist
```
Sin el agente, lo que depende del software de Logitech (ajustes manejados por Options+, avisos de batería) no se aplica. El mouse sigue funcionando como mouse normal.
4. Recargar la configuración desde el ícono de Hammerspoon en la barra de menú → **Reload Config**, cada vez que se edite `init.lua`.

**Cómo editarlo:**

- La tabla `porApp` asocia el *bundle ID* de cada app con sus reglas. Para saber el bundle ID de una app:
```bash
osascript -e 'id of app "Zed"'
```
- En las reglas, `"3"` es el botón de atrás y `"4"` el de adelante. Con modificadores se escribe `"3+cmd"`, `"4+shift"`, etc., siempre en el orden `cmd`, `shift`, `alt`, `ctrl`.
- Para depurar, pon `DEBUG = true` al inicio del archivo: muestra en pantalla el botón, gesto o atajo que detecta Hammerspoon. El detector de atajos de teclado requiere además el permiso de **Input Monitoring**. Déjalo en `false` en el uso normal, porque muestra un aviso en cada clic de botón extra.
- La regla `"3+shift"` de la tabla `globales` es una prueba que muestra la alerta "TEST". Se puede borrar.
- Si el archivo `~/.hammerspoon/init.lua` no existe, Hammerspoon muestra `Can't find ~/.hammerspoon/init.lua`. Corre `install.sh` para crearlo.

### Depuración en Zed

Si un atajo no responde, abre el command palette (`Cmd + Shift + P`) y ejecuta:

- **`zed: open keymap`**: abre el editor de atajos y permite grabar qué tecla recibe Zed.
- **`dev: open key context view`**: muestra qué atajo se disparó y en qué contexto.

### Si `Ctrl + PgUp` / `Ctrl + PgDn` no responden en ninguna app

Antes de revisar los keymaps, revisa **Logi Options+** (el software de Logitech). Puede capturar las teclas del teclado o los botones del mouse y reasignarlas antes de que lleguen a la app, aunque el keymap esté correcto. En este caso el atajo no funcionaba en Zed por eso.

- Abre Logi Options+, entra al dispositivo (teclado o mouse) y revisa si alguna tecla o botón tiene asignado `Ctrl + PgUp`, `Ctrl + PgDn` o una acción que choque.
- Esta configuración **no** está en este repo. Se hace a mano en cada Mac, porque Logi Options+ guarda sus ajustes en una base de datos propia (`~/Library/Application Support/LogiOptionsPlus/settings.db`) ligada a cada dispositivo.
