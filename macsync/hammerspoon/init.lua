-- Botones laterales del mouse (Logitech Lift) -> atajos de teclado, por app y por modificadores.
-- Botones: "3" = atras, "4" = adelante. Con modificadores: "3+cmd", "4+shift", etc.
-- Orden de los modificadores en la clave: cmd, shift, alt, ctrl.
-- Las apps que no estan en `porApp` conservan el comportamiento normal (Atras/Adelante en Finder, por ejemplo).
-- Permisos: Accesibilidad (mouse) e Input Monitoring (inversion del teclado en Chrome).

local E = hs.eventtap.event

-- Las teclas que envia este script llevan una marca, para que el detector de teclado de Chrome las ignore.
local MARCA = 7777
local function enviarTecla(mods, tecla)
  for _, abajo in ipairs({ true, false }) do
    local ev = E.newKeyEvent(mods, tecla, abajo)
    ev:setProperty(E.properties.eventSourceUserData, MARCA)
    ev:post()
  end
end

-- En Zed, VSCode, Obsidian e iTerm2: Ctrl+PgUp = tab siguiente, Ctrl+PgDn = tab anterior.
-- Mouse: atras = tab anterior, adelante = tab siguiente.
local tabs = {
  ["3"] = { { "ctrl" }, "pagedown" }, -- atras: tab anterior
  ["4"] = { { "ctrl" }, "pageup" },   -- adelante: tab siguiente
}

-- Chrome conserva su atajo nativo (Ctrl+PgUp = anterior, Ctrl+PgDn = siguiente), asi que las teclas van cruzadas.
local tabsChrome = { ["3"] = tabs["4"], ["4"] = tabs["3"] }

local porApp = {
  ["dev.zed.Zed"]           = tabs,
  ["com.microsoft.VSCode"]  = tabs,
  ["md.obsidian"]           = tabs,
  ["com.googlecode.iterm2"] = tabs,
  ["com.google.Chrome"]     = tabsChrome,
}

-- Reglas que aplican en cualquier app. El valor puede ser un atajo ({ {mods}, tecla }) o una funcion.
local globales = {
  ["3+shift"] = function() hs.alert.show("TEST") end, -- PRUEBA: Shift + atras
}

local function clave(e)
  local f = e:getFlags()
  local mods = (f.cmd and "+cmd" or "") .. (f.shift and "+shift" or "")
    .. (f.alt and "+alt" or "") .. (f.ctrl and "+ctrl" or "")
  return e:getProperty(E.properties.mouseEventButtonNumber) .. mods
end

local DEBUG = false -- true: muestra en pantalla cada boton extra, gesto y atajo detectado (para depurar)

tap = hs.eventtap.new({ E.types.otherMouseDown, E.types.otherMouseUp }, function(e)
  local k = clave(e)
  if DEBUG and e:getType() == E.types.otherMouseDown then
    hs.alert.show("boton: " .. k, 1)
  end
  local app = hs.application.frontmostApplication()
  local reglas = app and porApp[app:bundleID()]
  local accion = (reglas and reglas[k]) or globales[k]
  if not accion then return false end
  if e:getType() == E.types.otherMouseDown then
    if type(accion) == "function" then
      accion()
    else
      enviarTecla(accion[1], accion[2])
    end
  end
  return true
end)
tap:start()

-- Ctrl + rueda en las apps con tabs de `porApp`: hacia adelante = tab siguiente (Ctrl+PgDn), hacia atras = tab anterior (Ctrl+PgUp)
local INVERTIR_RUEDA = false -- true si la rueda va al reves de lo esperado
local ultimoGiro = 0

