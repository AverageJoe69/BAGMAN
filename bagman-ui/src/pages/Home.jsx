// src/pages/Home.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Tile from "../components/Tile.jsx";
import { loadTokens, getTokenSourceInfo, priceTokensPerBase } from "../utils/jupiter.js";

const DEFAULT_TILES = 10;
const MASTER_BASE = "SOL";        // fixed base
const POLL_MS = 1000;             // target cycle duration
const MAX_ABS_PCT = 50;           // clamp for UI (±50%)
const STAGGER_PER_COIN_MS = 90;   // spread requests inside each cycle

export default function Home() {
  const [selections, setSelections] = useState(Array(DEFAULT_TILES).fill(null));
  const [editingIndex, setEditingIndex] = useState(null);
  const [sourceInfo, setSourceInfo] = useState({ usingFallback: false, count: 0 });

  // session state
  const [isRunning, setIsRunning] = useState(false);
  const [baseline, setBaseline] = useState({});   // mint -> price at t0 (token per 1 SOL)
  const [lastPrice, setLastPrice] = useState({}); // mint -> latest price
  const [pctChange, setPctChange] = useState({}); // mint -> % change vs baseline (unclamped)
  const [lastTickAt, setLastTickAt] = useState(null); // UI heartbeat

  // leverage
  const [leverage, setLeverage] = useState(1);

  // refs for robust polling
  const timeoutRef = useRef(null);
  const refreshingRef = useRef(false);
  const t0Ref = useRef({});
  const runningRef = useRef(false);
  const selectionsRef = useRef(selections);

  useEffect(() => { selectionsRef.current = selections; }, [selections]);
  useEffect(() => { runningRef.current = isRunning; }, [isRunning]);
  useEffect(() => { t0Ref.current = baseline; }, [baseline]);

  // prime token list (for banner only)
  useEffect(() => {
    (async () => {
      await loadTokens();
      setSourceInfo(getTokenSourceInfo());
    })();
  }, []);

  const tiles = useMemo(
    () => selections.map((coin, idx) => ({ coin, isSelecting: editingIndex === idx })),
    [selections, editingIndex]
  );

  const selectedCount = useMemo(() => selections.filter(Boolean).length, [selections]);

  const openTile  = (index) => setEditingIndex(index);
  const closeTile = () => setEditingIndex(null);

  const handleChooseToken = (index, token) => {
    setSelections((prev) => {
      const next = [...prev];
      next[index] = token;
      return next;
    });
    closeTile();
  };

  const handleClear = (index) => {
    setSelections((prev) => {
      const next = [...prev];
      next[index] = null;
      return next;
    });
    closeTile();
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // === Robust ticker: never wedges, auto-seeds baseline after HMR/changes ===
  async function refreshOnce() {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const active = selectionsRef.current.filter(Boolean);
      const t0 = t0Ref.current;

      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        try {
          const p = await priceTokensPerBase(MASTER_BASE, c.mint);

          // 1) Always store last price
          setLastPrice((prev) => ({ ...prev, [c.mint]: p }));

          // 2) If baseline missing (e.g., hot reload), seed it now
          if (typeof t0[c.mint] !== "number" || !(t0[c.mint] > 0)) {
            setBaseline((prev) => {
              if (prev[c.mint] != null) return prev;
              const next = { ...prev, [c.mint]: p };
              t0Ref.current = next;
              return next;
            });
          } else {
            // 3) Compute % vs baseline
            const b = t0[c.mint];
            const pct = ((p / b) - 1) * 100;
            setPctChange((prev) => ({ ...prev, [c.mint]: pct }));
          }
        } catch {
          // swallow; keep previous values
        }
        if (i < active.length - 1) await sleep(STAGGER_PER_COIN_MS);
      }

      setLastTickAt(Date.now());
    } finally {
      refreshingRef.current = false;
    }
  }

  function scheduleNext() {
    if (!runningRef.current) return;
    timeoutRef.current = setTimeout(() => {
      refreshOnce().finally(scheduleNext);   // keep chain alive even on errors
    }, POLL_MS);
  }

  function stopPolling() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    refreshingRef.current = false;
  }

  async function handleStartSession() {
    const active = selections.filter(Boolean);
    if (active.length === 0) return;

    // take baselines
    const t0 = {};
    const baselines = await Promise.all(
      active.map(async (c) => {
        try {
          const p = await priceTokensPerBase(MASTER_BASE, c.mint);
          return { mint: c.mint, price: p };
        } catch {
          return { mint: c.mint, price: null };
        }
      })
    );
    for (const b of baselines) if (b.price != null) t0[b.mint] = b.price;
    setBaseline(t0);
    t0Ref.current = t0;

    setIsRunning(true);
    runningRef.current = true;

    stopPolling();
    await refreshOnce();   // immediate tick
    scheduleNext();        // start loop
  }

  // clean up on unmount
  useEffect(() => {
    return () => stopPolling();
  }, []);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="title">Bag Man — Session Setup</h1>
        <p className="subtitle">
          Base: {MASTER_BASE} • Select up to {DEFAULT_TILES} coins (chosen: {selectedCount}/{DEFAULT_TILES})
          {isRunning ? " • Live session running" : ""}
          {lastTickAt ? ` • Last tick: ${new Date(lastTickAt).toLocaleTimeString()}` : ""}
        </p>

        {/* Leverage buttons */}
        <div className="leverage-controls" style={{ marginTop: 8 }}>
          {[1, 10, 25, 50, 100].map((x) => (
            <button
              key={x}
              type="button"
              className={`pill ${leverage === x ? "active" : ""}`}
              onClick={() => setLeverage(x)}
            >
              {x}x
            </button>
          ))}
        </div>
      </header>

      <main className="stage">
        <div className="stage__inner" style={{ width: "100%" }}>
          {sourceInfo.usingFallback ? (
            <div
              className="session-banner"
              style={{
                background: "#2a2431",
                color: "#c7b8ff",
                border: "1px solid #4b3f6a",
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 8,
              }}
            >
              Local token list is blocked, but <b>live search is active</b>. Type a token’s symbol/name/mint to add it.
            </div>
          ) : (
            <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 8 }}>
              Loaded {sourceInfo.count} tokens from Jupiter.
            </div>
          )}

          <div className="block-line">
            {tiles.map((tile, idx) => {
              const mint = tile.coin?.mint;
              const rawChange = mint ? pctChange[mint] ?? 0 : 0;
              const change = Math.max(-MAX_ABS_PCT, Math.min(MAX_ABS_PCT, rawChange)); // clamp for visuals
              const price  = mint ? lastPrice[mint] : null;
              const base   = mint ? baseline[mint] : null;

              return (
                <Tile
                  key={idx}
                  coin={tile.coin}
                  isSelecting={!isRunning && tile.isSelecting}
                  onClick={(indexOrNull) => {
                    if (isRunning) return; // lock tiles during run
                    if (indexOrNull == null) return setEditingIndex(null);
                    setEditingIndex(indexOrNull);
                  }}
                  onChooseToken={handleChooseToken}
                  onClear={handleClear}
                  index={idx}
                  masterSymbol={MASTER_BASE}
                  running={isRunning}
                  changePct={change}
                  price={price}
                  baseline={base}
                  leverage={leverage}
                />
              );
            })}
          </div>
        </div>
      </main>

      <footer className="footer" style={{ gap: 12 }}>
        <button
          className="primary"
          type="button"
          disabled={selectedCount === 0}
          onClick={handleStartSession}
        >
          {isRunning ? "Restart Session" : "Start Session"}
        </button>
      </footer>
    </div>
  );
}
