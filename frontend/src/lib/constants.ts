// Deployment + network constants for the ONS frontend.
// Everything network-specific is overridable via Vite env variables so the
// same bundle can ship against devnet or mainnet with a single rebuild.

export type OctraNetwork = 'devnet' | 'mainnet'

const NETWORK_ENV = (import.meta.env.VITE_ONS_NETWORK ?? 'devnet').toLowerCase()
export const NETWORK: OctraNetwork = NETWORK_ENV === 'mainnet' ? 'mainnet' : 'devnet'

const DEFAULT_RPC: Record<OctraNetwork, string> = {
  devnet:  'http://165.227.225.79:8080',
  mainnet: 'https://rpc.octra.network',
}

const DEFAULT_EXPLORER: Record<OctraNetwork, string> = {
  devnet:  'https://devnet.octrascan.io',
  mainnet: 'https://octrascan.io',
}

export const ONS_RPC =
  import.meta.env.VITE_ONS_RPC ?? DEFAULT_RPC[NETWORK]

export const EXPLORER_HOST =
  import.meta.env.VITE_ONS_EXPLORER ?? DEFAULT_EXPLORER[NETWORK]

export const ONS_CONTRACT = import.meta.env.VITE_ONS_CONTRACT ?? ''

export const EPOCHS_PER_HOUR = 360
export const EPOCHS_PER_DAY  = 8_640
export const EPOCHS_PER_WEEK = 60_480
export const EPOCHS_PER_YEAR = 3_153_600

export const OU_PER_OCT = 1_000_000n

// Fallback constants (overridden once we read them on chain).
export const DEFAULT_PRICE_PER_YEAR_OU = 500_000n
export const DEFAULT_FEE_BPS           = 250
export const DEFAULT_GRACE_EPOCHS      = 259_200

export const APP_CIRCLE = 'ons'
export const APP_NAME   = 'ons · octra name service'
