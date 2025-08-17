// src/utils/jupiter.js
//
// Jupiter helper module (browser-friendly)
// - Uses Vite proxy paths (see vite.config.js) to avoid CORS/ad-block issues
// - Supports: loading cached token list (with fallback), remote live search,
//   route checks via Quote API, and a simple price helper (tokens per 1 SOL).

/* ----------------------- Proxy endpoints (via Vite) ----------------------- */
const TOKENS_URL = "/jup-tokens/tokens";            // -> https://tokens.jup.ag/tokens
const QUOTE_URL  = "/jup-quote/v6/quote";           // -> https://quote-api.jup.ag/v6/quote
const LITE_SEARCH_URL = "/jup-lite/tokens/v2/search"; // -> https://lite-api.jup.ag/tokens/v2/search

/* ---------------------------- Fallback tokens ----------------------------- */
/* Small offline list so the UI works even if the big list is blocked.       */
const FALLBACK_TOKENS = [
  { address: "So11111111111111111111111111111111111111112", symbol: "SOL",  name: "Solana",      decimals: 9, tags: ["verified"] },
  { address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", name: "USD Coin",    decimals: 6, tags: ["verified"] },
  { address: "Es9vMFrzaCERmJFrF4H2FYD4KCoNkY11McCe8BenwNYB", symbol: "USDT", name: "Tether USD",  decimals: 6, tags: ["verified"] },
  { address: "JUP2jxvE7ipT9G7oYTWX8cLZsCji7brJ2PmuE5Q5wsi", symbol: "JUP",  name: "Jupiter",      decimals: 6, tags: ["community"] },
  { address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", symbol: "BONK", name: "Bonk",        decimals: 5, tags: ["community"] },
  { address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", symbol: "RAY",  name: "Raydium",     decimals: 6, tags: ["verified"] },
  { address: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu8oqQmfLDsF3",   symbol: "ORCA", name: "Orca",        decimals: 6, tags: ["verified"] },
  { address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", symbol: "SAMO", name: "Samoyedcoin", decimals: 9, tags: ["community"] },
  { address: "F7xcoLMoBqK51hGZ5WhkrFJ8aUoD2rY9wyWykQG7bNGN", symbol: "WIF",  name: "dogwifhat",   decimals: 6, tags: ["community"] },
  // You can add more mints here for richer offline testing.
];

/* ------------------------------ Internal cache ---------------------------- */
let _tokensCache = null;                  // Array of tokens (from Jupiter or fallback)
let _bySymbol = null;                     // Map<UPPER_SYMBOL, token>
let _sourceInfo = { usingFallback: false, count: 0 }; // for UI banner

/* ------------------------------- Load tokens ------------------------------ */
export async function loadTokens() {
  if (_tokensCache) return _tokensCache;

  try {
    const res = await fetch(TOKENS_URL, { cache: "no-store", mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tokens = await res.json();
    _tokensCache = (tokens || []).filter((t) => t?.address && t?.symbol);
    if (!_tokensCache.length) throw new Error("Empty token list");
    _sourceInfo = { usingFallback: false, count: _tokensCache.length };
  } catch (err) {
    console.error("[jupiter] Failed to fetch tokens; using fallback list:", err);
    _tokensCache = FALLBACK_TOKENS.slice();
    _sourceInfo = { usingFallback: true, count: _tokensCache.length };
  }

  _bySymbol = new Map();
  for (const t of _tokensCache) {
    const sym = (t.symbol || "").toUpperCase();
    if (!sym) continue;
    const existing = _bySymbol.get(sym);
    const better =
      !existing ||
      (Array.isArray(t.tags) &&
        (t.tags.includes("verified") || t.tags.includes("community")));
    if (better) _bySymbol.set(sym, t);
  }

  return _tokensCache;
}

export function getTokenSourceInfo() {
  return _sourceInfo;
}

export async function getTokenBySymbol(symbol) {
  await loadTokens();
  return _bySymbol.get((symbol || "").toUpperCase()) || null;
}

/* ------------------------ Local (cached) token search --------------------- */
/* Works offline: matches symbol, name, or partial mint.                      */
export async function searchTokens(query, opts = {}) {
  await loadTokens();
  const { limit = 100, verifiedOnly = false } = opts;
  const q = (query || "").trim().toLowerCase();
  if (!q) return [];

  const looksLikeMint = q.length >= 32; // rough base58 length
  const out = [];
  for (const t of _tokensCache) {
    if (
      verifiedOnly &&
      !(Array.isArray(t.tags) &&
        (t.tags.includes("verified") || t.tags.includes("community")))
    ) {
      continue;
    }
    const sym = (t.symbol || "").toLowerCase();
    const name = (t.name || "").toLowerCase();
    const mint = (t.address || "").toLowerCase();

    if (sym.includes(q) || name.includes(q) || (looksLikeMint && mint.includes(q))) {
      out.push({
        symbol: t.symbol,
        name: t.name,
        mint: t.address,
        decimals: t.decimals,
        tags: t.tags,
      });
      if (out.length >= limit) break;
    }
  }
  return out.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

/* ------------------------- Remote (live) token search --------------------- */
/* Bypasses local list; calls Jupiter Token API v2 each time you type.        */
export async function remoteSearchTokens(
  query,
  { limit = 100, verifiedOnly = false } = {}
) {
  const q = (query || "").trim();
  if (!q) return [];
  const params = new URLSearchParams({ query: q, limit: String(limit) });

  const res = await fetch(`${LITE_SEARCH_URL}?${params.toString()}`, {
    cache: "no-store",
    mode: "cors",
  });
  if (!res.ok) throw new Error(`lite search HTTP ${res.status}`);
  const data = await res.json(); // array

  let list = Array.isArray(data) ? data : [];
  if (verifiedOnly) {
    list = list.filter(
      (t) =>
        Array.isArray(t.tags) &&
        (t.tags.includes("verified") || t.tags.includes("community"))
    );
  }
  return list.map((t) => ({
    symbol: t.symbol,
    name: t.name,
    mint: t.address || t.mint || t.id,
    decimals: t.decimals ?? 6,
    tags: t.tags || [],
  }));
}

/* ------------------------------ Quote helpers ----------------------------- */
function probeAmount(decimals) {
  if (!Number.isFinite(decimals) || decimals < 0) return 1n;
  const val = 10n ** BigInt(decimals); // 1.0 base unit
  return val > 0n ? val : 1n;
}

/** Check if a live route exists for base(symbol) -> candidate(mint). */
export async function checkRoute(masterSymbol, candidateMint) {
  if (!masterSymbol) return true; // don't block if unset
  await loadTokens();
  const master = await getTokenBySymbol(masterSymbol);
  if (!master) return false;

  const params = new URLSearchParams({
    inputMint: master.address,
    outputMint: candidateMint,
    amount: String(probeAmount(master.decimals)),
    slippageBps: "50",
    onlyDirectRoutes: "false",
  });

  try {
    const res = await fetch(`${QUOTE_URL}?${params.toString()}`, {
      cache: "no-store",
      mode: "cors",
    });
    if (!res.ok) return false;
    const data = await res.json();
    const out =
      (typeof data?.outAmount === "string" && data.outAmount) ||
      (Array.isArray(data?.data) && data.data[0]?.outAmount);
    return Boolean(out && BigInt(out) > 0n);
  } catch (e) {
    console.error("[jupiter] quote check failed", e);
    return false;
  }
}

/** Return tokens (OUTPUT) received for 1 unit of baseSymbol (e.g., 1 SOL). */
export async function priceTokensPerBase(baseSymbol, outputMint) {
  await loadTokens();
  const base = await getTokenBySymbol(baseSymbol);
  if (!base) throw new Error(`Unknown base ${baseSymbol}`);

  const amountAtomic = 10n ** BigInt(base.decimals); // 1 base unit
  const params = new URLSearchParams({
    inputMint: base.address,
    outputMint,
    amount: String(amountAtomic),
    slippageBps: "50",
    onlyDirectRoutes: "false",
  });

  const res = await fetch(`${QUOTE_URL}?${params.toString()}`, {
    cache: "no-store",
    mode: "cors",
  });
  if (!res.ok) throw new Error(`quote HTTP ${res.status}`);
  const data = await res.json();

  const out =
    (typeof data?.outAmount === "string" && data.outAmount) ||
    (Array.isArray(data?.data) && data.data[0]?.outAmount);
  if (!out) throw new Error("No outAmount in quote");

  // Prefer route decimals when available; fall back to 6
  const outDecimals =
    (Array.isArray(data?.data) && data.data[0]?.outDecimals) ?? 6;

  return Number(out) / Math.pow(10, outDecimals); // tokens per 1 base
}
