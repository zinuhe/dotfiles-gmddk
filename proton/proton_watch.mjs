#!/usr/bin/env node
// Vigila la bandeja de entrada de Proton Mail usando Brave en segundo plano,
// sin dependencias: Node habla directamente con Brave por el protocolo DevTools.
//
// Usa Brave y no Google Chrome a propósito: si fuera Chrome, macOS vería dos apps
// "Google Chrome" y a veces mandaría los links de Slack y otras apps a esta instancia
// invisible en vez de a tu Chrome de trabajo. Brave es otra app, así que nunca los recibe.
// Por eso Brave debe usarse solo para esto, no como navegador.
//
//   node proton_watch.mjs --login   abre una ventana de Brave para que inicies sesión a mano
//                                   (sal con Cmd+Q cuando veas tu bandeja de entrada)
//   node proton_watch.mjs           vigila en segundo plano (sin ventana) e imprime los correos nuevos
//
// Variables de entorno opcionales:
//   INTERVALO      segundos entre revisiones (60 por defecto)
//   PROTON_PERFIL  carpeta del perfil de Brave donde se guarda la sesión
//                  (por defecto ./proton-perfil-brave junto a este script)
//
// Mientras corre, guarda el número de no leídos en ~/.cache/proton-unread-count
// (solo si es mayor que 0) para que el prompt de Starship lo muestre como 📬 (N).

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// brew-apps instala en ~/Applications; si no está ahí, se busca en /Applications
const BRAVE = [
  join(homedir(), "Applications/Brave Browser.app/Contents/MacOS/Brave Browser"),
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
].find(existsSync);
const URL_INBOX = "https://mail.proton.me/u/0/inbox";
const PERFIL = process.env.PROTON_PERFIL || join(dirname(fileURLToPath(import.meta.url)), "proton-perfil-brave");
const INTERVALO = Number(process.env.INTERVALO || 60) * 1000;
const CONTADOR = join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "proton-unread-count");

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const hora = () => new Date().toLocaleTimeString();

function guardarContador(n) {
  if (n > 0) {
    mkdirSync(dirname(CONTADOR), { recursive: true });
    writeFileSync(CONTADOR, `${n}\n`);
  } else {
    rmSync(CONTADOR, { force: true });
  }
}

function login() {
  console.log("Inicia sesión en la ventana de Brave y, cuando veas tu bandeja de entrada, sal de Brave con Cmd+Q.");
  const brave = spawn(BRAVE, [`--user-data-dir=${PERFIL}`, "--no-first-run", "--no-default-browser-check", URL_INBOX], { stdio: "ignore" });
  brave.on("exit", () => console.log("Listo. Ahora ejecuta: node proton_watch.mjs"));
}

async function arrancarBrave() {
  const puertoFich = join(PERFIL, "DevToolsActivePort");
  rmSync(puertoFich, { force: true });
  const brave = spawn(BRAVE, [
    `--user-data-dir=${PERFIL}`, "--headless=new", "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check", URL_INBOX,
  ], { stdio: "ignore" });
  process.on("exit", () => {
    brave.kill();
    guardarContador(0);
  });
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGHUP", () => process.exit(0));
  brave.on("exit", () => {
    console.error(`[${hora()}] Brave se cerró.`);
    process.exit(1);
  });

  for (let i = 0; !existsSync(puertoFich); i++) {
    if (i > 100) throw new Error("Brave no arrancó. ¿Tienes abierta la ventana de --login? Ciérrala primero.");
    await dormir(200);
  }
  return readFileSync(puertoFich, "utf8").split("\n")[0];
}

// Brave restaura las pestañas que quedaron abiertas en el --login. Las de fondo se congelan
// o se descartan (y al descartarse se corta la conexión), así que se usa una sola pestaña
// de Proton, se cierran las demás y se pone al frente.
async function conectar(puerto) {
  const base = `http://127.0.0.1:${puerto}`;
  const paginas = (await (await fetch(`${base}/json/list`)).json()).filter((p) => p.type === "page");
  const pagina = paginas.find((p) => p.url.includes("proton.me"))
    || await (await fetch(`${base}/json/new?${URL_INBOX}`, { method: "PUT" })).json();
  for (const p of paginas) if (p.id !== pagina.id) await fetch(`${base}/json/close/${p.id}`);
  await fetch(`${base}/json/activate/${pagina.id}`);
  return conectarCDP(pagina.webSocketDebuggerUrl);
}

