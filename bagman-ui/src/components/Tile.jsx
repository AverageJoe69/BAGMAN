// src/components/Tile.jsx
import React, { useEffect, useRef } from "react";
import TokenSearchSelect from "./TokenSearchSelect.jsx";
import BagBadge from "./BagBadge.jsx";
import { computeBagValue } from "../hooks/useBags.js";

export default function Tile({
  coin,
  isSelecting,
  onClick,
  onChooseToken,
  onClear,
  onDropBag,        // <-- new
  index,
  masterSymbol,
  running = false,
  changePct = 0,    // (already clamped in Home)
  price = null,
  baseline = null,
  leverage = 1,
  bagUnits = 0,     // <-- new
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

  // Apply leverage to % change for visuals/value
  const scaledChange = (changePct || 0) * (leverage || 1);
  const isUp = scaledChange >= 0;

  // Tint class based on leveraged change
  const signClass =
    running && coin
      ? scaledChange > 0
        ? "tile--up"
        : scaledChange < 0
        ? "tile--down"
        : "tile--flat"
      : "";

  // Shell growth
  const SENS_DIVISOR = 10;
  const scaleMag = 1 + Math.abs(scaledChange) / SENS_DIVISOR;
  const growOrigin = isUp ? "bottom center" : "top center";

  // 💰 current bag value for display (integer dollars)
  const bagValueNow = computeBagValue(bagUnits, scaledChange);

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!coin || isSelecting) return;
    onDropBag?.(index);
  };

  return (
    <div
      ref={wrapperRef}
      className={`tile ${coin ? "tile--selected" : "tile--empty"} ${
        isSelecting ? "tile--open" : ""
      } ${running && coin ? "tile--live" : ""} ${signClass}`}
      onClick={() => showGhost && onClick(index)}
      onDoubleClick={handleDoubleClick}
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

            {/* Bag even when not running */}
            {bagUnits > 0 && (
              <BagBadge value={bagValueNow} positive={scaledChange >= 0} />
            )}
          </div>
        ) : (
          <div className="tile__placeholder">
            <span className="plus">＋</span>
            <span className="tile__hint">Select</span>
          </div>
        )
      ) : coin ? (
        <>
          {/* Scaled shell */}
          <div
            className="tile__shell"
            style={{
              transform: `scaleY(${scaleMag})`,
              transformOrigin: growOrigin,
              transition: "transform 220ms ease",
              pointerEvents: "none",
            }}
          />
          {/* Overlay (text stays pinned) */}
          <div className="tile__overlay">
            <div className="tile__run">
              <div className="tile__runTop">
                <span className="tile__symbol">{coin.symbol}</span>
                <span className="tile__mini">
                  {baseline != null && price != null ? "Live" : "…"}
                </span>
              </div>

              {/* Bag while running */}
              {bagUnits > 0 && (
                <BagBadge value={bagValueNow} positive={scaledChange >= 0} />
              )}
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
