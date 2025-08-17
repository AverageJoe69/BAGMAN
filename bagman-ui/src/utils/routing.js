// src/utils/routing.js

/**
 * Live compatibility using Jupiter APIs (browser-safe).
 * We cache results per master symbol to avoid re-querying on every tile click.
 */

const JUP_TOKENS_URL = "https://tokens.jup.ag/tokens";
const JUP_QUOTE_URL = "https://quote-api.jup.ag/v6/quote";

const CACHE_MS = 60_000; // 60s cache per master
const compatCache = new Map(); // key: masterSymbol -> { at: number, items: Array }

/** Fetch full Jupiter token list */
export async function fetchJupiterTokens() {
  const res = await fetch(JUP_TOKENS_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch Jupiter tokens: ${res.status}`);
  /** @type {Array<{address:string, decimals:number, symbol:string, name:string, tags?:string[]}>} */
  const tokens = await res.json();
  return tokens.filter(t => t.symbol && t.address); // basic sanity
}

/** Prefer a single token per symbol (prefers 'verified'/'community' tags) */
function buildSymbolMap(tokens) {
  const bySymbol = new Map();
  for (const t of tokens) {
    const sym = (t.symbol || "").toUpperCase();
    if (!sym) continue;
    const existing = bySymbol.get(sym);
    const isBetter =
      !existing ||
      (Array.isArray(t.tags) && (t.tags.includes("verified") || t.tags.includes("community")));
    if (isBetter) bySymbol.set(sym, t);
  }
  return bySymbol;
}

/** Small test amount in atomic units (≈ 0.01 of a unit); min 1 */
function tinyAmount(decimals) {
  if (!Number.isFinite(decimals) || decimals < 0) return 1n;
  if (decimals === 0) return 1n;
  const p = Math.max(0, decimals - 2);
  const val = (10n ** BigInt(p));
  return val > 0n ? val : 1n;
}

/** Probe whether a route exists from masterMint -> candMint with a tiny amount */
async function hasRoute(masterMint, candMint, amountAtomic) {
  const params = new URLSearchParams({
    inputMint: masterMint,
    outputMint: candMint,
    amount: String(amountAtomic),
    slippageBps: "50",
    onlyDirectRoutes: "false"
  });
  const res = await fetch(`${JUP_QUOTE_URL}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return false;
  const data = await res.json();
  const outAmount =
    (typeof data?.outAmount === "string" && data.outAmount) ||
    (Array.isArray(data?.data) && data.data[0]?.outAmount);
  try { return Boolean(outAmount && BigInt(outAmount) > 0n); }
  catch { return false; }
}

/**
 * Public: get active tradables for a given master **symbol** (e.g., "SOL", "USDC").
 * Returns minimal objects: { symbol, name, mint }.
 * Uses cache for snappy UX; refreshes after CACHE_MS.
 */
export async function getActiveTradables(masterSymbol, opts = {}) {
  const now = Date.now();
  const cached = compatCache.get(masterSymbol);
  if (cached && (now - cached.at) < CACHE_MS) {
    return cached.items;
  }

  const {
    maxCandidates = 250,   // scan first N tokens from the list
    parallel = 10,         // concurrent quote probes
    excludeSameSymbol = true
  } = opts;

  const tokens = await fetchJupiterTokens();
  const bySymbol = buildSymbolMap(tokens);
  const master = bySymbol.get((masterSymbol || "").toUpperCase());
  if (!master) throw new Error(`Master symbol not found: ${masterSymbol}`);

  const masterMint = master.address;
  const amount = tinyAmount(master.decimals);

  // Candidate set (skip obvious dupes/empty)
  let candidates = tokens.slice(0, maxCandidates).filter(t => t.address && t.symbol && t.symbol.toUpperCase() !== "UNKNOWN");
  if (excludeSameSymbol) {
    candidates = candidates.filter(t => (t.symbol || "").toUpperCase() !== (master.symbol || "").toUpperCase());
  }

  // Concurrency-limited probing
  const results = [];
  let i = 0;
  async function worker() {
    while (i < candidates.length) {
      const idx = i++;
      const cand = candidates[idx];
      try {
        const ok = await hasRoute(masterMint, cand.address, amount);
        if (ok) results.push(cand);
      } catch { /* ignore */ }
    }
  }
  await Promise.all(Array.from({ length: parallel }, worker));

  // Dedup by symbol, prefer verified/community
  const dedup = new Map();
  for (const c of results) {
    const sym = (c.symbol || "").toUpperCase();
    if (!sym) continue;
    const existing = dedup.get(sym);
    const better =
      !existing ||
      (Array.isArray(c.tags) && (c.tags.includes("verified") || c.tags.includes("community")));
    if (better) dedup.set(sym, c);
  }

  const mapped = Array.from(dedup.values())
    .map(t => ({ symbol: t.symbol, name: t.name, mint: t.address }))
    .sort((a, b) => a.symbol.localeCompare(b.symbol));

  compatCache.set(masterSymbol, { at: now, items: mapped });
  return mapped;
}

/* ----- Static fallback (optional) ----- */
import { COINS as LOCAL_COINS } from "./coins.js";
const STATIC_COMPAT = {
  USDC: LOCAL_COINS.map(c => c.symbol).filter(s => s !== "USDC"),
  SOL:  LOCAL_COINS.map(c => c.symbol).filter(s => s !== "SOL"),
  ETH:  ["USDC","SOL","BTC","JUP","BONK","PYTH","RAY","ORCA","WIF"],
  BTC:  ["USDC","SOL","ETH","JUP","RAY","ORCA","PYTH","BONK","WIF"],
};
export function getStaticTradables(masterSymbol) {
  const allow = STATIC_COMPAT[masterSymbol] || [];
  return LOCAL_COINS.filter(c => c.symbol !== masterSymbol && allow.includes(c.symbol));
}
