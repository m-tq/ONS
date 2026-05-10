import { useCallback, useEffect, useMemo, useState, Fragment } from 'react'
import {
  RefreshCw, ArrowUpRight, Plus, Tag as TagIcon,
  X as XIcon, Settings2, Trash2,
} from 'lucide-react'

import { formatOct, truncateMiddle, epochDeltaHuman } from '../lib/format'
import {
  loadName,
  loadOwnerNames,
  sendWrite,
  type NameRecord,
  type OnsConfig,
} from '../lib/ons'
import { getBalance as getChainBalance } from '../lib/rpc'
import {
  loadBookmarks,
  addPublicBookmark,
  removePublicBookmark,
} from '../lib/bookmarks'
import { NETWORK } from '../lib/constants'

import { AddressLink, TxLink } from './AddressLink'
import { StatusTag } from './StatusTag'
import { ActionButton } from './Button'
import { useAsyncAction } from '../hooks/useAsyncAction'
import type { WalletState } from '../hooks/useWallet'

interface Props {
  wallet: WalletState
  config: OnsConfig | null
}

interface Row {
  label:  string
  record: NameRecord
  owned:  boolean
}

export function DashboardPanel({ wallet, config }: Props) {
  const walletAddr = wallet.connection?.address ?? ''
  const [walletBalance, setWalletBalance] = useState<{ balance: string; nonce: number } | null>(null)
  const [rows, setRows]       = useState<Row[]>([])
  const [err, setErr]         = useState<string | null>(null)
  const [manual, setManual]   = useState('')
  const [notice, setNotice]   = useState<{ kind: 'ok' | 'error'; text: string; tx?: string } | null>(null)
  const [busy, setBusy]       = useState<string | null>(null)

  const balanceAction = useAsyncAction()
  const rowsAction    = useAsyncAction()
  const followAction  = useAsyncAction()

  const refreshBalance = useCallback(async () => {
    if (!wallet.sdk || !wallet.capability || !walletAddr) return
    try {
      const [sdkBalance, chainState] = await Promise.all([
        wallet.sdk.getBalance(wallet.capability.id),
        getChainBalance(walletAddr).catch(() => null),
      ])
      setWalletBalance({
        balance: String(sdkBalance.octBalance ?? '0'),
        nonce:   chainState ? chainState.pending_nonce ?? chainState.nonce ?? 0 : 0,
      })
    } catch (err) {
      console.warn('balance read failed', err)
    }
  }, [wallet.sdk, wallet.capability, walletAddr])

  const refreshRows = useCallback(async () => {
    if (!walletAddr) return
    setErr(null)

    try {
      const bookmarks = loadBookmarks(walletAddr)
      const owned = await loadOwnerNames(walletAddr)

      const ownedRows: Row[] = owned.map(({ label, record }) => ({
        label,
        record,
        owned: true,
      }))

      const ownedLabels = new Set(owned.map((e) => e.label))
      const followedLabels = bookmarks.publics.filter((label) => !ownedLabels.has(label))
      const followedRows: Row[] = await Promise.all(followedLabels.map(async (label): Promise<Row> => {
        const record = await loadName(label)
        return { label, record, owned: false }
      }))

      setRows([...ownedRows, ...followedRows])
    } catch (err) {
      setErr((err as Error).message)
    }
  }, [walletAddr])

  useEffect(() => { void balanceAction.run(refreshBalance) }, [refreshBalance]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void rowsAction.run(refreshRows) },       [refreshRows])    // eslint-disable-line react-hooks/exhaustive-deps

  const addManualPublic = useCallback(async () => {
    const label = manual.trim().toLowerCase().replace(/\.oct$/, '')
    if (!label) return
    if (!walletAddr) return
    addPublicBookmark(walletAddr, label)
    setManual('')
    await rowsAction.run(refreshRows)
  }, [manual, walletAddr, refreshRows, rowsAction])

  const owned    = useMemo(() => rows.filter((r) => r.owned), [rows])
  const followed = useMemo(() => rows.filter((r) => !r.owned), [rows])

  const performWrite = useCallback(async (
    label: string,
    method: string,
    params: unknown[],
    amountOu: bigint = 0n,
  ) => {
    if (!wallet.sdk || !wallet.capability) return
    setBusy(label + ':' + method)
    setNotice(null)
    try {
      const result = await sendWrite(wallet.sdk, wallet.capability.id, method, params, { amountOu })
      if (!result.success) throw new Error(result.revertReason ?? 'revert')
      setNotice({ kind: 'ok', text: `${method.replace(/_/g, ' ')} succeeded`, tx: result.txHash })
      await Promise.all([
        rowsAction.run(refreshRows),
        balanceAction.run(refreshBalance),
      ])
    } catch (err) {
      setNotice({ kind: 'error', text: (err as Error).message })
    } finally {
      setBusy(null)
    }
  }, [wallet, refreshRows, refreshBalance, rowsAction, balanceAction])

  if (!wallet.connection) {
    return (
      <section className="section">
        <div className="section-title"><span>my names</span></div>
        <div className="section-body">
          <div className="empty-line">connect a wallet to see your registered names and balance</div>
        </div>
      </section>
    )
  }

  const balanceMetrics = [
    { label: 'wallet',   value: walletAddr ? truncateMiddle(walletAddr, 8, 6) : '—' },
    { label: 'balance',  value: walletBalance ? `${walletBalance.balance} OCT` : '—' },
    { label: 'nonce',    value: walletBalance ? String(walletBalance.nonce) : '—' },
    { label: 'owned',    value: String(owned.length) },
    { label: 'followed', value: String(followed.length) },
    { label: 'network',  value: NETWORK },
  ]

  return (
    <>
      {/* Wallet strip */}
      <section className="section">
        <div className="section-title">
          <span>wallet</span>
          <ActionButton
            variant="quiet"
            icon={<RefreshCw size={12} />}
            pending={balanceAction.pending}
            pendingLabel="refreshing…"
            onClick={() => balanceAction.run(refreshBalance)}
          >
            refresh
          </ActionButton>
        </div>
        <div className="metrics-row" style={{ borderBottom: 0 }}>
          {balanceMetrics.map((m) => (
            <div className="metric" key={m.label}>
              <span>{m.label}</span>
              <strong className="mono" title={m.value}>{m.value}</strong>
            </div>
          ))}
        </div>
      </section>

      {notice && (
        <div
          className={`alert ${notice.kind === 'error' ? 'alert--error' : 'alert--ok'}`}
          style={{ marginTop: 'var(--oct-space-06)' }}
        >
          {notice.text}
          {notice.tx && <> · <TxLink hash={notice.tx} /></>}
        </div>
      )}

      {/* Owned names */}
      <section className="section" style={{ marginTop: 'var(--oct-space-06)' }}>
        <div className="section-title">
          <span>names you own</span>
          <ActionButton
            variant="quiet"
            icon={<RefreshCw size={12} />}
            pending={rowsAction.pending}
            pendingLabel="refreshing…"
            onClick={() => rowsAction.run(refreshRows)}
          >
            refresh
          </ActionButton>
        </div>

        {err && <div className="alert alert--error">{err}</div>}

        {rowsAction.pending && rows.length === 0 && (
          <div className="loading-line">loading owner index from the contract…</div>
        )}

        {!rowsAction.pending && owned.length === 0 && (
          <div className="empty-line">
            you haven't registered any names yet · head to <strong>register</strong>.
            any name bought via marketplace also appears here automatically.
          </div>
        )}

        {owned.length > 0 && (
          <NameTable
            rows={owned}
            config={config}
            currentEpoch={config?.currentEpoch ?? 0}
            busy={busy}
            onList={(row, price) => performWrite(row.label, 'list_name', [row.label, Number(price)])}
            onCancelListing={(row) => performWrite(row.label, 'cancel_listing', [row.label])}
            onRenew={(row, years) => {
              const cost = (config?.pricePerYear ?? 0n) * BigInt(years)
              performWrite(row.label, 'renew_name', [row.label, years], cost)
            }}
            onRelease={(row) => {
              if (!confirm('release this name? the name becomes available again after grace.')) return
              performWrite(row.label, 'release_name', [row.label])
            }}
            onSetPrimary={(row) => performWrite(row.label, 'set_primary', [row.label])}
            onUpdateDestination={(row, dest) =>
              performWrite(row.label, 'update_destination', [row.label, dest])
            }
          />
        )}
      </section>

      {/* Followed */}
      <section className="section" style={{ marginTop: 'var(--oct-space-06)' }}>
        <div className="section-title">
          <span>watched names</span>
          <span className="muted">{followed.length} tracked</span>
        </div>

        <div className="search-bar">
          <input
            className="input mono"
            placeholder="follow a name to see its state here (e.g. alice)"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') followAction.run(addManualPublic) }}
          />
          <ActionButton
            icon={<Plus size={12} />}
            pending={followAction.pending}
            pendingLabel="adding…"
            disabled={!manual.trim()}
            onClick={() => followAction.run(addManualPublic)}
          >
            follow
          </ActionButton>
        </div>

        {!rowsAction.pending && followed.length === 0 && (
          <div className="empty-line">no watched names yet</div>
        )}

        {!rowsAction.pending && followed.length > 0 && (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>name</th>
                <th style={{ width: '15%' }}>status</th>
                <th style={{ width: '25%' }}>owner</th>
                <th style={{ width: '15%' }}>expires</th>
                <th style={{ width: '15%' }}>action</th>
              </tr>
            </thead>
            <tbody>
              {followed.map((row) => (
                <tr key={row.label}>
                  <td className="mono">{row.label}<span className="muted">.oct</span></td>
                  <td>
                    {row.record.isActive
                      ? <StatusTag variant="confirmed">active</StatusTag>
                      : row.record.isAvailable
                        ? <StatusTag variant="ocs">available</StatusTag>
                        : <StatusTag variant="staging">grace</StatusTag>}
                  </td>
                  <td><AddressLink address={row.record.owner} small /></td>
                  <td className="mono">
                    {row.record.expiry
                      ? epochDeltaHuman(config?.currentEpoch ?? 0, row.record.expiry)
                      : <span className="muted">—</span>}
                  </td>
                  <td>
                    <button
                      className="button button--quiet"
                      onClick={() => {
                        removePublicBookmark(walletAddr, row.label)
                        void rowsAction.run(refreshRows)
                      }}
                    >
                      <Trash2 size={12} /> unfollow
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  )
}

// ─── Owned-names table ───────────────────────────────────────────────────

interface TableProps {
  rows:         Row[]
  config:       OnsConfig | null
  currentEpoch: number
  busy:         string | null
  onList:               (row: Row, priceOu: bigint) => void
  onCancelListing:      (row: Row) => void
  onRenew:              (row: Row, years: number) => void
  onRelease:            (row: Row) => void
  onSetPrimary:         (row: Row) => void
  onUpdateDestination:  (row: Row, destination: string) => void
}

function NameTable({
  rows, config, currentEpoch, busy,
  onList, onCancelListing, onRenew, onRelease, onSetPrimary, onUpdateDestination,
}: TableProps) {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th style={{ width: '30%' }}>name</th>
          <th style={{ width: '14%' }}>status</th>
          <th style={{ width: '14%' }}>expires</th>
          <th style={{ width: '16%' }}>listed</th>
          <th style={{ width: '26%' }}>action</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const key     = row.label
          const listed  = row.record.listingPrice > 0n
          const expired = !row.record.isActive && !row.record.isAvailable

          const statusTag = row.record.isActive
            ? <StatusTag variant="confirmed">active</StatusTag>
            : row.record.isAvailable
              ? <StatusTag variant="rejected">expired</StatusTag>
              : <StatusTag variant="staging">grace</StatusTag>

          return (
            <Fragment key={key}>
              <tr>
                <td className="mono">{row.label}<span className="muted">.oct</span></td>
                <td>{statusTag}</td>
                <td className="mono">
                  {row.record.expiry
                    ? epochDeltaHuman(currentEpoch, row.record.expiry)
                    : <span className="muted">—</span>}
                </td>
                <td>
                  {listed
                    ? <span className="mono">{formatOct(row.record.listingPrice)} OCT</span>
                    : <span className="muted">—</span>}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 'var(--oct-space-02)', flexWrap: 'wrap' }}>
                    <ActionButton
                      variant="quiet"
                      icon={<Settings2 size={11} />}
                      onClick={() => setOpen((cur) => (cur === key ? null : key))}
                    >
                      manage
                    </ActionButton>
                    {listed
                      ? (
                        <ActionButton
                          icon={<XIcon size={11} />}
                          pending={busy === key + ':cancel_listing'}
                          pendingLabel="unlisting…"
                          onClick={() => onCancelListing(row)}
                        >
                          unlist
                        </ActionButton>
                      )
                      : (
                        !expired && <ListButton row={row} onList={onList} busy={busy} />
                      )
                    }
                  </div>
                </td>
              </tr>

              {open === key && (
                <tr>
                  <td colSpan={5} style={{ background: 'var(--oct-color-surface-soft)', padding: 0, whiteSpace: 'normal' }}>
                    <ManagePanel
                      row={row}
                      config={config}
                      onRenew={onRenew}
                      onRelease={onRelease}
                      onSetPrimary={onSetPrimary}
                      onUpdateDestination={onUpdateDestination}
                      busy={busy}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          )
        })}
      </tbody>
    </table>
  )
}

