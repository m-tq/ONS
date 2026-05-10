// Compile ONS/contract/ons.aml via octra_compileAml.
//
// Writes to ONS/build/:
//   bytecode.b64   — base64 OCTB bytecode
//   abi.json       — ABI (functions + events)
//   compile.json   — full compile metadata incl. disassembly
//
// Honors ONS_NETWORK + ONS_RPC from .env / .env.<network> / shell env so the
// compiler can target different RPCs (devnet vs mainnet) without code changes.

const fs   = require('node:fs')
const path = require('node:path')

const { rpc, setRpcUrl, getRpcUrl } = require('./lib/rpc')
const { buildConfig, ROOT } = require('./lib/env')

const SRC_PATH     = path.join(ROOT, 'contract', 'ons.aml')
const BUILD_DIR    = path.join(ROOT, 'build')
const BYTECODE_OUT = path.join(BUILD_DIR, 'bytecode.b64')
const ABI_OUT      = path.join(BUILD_DIR, 'abi.json')
const COMPILE_OUT  = path.join(BUILD_DIR, 'compile.json')

function log(label, value) {
  console.log(`${label.padEnd(18)} ${value}`)
}

;(async () => {
  const { config } = buildConfig()
  setRpcUrl(config.rpcUrl)

  if (!fs.existsSync(SRC_PATH)) {
    console.error(`source not found: ${SRC_PATH}`)
    process.exit(1)
  }

  const source = fs.readFileSync(SRC_PATH, 'utf8')
  console.log('─── compile ─────────────────────────────────────')
  log('network', config.network)
  log('rpc',     getRpcUrl())
  log('source',  SRC_PATH)
  log('size',    `${source.length} chars`)

  const result = await rpc('octra_compileAml', [source])

  if (!result || !result.bytecode) {
    console.error('compile failed: no bytecode returned')
    console.error(JSON.stringify(result, null, 2))
    process.exit(1)
  }

  // ABI may arrive as a JSON string, array, or object. Normalize.
  let abi = result.abi
  if (typeof abi === 'string') {
    try { abi = JSON.parse(abi) } catch { /* keep as string */ }
  }
  const fnCount = Array.isArray(abi)
    ? abi.length
    : (abi?.functions?.length ?? 0)
  const evCount = Array.isArray(abi) ? 0 : (abi?.events?.length ?? 0)

  fs.mkdirSync(BUILD_DIR, { recursive: true })
  fs.writeFileSync(BYTECODE_OUT, result.bytecode)
  fs.writeFileSync(ABI_OUT,      JSON.stringify(abi ?? [], null, 2))
  fs.writeFileSync(COMPILE_OUT,  JSON.stringify({
    size:              result.size,
    instruction_count: result.instruction_count ?? result.instructions,
    version:           result.version,
    abi,
    disassembly:       result.disassembly,
  }, null, 2))

  console.log('─── result ──────────────────────────────────────')
  log('bytecode',  `${BYTECODE_OUT} (${result.bytecode.length} b64 chars)`)
  log('size',      `${result.size ?? '?'} bytes`)
  log('instr',     String(result.instruction_count ?? result.instructions ?? '?'))
  log('functions', String(fnCount))
  log('events',    String(evCount))
  log('version',   result.version ?? 'unknown')

  if (fnCount === 0) {
    console.warn('warning: no functions in ABI — check compiler response')
  }
})().catch((err) => {
  console.error('compile error:', err.message)
  process.exit(1)
})
