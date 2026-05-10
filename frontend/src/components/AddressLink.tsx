import { ExternalLink } from 'lucide-react'

import { EXPLORER_HOST } from '../lib/constants'
import { truncateMiddle } from '../lib/format'

interface Props {
  address: string
  label?: string
  truncate?: boolean
  small?: boolean
}

export function AddressLink({ address, label, truncate = true, small = false }: Props) {
  if (!address) return <span className="muted">—</span>

  return (
    <a
      className="addr"
      href={`${EXPLORER_HOST}/address.html?addr=${address}`}
      target="_blank"
      rel="noreferrer noopener"
      title={address}
      style={small ? { fontSize: 'var(--oct-type-size-01)' } : undefined}
    >
      {label ?? (truncate ? truncateMiddle(address, 8, 6) : address)}
      <ExternalLink size={10} style={{ marginLeft: 2, opacity: 0.6 }} />
    </a>
  )
}

interface TxLinkProps {
  hash: string
  truncate?: boolean
}

export function TxLink({ hash, truncate = true }: TxLinkProps) {
  if (!hash) return <span className="muted">—</span>
  return (
    <a
      className="hash"
      href={`${EXPLORER_HOST}/tx.html?hash=${hash}`}
      target="_blank"
      rel="noreferrer noopener"
      title={hash}
    >
      {truncate ? truncateMiddle(hash, 8, 6) : hash}
      <ExternalLink size={10} style={{ marginLeft: 2, opacity: 0.6 }} />
    </a>
  )
}
