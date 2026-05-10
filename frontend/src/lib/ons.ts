// Typed wrapper around the ONS contract's view + write surface.
// View calls go directly to the node (read-only, no fee).
// Write calls use the OctWa SDK so the wallet can prompt.

import type { OctraSDK } from '@octwa/sdk'

import { ONS_CONTRACT } from './constants'
import {
  getContractReceipt,
  getTransaction,
  viewAddress,
  viewBool,
  viewInt,
  viewString,
} from './rpc'

// ─── View shapes ─────────────────────────────────────────────────────────

export interface OnsConfig {
  admin:          string
  pendingOwner:   string
  paused:         boolean
  pricePerYear:   bigint
  feeBps:         number
  graceEpochs:    number
  feesCollected:  bigint
  totalNames:     number
  currentEpoch:   number
}

export interface NameRecord {
  label:         string
  owner:         string
  destination:   string
  viewPk:        string
  expiry:        number
  registeredAt:  number
  listingPrice:  bigint
  listingSeller: string
  isActive:      boolean
  isGrace:       boolean
  isAvailable:   boolean
}

export async function loadConfig(): Promise<OnsConfig> {
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
  return {
    admin,
    pendingOwner,
    paused,
    pricePerYear,
    feeBps:       Number(feeBps),
    graceEpochs:  Number(graceEpochs),
    feesCollected,
    totalNames:   Number(totalNames),
    currentEpoch: Number(currentEpoch),
  }
}

export async function loadName(label: string): Promise<NameRecord> {
  const [
    owner, destination, viewPk, expiry, registeredAt,
    listingPrice, listingSeller, isActive, isGrace, isAvailable,
  ] = await Promise.all([
    viewAddress(ONS_CONTRACT, 'owner_of', [label]),
    viewString(ONS_CONTRACT, 'destination_of', [label]),
    viewString(ONS_CONTRACT, 'view_pk_of', [label]),
    viewInt(ONS_CONTRACT, 'expiry_of', [label]),
    viewInt(ONS_CONTRACT, 'registered_at', [label]),
    viewInt(ONS_CONTRACT, 'listing_price_of', [label]),
    viewAddress(ONS_CONTRACT, 'listing_seller_of', [label]),
    viewBool(ONS_CONTRACT, 'is_active', [label]),
    viewBool(ONS_CONTRACT, 'is_grace', [label]),
    viewBool(ONS_CONTRACT, 'is_available', [label]),
  ])
  return {
    label,
    owner,
    destination,
    viewPk,
    expiry:       Number(expiry),
    registeredAt: Number(registeredAt),
    listingPrice,
    listingSeller,
    isActive,
    isGrace,
    isAvailable,
  }
}

export async function resolveName(label: string): Promise<string> {
  return viewAddress(ONS_CONTRACT, 'resolve', [label])
}

export async function primaryOf(addr: string): Promise<string> {
  return viewString(ONS_CONTRACT, 'primary_of', [addr])
}

// ─── Enumeration ─────────────────────────────────────────────────────────

export interface OwnerEntry {
  label:  string
  record: NameRecord
}

export async function loadOwnerNames(addr: string): Promise<OwnerEntry[]> {
  if (!addr) return []

  const total = await viewInt(ONS_CONTRACT, 'owner_total', [addr])
  const slots = Number(total)
  if (slots <= 0) return []

  const labels = await fetchSlots('owner_key_at', addr, slots)

  return Promise.all(labels
    .filter((label): label is string => !!label)
    .map(async (label): Promise<OwnerEntry> => ({
      label,
      record: await loadName(label),
    }))
  )
}

export interface ListingEntry {
  label:  string
  record: NameRecord
}

export async function loadActiveListings(): Promise<ListingEntry[]> {
  const total = await viewInt(ONS_CONTRACT, 'listing_total', [])
  const slots = Number(total)
  if (slots <= 0) return []

  const labels = await fetchSlots('listing_key_at', null, slots)

  const rows = await Promise.all(labels
    .filter((label): label is string => !!label)
    .map(async (label): Promise<ListingEntry> => ({
      label,
      record: await loadName(label),
    }))
  )

  return rows.filter((row) => row.record.listingPrice > 0n)
}

