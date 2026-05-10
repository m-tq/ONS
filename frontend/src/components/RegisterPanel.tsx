import { useCallback, useEffect, useMemo, useState } from 'react'

import { EPOCHS_PER_YEAR } from '../lib/constants'
import {
  formatOct,
  isValidLabel,
  normalizeLabel,
  octToOu,
  truncateMiddle,
} from '../lib/format'
import { sendWrite, loadName, type OnsConfig } from '../lib/ons'
import { addPublicBookmark } from '../lib/bookmarks'

import { StatusTag } from './StatusTag'
import { TxLink } from './AddressLink'
import { ActionButton } from './Button'
import type { WalletState } from '../hooks/useWallet'

interface Props {
  config:       OnsConfig | null
  wallet:       WalletState
  initialLabel?: string
  onDone:       () => void
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'submitting' }
  | { kind: 'success';  txHash: string; label: string }
  | { kind: 'error';    message: string }

export function RegisterPanel({ config, wallet, initialLabel, onDone }: Props) {
  const [label, setLabel]     = useState<string>(initialLabel ?? '')
  const [years, setYears]     = useState<number>(1)
  const [destination, setDestination] = useState<string>('')
  const [viewPk, setViewPk]           = useState<string>('')
  const [phase, setPhase]     = useState<Phase>({ kind: 'idle' })

  // Auto-fill destination + view pubkey from the connected wallet. The view
  // pubkey mirrors webcli's "keys → view key" value and is what enables
  // stealth sends to resolve through this name.
  useEffect(() => {
    if (!wallet.connection) return
    if (!destination) setDestination(wallet.connection.address)
    if (!viewPk) {
      const resolved = wallet.identity?.viewPublicKey || wallet.connection.viewPublicKey
      if (resolved) setViewPk(resolved)
    }
  }, [wallet.connection, wallet.identity, destination, viewPk])

  useEffect(() => { if (initialLabel) setLabel(initialLabel) }, [initialLabel])

  const cost = useMemo(() => {
    if (!config) return 0n
    return config.pricePerYear * BigInt(Math.max(1, years))
  }, [config, years])

  const canSubmit = wallet.connection != null
    && config != null
    && phase.kind !== 'submitting'

  const handleSubmit = useCallback(async () => {
    if (!wallet.sdk || !wallet.connection || !config) return
    setPhase({ kind: 'submitting' })
    try {
      const clean = normalizeLabel(label)
      if (!isValidLabel(clean)) throw new Error('invalid label — 3-63 chars, a-z, 0-9, dash')
      if (!destination.startsWith('oct') || destination.length !== 47) {
        throw new Error('destination must be a valid oct… address')
      }

      const pre = await loadName(clean)
      if (!pre.isAvailable) throw new Error('name is already taken')

      // Acquire the write capability as part of the same user gesture that
      // triggered the submit click — keeps Chrome's openPopup API inside its
      // user-activation window so the wallet can show its approval popup
      // inline rather than opening a standalone extension window.
      const cap = await wallet.ensureCapability('write')
      if (!cap) throw new Error('write permission not granted')

      const result = await sendWrite(
        wallet.sdk,
        cap.id,
        'register_name',
        [clean, destination, viewPk, years],
        { amountOu: cost, ou: 1_000 },
      )
      if (!result.success) throw new Error(result.revertReason ?? 'revert')

      if (wallet.connection) addPublicBookmark(wallet.connection.address, clean)
      setPhase({ kind: 'success', txHash: result.txHash, label: clean })
    } catch (err) {
      setPhase({ kind: 'error', message: (err as Error).message })
    }
  }, [label, destination, viewPk, years, cost, wallet, config])

  const resetForm = useCallback(() => {
    setPhase({ kind: 'idle' })
    setLabel('')
  }, [])

  if (phase.kind === 'success') {
    return (
      <section className="section">
        <div className="section-title">
          <span>registration complete</span>
          <StatusTag variant="confirmed">confirmed</StatusTag>
        </div>
        <div className="section-body">
          <table className="detail-table" style={{ marginBottom: 'var(--oct-space-06)' }}>
            <tbody>
              <tr>
                <td>name</td>
                <td className="mono">{phase.label}<span className="muted">.oct</span></td>
              </tr>
              <tr>
                <td>tx hash</td>
                <td><TxLink hash={phase.txHash} /></td>
              </tr>
            </tbody>
          </table>
          <div style={{ display: 'flex', gap: 'var(--oct-space-04)' }}>
            <button className="button" onClick={resetForm}>register another</button>
            <button className="button button--primary" onClick={onDone}>open dashboard</button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="section">
      <div className="section-title">
        <span>register a name</span>
        <span className="muted">public namespace</span>
      </div>

      <div className="section-body">
        <div className="form-grid">
          <div className="form-field">
            <label className="form-label" htmlFor="label">label</label>
            <input
              id="label"
              className="input mono"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="alice"
              maxLength={63}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="form-help">
              3-63 chars · a-z, 0-9, dash. resolvable as <code className="mono">{label.trim() ? normalizeLabel(label) : '<label>'}.oct</code>.
            </span>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="years">duration</label>
            <select
              id="years"
              className="input"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            >
              {[1, 2, 3, 5, 10].map((y) => (
                <option key={y} value={y}>{y} {y === 1 ? 'year' : 'years'} ({(y * EPOCHS_PER_YEAR).toLocaleString()} epochs)</option>
              ))}
            </select>
            <span className="form-help">
              cost: <span className="mono">{formatOct(cost)} OCT</span>{' '}
              ({octToOu(formatOct(cost)).toString()} OU)
            </span>
          </div>

          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="destination">destination address</label>
            <input
              id="destination"
              className="input mono"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="oct..."
              autoComplete="off"
              spellCheck={false}
            />
            <span className="form-help">plaintext address returned by <code className="mono">resolve(label)</code>.</span>
          </div>

          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="viewpk">view pubkey (optional)</label>
            <div className="input-group">
              <input
                id="viewpk"
                className="input mono"
                value={viewPk}
                onChange={(e) => setViewPk(e.target.value)}
                placeholder="base64 curve25519 view pubkey"
                autoComplete="off"
                spellCheck={false}
              />
              <ActionButton
                type="button"
                disabled={!wallet.sdk || !wallet.connection}
                onClick={async () => {
                  if (!wallet.sdk) return
                  try {
                    // Acquire the read cap inside the click handler so the
                    // approval popup (if needed for the first call) lands
                    // in the active user-gesture window.
                    const cap = wallet.readCap ?? await wallet.ensureCapability('read')
                    if (!cap) return
                    // Auto-execute through the offscreen PVAC runner — no popup.
                    const id = await wallet.sdk.getCryptoIdentity(cap.id)
                    if (id.viewPublicKey) setViewPk(id.viewPublicKey)
                  } catch (err) {
                    setPhase({ kind: 'error', message: (err as Error).message })
                  }
                }}
                title="fetch view pubkey from wallet"
              >
                fetch
              </ActionButton>
            </div>
            <span className="form-help">
              auto-filled from the connected wallet. enables senders to stealth-send to your name
              without revealing your address.
            </span>
          </div>
        </div>

        {phase.kind === 'error' && (
          <div className="alert alert--error" style={{ marginTop: 'var(--oct-space-06)' }}>{phase.message}</div>
        )}

        <div style={{ display: 'flex', gap: 'var(--oct-space-04)', marginTop: 'var(--oct-space-06)', alignItems: 'center' }}>
          <ActionButton
            variant="primary"
            pending={phase.kind === 'submitting'}
            pendingLabel="submitting…"
            disabled={!canSubmit || !label.trim()}
            title={!wallet.connection ? 'connect wallet first' : undefined}
            onClick={handleSubmit}
          >
            register · {formatOct(cost)} OCT
          </ActionButton>
          {!wallet.connection && <span className="muted">connect a wallet to register</span>}
          {wallet.connection && phase.kind !== 'submitting' && (
            <span className="muted">
              paid by <span className="mono">{truncateMiddle(wallet.connection.address, 6, 4)}</span>
            </span>
          )}
        </div>
      </div>
    </section>
  )
}
