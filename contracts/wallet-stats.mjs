#!/usr/bin/env node
/**
 * BVCC Wallet stats — cuántas wallets se han creado, por tipo y por red.
 *
 * Cuenta los eventos de las factories V4 (CREATE2, misma address en todas las redes):
 *   - Smart wallet  -> WalletCreated       (factory 0xfd1051…F93c)
 *   - Agent wallet  -> AgentWalletCreated  (factory 0xf3A61F…26a6)
 *
 * Solo V4. Las generaciones V1/V2/V3 tienen otras addresses y otro topic0, así que no
 * entran en el conteo: cada migración cambia la address del wallet, y sumarlas contaría
 * varias veces a la misma persona.
 *
 * Usa la API Etherscan v2 (un solo endpoint multi-chain). Necesita una API key.
 * Pon la key en un archivo .env en ESTA carpeta (no queda en el historial):
 *   ETHERSCAN_API_KEY=tu_key
 * y ejecuta:  node wallet-stats.mjs
 * (también vale  ETHERSCAN_API_KEY=xxxx node wallet-stats.mjs  o  node wallet-stats.mjs <API_KEY>)
 *
 * Etherscan free cubre Ethereum/Arbitrum/Polygon/Arb-Sepolia. Base usa fallback RPC.
 * Para BNB (y como fallback de cualquier red) puedes definir un RPC de archivo en .env:
 *   RPC_URL_56=https://...   RPC_URL_8453=https://...   (key gratis Alchemy/Ankr/dRPC)
 *
 * Solo lectura. No mueve fondos ni necesita claves privadas.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Carga .env de la carpeta del script (parser propio, sin dependencias).
// El entorno (process.env) tiene prioridad sobre el archivo.
function loadDotEnv() {
  try {
    const dir = dirname(fileURLToPath(import.meta.url));
    const raw = readFileSync(join(dir, ".env"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue; // ignora comentarios y líneas vacías
      const key = m[1];
      let val = m[2].trim().replace(/^["']|["']$/g, ""); // quita comillas envolventes
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* sin .env: se usa process.env o el argumento */
  }
}
loadDotEnv();

const API = "https://api.etherscan.io/v2/api";

const SMART_FACTORY = "0xfd105197109244483b5f870501326E6faec9F93c";
const AGENT_FACTORY = "0xf3A61F9d64d45362E149A111289546523BCd26a6";

// OJO: en V4 el evento perdió el `credentialId` (fix de BVCC-06 — viajaba sin autenticar
// por la factory; ahora lo anuncia la propia wallet con CredentialSet en una llamada
// firmada). La firma pasó de 4 params a 3, así que el topic0 NO es el de V1/V2/V3.
const TOPIC_SMART = "0xab5df568848e29a6e748be84ec279e2efe31bf739e7c3e16ffab4bbb6fb4b131"; // WalletCreated(address,uint256,uint256)
const TOPIC_AGENT = "0xf714fe155210a68a672553a38baa850d2fad470efb6cb5a8eb66d3986c26b4f5"; // AgentWalletCreated(address,uint256,uint256)

// deployBlock = bloque de despliegue de las factories V4 en cada red, sacado de
// broadcast/. Acota el escaneo: sin esto se recorre la cadena entera para nada.
const NETWORKS = [
  { chainId: 1, name: "Ethereum", rpc: "https://ethereum-rpc.publicnode.com", deployBlock: 25629984 },
  { chainId: 42161, name: "Arbitrum One", rpc: "https://arb1.arbitrum.io/rpc", deployBlock: 488534746 },
  { chainId: 8453, name: "Base", rpc: "https://base.drpc.org", deployBlock: 49218001 },
  { chainId: 56, name: "BNB Chain", rpc: "https://bsc.drpc.org", deployBlock: 112589915 },
  { chainId: 137, name: "Polygon", rpc: "https://polygon-bor-rpc.publicnode.com", deployBlock: 91013698 },
  { chainId: 421614, name: "Arbitrum Sepolia", rpc: "https://sepolia-rollup.arbitrum.io/rpc", deployBlock: 292159712 },
];

