// Minimal JSON-RPC 2.0 client for the Octra node.
// dApp-side reads go through this helper; write txs go through the OctWa SDK
// so the wallet can prompt the user.

import { ONS_RPC } from './constants'

type JsonRpcResponse<T> =
  | { jsonrpc: '2.0'; id: number; result: T }
  | { jsonrpc: '2.0'; id: number; error: { code: number; message: string; reason?: string } }

let rpcUrl = ONS_RPC

export function setRpcUrl(url: string): void {
  rpcUrl = url.replace(/\/+$/, '')
}

export function getRpcUrl(): string {
  return rpcUrl
}

let nextId = 1

export async function rpc<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(`${rpcUrl}/rpc`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
  })
  if (!res.ok) throw new Error(`rpc http ${res.status}`)
  const json = (await res.json()) as JsonRpcResponse<T>
  if ('error' in json) {
    throw new Error(json.error.message || json.error.reason || 'rpc error')
  }
  return json.result
}

// ─── Contract view helper ────────────────────────────────────────────────
// The node returns `{ result: <value>, storage: {...} }` for contract_call.
// We unwrap to the value directly.

export async function contractView<T = unknown>(
  contract: string,
  method:   string,
  params:   unknown[] = [],
): Promise<T> {
  const res = await rpc<{ result: T; storage?: Record<string, unknown> } | T>('contract_call', [
    contract,
    method,
    params,
  ])
  if (res && typeof res === 'object' && 'result' in (res as Record<string, unknown>)) {
    return (res as { result: T }).result
  }
  return res as T
}

// Typed view helpers — the node returns primitives as strings ("1", "true",
// "0" for unset addresses). Normalize here so component code stays clean.

export async function viewString(contract: string, method: string, params: unknown[] = []): Promise<string> {
  const v = await contractView<string>(contract, method, params)
  return typeof v === 'string' ? v : String(v ?? '')
}

export async function viewInt(contract: string, method: string, params: unknown[] = []): Promise<bigint> {
  const v = await contractView<string | number | bigint>(contract, method, params)
  if (typeof v === 'bigint') return v
  if (typeof v === 'number') return BigInt(Math.trunc(v))
  if (typeof v === 'string' && v.length > 0) {
    try { return BigInt(v) } catch { /* fall through */ }
  }
  return 0n
}

export async function viewBool(contract: string, method: string, params: unknown[] = []): Promise<boolean> {
  const v = await contractView<boolean | string | number>(contract, method, params)
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v === 'true' || v === '1'
  return false
}

export async function viewAddress(contract: string, method: string, params: unknown[] = []): Promise<string> {
  const v = await viewString(contract, method, params)
  return v === '0' ? '' : v
}

// ─── Transaction read helpers ────────────────────────────────────────────

export interface TxInfo {
  status: 'pending' | 'confirmed' | 'rejected' | 'dropped' | string
  tx_hash?: string
  epoch?: number
  epoch_id?: number
  error?: { type?: string; reason?: string } | string | null
  from?: string
  to?: string
}

export async function getTransaction(hash: string): Promise<TxInfo> {
  return rpc<TxInfo>('octra_transaction', [hash])
}

export interface ContractReceipt {
  contract: string
  method:   string
  success:  boolean
  effort:   number
  events:   Array<{ contract: string; depth: number; event: string; values: string[] }>
  error:    string | null
  epoch:    number
  ts:       number
}

export async function getContractReceipt(hash: string): Promise<ContractReceipt | null> {
  try {
    return await rpc<ContractReceipt>('contract_receipt', [hash])
  } catch (err) {
    if (/not found/i.test((err as Error).message)) return null
    throw err
  }
}

export async function getNodeStatus(): Promise<{ epoch: number; network_version: string }> {
  return rpc('node_status', [])
}

export async function getBalance(addr: string): Promise<{ balance: string; balance_raw: string; nonce: number; pending_nonce: number }> {
  return rpc('octra_balance', [addr])
}
