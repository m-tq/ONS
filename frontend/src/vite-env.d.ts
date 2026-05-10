/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ONS_NETWORK?:  string
  readonly VITE_ONS_CONTRACT?: string
  readonly VITE_ONS_RPC?:      string
  readonly VITE_ONS_EXPLORER?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
