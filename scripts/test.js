// Full functional test suite for the ONS contract (public-only).
//
// Every write test asserts receipt-based revert detection — tx-level
// confirmation alone is not enough because reverted contract calls still
// report status "confirmed" on chain.

const { rpc, setRpcUrl, getRpcUrl } = require('./lib/rpc')
const ons = require('./lib/ons')
const { buildConfig, readDeployment } = require('./lib/env')

// ─── Config (resolved from .env / .env.<network> / shell) ────────────────

const { config: envConfig, missing } = buildConfig()
if (missing.length) {
  console.error(`missing required env vars: ${missing.join(', ')}`)
  process.exit(1)
}

const RPC_URL  = envConfig.rpcUrl
const DEPLOYER = envConfig.deployer
const PRIV_KEY = envConfig.privKey
const PRICE_PER_YEAR = envConfig.pricePerYear
const FEE_BPS        = envConfig.feeBps
const GRACE_EPOCHS   = envConfig.graceEpochs

// Shared state
let deployment
let contract
let keypair
const results = []

// ─── Helpers ─────────────────────────────────────────────────────────────

function banner(title) {
  console.log(`\n─── ${title} ${'─'.repeat(Math.max(0, 48 - title.length))}`)
}

function ok(name, extra = '') {
  results.push({ name, status: 'pass', extra })
  console.log(`  ✔ ${name}${extra ? '  — ' + extra : ''}`)
}

function fail(name, err) {
  results.push({ name, status: 'fail', error: err.message })
  console.log(`  ✘ ${name}  — ${err.message}`)
}

async function run(name, fn) {
  try {
    const extra = await fn()
    ok(name, extra ?? '')
  } catch (err) {
    fail(name, err)
  }
}

async function send(method, params, amount = 0) {
  const account = await ons.getAccountState(DEPLOYER)
  const nonce   = account.pendingNonce + 1
  const fee     = await ons.getRecommendedFee('call')
  const ou      = Math.max(fee, 1000)

  const tx = ons.buildCallTx({
    caller:   DEPLOYER,
    contract,
    method,
    params,
    amount,
    nonce,
    ou,
    keypair,
  })

  const hash = await ons.submitTx(tx)
  return ons.waitForTx(hash, { timeoutMs: 180_000 })
}

async function expectRevert(method, params, amount = 0, matcher = null) {
  try {
    await send(method, params, amount)
    throw new Error(`expected revert, got success`)
  } catch (err) {
    const msg = String(err.message || '')
    if (!/revert|rejected/i.test(msg)) {
      throw new Error(`expected revert, got other error: ${msg}`)
    }
    if (matcher && !matcher.test(msg)) {
      throw new Error(`revert message did not match ${matcher}: ${msg}`)
    }
    return `reverted as expected`
  }
}

async function viewStr(method, params = []) {
  const r = await rpc('contract_call', [contract, method, params])
  if (typeof r === 'string') return r
  if (r && typeof r.result !== 'undefined') return r.result
  return r
}

async function viewInt(method, params = []) {
  const v = await viewStr(method, params)
  if (typeof v === 'number') return v
  return parseInt(v, 10)
}

async function viewBool(method, params = []) {
  const v = await viewStr(method, params)
  if (typeof v === 'boolean') return v
  return v === '1' || v === 'true' || v === true
}

async function viewAddr(method, params = []) {
  const v = await viewStr(method, params)
  if (typeof v !== 'string') return ''
  return v
}

// ─── Boot ────────────────────────────────────────────────────────────────

async function boot() {
  setRpcUrl(RPC_URL)
  deployment = readDeployment(envConfig.network)
  if (!deployment) {
    throw new Error(`deployment not found for network=${envConfig.network}. Run deploy.js first.`)
  }
  contract = deployment.address
  keypair  = ons.keyPairFromBase64(PRIV_KEY)

  console.log('─── ons test suite ──────────────────────────────')
  console.log(`network          ${envConfig.network}`)
  console.log(`rpc              ${getRpcUrl()}`)
  console.log(`contract         ${contract}`)
  console.log(`deployer         ${DEPLOYER}`)
  console.log(`price_per_year   ${PRICE_PER_YEAR} OU`)
  console.log(`fee_bps          ${FEE_BPS}`)
  console.log(`grace_epochs     ${GRACE_EPOCHS}`)
}