async function fetchSlots(viewFn: string, holder: string | null, slots: number): Promise<string[]> {
  if (slots <= 0) return []
  const indices = Array.from({ length: slots }, (_, i) => i)
  const out: string[] = []
  const chunk = 16
  for (let i = 0; i < indices.length; i += chunk) {
    const slice = indices.slice(i, i + chunk)
    const keys = await Promise.all(slice.map((slot) => {
      const params = holder ? [holder, slot] : [slot]
      return viewString(ONS_CONTRACT, viewFn, params).catch(() => '')
    }))
    out.push(...keys)
  }
  return out
}

// ─── Write helpers (through the SDK) ─────────────────────────────────────

export interface SendOptions {
  amountOu?: bigint
  ou?:       number
}

export interface SendResult {
  txHash:       string
  success:      boolean
  revertReason?: string
  epoch?:       number
  receipt?:     Awaited<ReturnType<typeof getContractReceipt>>
}

export async function sendWrite(
  sdk: OctraSDK,
  capId: string,
  method: string,
  params: unknown[],
  { amountOu = 0n, ou = 1_000 }: SendOptions = {},
): Promise<SendResult> {
  const amountOct = Number(amountOu) / 1_000_000
  const result = await sdk.sendContractCall(capId, {
    contract: ONS_CONTRACT,
    method,
    params,
    amount:   amountOct,
    ou,
  })
  const txHash = (result as { txHash: string }).txHash
  return waitForReceipt(txHash)
}

export async function waitForReceipt(
  txHash: string,
  { timeoutMs = 180_000, intervalMs = 2_000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<SendResult> {
  const start = Date.now()
  let lastTx: Awaited<ReturnType<typeof getTransaction>> | null = null

  while (Date.now() - start < timeoutMs) {
    try {
      lastTx = await getTransaction(txHash)
      if (lastTx.status === 'rejected') {
        const reason  = extractRejectReason(lastTx.error)
        const receipt = await getContractReceipt(txHash)
        const revertReason = extractReceiptRevert(receipt) ?? reason
        return {
          txHash,
          success: false,
          revertReason,
          epoch:   lastTx.epoch ?? lastTx.epoch_id,
          receipt,
        }
      }
      if (lastTx.status === 'confirmed' || lastTx.epoch || lastTx.epoch_id) break
    } catch (err) {
      if (!/not found/i.test((err as Error).message)) {
        if (Date.now() - start > 10_000) throw err
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  for (let i = 0; i < 6; i++) {
    const receipt = await getContractReceipt(txHash)
    if (receipt) {
      return {
        txHash,
        success:       receipt.success !== false,
        revertReason:  receipt.success === false
          ? (extractReceiptRevert(receipt) ?? 'revert')
          : undefined,
        epoch:         receipt.epoch ?? lastTx?.epoch ?? lastTx?.epoch_id,
        receipt,
      }
    }
    await new Promise((r) => setTimeout(r, 1_500))
  }

  return { txHash, success: true, epoch: lastTx?.epoch ?? lastTx?.epoch_id }
}

function extractRejectReason(err: TxInfo['error']): string {
  if (!err) return 'tx rejected'
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err && 'reason' in err && err.reason) return err.reason
  return 'tx rejected'
}

function extractReceiptRevert(receipt: Awaited<ReturnType<typeof getContractReceipt>>): string | undefined {
  if (!receipt) return undefined
  const requireEvent = receipt.events?.find((e) => e.event === 'Require')
  if (requireEvent && requireEvent.values?.length) return requireEvent.values[0]
  if (receipt.error) return receipt.error
  return undefined
}

import type { TxInfo } from './rpc'

export { ONS_CONTRACT }
