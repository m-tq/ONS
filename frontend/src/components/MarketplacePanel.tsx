import { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, ShoppingCart, Info } from 'lucide-react'

import { loadActiveListings, sendWrite, type ListingEntry, type OnsConfig } from '../lib/ons'
import { formatOct } from '../lib/format'
import { useAsyncAction } from '../hooks/useAsyncAction'

import { AddressLink, TxLink } from './AddressLink'
import { ActionButton } from './Button'
import type { WalletState } from '../hooks/useWallet'

interface Props {
  wallet: WalletState
  config: OnsConfig | null
}

export function MarketplacePanel({ wallet, config }: Props) {
  const [rows, setRows]         = useState<ListingEntry[]>([])
  const [error, setError]       = useState<string | null>(null)
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null)
  const [message, setMessage]   = useState<{ kind: 'ok' | 'error'; text: string; tx?: string } | null>(null)
  const [busy, setBusy]         = useState<string | null>(null)

  const refreshAction = useAsyncAction()
  const walletAddr = wallet.connection?.address ?? ''

  const doRefresh = useCallback(async () => {
    setError(null)
    try {
      const entries = await loadActiveListings()
      setRows(entries)
      setLastLoadedAt(Date.now())
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => { void refreshAction.run(doRefresh) }, [doRefresh]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuy = useCallback(async (entry: ListingEntry) => {
    if (!wallet.sdk || !wallet.connection) {
      setMessage({ kind: 'error', text: 'connect a wallet first' })
      return
    }
    const price = entry.record.listingPrice
    setBusy(entry.label)
    setMessage(null)
    try {
      const buyerAddr   = wallet.connection.address
      const buyerViewPk = wallet.identity?.viewPublicKey ?? wallet.connection.viewPublicKey ?? ''

      // Acquire the write cap inside this click handler so the approval
      // popup opens inline (not as a standalone extension window).
      const cap = await wallet.ensureCapability('write')
      if (!cap) throw new Error('write permission not granted')

      const result = await sendWrite(
        wallet.sdk,
        cap.id,
        'buy_name',
        [entry.label, buyerAddr, buyerViewPk],
        { amountOu: price, ou: 1_000 },
      )
      if (!result.success) throw new Error(result.revertReason ?? 'revert')

      setMessage({
        kind: 'ok',
        text: `bought ${entry.label}.oct for ${formatOct(price)} OCT · resolves to your wallet`,
        tx:   result.txHash,
      })
      await refreshAction.run(doRefresh)
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(null)
    }
  }, [wallet, doRefresh, refreshAction])

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => Number(a.record.listingPrice - b.record.listingPrice)),
    [rows],
  )

  const lastLoadedText = refreshAction.pending
    ? 'refreshing…'
    : lastLoadedAt
      ? `updated ${formatAgo(lastLoadedAt)}`
      : 'never refreshed'

  return (
    <>
      <section className="section">
        <div className="section-title">
          <span>marketplace</span>
          <div style={{ display: 'flex', gap: 'var(--oct-space-03)', alignItems: 'center' }}>
            <span className="muted" style={{ fontSize: 'var(--oct-type-size-01)' }}>{lastLoadedText}</span>
            <ActionButton
              variant="quiet"
              pending={refreshAction.pending}
              pendingLabel="refreshing…"
              icon={<RefreshCw size={12} />}
              onClick={() => refreshAction.run(doRefresh)}
            >
              refresh
            </ActionButton>
          </div>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {message && (
          <div className={`alert ${message.kind === 'error' ? 'alert--error' : 'alert--ok'}`}>
            {message.text}
            {message.tx && message.kind === 'ok' && <> · <TxLink hash={message.tx} /></>}
          </div>
        )}

        {refreshAction.pending && rows.length === 0 && (
          <div className="loading-line">loading active listings from the contract…</div>
        )}

        {!refreshAction.pending && sortedRows.length === 0 && !error && (
          <div className="empty-line">
            no active listings right now · anyone can list a name from the <strong>my names</strong> tab
          </div>
        )}

        {sortedRows.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>name</th>
                <th style={{ width: '25%' }}>seller</th>
                <th style={{ width: '15%' }}>price</th>
                <th style={{ width: '15%' }}>after fee</th>
                <th style={{ width: '15%' }}>action</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((entry) => {
                const price = entry.record.listingPrice
                const fee   = config ? (price * BigInt(config.feeBps)) / 10_000n : 0n
                const sellerAmount = price - fee
                const isOwn = Boolean(walletAddr && entry.record.owner === walletAddr)
                const isBusy = busy === entry.label

                return (
                  <tr key={entry.label}>
                    <td className="mono">
                      {entry.label}<span className="muted">.oct</span>
                    </td>
                    <td>
                      <AddressLink address={entry.record.listingSeller || entry.record.owner} small />
                    </td>
                    <td className="amount">{formatOct(price)} OCT</td>
                    <td className="amount muted">{formatOct(sellerAmount)} OCT</td>
                    <td>
                      <ActionButton
                        variant="primary"
                        pending={isBusy}
                        pendingLabel="buying…"
                        icon={<ShoppingCart size={12} />}
                        disabled={!wallet.connection || isOwn || refreshAction.pending}
                        title={isOwn ? 'cannot buy your own listing' : undefined}
                        onClick={() => handleBuy(entry)}
                      >
                        buy
                      </ActionButton>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="section" style={{ marginTop: 'var(--oct-space-06)' }}>
        <div className="section-title">
          <span><Info size={12} /> on-chain listing index</span>
          <span className="muted">ons marketplace</span>
        </div>
        <div className="section-body">
          <p style={{ margin: 0 }} className="muted">
            the contract maintains a swap-and-pop index of active listings. the dApp reads
            <code className="mono"> listing_total</code> / <code className="mono">listing_key_at(i)</code>
            to iterate every active listing in O(n) — no event scanning.
          </p>
          <ul className="muted" style={{ marginTop: 'var(--oct-space-04)', paddingLeft: '1.4em' }}>
            <li>buyer's wallet address is auto-bound as the new destination when a buy confirms.</li>
            <li>seller receives <span className="mono">price − (price × {(config?.feeBps ?? 250) / 100}%)</span>.</li>
            <li>listings auto-cancel when the name is transferred, bought, released, or re-registered.</li>
          </ul>
        </div>
      </section>
    </>
  )
}

function formatAgo(ts: number): string {
  const secs = Math.max(1, Math.round((Date.now() - ts) / 1000))
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}