function ListButton({
  row, onList, busy,
}: { row: Row; onList: (row: Row, priceOu: bigint) => void; busy: string | null }) {
  const [price, setPrice] = useState('')
  const [open, setOpen]   = useState(false)
  const pending = busy === row.label + ':list_name'

  if (!open) {
    return (
      <ActionButton
        variant="primary"
        icon={<TagIcon size={11} />}
        onClick={() => setOpen(true)}
      >
        list
      </ActionButton>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      <input
        className="input mono"
        style={{ width: 100 }}
        placeholder="OCT"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        autoFocus
      />
      <ActionButton
        variant="primary"
        pending={pending}
        pendingLabel="listing…"
        onClick={() => {
          const p = Number(price)
          if (!Number.isFinite(p) || p <= 0) return
          onList(row, BigInt(Math.round(p * 1_000_000)))
          setOpen(false)
          setPrice('')
        }}
      >
        list
      </ActionButton>
      <ActionButton onClick={() => { setOpen(false); setPrice('') }}>
        <XIcon size={11} />
      </ActionButton>
    </div>
  )
}

function ManagePanel({
  row, config, onRenew, onRelease, onSetPrimary, onUpdateDestination, busy,
}: {
  row: Row
  config: OnsConfig | null
  busy: string | null
  onRenew:              (row: Row, years: number) => void
  onRelease:            (row: Row) => void
  onSetPrimary:         (row: Row) => void
  onUpdateDestination:  (row: Row, destination: string) => void
}) {
  const [dest, setDest]   = useState(row.record.destination)
  const [years, setYears] = useState(1)

  const renewCost = (config?.pricePerYear ?? 0n) * BigInt(years)

  return (
    <div style={{ padding: 'var(--oct-space-06)', display: 'grid', gap: 'var(--oct-space-06)', gridTemplateColumns: '1fr 1fr' }}>
      <div>
        <div className="form-label" style={{ marginBottom: 'var(--oct-space-02)' }}>destination address</div>
        <div className="input-group">
          <input
            className="input mono"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="oct..."
            autoComplete="off"
            spellCheck={false}
          />
          <ActionButton
            icon={<ArrowUpRight size={11} />}
            pending={busy === row.label + ':update_destination'}
            pendingLabel="updating…"
            disabled={!dest || dest === row.record.destination}
            onClick={() => onUpdateDestination(row, dest)}
          >
            update
          </ActionButton>
        </div>

        <div style={{ marginTop: 'var(--oct-space-05)' }}>
          <ActionButton
            pending={busy === row.label + ':set_primary'}
            pendingLabel="setting…"
            onClick={() => onSetPrimary(row)}
          >
            set as primary
          </ActionButton>
          <span className="muted" style={{ marginLeft: 8 }}>
            reverse lookup for {truncateMiddle(row.record.owner, 6, 4)}
          </span>
        </div>
      </div>

      <div>
        <div className="form-label" style={{ marginBottom: 'var(--oct-space-02)' }}>renew</div>
        <div className="input-group">
          <select
            className="input"
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
          >
            {[1, 2, 3, 5, 10].map((y) => (
              <option key={y} value={y}>{y} year{y > 1 ? 's' : ''}</option>
            ))}
          </select>
          <ActionButton
            variant="primary"
            pending={busy === row.label + ':renew_name'}
            pendingLabel="renewing…"
            onClick={() => onRenew(row, years)}
          >
            renew · {formatOct(renewCost)} OCT
          </ActionButton>
        </div>

        <div style={{ marginTop: 'var(--oct-space-05)' }}>
          <ActionButton
            variant="danger"
            pending={busy === row.label + ':release_name'}
            pendingLabel="releasing…"
            onClick={() => onRelease(row)}
          >
            release name
          </ActionButton>
        </div>
      </div>
    </div>
  )
}
