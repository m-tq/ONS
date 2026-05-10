// Minimal JSON-RPC 2.0 client for Octra nodes.
// Canonicalizes parameters as a positional array and logs the request/response
// when ONS_DEBUG=1 is set.

const DEBUG = process.env.ONS_DEBUG === '1'

let _rpcUrl = 'http://165.227.225.79:8080'

function setRpcUrl(url) {
  _rpcUrl = url.replace(/\/+$/, '')
}

function getRpcUrl() {
  return _rpcUrl
}

let _id = 1

async function rpc(method, params = []) {
  const body = {
    jsonrpc: '2.0',
    id:      _id++,
    method,
    params,
  }

  if (DEBUG) console.error('[rpc →]', method, JSON.stringify(params).slice(0, 200))

  const res = await fetch(`${_rpcUrl}/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  const text = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)

  let json
  try {
    json = JSON.parse(text)
  } catch (err) {
    throw new Error(`Invalid JSON response: ${text.slice(0, 300)}`)
  }

  if (DEBUG) console.error('[rpc ←]', JSON.stringify(json.result ?? json.error ?? json).slice(0, 200))

  if (json.error) {
    const msg = json.error.message || json.error.reason || JSON.stringify(json.error)
    throw new Error(`RPC error [${method}]: ${msg}`)
  }

  return json.result
}

module.exports = { rpc, setRpcUrl, getRpcUrl }
