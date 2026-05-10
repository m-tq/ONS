import { formatOct } from '../lib/format'
import type { OnsConfig } from '../lib/ons'

interface Props { config: OnsConfig | null }

export function MetricsRow({ config }: Props) {
  if (!config) {
    return (
      <div className="metrics-row">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="metric" key={i}>
            <span>&nbsp;</span>
            <strong className="muted">—</strong>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="metrics-row">
      <Metric label="epoch"          value={config.currentEpoch.toLocaleString()} />
      <Metric label="names"          value={config.totalNames.toLocaleString()} />
      <Metric label="price/year"     value={`${formatOct(config.pricePerYear)} OCT`} />
      <Metric label="market fee"     value={`${(config.feeBps / 100).toFixed(2)}%`} />
      <Metric label="fees collected" value={`${formatOct(config.feesCollected)} OCT`} />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong title={value}>{value}</strong>
    </div>
  )
}