// ─── Test groups ─────────────────────────────────────────────────────────

async function testMeta() {
  banner('meta views')
  await run('get_owner == deployer', async () => {
    const v = await viewAddr('get_owner', [])
    if (v !== DEPLOYER) throw new Error(`owner mismatch: ${v}`)
  })
  await run('is_paused == false', async () => {
    const p = await viewBool('is_paused', [])
    if (p !== false) throw new Error(`expected false, got ${p}`)
  })
  await run('get_price_per_year', async () => {
    const v = await viewInt('get_price_per_year', [])
    if (v !== PRICE_PER_YEAR) throw new Error(`price ${v} != ${PRICE_PER_YEAR}`)
  })
  await run('get_fee_bps', async () => {
    const v = await viewInt('get_fee_bps', [])
    if (v !== FEE_BPS) throw new Error(`fee ${v} != ${FEE_BPS}`)
  })
  await run('get_grace_epochs', async () => {
    const v = await viewInt('get_grace_epochs', [])
    if (v !== GRACE_EPOCHS) throw new Error(`grace ${v} != ${GRACE_EPOCHS}`)
  })
  await run('get_fees_collected == 0', async () => {
    const v = await viewInt('get_fees_collected', [])
    if (v !== 0) throw new Error(`fees ${v} != 0`)
  })
  await run('get_epoch > 0', async () => {
    const v = await viewInt('get_epoch', [])
    if (!(v > 0)) throw new Error(`epoch ${v}`)
  })
}

async function testAdmin() {
  banner('admin surface (pause / prices)')

  await run('pause', async () => {
    await send('pause', [])
    const paused = await viewBool('is_paused', [])
    if (!paused) throw new Error(`still not paused`)
  })

  await run('register blocked while paused', async () => {
    const label = 'paused-' + Date.now().toString(36).slice(-6)
    return expectRevert('register_name', [label, DEPLOYER, '', 1], PRICE_PER_YEAR, /paused/i)
  })

  await run('unpause', async () => {
    await send('unpause', [])
    const paused = await viewBool('is_paused', [])
    if (paused) throw new Error(`still paused`)
  })

  await run('set_registration_price roundtrip', async () => {
    const before = await viewInt('get_price_per_year', [])
    await send('set_registration_price', [PRICE_PER_YEAR * 2])
    const mid = await viewInt('get_price_per_year', [])
    if (mid !== PRICE_PER_YEAR * 2) throw new Error(`mid ${mid}`)
    await send('set_registration_price', [before])
  })

  await run('set_marketplace_fee_bps roundtrip', async () => {
    await send('set_marketplace_fee_bps', [500])
    const mid = await viewInt('get_fee_bps', [])
    if (mid !== 500) throw new Error(`mid ${mid}`)
    await send('set_marketplace_fee_bps', [FEE_BPS])
  })

  await run('set_grace_period roundtrip', async () => {
    await send('set_grace_period', [1_000])
    const mid = await viewInt('get_grace_epochs', [])
    if (mid !== 1_000) throw new Error(`mid ${mid}`)
    await send('set_grace_period', [GRACE_EPOCHS])
  })

  await run('set_registration_price reverts on 0', async () =>
    expectRevert('set_registration_price', [0]))

  await run('set_marketplace_fee_bps reverts on 1200', async () =>
    expectRevert('set_marketplace_fee_bps', [1200]))
}