ruedaTap = hs.eventtap.new({ E.types.scrollWheel }, function(e)
  local f = e:getFlags()
  if not (f.ctrl and not f.cmd and not f.alt and not f.shift) then return false end
  local app = hs.application.frontmostApplication()
  local reglas = app and porApp[app:bundleID()]
  if reglas ~= tabs and reglas ~= tabsChrome then return false end

  local delta = e:getProperty(E.properties.scrollWheelEventDeltaAxis1)
  if delta == 0 then delta = e:getProperty(E.properties.scrollWheelEventDeltaAxis2) end
  if delta == 0 then return true end
  if DEBUG then hs.alert.show("rueda: " .. delta, 1) end

  local ahora = hs.timer.secondsSinceEpoch()
  if ahora - ultimoGiro > 0.15 then
    ultimoGiro = ahora
    local adelante = delta > 0
    if INVERTIR_RUEDA then adelante = not adelante end
    local accion = adelante and reglas["4"] or reglas["3"]
    enviarTecla(accion[1], accion[2])
  end
  return true
end)
ruedaTap:start()

-- Teclado en Chrome: su Ctrl+PgUp/PgDn nativo va al reves (PgUp = anterior), asi que se cruzan
-- para que quede como en las demas apps (PgUp = siguiente, PgDn = anterior).
-- Requiere el permiso de Input Monitoring.
local codigoPgUp, codigoPgDn = hs.keycodes.map["pageup"], hs.keycodes.map["pagedown"]

chromeTeclasTap = hs.eventtap.new({ E.types.keyDown }, function(e)
  if e:getProperty(E.properties.eventSourceUserData) == MARCA then return false end
  local app = hs.application.frontmostApplication()
  if not app or app:bundleID() ~= "com.google.Chrome" then return false end
  local f = e:getFlags()
  if not (f.ctrl and not f.cmd and not f.alt and not f.shift) then return false end
  local codigo = e:getKeyCode()
  if codigo == codigoPgUp then
    enviarTecla({ "ctrl" }, "pagedown")
  elseif codigo == codigoPgDn then
    enviarTecla({ "ctrl" }, "pageup")
  else
    return false
  end
  return true
end)
chromeTeclasTap:start()

if DEBUG then
  local nombres, lista = {}, {}
  for n, v in pairs(E.types) do nombres[v] = n end
  for _, n in ipairs({ "gesture", "magnify", "swipe", "rotate", "smartMagnify", "systemDefined", "pressure" }) do
    if E.types[n] then table.insert(lista, E.types[n]) end
  end
  debugTap = hs.eventtap.new(lista, function(e)
    local t = nombres[e:getType()] or tostring(e:getType())
    print("evento: " .. t)
    hs.alert.show("evento: " .. t, 1)
    return false
  end)
  debugTap:start()

  -- Solo registra teclas con Cmd/Ctrl/Option (atajos), para no capturar lo que se escribe
  teclaDebugTap = hs.eventtap.new({ E.types.keyDown }, function(e)
    local f = e:getFlags()
    if f.cmd or f.ctrl or f.alt then
      local mods = (f.cmd and "+cmd" or "") .. (f.shift and "+shift" or "")
        .. (f.alt and "+alt" or "") .. (f.ctrl and "+ctrl" or "")
      local msg = "atajo: " .. tostring(hs.keycodes.map[e:getKeyCode()] or e:getKeyCode()) .. mods
      print(msg)
      hs.alert.show(msg, 1)
    end
    return false
  end)
  teclaDebugTap:start()
  if not teclaDebugTap:isEnabled() then
    hs.alert.show("Falta Input Monitoring para Hammerspoon (detector de atajos)", 5)
  end
end

if not hs.accessibilityState() then
  hs.alert.show("Falta el permiso de Accesibilidad para Hammerspoon", 5)
elseif not tap:isEnabled() then
  hs.alert.show("El detector del mouse no se activo", 5)
elseif not chromeTeclasTap:isEnabled() then
  hs.alert.show("Falta Input Monitoring para Hammerspoon: el teclado de Chrome no se invertira", 5)
else
  hs.alert.show("Hammerspoon: configuracion cargada")
end
