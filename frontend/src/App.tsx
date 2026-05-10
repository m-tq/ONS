import { useCallback, useEffect, useState } from 'react'

import { ONS_RPC, NETWORK } from './lib/constants'
import { Header } from './components/Header'
import { NavTabs, type NavTab } from './components/NavTabs'
import { MetricsRow } from './components/MetricsRow'
import { SearchPanel } from './components/SearchPanel'
import { RegisterPanel } from './components/RegisterPanel'
import { MarketplacePanel } from './components/MarketplacePanel'
import { DashboardPanel } from './components/DashboardPanel'
import { AboutPanel } from './components/AboutPanel'
import { Footer } from './components/Footer'
import { useWallet } from './hooks/useWallet'
import { useOnsConfig } from './hooks/useOnsConfig'

export default function App() {
  const [tab, setTab]                   = useState<NavTab>('search')
  const [prefillLabel, setPrefillLabel] = useState<string>('')

  const wallet                  = useWallet()
  const { config, error: cfgError } = useOnsConfig()
  const [online, setOnline]     = useState(true)

  useEffect(() => { setOnline(cfgError == null) }, [cfgError])

  const goRegister = useCallback((label: string) => {
    setPrefillLabel(label)
    setTab('register')
  }, [])

  const goMarketplace = useCallback((_label: string) => { setTab('marketplace') }, [])

  const tabContent = (() => {
    switch (tab) {
      case 'search':
        return (
          <SearchPanel
            currentEpoch={config?.currentEpoch ?? 0}
            onRegister={goRegister}
            onBuy={goMarketplace}
          />
        )
      case 'register':
        return (
          <RegisterPanel
            config={config}
            wallet={wallet}
            initialLabel={prefillLabel}
            onDone={() => setTab('dashboard')}
          />
        )
      case 'marketplace':
        return <MarketplacePanel wallet={wallet} config={config} />
      case 'dashboard':
        return <DashboardPanel wallet={wallet} config={config} />
      case 'about':
      default:
        return <AboutPanel config={config} />
    }
  })()

  return (
    <div className="app-shell">
      <Header
        config={config}
        wallet={wallet}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
        network={NETWORK}
      />
      <MetricsRow config={config} />
      <NavTabs current={tab} onChange={setTab} />

      <main className="app-main">
        {wallet.error && (
          <div className="alert alert--error" style={{ marginTop: 'var(--oct-space-06)' }}>
            {wallet.error}
          </div>
        )}
        {cfgError && !config && (
          <div className="alert alert--error" style={{ marginTop: 'var(--oct-space-06)' }}>
            rpc offline — {cfgError}
          </div>
        )}
        {tabContent}
      </main>

      <Footer network={NETWORK} rpc={ONS_RPC} online={online} />
    </div>
  )
}
