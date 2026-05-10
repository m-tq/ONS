// Deploy the compiled ONS contract to the configured network.
//
// Config is resolved from .env + .env.<network> + shell env via scripts/lib/env.js.
// The deployer credentials must be set — there is no hardcoded fallback.
// Deployment metadata is written to `build/deployment.<network>.json` so the
// devnet and mainnet artifacts coexist cleanly.

const fs   = require('node:fs')
const path = require('node:path')

const { rpc, setRpcUrl, getRpcUrl } = require('./lib/rpc')
const ons = require('./lib/ons')
const { buildConfig, deploymentPath, ROOT } = require('./lib/env')

const BUILD_DIR     = path.join(ROOT, 'build')
const BYTECODE_PATH = path.join(BUILD_DIR, 'bytecode.b64')

function log(label, value) {
  console.log(`${label.padEnd(18)} ${value}`)
}

;(async () => {
  const { config, missing } = buildConfig()
  if (missing.length) {
    console.error(`missing required env vars: ${missing.join(', ')}`)
    console.error(`set them in .env / .env.${config.network} or as shell overrides.`)
    process.exit(1)
  }
  setRpcUrl(config.rpcUrl)

  if (!fs.existsSync(BYTECODE_PATH)) {
    console.error(`bytecode not found: ${BYTECODE_PATH}`)
    console.error('run: node scripts/compile.js first')
    process.exit(1)
  }
  const bytecodeB64 = fs.readFileSync(BYTECODE_PATH, 'utf8').trim()

  const keypair = ons.keyPairFromBase64(config.privKey)
  const constructorParams = [config.pricePerYear, config.feeBps, config.graceEpochs]

  console.log('─── deploy ──────────────────────────────────────')
  log('network',     config.network)
  log('rpc',         getRpcUrl())
  log('deployer',    config.deployer)
  log('bytecode',    `${bytecodeB64.length} b64 chars`)
  log('constructor', JSON.stringify(constructorParams))

  const account = await ons.getAccountState(config.deployer)
  log('nonce',         String(account.nonce))
  log('pending_nonce', String(account.pendingNonce))
  log('balance_raw',   String(account.balanceRaw))

  const nextNonce = account.pendingNonce + 1
  log('next_nonce', String(nextNonce))

  const addrResult = await rpc('octra_computeContractAddress', [bytecodeB64, config.deployer, nextNonce])
  const computedAddress = typeof addrResult === 'string' ? addrResult : addrResult.address
  log('predicted_addr', computedAddress)

  if (!computedAddress || !computedAddress.startsWith('oct')) {
    throw new Error(`unexpected address response: ${JSON.stringify(addrResult)}`)
  }

  const recommended = await ons.getRecommendedFee('deploy')
  const ou = Math.max(recommended, config.deployFeeOu)
  log('fee_ou', `${ou} (recommended ${recommended})`)

  if (account.balanceRaw < ou) {
    throw new Error(`insufficient balance: ${account.balanceRaw} < ${ou}`)
  }

  const deployTx = ons.buildDeployTx({
    deployer:          config.deployer,
    computedAddress,
    bytecodeB64,
    constructorParams,
    nonce:             nextNonce,
    ou,
    keypair,
  })

  console.log('─── submit ──────────────────────────────────────')
  const hash = await ons.submitTx(deployTx)
  log('hash', hash)
  log('explorer', `${config.explorerHost}/tx.html?hash=${hash}`)

  console.log('─── wait ────────────────────────────────────────')
  const { tx, receipt } = await ons.waitForTx(hash, { timeoutMs: 240_000 })
  log('status', tx.status ?? 'confirmed')
  log('epoch',  String(tx.epoch_id ?? tx.epoch ?? '?'))
  if (receipt) {
    log('success',  String(receipt.success))
    log('effort',   String(receipt.effort ?? '?'))
    log('events',   String((receipt.events ?? []).length))
  }

  const deployment = {
    address:           computedAddress,
    deployer:          config.deployer,
    deployTxHash:      hash,
    epoch:             tx.epoch_id ?? tx.epoch ?? null,
    nonce:             nextNonce,
    constructorParams,
    rpc:               config.rpcUrl,
    network:           config.network,
    deployedAt:        new Date().toISOString(),
  }

  const outPath = deploymentPath(config.network)
  fs.mkdirSync(BUILD_DIR, { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(deployment, null, 2))

  console.log('─── done ────────────────────────────────────────')
  log('address', computedAddress)
  log('saved',   outPath)
})().catch((err) => {
  console.error('deploy error:', err.message)
  if (err.stack && process.env.ONS_DEBUG === '1') console.error(err.stack)
  process.exit(1)
})