async function testRegistration() {
  banner('registration')

  const label = 'alpha-' + Date.now().toString(36).slice(-6)

  await run('is_available before register', async () => {
    const av = await viewBool('is_available', [label])
    if (!av) throw new Error(`unexpectedly taken`)
    return label
  })

  await run(`register_name('${label}', 1 year)`, async () => {
    const viewPk = 'BmVvVRb6FJt7aNh+8VQ0xQ2xJ8DdpL1Rf8PPQiU6NyE='
    await send('register_name', [label, DEPLOYER, viewPk, 1], PRICE_PER_YEAR)
  })

  await run('owner_of == deployer', async () => {
    const o = await viewAddr('owner_of', [label])
    if (o !== DEPLOYER) throw new Error(`owner ${o}`)
  })

  await run('resolve == deployer', async () => {
    const d = await viewAddr('resolve', [label])
    if (d !== DEPLOYER) throw new Error(`dest ${d}`)
  })

  await run('view_pk_of returns stored pk', async () => {
    const vp = await viewStr('view_pk_of', [label])
    if (!vp || vp.length < 40) throw new Error(`view_pk ${vp}`)
  })

  await run('is_active == true', async () => {
    const a = await viewBool('is_active', [label])
    if (!a) throw new Error(`not active`)
  })

  await run('is_available after register == false', async () => {
    const av = await viewBool('is_available', [label])
    if (av) throw new Error(`still available`)
  })

  await run('register reverts on wrong payment', async () =>
    expectRevert('register_name', [label + 'x', DEPLOYER, '', 1], PRICE_PER_YEAR - 1, /wrong payment/i))

  await run('register reverts on duplicate label', async () =>
    expectRevert('register_name', [label, DEPLOYER, '', 1], PRICE_PER_YEAR, /not available/i))

  await run('register reverts on too-short label', async () =>
    expectRevert('register_name', ['ab', DEPLOYER, '', 1], PRICE_PER_YEAR, /too short/i))

  await run('register reverts on years == 0', async () =>
    expectRevert('register_name', ['zeroyr-' + Date.now().toString(36).slice(-4), DEPLOYER, '', 0], 0, /years/i))

  global._ons_label = label
}

async function testMutations() {
  banner('mutations (renew / update / transfer)')

  const label = global._ons_label
  if (!label) throw new Error('no label from registration phase')

  await run('renew_name +1yr extends expiry', async () => {
    const before = await viewInt('expiry_of', [label])
    await send('renew_name', [label, 1], PRICE_PER_YEAR)
    const after = await viewInt('expiry_of', [label])
    if (!(after > before)) throw new Error(`after ${after} <= before ${before}`)
    return `+${(after - before).toLocaleString()} epochs`
  })

  await run('update_destination', async () => {
    const freshDest = 'oct7voWd6kADDiYdbCf4xFumSTXsMCsKK5eFqxzu5z8MyiE'
    await send('update_destination', [label, freshDest])
    const d = await viewAddr('destination_of', [label])
    if (d !== freshDest) throw new Error(`dest ${d}`)
  })

  await run('update_view_pk', async () => {
    const fresh = 'AAAABBBBCCCCDDDDEEEEFFFFGGGGHHHHIIIIJJJJKKKKLLLL='
    await send('update_view_pk', [label, fresh])
    const v = await viewStr('view_pk_of', [label])
    if (v !== fresh) throw new Error(`vp ${v}`)
  })

  await run('set_primary', async () => {
    await send('set_primary', [label])
    const p = await viewStr('primary_of', [DEPLOYER])
    if (p !== label) throw new Error(`primary ${p}`)
  })

  await run('unset_primary', async () => {
    await send('unset_primary', [])
    const p = await viewStr('primary_of', [DEPLOYER])
    if (p !== '') throw new Error(`primary still ${p}`)
  })

  await run('re-set primary', async () => {
    await send('set_primary', [label])
  })

  await run('update fails on unknown label', async () =>
    expectRevert('update_destination', ['nonexistent-xyz', DEPLOYER], 0, /not owner|expired/i))
}

