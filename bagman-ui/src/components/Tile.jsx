// src/components/Tile.jsx
import React, { useEffect, useRef } from "react";
import TokenSearchSelect from "./TokenSearchSelect.jsx";

export default function Tile({
  coin,
  isSelecting,
  onClick,
  onChooseToken,
  onClear,
  index,
  masterSymbol,
  running = false,
  changePct = 0,
  price = null,
  baseline = null,
  leverage = 1,
}) {
  const wrapperRef = useRef(null);

  // Close dropdown when clicking outside / Esc
  useEffect(() => {
    if (!isSelecting) return;
    function onDown(e) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target)) onClick(null);
    }
    function onKey(e) {
      if (e.key === "Escape") onClick(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [isSelecting, onClick]);

  const showGhost = !running;

  // Apply leverage for visuals (Home feeds % vs baseline)
  const scaledChange = (changePct || 0) * (leverage || 1);
  const isUp = scaledChange >= 0;
  const absClamped = Math.min(50, Math.abs(scaledChange));

  // Outer tint class (keeps your existing up/down look)
  const signClass =
    running && coin
      ? scaledChange > 0
        ? "tile--up"
        : scaledChange < 0
        ? "tile--down"
        : "tile--flat"
      : "";

  // Sensitivity for shell scaling (same as before)
  const SENS_DIVISOR = 10;
  const scaleMag = 1 + Math.abs(scaledChange) / SENS_DIVISOR; // >= 1
  const growOrigin = isUp ? "bottom center" : "top center";

  return (
    <div
      ref={wrapperRef}
      className={`tile ${coin ? "tile--selected" : "tile--empty"} ${
        isSelecting ? "tile--open" : ""
      } ${running && coin ? "tile--live" : ""} ${signClass}`}
      onClick={() => showGhost && onClick(index)}
      role="button"
      tabIndex={0}
      aria-label={coin ? `${coin.symbol} tile` : "Empty tile"}
    >
      {showGhost ? (
        coin ? (
          <div className="tile__content" onClick={(e) => e.stopPropagation()}>
            <span className="tile__symbol">{coin.symbol}</span>
            <span className="tile__name">{coin.name}</span>
            <div className="tile__actions">
              <button
                className="pill"
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(index);
                }}
              >
                Change
              </button>
              <button
                className="pill pill--danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onClear(index);
                }}
              >
                Clear
              </button>
            </div>
          </div>
        ) : (
          <div className="tile__placeholder">
            <span className="plus">＋</span>
            <span className="tile__hint">Select</span>
          </div>
        )
      ) : coin ? (
        <>
          {/* The actual visual box that scales up/down from midline */}
          <div
            className="tile__shell"
            style={{
              transform: `scaleY(${scaleMag})`,
              transformOrigin: growOrigin,
              transition: "transform 220ms ease",
              pointerEvents: "none",
            }}
          />
          {/* Text/UI overlay stays pinned */}
          <div className="tile__overlay">
            <div className="tile__run">
              <div className="tile__runTop">
                <span className="tile__symbol">{coin.symbol}</span>
                <span className="tile__mini">
                  {baseline != null && price != null ? "Live" : "…"}
                </span>
              </div>
              <div className="meter__label">{scaledChange.toFixed(2)}%</div>
            </div>
          </div>
        </>
      ) : (
        <div className="tile__run empty">
          <span className="tile__hint">—</span>
        </div>
      )}

      {/* Inline search (only when not running) */}
      {showGhost && isSelecting && (
        <TokenSearchSelect
          masterSymbol={masterSymbol}
          onChoose={(token) => onChooseToken(index, token)}
          onClose={() => onClick(null)}
        />
      )}
    </div>
  );
}
