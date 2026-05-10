// Small formatters for OU, OCT, epochs, and mono-friendly truncation.

import { EPOCHS_PER_DAY, EPOCHS_PER_HOUR, EPOCHS_PER_YEAR, OU_PER_OCT } from './constants'

export function truncateMiddle(str: string, left = 8, right = 6): string {
  if (!str) return ''
  if (str.length <= left + right + 3) return str
  return `${str.slice(0, left)}...${str.slice(-right)}`
}

export function ouToOct(rawOu: bigint | string | number): string {
  const raw = typeof rawOu === 'bigint' ? rawOu : BigInt(rawOu || 0)
  if (raw === 0n) return '0'
  const neg = raw < 0n
  const abs = neg ? -raw : raw
  const whole = abs / OU_PER_OCT
  const frac  = abs % OU_PER_OCT
  const fracStr = frac.toString().padStart(6, '0').replace(/0+$/, '')
  const body = fracStr.length > 0 ? `${whole}.${fracStr}` : whole.toString()
  return neg ? `-${body}` : body
}

export function octToOu(oct: string | number): bigint {
  const s = String(oct).trim()
  if (!s) return 0n
  const neg = s.startsWith('-')
  const body = neg ? s.slice(1) : s
  const [whole, fracRaw = ''] = body.split('.')
  const frac = (fracRaw + '000000').slice(0, 6)
  const total = BigInt(whole || '0') * OU_PER_OCT + BigInt(frac || '0')
  return neg ? -total : total
}

export function formatOct(rawOu: bigint | string | number, decimals = 6): string {
  const s = ouToOct(rawOu)
  if (decimals === 6) return s
  const [whole, frac = ''] = s.split('.')
  if (!frac) return whole
  return `${whole}.${frac.slice(0, decimals)}`
}

// ─── epoch helpers ───────────────────────────────────────────────────────

export function epochsToDuration(epochs: bigint | number): string {
  const e = typeof epochs === 'bigint' ? Number(epochs) : epochs
  if (!Number.isFinite(e) || e <= 0) return '0'
  if (e >= EPOCHS_PER_YEAR) {
    const years = e / EPOCHS_PER_YEAR
    return `${years.toFixed(years >= 10 ? 0 : 2)}y`
  }
  if (e >= EPOCHS_PER_DAY) {
    const days = e / EPOCHS_PER_DAY
    return `${days.toFixed(days >= 10 ? 0 : 1)}d`
  }
  if (e >= EPOCHS_PER_HOUR) {
    const hours = e / EPOCHS_PER_HOUR
    return `${hours.toFixed(hours >= 10 ? 0 : 1)}h`
  }
  return `${e}ep`
}

export function epochDeltaHuman(fromEpoch: number, untilEpoch: number): string {
  if (!Number.isFinite(fromEpoch) || !Number.isFinite(untilEpoch)) return '—'
  const delta = untilEpoch - fromEpoch
  if (delta <= 0) return 'expired'
  return epochsToDuration(delta)
}

// ─── dates (approximate — epoch ~10s) ────────────────────────────────────

export function epochToApproxDate(targetEpoch: number, currentEpoch: number, nowMs: number = Date.now()): Date {
  const deltaEpochs = targetEpoch - currentEpoch
  const ms = nowMs + deltaEpochs * 10_000
  return new Date(ms)
}

export function formatDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// ─── label + commitment helpers ──────────────────────────────────────────

const LABEL_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

export function normalizeLabel(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.oct$/i, '')
}

export function isValidLabel(label: string): boolean {
  const n = normalizeLabel(label)
  if (n.length < 3 || n.length > 63) return false
  return LABEL_RE.test(n)
}

export async function deriveCommitment(label: string, saltHex: string): Promise<string> {
  const payload = `ons.private.v1|${normalizeLabel(label)}|${saltHex}`
  const enc = new TextEncoder().encode(payload)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function randomSaltHex(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ─── small utilities ─────────────────────────────────────────────────────

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