async function testMarketplace() {
  banner('marketplace')

  const label = global._ons_label
  if (!label) throw new Error('no label from prior phase')

  const listPrice = 3_000_000   // 3 OCT

  await run('listing_price_of == 0 before list', async () => {
    const v = await viewInt('listing_price_of', [label])
    if (v !== 0) throw new Error(`listing ${v}`)
  })

  await run(`list_name at ${listPrice} OU`, async () => {
    await send('list_name', [label, listPrice])
    const p = await viewInt('listing_price_of', [label])
    if (p !== listPrice) throw new Error(`listing ${p}`)
  })

  await run('cannot buy own name', async () =>
    expectRevert('buy_name', [label, DEPLOYER, ''], listPrice, /cannot buy own|cannot/i))

  await run('cancel_listing', async () => {
    await send('cancel_listing', [label])
    const p = await viewInt('listing_price_of', [label])
    if (p !== 0) throw new Error(`listing still ${p}`)
  })

  await run('re-list for transfer test', async () => {
    await send('list_name', [label, listPrice])
  })

  await run('list fails with price 0', async () =>
    expectRevert('list_name', [label, 0], 0, /price/i))

  const second = 'oct9HhvFJKbJXs6eVTsLPfdzEFYcTQADYS9QDeaLvsFFVff'
  await run('transfer_name clears listing', async () => {
    await send('transfer_name', [label, second])
    const p = await viewInt('listing_price_of', [label])
    if (p !== 0) throw new Error(`listing survived transfer: ${p}`)
    const newOwner = await viewAddr('owner_of', [label])
    if (newOwner !== second) throw new Error(`owner ${newOwner}`)
  })

  await run('primary_of invalid after transfer', async () => {
    const p = await viewStr('primary_of', [DEPLOYER])
    if (p !== '') throw new Error(`primary still ${p}`)
  })

  await run('former owner cannot update', async () =>
    expectRevert('update_destination', [label, DEPLOYER], 0, /not owner/i))
}

async function testListingIndex() {
  banner('listing enumeration index')

  const totalBefore = await viewInt('listing_total', [])
  const nameA = 'idxa-' + Date.now().toString(36).slice(-5)
  const nameB = 'idxb-' + Date.now().toString(36).slice(-5)

  await run(`register ${nameA}`, async () => {
    await send('register_name', [nameA, DEPLOYER, '', 1], PRICE_PER_YEAR)
  })
  await run(`register ${nameB}`, async () => {
    await send('register_name', [nameB, DEPLOYER, '', 1], PRICE_PER_YEAR)
  })

  await run(`list ${nameA}`, async () => {
    await send('list_name', [nameA, 2_500_000])
  })
  await run(`list ${nameB}`, async () => {
    await send('list_name', [nameB, 3_500_000])
  })

  let totalAfter = 0
  await run('listing_total increased by 2', async () => {
    totalAfter = await viewInt('listing_total', [])
    if (totalAfter !== totalBefore + 2) {
      throw new Error(`expected ${totalBefore + 2}, got ${totalAfter}`)
    }
  })

  await run('listing_key_at enumerates both', async () => {
    const keys = new Set()
    for (let i = 0; i < totalAfter; i++) {
      const k = await viewStr('listing_key_at', [i])
      if (k) keys.add(k)
    }
    if (!keys.has(nameA)) throw new Error(`${nameA} missing from index`)
    if (!keys.has(nameB)) throw new Error(`${nameB} missing from index`)
  })

  await run('cancel middle drops count by 1', async () => {
    await send('cancel_listing', [nameA])
    const n = await viewInt('listing_total', [])
    if (n !== totalAfter - 1) throw new Error(`expected ${totalAfter - 1}, got ${n}`)
  })

  await run(`${nameB} still enumerable after swap`, async () => {
    const total = await viewInt('listing_total', [])
    const keys = new Set()
    for (let i = 0; i < total; i++) {
      const k = await viewStr('listing_key_at', [i])
      if (k) keys.add(k)
    }
    if (!keys.has(nameB)) throw new Error(`${nameB} dropped from index after swap-remove`)
    if (keys.has(nameA)) throw new Error(`${nameA} leaked after cancel`)
  })

  await run('release removes from index', async () => {
    await send('release_name', [nameB])
    const n = await viewInt('listing_total', [])
    if (n !== totalAfter - 2) throw new Error(`expected ${totalAfter - 2}, got ${n}`)
  })
}

