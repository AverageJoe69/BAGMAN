import { useEffect, useMemo, useRef, useState } from 'react'

// Static, safe sample list — replace with your SPL list later
const COINS = [
  { symbol: 'USDC', name: 'USD Coin', mint: 'usdc-mint' },
  { symbol: 'SOL',  name: 'Solana',   mint: 'sol-mint' },
  { symbol: 'ETH',  name: 'Ether (Wormhole)', mint: 'eth-wh-mint' },
  { symbol: 'BTC',  name: 'Bitcoin (Wormhole)', mint: 'btc-wh-mint' },
  { symbol: 'JUP',  name: 'Jupiter',  mint: 'jup-mint' },
  { symbol: 'BONK', name: 'Bonk',     mint: 'bonk-mint' },
  { symbol: 'PYTH', name: 'Pyth',     mint: 'pyth-mint' },
  { symbol: 'WIF',  name: 'dogwifhat', mint: 'wif-mint' },
  { symbol: 'RAY',  name: 'Raydium',  mint: 'ray-mint' },
  { symbol: 'ORCA', name: 'Orca',     mint: 'orca-mint' },
]

export default function CoinSelector({ open, onClose, onChoose }) {
  const [q, setQ] = useState('')
  const sheetRef = useRef(null)

  // Close on Esc
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        const el = sheetRef.current?.querySelector('input[type="search"]')
        el?.focus()
      }, 0)
    } else {
      setQ('')
    }
  }, [open])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return COINS
    return COINS.filter(
      c =>
        c.symbol.toLowerCase().includes(s) ||
        c.name.toLowerCase().includes(s)
    )
  }, [q])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`backdrop ${open ? 'backdrop--show' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />

      {/* Bottom sheet */}
      <aside
        className={`sheet ${open ? 'sheet--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Select a coin"
        ref={sheetRef}
      >
        <div className="sheet__grab" aria-hidden />
        <div className="sheet__header">
          <h2>Select a coin</h2>
          <button className="ghost" onClick={onClose} aria-label="Close selector">✕</button>
        </div>

        <div className="sheet__search">
          <input
            type="search"
            placeholder="Search symbol or name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <ul className="coin-list">
          {filtered.map((c) => (
            <li key={c.mint}>
              <button
                className="coin"
                onClick={() => onChoose(c)}
                aria-label={`Choose ${c.symbol}`}
              >
                <div className="coin__symbol">{c.symbol}</div>
                <div className="coin__name">{c.name}</div>
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="empty">No matches</li>
          )}
        </ul>
      </aside>
    </>
  )
}
