// Contract config polling — split by volatility:
//
//   epoch      (volatile, ~10s)   → polled every 15 s
//   everything else (slow-changing) → polled every 2 min
//
// Both pollers pause while the tab is hidden to avoid hammering the RPC when
// the user has tabbed away. On visibility regain we refresh immediately.

import { useCallback, useEffect, useRef, useState } from 'react'

import { viewAddress, viewBool, viewInt } from '../lib/rpc'
import { ONS_CONTRACT } from '../lib/constants'
import type { OnsConfig } from '../lib/ons'

const EPOCH_POLL_MS   = 15_000
const STATIC_POLL_MS  = 120_000

export interface UseOnsConfig {
  config:  OnsConfig | null
  loading: boolean
  error:   string | null
  refresh: () => Promise<void>
}

export function useOnsConfig(): UseOnsConfig {
  const [config,  setConfig]  = useState<OnsConfig | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error,   setError]   = useState<string | null>(null)
  const mountedRef = useRef(true)

  // Slow-moving fields (admin, price, fee, totals, fees collected).
  const loadStatic = useCallback(async () => {
    const [
      admin, pendingOwner, paused,
      pricePerYear, feeBps, graceEpochs,
      feesCollected, totalNames,
      currentEpoch,
    ] = await Promise.all([
      viewAddress(ONS_CONTRACT, 'get_owner'),
      viewAddress(ONS_CONTRACT, 'get_pending_owner'),
      viewBool(ONS_CONTRACT, 'is_paused'),
      viewInt(ONS_CONTRACT, 'get_price_per_year'),
      viewInt(ONS_CONTRACT, 'get_fee_bps'),
      viewInt(ONS_CONTRACT, 'get_grace_epochs'),
      viewInt(ONS_CONTRACT, 'get_fees_collected'),
      viewInt(ONS_CONTRACT, 'get_total_names'),
      viewInt(ONS_CONTRACT, 'get_epoch'),
    ])
    if (!mountedRef.current) return
    setConfig({
      admin,
      pendingOwner,
      paused,
      pricePerYear,
      feeBps:       Number(feeBps),
      graceEpochs:  Number(graceEpochs),
      feesCollected,
      totalNames:   Number(totalNames),
      currentEpoch: Number(currentEpoch),
    })
    setError(null)
  }, [])

  // Epoch-only refresh — cheap single read.
  const loadEpoch = useCallback(async () => {
    const currentEpoch = await viewInt(ONS_CONTRACT, 'get_epoch')
    if (!mountedRef.current) return
    setConfig((prev) => prev ? { ...prev, currentEpoch: Number(currentEpoch) } : prev)
  }, [])

  const refresh = useCallback(async () => {
    try {
      await loadStatic()
    } catch (err) {
      if (!mountedRef.current) return
      setError((err as Error).message)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [loadStatic])

  useEffect(() => {
    mountedRef.current = true

    let staticId:  number | null = null
    let epochId:   number | null = null

    const tickStatic = () => { loadStatic().catch((err) => setError((err as Error).message)) }
    const tickEpoch  = () => { loadEpoch().catch(() => { /* ignore transient failures */ }) }

    const startTimers = () => {
      stopTimers()
      staticId = window.setInterval(tickStatic, STATIC_POLL_MS)
      epochId  = window.setInterval(tickEpoch,  EPOCH_POLL_MS)
    }

    const stopTimers = () => {
      if (staticId != null) window.clearInterval(staticId)
      if (epochId  != null) window.clearInterval(epochId)
      staticId = null
      epochId  = null
    }

    // Initial load
    loadStatic()
      .catch((err) => setError((err as Error).message))
      .finally(() => mountedRef.current && setLoading(false))

    if (!document.hidden) startTimers()

    const onVisibility = () => {
      if (document.hidden) {
        stopTimers()
      } else {
        // Catch up immediately after coming back from hidden.
        tickEpoch()
        startTimers()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mountedRef.current = false
      stopTimers()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [loadStatic, loadEpoch])

  return { config, loading, error, refresh }
}
