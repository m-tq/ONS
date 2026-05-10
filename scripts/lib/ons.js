// Transaction + signing helpers for ONS scripts.
// Mirrors webcli's canonical_json in tx_builder.hpp so the signature
// matches what the node expects.

const crypto = require('node:crypto')
const nacl   = require('tweetnacl')

const { rpc } = require('./rpc')

// ─── Utility encoding helpers ────────────────────────────────────────────

function bytesToBase64(bytes) {
  return Buffer.from(bytes).toString('base64')
}

function base64ToBytes(b64) {
  return new Uint8Array(Buffer.from(b64, 'base64'))
}

function hexToBytes(hex) {
  return new Uint8Array(Buffer.from(hex, 'hex'))
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex')
}

function sha256Hex(input) {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input)
  return crypto.createHash('sha256').update(buf).digest('hex')
}

// ─── Key material ───────────────────────────────────────────────────────

// Octra private keys are base64-encoded 32-byte seeds (Ed25519 seed).
// nacl.sign.keyPair.fromSeed expands it into (sk_64, pk_32).
function keyPairFromBase64(privB64) {
  const seed = base64ToBytes(privB64)
  if (seed.length !== 32) {
    throw new Error(`expected 32-byte seed, got ${seed.length}`)
  }
  const kp = nacl.sign.keyPair.fromSeed(seed)
  return {
    seed,
    sk:           kp.secretKey,              // 64 bytes
    pk:           kp.publicKey,              // 32 bytes
    pkBase64:     bytesToBase64(kp.publicKey),
  }
}

// ─── Canonical transaction JSON (must match webcli/lib/tx_builder.hpp) ───
//
//   {"from":"...","to_":"...","amount":"...","nonce":N,
//    "ou":"...","timestamp":T,"op_type":"...",
//    [,"encrypted_data":"..."][,"message":"..."]}
//
// Field ordering is critical. Do NOT use JSON.stringify on an object — the
// implementation preserves insertion order but others may not.

function jsonEscape(s) {
  // JSON.stringify handles all required escapes identically to the reference
  return JSON.stringify(s).slice(1, -1)
}

function formatTimestamp(ts) {
  // webcli uses nlohmann::json::dump which formats floats with minimal
  // precision. JS's Number.toString() produces the shortest round-trip
  // representation which is compatible.
  const s = String(ts)
  return s.includes('.') ? s : `${s}.0`
}

function canonicalTxJson(tx) {
  const opType = tx.op_type && tx.op_type.length > 0 ? tx.op_type : 'standard'
  let s =
    `{"from":"${jsonEscape(tx.from)}"` +
    `,"to_":"${jsonEscape(tx.to_)}"` +
    `,"amount":"${jsonEscape(tx.amount)}"` +
    `,"nonce":${tx.nonce}` +
    `,"ou":"${jsonEscape(tx.ou)}"` +
    `,"timestamp":${formatTimestamp(tx.timestamp)}` +
    `,"op_type":"${jsonEscape(opType)}"`
  if (tx.encrypted_data && tx.encrypted_data.length > 0) {
    s += `,"encrypted_data":"${jsonEscape(tx.encrypted_data)}"`
  }
  if (tx.message && tx.message.length > 0) {
    s += `,"message":"${jsonEscape(tx.message)}"`
  }
  s += '}'
  return s
}

function txHash(tx) {
  return sha256Hex(canonicalTxJson(tx))
}

// ─── Sign + build wire body ──────────────────────────────────────────────

function signTx(tx, sk) {
  const msg = Buffer.from(canonicalTxJson(tx), 'utf8')
  const sig = nacl.sign.detached(msg, sk)
  return bytesToBase64(sig)
}

function buildSignedTx(fields, keypair) {
  const tx = {
    from:      fields.from,
    to_:       fields.to_,
    amount:    String(fields.amount),
    nonce:     fields.nonce,
    ou:        String(fields.ou),
    timestamp: fields.timestamp,
    op_type:   fields.op_type || 'standard',
  }
  if (fields.encrypted_data) tx.encrypted_data = fields.encrypted_data
  if (fields.message)        tx.message        = fields.message

  tx.signature  = signTx(tx, keypair.sk)
  tx.public_key = keypair.pkBase64

  return tx
}

// ─── High-level helpers ─────────────────────────────────────────────────

async function getAccountState(address) {
  const acct = await rpc('octra_balance', [address])
  return {
    balanceRaw:   Number(acct.balance_raw ?? 0),
    nonce:        Number(acct.nonce ?? 0),
    pendingNonce: Number(acct.pending_nonce ?? acct.nonce ?? 0),
    hasPublicKey: Boolean(acct.has_public_key),
  }
}