async function testOwnerIndex() {
  banner('per-owner enumeration index')

  const nameX = 'own-' + Date.now().toString(36).slice(-5)

  await run(`register ${nameX} under deployer`, async () => {
    await send('register_name', [nameX, DEPLOYER, '', 1], PRICE_PER_YEAR)
  })

  let totalAfter = 0
  await run('owner_total >= 1', async () => {
    totalAfter = await viewInt('owner_total', [DEPLOYER])
    if (totalAfter < 1) throw new Error(`expected >= 1, got ${totalAfter}`)
  })

  await run(`${nameX} appears in owner enumeration`, async () => {
    const keys = new Set()
    for (let i = 0; i < totalAfter; i++) {
      const k = await viewStr('owner_key_at', [DEPLOYER, i])
      if (k) keys.add(k)
    }
    if (!keys.has(nameX)) throw new Error(`${nameX} not in owner index`)
  })

  await run('release removes from owner index', async () => {
    await send('release_name', [nameX])
    const after = await viewInt('owner_total', [DEPLOYER])
    if (after !== totalAfter - 1) throw new Error(`count ${after} != ${totalAfter - 1}`)
    for (let i = 0; i < after; i++) {
      const k = await viewStr('owner_key_at', [DEPLOYER, i])
      if (k === nameX) throw new Error(`${nameX} still in owner index`)
    }
  })
}

async function testReleaseAndCleanup() {
  banner('release + counters')

  const label = 'rel-' + Date.now().toString(36).slice(-5)

  await run(`register_name('${label}')`, async () => {
    await send('register_name', [label, DEPLOYER, '', 1], PRICE_PER_YEAR)
  })

  await run('release_name clears state', async () => {
    await send('release_name', [label])
    const o = await viewAddr('owner_of', [label])
    if (o !== '' && o !== '0') throw new Error(`owner survived: ${o}`)
    const e = await viewInt('expiry_of', [label])
    if (e !== 0) throw new Error(`expiry survived: ${e}`)
  })

  await run('is_available after release == true', async () => {
    const av = await viewBool('is_available', [label])
    if (!av) throw new Error(`not available`)
  })
}

async function testOwnershipTransfer() {
  banner('two-step ownership transfer')

  await run('propose_ownership (self as pending)', async () => {
    await send('propose_ownership', [DEPLOYER])
    const pending = await viewAddr('get_pending_owner', [])
    if (pending !== DEPLOYER) throw new Error(`pending ${pending}`)
  })

  await run('accept_ownership', async () => {
    await send('accept_ownership', [])
    const owner = await viewAddr('get_owner', [])
    if (owner !== DEPLOYER) throw new Error(`owner ${owner}`)
  })

  await run('accept_ownership reverts when no pending', async () =>
    expectRevert('accept_ownership', [], 0, /not pending/i))
}

async function testFeeWithdraw() {
  banner('fee withdrawal')

  const collected = await viewInt('get_fees_collected', [])
  if (collected > 0) {
    await run(`withdraw_fees to deployer (${collected} OU)`, async () => {
      await send('withdraw_fees', [DEPLOYER])
      const after = await viewInt('get_fees_collected', [])
      if (after !== 0) throw new Error(`fees after withdraw: ${after}`)
    })
  } else {
    await run('withdraw_fees reverts when no fees', async () =>
      expectRevert('withdraw_fees', [DEPLOYER], 0, /no fees/i))
  }
}

// ─── Main ────────────────────────────────────────────────────────────────

;(async () => {
  try {
    await boot()
  } catch (err) {
    console.error('boot failed:', err.message)
    process.exit(1)
  }

  await testMeta()
  await testAdmin()
  await testRegistration()
  await testMutations()
  await testMarketplace()
  await testListingIndex()
  await testOwnerIndex()
  await testReleaseAndCleanup()
  await testOwnershipTransfer()
  await testFeeWithdraw()

  banner('summary')
  const pass = results.filter((r) => r.status === 'pass').length
  const failed = results.filter((r) => r.status === 'fail')
  console.log(`pass: ${pass} / ${results.length}`)
  if (failed.length) {
    console.log(`fail: ${failed.length}`)
    for (const f of failed) console.log(`  ✘ ${f.name} — ${f.error}`)
    process.exit(1)
  } else {
    console.log('all tests passed')
  }
})()
