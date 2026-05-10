import { useCallback, useEffect, useRef, useState } from 'react'

import { OctraSDK, UserRejectedError } from '@octwa/sdk'
import type { Capability, CapabilityTemplate, Connection, CryptoIdentity } from '@octwa/sdk'

import { APP_CIRCLE, APP_NAME } from '../lib/constants'

export interface WalletState {
  sdk:        OctraSDK | null
  installed:  boolean
  ready:      boolean
  connection: Connection | null
  /** Read-scope capability: auto-execute calls (get_balance, get_crypto_identity, …). */
  readCap:    Capability | null
  /** Write-scope capability: always-popup calls (send_transaction). */
  writeCap:   Capability | null
  /**
   * Back-compat alias pointing at the write-scope capability so existing
   * components (e.g. `wallet.capability.id` in send flows) keep working.
   */
  capability: Capability | null
  identity:   CryptoIdentity | null
  connecting: boolean
  error:      string | null
  /**
   * Lazily acquire a capability for the requested scope. Call this from a
   * user-gesture handler (onClick, onSubmit) — the wallet needs the active
   * user-activation window to open its approval popup inline instead of
   * falling back to a standalone extension window.
   */
  ensureCapability: (scope: 'read' | 'write') => Promise<Capability | null>
}

// ─── Capability templates ────────────────────────────────────────────────

const READ_METHODS: readonly string[] = [
  'get_balance',
  'get_encrypted_balance',
  'get_crypto_identity',
  'decrypt_cipher',
]

const WRITE_METHODS: readonly string[] = [
  'send_transaction',
]

const REQUESTED_CAPABILITIES: CapabilityTemplate[] = [
  { methods: [...READ_METHODS],  scope: 'read',  encrypted: false },
  { methods: [...WRITE_METHODS], scope: 'write', encrypted: false },
]

export function useWallet(): WalletState & {
  connect:    () => Promise<void>
  disconnect: () => Promise<void>
  renewCapability: () => Promise<void>
} {
  const [state, setState] = useState<Omit<WalletState, 'capability' | 'ensureCapability'>>({
    sdk:        null,
    installed:  false,
    ready:      false,
    connection: null,
    readCap:    null,
    writeCap:   null,
    identity:   null,
    connecting: false,
    error:      null,
  })

  // Deduplicate concurrent requests for the same scope so a double-click on
  // a button doesn't spawn two popups for the same capability.
  const inFlightRef = useRef<{ read: Promise<Capability | null> | null; write: Promise<Capability | null> | null }>({
    read:  null,
    write: null,
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

      // Just the connect handshake. Capabilities are requested lazily on the
      // next user gesture so `chrome.action.openPopup()` still has a valid
      // user-activation window. Chaining `requestCapability` inline here
      // would fire after the gesture expired and Chrome would fall back to
      // a standalone extension window instead of the inline approval popup.
      const connection = await sdk.connect({
        circle:    APP_CIRCLE,
        appOrigin: window.location.origin,
        appName:   APP_NAME,
        // Advertise the caps we'll ask for — wallets that support preview
        // render them inside the connect approval UI.
        requestedCapabilities: REQUESTED_CAPABILITIES,
      })

      setState((s) => ({ ...s, connection, connecting: false }))
    } catch (err) {
      if (err instanceof UserRejectedError) {
        setState((s) => ({ ...s, connecting: false, error: null }))
        return
      }
      setState((s) => ({ ...s, connecting: false, error: (err as Error).message }))
    }
  }, [state.sdk])

  const ensureCapability = useCallback(async (scope: 'read' | 'write'): Promise<Capability | null> => {
    const sdk = state.sdk
    if (!sdk || !state.connection) return null

    const existing = scope === 'read' ? state.readCap : state.writeCap
    if (existing) return existing

    const slot = inFlightRef.current
    if (slot[scope]) return slot[scope]

    const task = (async (): Promise<Capability | null> => {
      try {
        const methods = scope === 'read' ? [...READ_METHODS] : [...WRITE_METHODS]
        const cap = await sdk.requestCapability({
          circle:     APP_CIRCLE,
          methods,
          scope,
          encrypted:  false,
          ttlSeconds: 60 * 60,
        })
        setState((s) => (scope === 'read' ? { ...s, readCap: cap } : { ...s, writeCap: cap }))

        // Best-effort: once the read cap lands, pull the crypto identity
        // silently via offscreen so the view pubkey is pre-populated.
        if (scope === 'read') {
          try {
            const identity = await sdk.getCryptoIdentity(cap.id)
            setState((s) => ({ ...s, identity }))
          } catch {
            /* view pubkey stays optional */
          }
        }

        return cap
      } catch (err) {
        if (!(err instanceof UserRejectedError)) {
          setState((s) => ({ ...s, error: (err as Error).message }))
        }
        return null
      } finally {
        slot[scope] = null
      }
    })()

    slot[scope] = task
    return task
  }, [state.sdk, state.connection, state.readCap, state.writeCap])

  const disconnect = useCallback(async () => {
    const sdk = state.sdk
    if (sdk) {
      try { await sdk.disconnect() } catch { /* ignore */ }
    }
    inFlightRef.current.read  = null
    inFlightRef.current.write = null
    setState((s) => ({
      ...s,
      connection: null,
      readCap:    null,
      writeCap:   null,
      identity:   null,
    }))
  }, [state.sdk])

  const renewCapability = useCallback(async () => {
    const sdk = state.sdk
    if (!sdk) return
    try {
      const patch: Partial<Omit<WalletState, 'capability' | 'ensureCapability'>> = {}
      if (state.readCap)  patch.readCap  = await sdk.renewCapability(state.readCap.id)
      if (state.writeCap) patch.writeCap = await sdk.renewCapability(state.writeCap.id)
      setState((s) => ({ ...s, ...patch }))
    } catch (err) {
      setState((s) => ({ ...s, error: (err as Error).message }))
    }
  }, [state.sdk, state.readCap, state.writeCap])

  return {
    ...state,
    capability: state.writeCap,
    ensureCapability,
    connect,
    disconnect,
    renewCapability,
  }
}
