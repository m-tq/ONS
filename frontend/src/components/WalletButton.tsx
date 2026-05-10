import { ExternalLink, Wallet } from 'lucide-react'

import { truncateMiddle } from '../lib/format'
import type { WalletState } from '../hooks/useWallet'
import { EXPLORER_HOST } from '../lib/constants'

interface Props {
  wallet:       WalletState
  onConnect:    () => void
  onDisconnect: () => void
}

export function WalletButton({ wallet, onConnect, onDisconnect }: Props) {
  if (!wallet.ready) {
    return <span className="status-chip">detecting wallet…</span>
  }

  if (!wallet.installed) {
    return (
      <a
        className="button"
        href="https://chromewebstore.google.com/detail/octwa"
        target="_blank"
        rel="noreferrer noopener"
      >
        install octwa <ExternalLink size={12} />
      </a>
    )
  }

  if (!wallet.connection) {
    return (
      <button
        className="button button--primary"
        onClick={onConnect}
        disabled={wallet.connecting}
      >
        <Wallet size={13} /> {wallet.connecting ? 'connecting…' : 'connect wallet'}
      </button>
    )
  }

  const addr = wallet.connection.address
  return (
    <div className="oct-header__right" style={{ gap: 'var(--oct-space-03)' }}>
      <a
        className="status-chip mono"
        href={`${EXPLORER_HOST}/address.html?addr=${addr}`}
        target="_blank"
        rel="noreferrer noopener"
        title={addr}
      >
        {truncateMiddle(addr, 6, 4)}
      </a>
      <button className="button button--quiet" onClick={onDisconnect} title="disconnect">
        disconnect
      </button>
    </div>
  )
}
