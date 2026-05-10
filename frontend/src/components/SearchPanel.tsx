import { Search, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { useCallback, useState } from 'react'

import { ONS_CONTRACT } from '../lib/constants'
import { epochDeltaHuman, formatOct, isValidLabel, normalizeLabel, truncateMiddle } from '../lib/format'
import { loadName, type NameRecord } from '../lib/ons'

import { AddressLink } from './AddressLink'
import { StatusTag } from './StatusTag'
import { ActionButton } from './Button'
import { useAsyncAction } from '../hooks/useAsyncAction'

interface Props {
  currentEpoch: number
  onRegister:   (label: string) => void
  onBuy:        (label: string) => void
}

type LookupResult =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'hit';   label: string; record: NameRecord }

export function SearchPanel({ currentEpoch, onRegister, onBuy }: Props) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<LookupResult>({ kind: 'idle' })
  const lookupAction = useAsyncAction()

  const runLookup = useCallback(async () => {
    const raw = query.trim()
    if (!raw) return

    setResult({ kind: 'loading' })
    try {
      const label = normalizeLabel(raw)
      if (!isValidLabel(label)) {
        setResult({ kind: 'error', message: 'invalid label — 3-63 chars, a-z, 0-9, dash' })
        return
      }
      const record = await loadName(label)
      setResult({ kind: 'hit', label, record })
    } catch (err) {
      setResult({ kind: 'error', message: (err as Error).message })
    }
  }, [query])

  return (
    <section className="section">
      <div className="section-title">
        <span>search registry</span>
        <span className="mono" title={ONS_CONTRACT}>ons:{truncateMiddle(ONS_CONTRACT, 6, 4)}</span>
      </div>

      <div className="search-bar">
        <input
          className="input mono"
          placeholder="enter name (e.g. alice)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') lookupAction.run(runLookup) }}
          style={{ flex: 1 }}
        />
        <ActionButton
          variant="primary"
          icon={<Search size={13} />}
          pending={lookupAction.pending}
          pendingLabel="resolving…"
          disabled={!query.trim()}
          onClick={() => lookupAction.run(runLookup)}
        >
          lookup
        </ActionButton>
      </div>

      <div className="section-body">
        {result.kind === 'idle' && (
          <div className="empty-line">enter a name to resolve its destination and view pubkey</div>
        )}
        {result.kind === 'loading' && <div className="loading-line">resolving…</div>}
        {result.kind === 'error' && <div className="alert alert--error">{result.message}</div>}
        {result.kind === 'hit' && (
          <ResultView
            label={result.label}
            record={result.record}
            currentEpoch={currentEpoch}
            onRegister={() => onRegister(result.label)}
            onBuy={() => onBuy(result.label)}
          />
        )}
      </div>
    </section>
  )
}

function ResultView({
  label, record, currentEpoch, onRegister, onBuy,
}: {
  label:        string
  record:       NameRecord
  currentEpoch: number
  onRegister:   () => void
  onBuy:        () => void
}) {
  const listing = record.listingPrice > 0n
  const statusTag = record.isAvailable
    ? <StatusTag variant="confirmed"><CheckCircle2 size={10} /> available</StatusTag>
    : record.isGrace
      ? <StatusTag variant="staging"><Clock size={10} /> grace period</StatusTag>
      : record.isActive
        ? <StatusTag variant="rejected"><XCircle size={10} /> registered</StatusTag>
        : <StatusTag variant="rejected">expired</StatusTag>

  return (
    <div className="two-col">
      <table className="detail-table">
        <tbody>
          <tr>
            <td>name</td>
            <td className="mono" style={{ fontWeight: 600 }}>{label}<span className="muted">.oct</span></td>
          </tr>
          <tr>
            <td>status</td>
            <td>{statusTag}</td>
          </tr>
          {!record.isAvailable && (
            <>
              <tr>
                <td>owner</td>
                <td><AddressLink address={record.owner} /></td>
              </tr>
              <tr>
                <td>resolves to</td>
                <td>
                  {record.destination
                    ? <AddressLink address={record.destination} />
                    : <span className="muted">no destination set</span>}
                </td>
              </tr>
              <tr>
                <td>view pubkey</td>
                <td className="mono">
                  {record.viewPk
                    ? <span title={record.viewPk}>{truncateMiddle(record.viewPk, 12, 8)}</span>
                    : <span className="muted">not set</span>}
                </td>
              </tr>
              <tr>
                <td>expiry epoch</td>
                <td className="mono">
                  {record.expiry.toLocaleString()}{' '}
                  <span className="muted">({epochDeltaHuman(currentEpoch, record.expiry)})</span>
                </td>
              </tr>
            </>
          )}
          {listing && (
            <tr>
              <td>listed for</td>
              <td className="mono">{formatOct(record.listingPrice)} OCT</td>
            </tr>
          )}
        </tbody>
      </table>

      <div>
        <div className="section-title" style={{ border: 'none', padding: 'var(--oct-space-02) 0' }}>
          <span>action</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--oct-space-04)' }}>
          {record.isAvailable && (
            <button className="button button--primary" onClick={onRegister}>register this name</button>
          )}
          {!record.isAvailable && listing && (
            <button className="button button--primary" onClick={onBuy}>buy for {formatOct(record.listingPrice)} OCT</button>
          )}
          {!record.isAvailable && !listing && (
            <span className="muted">name is taken and not for sale</span>
          )}
        </div>
      </div>
    </div>
  )
}