async function getNextNonce(address) {
  const s = await getAccountState(address)
  return s.pendingNonce + 1
}

async function getRecommendedFee(opType) {
  const fee = await rpc('octra_recommendedFee', [opType])
  const r = fee.recommended ?? fee.base ?? 1000
  return typeof r === 'string' ? parseInt(r, 10) : r
}

// Build the deploy + call shapes. Both go through octra_submit.

function buildDeployTx({ deployer, computedAddress, bytecodeB64, constructorParams, nonce, ou, keypair }) {
  return buildSignedTx({
    from:           deployer,
    to_:            computedAddress,
    amount:         '0',
    nonce,
    ou,
    timestamp:      Date.now() / 1000,
    op_type:        'deploy',
    encrypted_data: bytecodeB64,
    message:        JSON.stringify(constructorParams),
  }, keypair)
}

function buildCallTx({ caller, contract, method, params, amount, nonce, ou, keypair }) {
  return buildSignedTx({
    from:           caller,
    to_:            contract,
    amount:         String(amount ?? '0'),
    nonce,
    ou,
    timestamp:      Date.now() / 1000,
    op_type:        'call',
    encrypted_data: method,
    message:        JSON.stringify(params ?? []),
  }, keypair)
}

async function submitTx(tx) {
  const result = await rpc('octra_submit', [tx])
  if (typeof result === 'string') return result
  if (result?.status === 'rejected') {
    const reason = typeof result.reason === 'string'
      ? result.reason
      : (result.reason ? JSON.stringify(result.reason) : JSON.stringify(result))
    throw new Error(`rejected: ${reason}`)
  }
  const hash = result?.tx_hash || result?.hash
  if (!hash) throw new Error(`no tx hash in submit response: ${JSON.stringify(result)}`)
  return hash
}

// Wait for tx-level commitment AND check contract receipt for reverts.
async function waitForTx(hash, { timeoutMs = 180_000, intervalMs = 2500, checkReceipt = true } = {}) {
  const start = Date.now()
  let txInfo = null

  while (Date.now() - start < timeoutMs) {
    try {
      const info = await rpc('octra_transaction', [hash])
      txInfo = info
      if (info.status === 'rejected') {
        const err = info.error
        let reason
        if (!err) {
          reason = 'rejected'
        } else if (typeof err === 'string') {
          reason = err
        } else if (err.reason) {
          reason = err.reason
        } else {
          reason = JSON.stringify(err)
        }
        throw new Error(`tx rejected: ${reason}`)
      }
      if (info.status === 'confirmed' || info.epoch_id || info.epoch) {
        break
      }
    } catch (err) {
      if (/^tx rejected/.test(String(err.message))) throw err
      if (!/not found/i.test(String(err.message))) {
        if (Date.now() - start > 10_000) throw err
      }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }

  if (!txInfo || !(txInfo.status === 'confirmed' || txInfo.epoch_id || txInfo.epoch)) {
    throw new Error(`tx ${hash} did not confirm within ${timeoutMs}ms`)
  }

  if (!checkReceipt) return { tx: txInfo, receipt: null }

  // Receipts may briefly 404 — retry a few times
  for (let i = 0; i < 6; i++) {
    try {
      const receipt = await rpc('contract_receipt', [hash])
      if (receipt.success === false) {
        // Prefer the Require event message when present
        const requireEv = (receipt.events ?? []).find((e) => e.event === 'Require')
        const detail = requireEv
          ? String(requireEv.values?.[0] ?? receipt.error ?? 'revert')
          : (typeof receipt.error === 'string' ? receipt.error : JSON.stringify(receipt.error))
        throw new Error(`contract revert: ${detail}`)
      }
      return { tx: txInfo, receipt }
    } catch (err) {
      if (/contract revert/i.test(String(err.message))) throw err
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  return { tx: txInfo, receipt: null }
}

// Commitment helper for private-mode registrations.
// H("ons.private.v1|" + label + "|" + salt) — 64-char hex string.
function deriveCommitment(label, saltHex) {
  return sha256Hex(`ons.private.v1|${label}|${saltHex}`)
}

function randomSaltHex() {
  return crypto.randomBytes(32).toString('hex')
}

module.exports = {
  // encoding
  bytesToBase64,
  base64ToBytes,
  hexToBytes,
  bytesToHex,
  sha256Hex,

  // key material
  keyPairFromBase64,

  // canonical + sign
  canonicalTxJson,
  txHash,
  signTx,
  buildSignedTx,

  // higher-level
  getAccountState,
  getNextNonce,
  getRecommendedFee,
  buildDeployTx,
  buildCallTx,
  submitTx,
  waitForTx,

  // ONS-specific
  deriveCommitment,
  randomSaltHex,
}
