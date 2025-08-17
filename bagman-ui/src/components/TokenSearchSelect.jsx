import React, { useEffect, useMemo, useRef, useState } from "react";
import { remoteSearchTokens, checkRoute } from "../utils/jupiter.js";

export default function TokenSearchSelect({ masterSymbol, onChoose, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [checkingMint, setCheckingMint] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoadError(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const r = await remoteSearchTokens(q, { limit: 100, verifiedOnly: false });
        setResults(r);
      } catch (err) {
        console.error("Remote token search failed:", err);
        setResults([]);
        setLoadError("Search unavailable.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [query]);

  async function handlePick(token) {
    try {
      if (!masterSymbol) { onChoose(token); onClose?.(); return; }
      setCheckingMint(token.mint);
      const ok = await checkRoute(masterSymbol, token.mint);
      setCheckingMint(null);
      if (!ok) {
        console.warn(`[route-check] No route for ${masterSymbol} -> ${token.symbol}. Allowing selection during dev.`);
      }
      onChoose(token);
      onClose?.();
    } catch (err) {
      setCheckingMint(null);
      console.error("Route check failed; allowing selection.", err);
      onChoose(token);
      onClose?.();
    }
  }

  const hint = useMemo(() => {
    if (loading) return "Searching…";
    if (loadError) return loadError;
    if (query.trim().length < 2) return "Type at least 2 characters";
    if (!results.length) return "No matches";
    return `${results.length} match${results.length === 1 ? "" : "es"}`;
  }, [loading, loadError, query, results]);

  return (
    <div className="selector-inline" onClick={(e) => e.stopPropagation()}>
      <div className="selector-inline__label" style={{ width: "100%" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 12, color: "#9aa1ad" }}>
            Pick a coin (pairs with {masterSymbol || "—"})
          </div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#6b7280" }}>{hint}</div>
        </div>

        <input
          autoFocus
          placeholder="Search by symbol, name, or mint… e.g. SAMO, ORCA"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%", padding: "10px 12px", background: "#0b1015",
            color: "white", border: "1px solid #1f2430", borderRadius: 10, outline: "none"
          }}
        />

        <div style={{ marginTop: 10, maxHeight: 220, overflowY: "auto", display: "grid", gap: 6 }}>
          {results.map((t) => (
            <button
              key={t.mint}
              onClick={() => handlePick(t)}
              disabled={checkingMint === t.mint}
              style={{
                textAlign: "left", padding: "10px 12px", borderRadius: 10,
                background: "#0f1318", color: "white", border: "1px solid #1f2430",
                cursor: "pointer", opacity: checkingMint === t.mint ? 0.6 : 1
              }}
            >
              <div style={{ fontWeight: 700, letterSpacing: 0.3 }}>{t.symbol}</div>
              <div style={{ fontSize: 12, color: "#96a0ae" }}>{t.name}</div>
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 10, width: "100%", padding: "8px 10px",
            borderRadius: 10, border: "1px solid #1f2430",
            background: "#12161b", color: "#cbd5e1", cursor: "pointer"
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
