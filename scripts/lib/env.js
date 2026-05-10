// Dependency-free env loader for the ONS script suite.
//
// Resolution order (first match wins per key):
//
//   1. process.env                        — explicit shell override
//   2. ONS/.env.<network>                 — per-network file (e.g. .env.mainnet)
//   3. ONS/.env                           — defaults shared across networks
//
// The target network itself comes from (first match wins):
//
//   1. process.env.ONS_NETWORK
//   2. `ONS_NETWORK=` inside .env.<network>
//   3. `ONS_NETWORK=` inside .env
//   4. literal 'devnet'
//
// No process.env is ever mutated — the caller gets a plain object back.

const fs   = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..', '..')

function parseDotenv(text) {
  const out = {}
  if (!text) return out
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

function readDotenv(name) {
  const file = path.join(ROOT, name)
  if (!fs.existsSync(file)) return {}
  try {
    return parseDotenv(fs.readFileSync(file, 'utf8'))
  } catch {
    return {}
  }
}

function resolveNetwork(envFromBase) {
  const explicit = process.env.ONS_NETWORK
  if (explicit) return String(explicit).trim().toLowerCase()
  const fromFile = envFromBase.ONS_NETWORK
  if (fromFile) return String(fromFile).trim().toLowerCase()
  return 'devnet'
}

function loadEnv() {
  const baseEnv  = readDotenv('.env')
  const network  = resolveNetwork(baseEnv)
  const perNetwork = readDotenv(`.env.${network}`)

  // Merge: process.env > .env.<network> > .env
  const merged = {
    ...baseEnv,
    ...perNetwork,
  }
  for (const key of Object.keys(merged)) {
    if (process.env[key] != null && process.env[key] !== '') {
      merged[key] = process.env[key]
    }
  }
  // Walk process.env for any keys not in merged (pure shell overrides)
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('ONS_') && merged[key] === undefined) {
      merged[key] = process.env[key]
    }
  }

  merged.ONS_NETWORK = network
  return merged
}

const DEFAULT_RPC = {
  devnet:  'http://165.227.225.79:8080',
  mainnet: 'https://rpc.octra.network',
}

const DEFAULT_EXPLORER = {
  devnet:  'https://devnet.octrascan.io',
  mainnet: 'https://octrascan.io',
}

function buildConfig() {
  const env = loadEnv()
  const network = env.ONS_NETWORK === 'mainnet' ? 'mainnet' : 'devnet'

  const config = {
    network,
    rpcUrl:       env.ONS_RPC        || DEFAULT_RPC[network],
    explorerHost: env.ONS_EXPLORER   || DEFAULT_EXPLORER[network],
    deployer:     env.ONS_DEPLOYER_ADDR || '',
    privKey:      env.ONS_DEPLOYER_PRIV || '',
    pricePerYear: toNumber(env.ONS_PRICE_PER_YEAR_OU, 500_000),
    feeBps:       toNumber(env.ONS_FEE_BPS, 250),
    graceEpochs:  toNumber(env.ONS_GRACE_EPOCHS, 259_200),
    deployFeeOu:  toNumber(env.ONS_DEPLOY_FEE_OU, 200_000),
    callFeeOu:    toNumber(env.ONS_CALL_FEE_OU, 1_000),
  }

  const missing = []
  if (!config.deployer) missing.push('ONS_DEPLOYER_ADDR')
  if (!config.privKey)  missing.push('ONS_DEPLOYER_PRIV')

  return { config, env, missing }
}

function toNumber(raw, fallback) {
  if (raw == null || raw === '') return fallback
  const n = Number(raw)
  return Number.isFinite(n) ? n : fallback
}

function deploymentPath(network) {
  return path.join(ROOT, 'build', `deployment.${network}.json`)
}

function legacyDeploymentPath() {
  return path.join(ROOT, 'build', 'deployment.json')
}

// Back-compat: `build/deployment.json` from the pre-env era still reads.
function readDeployment(network) {
  const primary = deploymentPath(network)
  if (fs.existsSync(primary)) {
    return JSON.parse(fs.readFileSync(primary, 'utf8'))
  }
  const legacy = legacyDeploymentPath()
  if (fs.existsSync(legacy)) {
    return JSON.parse(fs.readFileSync(legacy, 'utf8'))
  }
  return null
}

module.exports = {
  loadEnv,
  buildConfig,
  deploymentPath,
  legacyDeploymentPath,
  readDeployment,
  ROOT,
}
