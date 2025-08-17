// src/components/BagBadge.jsx
import React from "react";

/**
 * Circular badge that shows the *current* bag value (already computed/rounded).
 * Keep it simple: just a number (no $) so it fits.
 */
export default function BagBadge({ value = 0, positive = false }) {
  const display = Math.max(0, Math.round(value)); // avoid -0
  return (
    <div
      className={`bag-badge ${positive ? "bag--up" : "bag--down"}`}
      aria-label={`Bag value ${display}`}
      title={`$${display}`}
    >
      {display}
    </div>
  );
}
