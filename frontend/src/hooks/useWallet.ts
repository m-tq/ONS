import { useCallback, useEffect, useState } from 'react'

import { OctraSDK, UserRejectedError } from '@octwa/sdk'
import type { Capability, Connection, CryptoIdentity } from '@octwa/sdk'

import { APP_CIRCLE, APP_NAME } from '../lib/constants'

export interface WalletState {
  sdk:         OctraSDK | null
  installed:   boolean
  ready:       boolean
  connection:  Connection | null
  capability:  Capability | null
  identity:    CryptoIdentity | null
  connecting:  boolean
  error:       string | null
}

/** Methods we need a single write-scope capability for. */
const ONS_METHODS = [
  'send_transaction',      // contract calls (write)
  'get_balance',           // read balance for dashboard
  'get_encrypted_balance',
  'get_crypto_identity',   // derive view pubkey for own names
] as const

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    sdk:        null,
    installed:  false,
    ready:      false,
    connection: null,
    capability: null,
    identity:   null,
    connecting: false,
    error:      null,
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const sdk = await OctraSDK.init({ timeout: 3000 })
        if (cancelled) return
        setState((s) => ({ ...s, sdk, installed: sdk.isInstalled(), ready: true }))
      } catch (err) {
        if (cancelled) return
        setState((s) => ({ ...s, ready: true, error: (err as Error).message }))
      }
    })()
    return () => { cancelled = true }
  }, [])

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, connecting: true, error: null }))
    try {
      const sdk = state.sdk
      if (!sdk) throw new Error('wallet not ready')
      if (!sdk.isInstalled()) throw new Error('octwa wallet not installed')

      const connection = await sdk.connect({
        circle:    APP_CIRCLE,
        appOrigin: window.location.origin,
        appName:   APP_NAME,
      })

      const capability = await sdk.requestCapability({
        circle:     APP_CIRCLE,
        methods:    [...ONS_METHODS],
        scope:      'write',
        encrypted:  false,
        ttlSeconds: 60 * 60,
      })

      // Best-effort: pull the wallet's crypto identity so we can auto-fill
      // the view pubkey in the register panel without re-opening a popup.
      // This is a read-scope auto-execute call via the write capability.
      let identity: CryptoIdentity | null = null
      try {
        identity = await sdk.getCryptoIdentity(capability.id)
      } catch {
        /* ignore — view pubkey will remain optional */
      }

      setState((s) => ({ ...s, connection, capability, identity, connecting: false }))
    } catch (err) {
      if (err instanceof UserRejectedError) {
        setState((s) => ({ ...s, connecting: false, error: null }))
        return
      }
      setState((s) => ({ ...s, connecting: false, error: (err as Error).message }))
    }
  }, [state.sdk])

  const disconnect = useCallback(async () => {
    const sdk = state.sdk
    if (sdk) {
      try { await sdk.disconnect() } catch { /* ignore */ }
    }
    setState((s) => ({ ...s, connection: null, capability: null, identity: null }))
  }, [state.sdk])

  const renewCapability = useCallback(async () => {
    const sdk = state.sdk
    const cap = state.capability
    if (!sdk || !cap) return
    try {
      const renewed = await sdk.renewCapability(cap.id)
      setState((s) => ({ ...s, capability: renewed }))
    } catch (err) {
      setState((s) => ({ ...s, error: (err as Error).message }))
    }
  }, [state.sdk, state.capability])

  return {
    ...state,
    connect,
    disconnect,
    renewCapability,
  }
}