function conectarCDP(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pendientes = new Map();
  let siguienteId = 0;
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    const p = pendientes.get(msg.id);
    if (!p) return;
    pendientes.delete(msg.id);
    msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
  };
  // Si la conexión se corta, las peticiones pendientes fallan en vez de esperar para siempre
  ws.onclose = () => {
    for (const p of pendientes.values()) p.reject(new Error("Se perdió la conexión con Brave"));
    pendientes.clear();
  };
  const enviar = (method, params = {}) => new Promise((resolve, reject) => {
    if (ws.readyState !== WebSocket.OPEN) return reject(new Error("Se perdió la conexión con Brave"));
    const id = ++siguienteId;
    const timer = setTimeout(() => {
      pendientes.delete(id);
      reject(new Error("Brave no respondió"));
    }, 30000);
    pendientes.set(id, {
      resolve: (v) => { clearTimeout(timer); resolve(v); },
      reject: (e) => { clearTimeout(timer); reject(e); },
    });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(enviar);
    ws.onerror = () => reject(new Error("No se pudo conectar con Brave"));
  });
}

// Se ejecuta dentro de la página de Proton: lista los correos no leídos visibles en la bandeja
const EXTRAER = `(() => {
  const filas = [...document.querySelectorAll('[data-shortcut-target="item-container"]')];
  const texto = (f, sel) => f.querySelector(sel)?.textContent?.trim() || '';
  return {
    url: location.href,
    lista: !!document.querySelector('[data-shortcut-target="item-container"], .empty-view, [data-testid*="empty"]'),
    noLeidos: filas.filter((f) => f.classList.contains('unread')).map((f) => ({
      id: f.dataset.elementId,
      de: texto(f, '[data-testid="message-column:sender-address"]') || texto(f, '[data-testid*="sender"]'),
      asunto: texto(f, '[data-testid="message-column:subject"]') || texto(f, '[data-testid*="subject"]'),
    })),
  };
})()`;

async function leer(enviar, { comprobarSesion = true } = {}) {
  const { result } = await enviar("Runtime.evaluate", { expression: EXTRAER, returnByValue: true });
  const estado = result.value;
  if (comprobarSesion && !estado.url.startsWith("https://mail.proton.me")) {
    console.error(`[${hora()}] La sesión no está iniciada o caducó. Ejecuta: node proton_watch.mjs --login`);
    process.exit(1);
  }
  return estado;
}

async function vigilar() {
  const puerto = await arrancarBrave();
  let enviar = await conectar(puerto);
  // Esperar a que la aplicación de Proton cargue la bandeja (hasta 90 s). Mientras carga
  // puede pasar por account.proton.me, así que la sesión solo se comprueba al final.
  let estado;
  for (let i = 0; i < 45; i++) {
    await dormir(2000);
    estado = await leer(enviar, { comprobarSesion: false });
    if (estado.lista) break;
  }
  estado = await leer(enviar);
  if (!estado.lista) throw new Error("La bandeja de entrada no terminó de cargar.");

  const vistos = new Set(estado.noLeidos.map((c) => c.id));
  guardarContador(estado.noLeidos.length);
  console.log(`[${hora()}] Vigilando Proton Mail cada ${INTERVALO / 1000}s (${vistos.size} no leídos ya en la bandeja)`);
  for (;;) {
    await dormir(INTERVALO);
    let noLeidos;
    try {
      ({ noLeidos } = await leer(enviar));
    } catch (e) {
      console.error(`[${hora()}] ${e.message}. Reconectando...`);
      enviar = await conectar(puerto);
      continue;
    }
    guardarContador(noLeidos.length);
    for (const c of noLeidos) {
      if (vistos.has(c.id)) continue;
      vistos.add(c.id);
      console.log(`[${hora()}] 📬 Nuevo correo de ${c.de || "?"}: ${c.asunto || "(sin asunto)"}`);
    }
  }
}

if (!BRAVE) {
  console.error("No encuentro Brave en ~/Applications ni en /Applications. Instálalo con: brew install --cask brave-browser");
  process.exit(1);
}
if (process.argv.includes("--login")) login();
else vigilar().catch((e) => { console.error(e.message); process.exit(1); });
