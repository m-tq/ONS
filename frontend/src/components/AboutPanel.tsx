import { ExternalLink } from 'lucide-react'

import { EPOCHS_PER_DAY, EPOCHS_PER_HOUR, EPOCHS_PER_YEAR, EXPLORER_HOST, NETWORK, ONS_CONTRACT } from '../lib/constants'
import type { OnsConfig } from '../lib/ons'
import { formatOct, truncateMiddle } from '../lib/format'

interface Props { config: OnsConfig | null }

export function AboutPanel({ config }: Props) {
  return (
    <section className="section">
      <div className="section-title">
        <span>about ons</span>
        <span className="muted">octra name service</span>
      </div>
      <div className="section-body">
        <div className="two-col">
          <div>
            <h3 style={{ fontFamily: 'var(--oct-type-mono)', fontSize: 'var(--oct-type-size-03)', margin: 0 }}>
              what it is
            </h3>
            <p className="muted" style={{ marginTop: 8 }}>
              ons is a human-readable name system on octra. each registered name stores a plaintext
              destination address and a curve25519 view pubkey.
            </p>
            <p className="muted">
              privacy of transfers is delegated to octra's native stealth primitive — counterparties
              look up the view pubkey via <code className="mono">view_pk_of(label)</code>, generate
              a stealth output, and the recipient claims it. sender and receiver are unlinkable on chain
              while the name itself stays discoverable.
            </p>
          </div>

          <table className="detail-table">
            <tbody>
              <tr>
                <td>contract</td>
                <td>
                  <a
                    className="addr"
                    href={`${EXPLORER_HOST}/address.html?addr=${ONS_CONTRACT}`}
                    target="_blank" rel="noreferrer noopener"
                    title={ONS_CONTRACT}
                  >
                    {truncateMiddle(ONS_CONTRACT, 10, 6)} <ExternalLink size={10} />
                  </a>
                </td>
              </tr>
              <tr><td>network</td><td className="mono">{NETWORK}</td></tr>
              <tr>
                <td>price per year</td>
                <td className="mono">{config ? `${formatOct(config.pricePerYear)} OCT` : '—'}</td>
              </tr>
              <tr>
                <td>marketplace fee</td>
                <td className="mono">{config ? `${(config.feeBps / 100).toFixed(2)}%` : '—'}</td>
              </tr>
              <tr>
                <td>grace period</td>
                <td className="mono">
                  {config ? `${config.graceEpochs.toLocaleString()} epochs (≈ ${Math.round(config.graceEpochs / EPOCHS_PER_DAY)} days)` : '—'}
                </td>
              </tr>
              <tr>
                <td>admin</td>
                <td>
                  {config
                    ? <a className="addr" href={`${EXPLORER_HOST}/address.html?addr=${config.admin}`} target="_blank" rel="noreferrer noopener" title={config.admin}>
                        {truncateMiddle(config.admin, 6, 4)} <ExternalLink size={10} />
                      </a>
                    : <span className="muted">—</span>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="section" style={{ marginTop: 'var(--oct-space-06)' }}>
          <div className="section-title"><span>epoch reference</span></div>
          <div className="section-body">
            <table className="detail-table">
              <tbody>
                <tr><td>epoch duration</td><td className="mono">~10 seconds</td></tr>
                <tr><td>epochs per hour</td><td className="mono">{EPOCHS_PER_HOUR}</td></tr>
                <tr><td>epochs per day</td><td className="mono">{EPOCHS_PER_DAY.toLocaleString()}</td></tr>
                <tr><td>epochs per year</td><td className="mono">{EPOCHS_PER_YEAR.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  )
}
