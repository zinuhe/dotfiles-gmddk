#!/usr/bin/env node
// Vigila la bandeja de entrada de Proton Mail usando el Google Chrome instalado,
// sin dependencias: Node habla directamente con Chrome por el protocolo DevTools.
//
//   node proton_watch.mjs --login   abre una ventana de Chrome para que inicies sesión a mano
//                                   (sal con Cmd+Q cuando veas tu bandeja de entrada)
//   node proton_watch.mjs           vigila en segundo plano (sin ventana) e imprime los correos nuevos
//
// Variables de entorno opcionales:
//   INTERVALO      segundos entre revisiones (60 por defecto)
//   PROTON_PERFIL  carpeta del perfil de Chrome donde se guarda la sesión
//                  (por defecto ./proton-perfil junto a este script)
//
// Mientras corre, guarda el número de no leídos en ~/.cache/proton-unread-count
// (solo si es mayor que 0) para que el prompt de Starship lo muestre como 📬 (N).

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_INBOX = "https://mail.proton.me/u/0/inbox";
const PERFIL = process.env.PROTON_PERFIL || join(dirname(fileURLToPath(import.meta.url)), "proton-perfil");
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
  console.log("Inicia sesión en la ventana de Chrome y, cuando veas tu bandeja de entrada, sal de Chrome con Cmd+Q.");
  const chrome = spawn(CHROME, [`--user-data-dir=${PERFIL}`, "--no-first-run", "--no-default-browser-check", URL_INBOX], { stdio: "ignore" });
  chrome.on("exit", () => console.log("Listo. Ahora ejecuta: node proton_watch.mjs"));
}

async function arrancarChrome() {
  const puertoFich = join(PERFIL, "DevToolsActivePort");
  rmSync(puertoFich, { force: true });
  const chrome = spawn(CHROME, [
    `--user-data-dir=${PERFIL}`, "--headless=new", "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check", URL_INBOX,
  ], { stdio: "ignore" });
  process.on("exit", () => {
    chrome.kill();
    guardarContador(0);
  });
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGHUP", () => process.exit(0));

  for (let i = 0; !existsSync(puertoFich); i++) {
    if (i > 100) throw new Error("Chrome no arrancó. ¿Tienes abierta la ventana de --login? Ciérrala primero.");
    await dormir(200);
  }
  const puerto = readFileSync(puertoFich, "utf8").split("\n")[0];
  const paginas = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json();
  return conectarCDP(paginas.find((p) => p.type === "page").webSocketDebuggerUrl);
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
  const enviar = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++siguienteId;
    pendientes.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(enviar);
    ws.onerror = () => reject(new Error("No se pudo conectar con Chrome"));
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
  const enviar = await arrancarChrome();
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
    const { noLeidos } = await leer(enviar);
    guardarContador(noLeidos.length);
    for (const c of noLeidos) {
      if (vistos.has(c.id)) continue;
      vistos.add(c.id);
      console.log(`[${hora()}] 📬 Nuevo correo de ${c.de || "?"}: ${c.asunto || "(sin asunto)"}`);
    }
  }
}

if (process.argv.includes("--login")) login();
else vigilar().catch((e) => { console.error(e.message); process.exit(1); });
