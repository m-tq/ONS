import { Moon, Sun } from 'lucide-react'

import type { OnsConfig } from '../lib/ons'
import { useTheme } from '../hooks/useTheme'

import { WalletButton } from './WalletButton'
import type { WalletState } from '../hooks/useWallet'

interface Props {
  config:    OnsConfig | null
  wallet:    WalletState
  onConnect: () => void
  onDisconnect: () => void
  network:   string
}

export function Header({ config, wallet, onConnect, onDisconnect, network }: Props) {
  const { theme, toggle } = useTheme()

  const paused = config?.paused ?? false

  return (
    <header className="oct-header">
      <div className="oct-header__left">
        <span className="oct-header__title">ons | octra name service</span>
        <span className="oct-header__subtitle">
          {network}{paused ? ' · paused' : ''}
        </span>
      </div>
      <div className="oct-header__right">
        {config && (
          <span className="status-chip status-chip--static" title="current epoch">
            epoch {config.currentEpoch.toLocaleString()}
          </span>
        )}
        <WalletButton wallet={wallet} onConnect={onConnect} onDisconnect={onDisconnect} />
        <button
          className="button button--quiet"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'switch to light' : 'switch to dark'}
          title={theme === 'dark' ? 'switch to light' : 'switch to dark'}
        >
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
        </button>
      </div>
    </header>
  )
}
