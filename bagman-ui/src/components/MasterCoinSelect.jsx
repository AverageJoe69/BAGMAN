// src/components/MasterCoinSelect.jsx
import React from "react";
import { COINS } from "../utils/coins.js";

export default function MasterCoinSelect({ value, onChange }) {
  return (
    <div className="master-coin-select">
      <label>
        Master Trading Coin:
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {COINS.map((coin) => (
            <option key={coin.symbol} value={coin.symbol}>
              {coin.symbol} — {coin.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
