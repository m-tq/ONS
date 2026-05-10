# ONS Frontend

React + Vite + Tailwind dApp for the Octra Name Service.

## Features

- **Search** — resolve public names or private commitments, see status, owner, destination, listing.
- **Register** — hybrid registration flow. Public mode takes a label + destination + optional view pubkey; private mode combines a local label and salt into a commitment stored on chain.
- **Marketplace** — watchlist-driven listing view with fee preview and one-click buy.
- **My names (dashboard)** — wallet strip (address, balance, nonce), owned names with inline manage panel (update destination, renew, list/unlist, set primary, release), and a followed-names table.
- **About** — contract address, economics, and epoch reference.

## Stack

| Layer | Choice |
|-------|--------|
| framework | React 18 + TypeScript |
| build | Vite 6 |
| styling | Tailwind 3 + custom octrascan design tokens in `src/index.css` |
| icons | lucide-react |
| wallet | `@octwa/sdk@^1.6.0` |

## Contract

Runs against the devnet deployment at
[`oct9xXiCdw8Vpp8fugTgEQbdTXxVRGQYkGt9rwVMCe2pfGt`](https://devnet.octrascan.io/address.html?addr=oct9xXiCdw8Vpp8fugTgEQbdTXxVRGQYkGt9rwVMCe2pfGt)
via RPC `http://165.227.225.79:8080`.

Override with environment variables:

```
VITE_ONS_CONTRACT=oct...
VITE_ONS_RPC=http://...
```

## Development

```
npm install
npm run dev     # vite dev server on port 4000
npm run build   # tsc + vite build
npm run preview # serve the built bundle
```

## Project layout

```
src/
  components/           UI panels
    Header.tsx
    NavTabs.tsx
    MetricsRow.tsx
    SearchPanel.tsx
    RegisterPanel.tsx
    MarketplacePanel.tsx
    DashboardPanel.tsx
    AboutPanel.tsx
    Footer.tsx
    AddressLink.tsx   shared explorer links
    StatusTag.tsx     tag variants
    WalletButton.tsx  connect/disconnect
  hooks/
    useWallet.ts      OctraSDK init + connect + capability request
    useOnsConfig.ts   polls contract config every 15s
    useTheme.ts       light/dark toggle
  lib/
    constants.ts      contract address, RPC, epoch constants
    rpc.ts            JSON-RPC 2.0 client + typed view helpers
    ons.ts            contract-level typed reads + sendWrite wrapper
    format.ts         OU/OCT, epoch, label, commitment helpers
    bookmarks.ts      localStorage list of owned/watched names
  index.css           octrascan design tokens + component classes
  App.tsx             top-level tab router
  main.tsx            react entry point
```

## Design notes

- **Octrascan visual language** — dense, table-first, scanner-like. Square edges, 1px borders, mono font for protocol values.
- **Status always textual** — `available` · `registered` · `grace` · `expired`. Tags provide color as accent only.
- **No state enumeration** — AML maps are not iterable; the dashboard and marketplace persist a watchlist in `localStorage` keyed by wallet address.
- **Receipt-aware writes** — every contract write goes through `sendWrite` → `waitForReceipt`, which extracts the `Require` event from the receipt so users see the real revert reason instead of a silent "confirmed" status.
- **Pre-flight checks** — registration and buy flows do a view read before submitting a tx, so invalid inputs never burn a fee.

## Wallet flow

1. `OctraSDK.init()` — detects the OctWa extension.
2. `connect({ circle: 'ons_v2' })` — opens the popup; returns the wallet address and `viewPublicKey`.
3. `requestCapability({ methods: ['send_transaction', 'get_balance', 'get_encrypted_balance', 'get_crypto_identity'], scope: 'write' })` — a single capability covers every ONS operation; TTL defaults to 1 hour.
4. Writes go through `sdk.sendContractCall(...)` which always opens a popup.
5. Reads via `contract_call` RPC do not require a capability since they are truly public.

## Privacy posture

- **Public mode** is intentionally plaintext — think ENS. The `view_pk` field stores your Curve25519 view pubkey so others can stealth-send to `name.oct` without ever learning your address.
- **Private mode** never sends the label to the chain. Only `sha256("ons.private.v1|" + label + "|" + salt)` lands in contract storage. Users must keep their salt — without it, there's no way to prove ownership from a different machine.

## Known limitations

- Dashboard only sees names that were registered or followed from this browser profile (localStorage). Move between devices by exporting your bookmark list (future work) or by re-registering private names from the source where the salt lives.
- Marketplace watchlist is manual — there's no contract-level listing index because AML maps cannot be enumerated.