const KEY = process.env.ETHERSCAN_API_KEY || process.argv[2];
if (!KEY) {
  console.error(
    "Falta la API key. Usa:  ETHERSCAN_API_KEY=xxxx node wallet-stats.mjs\n" +
      "                  (o)  node wallet-stats.mjs <API_KEY>",
  );
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Dirección creada = topic indexado [1] (32 bytes) -> últimos 20 bytes. */
function addrFromTopic(topic) {
  return "0x" + String(topic).slice(-40);
}

/** Fecha ISO (UTC, solo día+hora) desde el timeStamp hex del log. */
function dateFromTs(hexTs) {
  const secs = parseInt(hexTs, 16);
  if (!Number.isFinite(secs)) return "?";
  return new Date(secs * 1000).toISOString().slice(0, 16).replace("T", " ");
}

/** Devuelve los eventos de creación de una chain, paginando (Etherscan: máx 1000/página). */
async function fetchLogs(chainId, address, topic0, fromBlock = 0) {
  const out = [];
  for (let page = 1; ; page++) {
    const url =
      `${API}?chainid=${chainId}&module=logs&action=getLogs` +
      `&address=${address}&topic0=${topic0}` +
      `&fromBlock=${fromBlock}&toBlock=latest&page=${page}&offset=1000&apikey=${KEY}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status === "0") {
      // "No records found" = 0; cualquier otro mensaje = error real
      if (typeof json.result === "string" && /no records/i.test(json.result)) break;
      if (Array.isArray(json.result) && json.result.length === 0) break;
      throw new Error(`chain ${chainId}: ${json.message || ""} ${json.result || ""}`.trim());
    }

    const batch = Array.isArray(json.result) ? json.result : [];
    for (const log of batch) {
      out.push({ address: addrFromTopic(log.topics?.[1]), date: dateFromTs(log.timeStamp) });
    }
    if (batch.length < 1000) break; // última página
    await sleep(250); // respeta rate-limit del free tier
  }
  return out;
}

// ── Fallback por RPC (JSON-RPC eth_getLogs) para chains sin cobertura Etherscan ──
async function rpcCall(url, method, params, attempt = 0) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (res.status >= 500) throw new Error("http " + res.status); // transitorio
    const json = await res.json();
    if (json.error) {
      const msg = json.error.message || "rpc error";
      // errores de límite de rango -> que el caller divida; no reintentar
      if (/range|limit|exceed|too large|beyond/i.test(msg)) throw new Error(msg);
      if (attempt < 2) {
        await sleep(500);
        return rpcCall(url, method, params, attempt + 1);
      }
      throw new Error(msg);
    }
    return json.result;
  } catch (e) {
    // reintento solo para fallos transitorios (red/5xx), no para límites de rango
    if (attempt < 2 && !/range|limit|exceed|too large|beyond/i.test(e.message)) {
      await sleep(500);
      return rpcCall(url, method, params, attempt + 1);
    }
    throw e;
  }
}

const hx = (n) => "0x" + n.toString(16);

const MAX_RPC_CALLS = 1200; // tope de seguridad: si el RPC topa getLogs muy bajo, abortar con aviso

/** eth_getLogs por rango con división binaria si el RPC limita el rango/resultados. */
async function rpcLogsRange(url, address, topic0, from, to, out, ctr) {
  if (++ctr.n > MAX_RPC_CALLS) {
    throw new Error(
      "el RPC limita getLogs a un rango demasiado pequeño para tanta historia. " +
        "Define un RPC de archivo en .env (p.ej. RPC_URL_56=https://...) o usa un plan Etherscan de pago.",
    );
  }
  try {
    const logs = await rpcCall(url, "eth_getLogs", [
      { address, topics: [topic0], fromBlock: hx(from), toBlock: hx(to) },
    ]);
    for (const l of logs) out.push(l);
    await sleep(120); // throttle suave
  } catch (e) {
    if (from >= to) throw e; // no se puede dividir más
    const mid = Math.floor((from + to) / 2);
    await rpcLogsRange(url, address, topic0, from, mid, out, ctr);
    await rpcLogsRange(url, address, topic0, mid + 1, to, out, ctr);
  }
}

/** Devuelve [{address,date}] vía RPC, resolviendo el timestamp de cada bloque (cacheado). */
async function rpcFetchLogs(net, address, topic0) {
  const url = process.env[`RPC_URL_${net.chainId}`] || net.rpc; // override opcional por red
  const latestHex = await rpcCall(url, "eth_blockNumber", []);
  const latest = parseInt(latestHex, 16);
  const raw = [];
  await rpcLogsRange(url, address, topic0, net.deployBlock, latest, raw, { n: 0 });

  const tsCache = new Map();
  const out = [];
  for (const l of raw) {
    let date = "?";
    const bn = l.blockNumber;
    if (!tsCache.has(bn)) {
      const blk = await rpcCall(url, "eth_getBlockByNumber", [bn, false]);
      tsCache.set(bn, blk?.timestamp);
    }
    const ts = tsCache.get(bn);
    if (ts) date = dateFromTs(ts);
    out.push({ address: addrFromTopic(l.topics?.[1]), date });
  }
  return out;
}

function pad(s, n) {
  s = String(s);
  return s + " ".repeat(Math.max(0, n - s.length));
}

(async () => {
  const rows = [];
  const wallets = []; // { date, name, type, address }
  let tSmart = 0,
    tAgent = 0;

  for (const net of NETWORKS) {
    try {
      let smart, agent;
      try {
        smart = await fetchLogs(net.chainId, SMART_FACTORY, TOPIC_SMART, net.deployBlock);
        await sleep(250);
        agent = await fetchLogs(net.chainId, AGENT_FACTORY, TOPIC_AGENT, net.deployBlock);
        await sleep(250);
      } catch (e) {
        // Etherscan free no cubre esta chain (Base/BNB) -> fallback por RPC
        if (net.rpc && /not supported for this chain|upgrade|api plan/i.test(e.message)) {
          smart = await rpcFetchLogs(net, SMART_FACTORY, TOPIC_SMART);
          agent = await rpcFetchLogs(net, AGENT_FACTORY, TOPIC_AGENT);
        } else {
          throw e;
        }
      }
      tSmart += smart.length;
      tAgent += agent.length;
      rows.push({ name: net.name, smart: smart.length, agent: agent.length, total: smart.length + agent.length });
      for (const w of smart) wallets.push({ ...w, name: net.name, type: "Personal" });
      for (const w of agent) wallets.push({ ...w, name: net.name, type: "Agente" });
    } catch (e) {
      rows.push({ name: net.name, smart: "ERR", agent: "ERR", total: "—", err: e.message });
    }
  }

  // ── Listado detallado (orden cronológico) ──────────────────────────────
  wallets.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  console.log("\nWallets creadas (factories V4)  —  " + new Date().toISOString().slice(0, 10));
  console.log("─".repeat(86));
  console.log(pad("Fecha (UTC)", 18) + pad("Red", 18) + pad("Tipo", 10) + "Dirección");
  console.log("─".repeat(86));
  if (wallets.length === 0) console.log("(ninguna)");
  for (const w of wallets) {
    console.log(pad(w.date, 18) + pad(w.name, 18) + pad(w.type, 10) + w.address);
  }

  // ── Resumen por red y tipo ─────────────────────────────────────────────
  console.log("\nResumen por red");
  console.log("─".repeat(56));
  console.log(pad("Red", 20) + pad("Personal", 12) + pad("Agente", 10) + "Total");
  console.log("─".repeat(56));
  for (const r of rows) {
    console.log(pad(r.name, 20) + pad(r.smart, 12) + pad(r.agent, 10) + r.total);
  }
  console.log("─".repeat(56));
  console.log(pad("TOTAL", 20) + pad(tSmart, 12) + pad(tAgent, 10) + (tSmart + tAgent));
  console.log("");

  const failed = rows.filter((r) => r.err);
  if (failed.length) {
    console.error("Redes no escaneadas:");
    for (const r of failed) console.error(`  ! ${r.name}: ${r.err}`);
    console.error(
      "\nPista: Etherscan free no cubre Base/BNB y los RPC públicos de BNB topan getLogs muy bajo.\n" +
        "Para escanearlas, añade en .env un RPC de archivo (key gratis de Alchemy/Ankr/dRPC), p.ej.:\n" +
        "  RPC_URL_56=https://bnb-mainnet.g.alchemy.com/v2/TU_KEY\n" +
        "  RPC_URL_8453=https://base-mainnet.g.alchemy.com/v2/TU_KEY\n" +
        "o usa un plan Etherscan v2 de pago (cubre todas las chains vía API).",
    );
  }
})();
