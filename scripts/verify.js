// Submit the source for on-chain verification via contract_verify for the
// network selected by .env / ONS_NETWORK.

const fs   = require('node:fs')
const path = require('node:path')

const { rpc, setRpcUrl, getRpcUrl } = require('./lib/rpc')
const { buildConfig, readDeployment, ROOT } = require('./lib/env')

const SRC_PATH = path.join(ROOT, 'contract', 'ons.aml')

function log(label, value) {
  console.log(`${label.padEnd(18)} ${value}`)
}

;(async () => {
  const { config } = buildConfig()
  setRpcUrl(config.rpcUrl)

  if (!fs.existsSync(SRC_PATH)) throw new Error(`source not found: ${SRC_PATH}`)
  const deployment = readDeployment(config.network)
  if (!deployment) {
    throw new Error(`deployment record not found for network=${config.network}. run deploy.js first.`)
  }

  const source = fs.readFileSync(SRC_PATH, 'utf8')

  console.log('─── verify ──────────────────────────────────────')
  log('network', config.network)
  log('rpc',     getRpcUrl())
  log('address', deployment.address)
  log('src_len', String(source.length))

  const result = await rpc('contract_verify', [deployment.address, source])
  log('result', typeof result === 'string' ? result : JSON.stringify(result).slice(0, 300))

  try {
    const fetched = await rpc('contract_source', [deployment.address])
    const got = typeof fetched === 'string' ? fetched : (fetched?.source ?? '')
    log('source_stored', got.length ? `${got.length} chars` : 'none')
  } catch (err) {
    log('source_stored', `read failed: ${err.message}`)
  }

  console.log('─── done ────────────────────────────────────────')
})().catch((err) => {
  console.error('verify error:', err.message)
  process.exit(1)
})
