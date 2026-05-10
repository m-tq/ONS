# ONS — Octra Name Service (v2)

> Public name service on Octra Chain with built-in marketplace.
> Privacy of transfers is delegated to Octra's native stealth primitive.

---

## Concept

ONS gives Octra addresses human-readable names. Every registered name publishes:

| Field          | Purpose |
|----------------|---------|
| `destination`  | the plain address that `resolve(label)` returns |
| `view_pk`      | curve25519 view pubkey that enables stealth sends |

Stealth sends work like this: a sender looks up `view_pk_of("alice")`, generates a one-time stealth output tied to the view pubkey, and the recipient claims it later. The sender's and receiver's addresses are unlinkable on chain — but the name `alice.oct` stays discoverable and tradeable.

There is no separate "private" name tier. Privacy is a transport-layer property of stealth transfers, not a storage-layer property of names.

---

## Epoch Model

Octra produces one epoch every ~10 seconds. All time logic is epoch-based.

```
epochs per hour    = 360
epochs per day     = 8,640
epochs per week    = 60,480
epochs per year    = 3,153,600
```

Registration is priced per year. Grace period defaults to 30 days (259,200 epochs).

---

## Features

- Registration with destination + view pubkey published in one tx.
- Signature-based ownership (`origin` is the trusted owner, no state-tag bypass surface).
- **Marketplace**: list, cancel, buy. Fee split: seller receives `price − (price × fee_bps / 10000)`, fee accrues to contract for admin withdrawal. Buyer's wallet and view pubkey are atomically rebound on purchase.
- Renewal, transfer, voluntary release.
- Reverse resolution: set a primary name, `primary_of(addr)` returns it while ownership is valid.
- Pause / unpause admin surface.
- Configurable registration price, marketplace fee, grace period.
- **On-chain enumeration indices**: `listing_total` / `listing_key_at(i)` for marketplace, `owner_total` / `owner_key_at(addr, i)` for per-wallet name lists. O(n) iteration, no event scans.

---

## Layout

```
ONS/
  contract/
    ons.aml                 main contract source
  scripts/
    lib/
      rpc.js                JSON-RPC 2.0 client
      ons.js                tx build + sign + wait helpers
    compile.js              compile source via octra_compileAml
    deploy.js               compute address + send deploy tx
    save_abi.js             contract_saveAbi with compiled ABI
    verify.js               contract_verify against deployed bytecode
    test.js                 full functional test suite
  build/
    (generated: bytecode, abi, deployment.json, verification)
  frontend/                 React + Vite dApp
    src/
      components/           octrascan-styled UI panels
      hooks/                wallet, config, theme
      lib/                  rpc, ons, format, bookmarks
      index.css             octrascan design tokens
    package.json            npm run dev / build / preview
  BASE_UI_UX.md             UI spec
  README.md                 this file
```

---

## Invariants

- Network: devnet
- RPC: `http://165.227.225.79:8080`
- Deployer: `oct7voWd6kADDiYdbCf4xFumSTXsMCsKK5eFqxzu5z8MyiE`
- Explorer: `https://devnet.octrascan.io`
- Octra 6-decimal raw units (1 OCT = 1,000,000 OU) throughout.

## Deployed Contract (devnet)

| Field | Value |
|-------|-------|
| Address | `oct4BkKJyYUrnd1tcRqVLmqMgbDL52q9a2WBzkbR34VBVAj` |
| Deploy tx | `ab16c2588f5d04556cf50f20f0ccf64414d833d9b949b557911aa312de461d41` |
| Bytecode | 9,525 bytes · 1,933 instructions · `1.0 Rehovot` |
| Functions | 44 |
| Events | 19 |
| Epoch | 655,072 |
| Price per year | 500,000 OU (0.5 OCT) |
| Marketplace fee | 250 bps (2.5 %) |
| Grace period | 259,200 epochs (30 days) |

- [View on explorer](https://devnet.octrascan.io/address.html?addr=oct4BkKJyYUrnd1tcRqVLmqMgbDL52q9a2WBzkbR34VBVAj)
- [Deploy tx](https://devnet.octrascan.io/tx.html?hash=ab16c2588f5d04556cf50f20f0ccf64414d833d9b949b557911aa312de461d41)

Test suite result: **62 / 62 passing** (registration, renewal, transfer, release, marketplace, enumeration indices, two-step ownership, fee withdrawal, receipt-based revert assertions).

---

## Running Scripts

All scripts resolve configuration from three sources, in this order (first match wins per key):

```
shell env            e.g. ONS_NETWORK=mainnet npm run deploy
.env.<network>       e.g. .env.mainnet
.env                 shared defaults
```

Target network defaults to `devnet`. Switch via `ONS_NETWORK=mainnet` or the `:mainnet` npm scripts.

### Devnet (default)

```
npm run compile              # source → bytecode + abi → build/
npm run deploy               # deploy tx → build/deployment.devnet.json
npm run save-abi             # contract_saveAbi
npm run verify               # contract_verify
npm run test                 # exercise every function, then summarize
```

### Mainnet

```
npm run compile:mainnet      # or: cross-env ONS_NETWORK=mainnet node scripts/compile.js
npm run deploy:mainnet       # writes build/deployment.mainnet.json
npm run save-abi:mainnet
npm run verify:mainnet
npm run test:mainnet
```

### Required env vars

```
ONS_DEPLOYER_ADDR=oct...             # deployer / admin wallet
ONS_DEPLOYER_PRIV=base64 seed        # Ed25519 seed (32 bytes, base64)
```

Put these in `.env.devnet` or `.env.mainnet` for convenience. On CI, prefer shell overrides so private keys are never committed to disk.

### Optional env vars

```
ONS_NETWORK=devnet|mainnet           # default: devnet
ONS_RPC=...                          # default: devnet node / rpc.octra.network
ONS_EXPLORER=...                     # default: devnet.octrascan.io / octrascan.io
ONS_PRICE_PER_YEAR_OU=500000
ONS_FEE_BPS=250
ONS_GRACE_EPOCHS=259200
ONS_DEPLOY_FEE_OU=200000
ONS_CALL_FEE_OU=1000
```

Deployment records are written to `build/deployment.<network>.json`. Devnet and mainnet deployments coexist in the same build directory — no overwrites.

## Frontend

```
cd frontend
npm install
npm run dev     # vite dev server on http://localhost:4000
npm run build
```

See [frontend/README.md](frontend/README.md) for the component map and wallet integration notes.

## Integrating with wallets and explorers

A self-contained resolver ships under `main/src/integrations/ons/` in this repo and can be copied verbatim into any Octra dApp. See [INTEGRATION.md](INTEGRATION.md) for the full guide — it covers configuration, React + non-React usage, reverse lookups, caching, and multi-network scoping.
