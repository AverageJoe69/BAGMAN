// src/hooks/useBags.js
import { useState, useCallback } from "react";

/** $ per "unit" (one double-click adds one unit) */
export const BAG_UNIT_USD = 10;

/** Compute current bag value from units and % change (after leverage). */
export function computeBagValue(units = 0, percent = 0) {
  const base = units * BAG_UNIT_USD;
  return base * (1 + (percent || 0) / 100);
}

/** Holds per-tile bag state. API: increment(index), clear(index), getUnits(index) */
export default function useBags() {
  const [bags, setBags] = useState({}); // { [tileIndex]: units }

  const increment = useCallback((index, by = 1) => {
    setBags((prev) => ({ ...prev, [index]: (prev[index] || 0) + by }));
  }, []);

  const clear = useCallback((index) => {
    setBags((prev) => {
      if (prev[index] == null) return prev;
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }, []);

  const getUnits = useCallback((index) => bags[index] || 0, [bags]);

  return { bags, increment, clear, getUnits };
}
