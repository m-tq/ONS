# Integrating ONS

> Step-by-step guide for wallets, explorers, and dApps that want to resolve
> Octra Name Service records.

The integration code is published as a single self-contained folder. Wallets, explorers, and third-party dApps all consume the same files with zero wiring differences.

---

## 1. Copy the integration

Copy `main/src/integrations/ons/` into your host project. The directory ships as a drop-in unit:

```
integrations/ons/
  config.ts         network → contract address + rpc endpoint
  client.ts         view-only client (resolve, reverse, records)
  cache.ts          lru cache with per-entry TTL
  react.ts          optional React hook
  index.ts          public entrypoint
  README.md         on-disk usage notes
```

No build step, no npm install. It uses only the `fetch` API and (optionally) React.

---

## 2. Point it at the right contract

The ONS contract address is host configuration — never hardcode it in the resolver. Source it from your host's environment config (for example Vite's `import.meta.env`) and pass it into `configureOns` once at application bootstrap:

```ts
import { configureOns } from '@/integrations/ons'

configureOns({
  network:    'mainnet',
  contract:   import.meta.env.VITE_ONS_CONTRACT_MAINNET,   // oct1MAINNET…
  rpcUrl:     import.meta.env.VITE_RPC_MAINNET,            // https://rpc.octra.network
  cacheTtlMs: 30_000,                                      // optional — defaults to 15 s
})
```

Recommended environment variables (adjust the prefix to match your build tool):

```
VITE_ONS_CONTRACT_DEVNET=oct...
VITE_ONS_CONTRACT_MAINNET=oct...
```

Leave a variable blank to disable ONS resolution on that network. The resolver will return empty strings for every lookup until a contract is configured.

If the host already tracks an "active RPC provider" (like the OctWa wallet), bridge it once and whenever the selection changes:

```ts
// Wallet-side adapter — wrap your own "active RPC" getter.
import { configureOns, clearOnsCache, type OnsNetwork } from '@/integrations/ons'

function pickContract(network: OnsNetwork): string | undefined {
  const raw = network === 'devnet'
    ? import.meta.env.VITE_ONS_CONTRACT_DEVNET
    : import.meta.env.VITE_ONS_CONTRACT_MAINNET
  const trimmed = typeof raw === 'string' ? raw.trim() : ''
  return trimmed.length > 0 ? trimmed : undefined
}

export function syncOnsConfigFromActiveProvider(): void {
  const provider = getActiveRPCProvider()
  const network  = getActiveNetwork()
  configureOns({
    network,
    rpcUrl:   provider?.url,
    contract: pickContract(network),
  })
  clearOnsCache()
}
```

Call `syncOnsConfigFromActiveProvider` on boot and whenever the RPC provider list changes. See `main/src/utils/onsBootstrap.ts` in this repo for a reference implementation.

---

## 3. Resolve input as the user types

### Plain JavaScript / any framework

```ts
import { resolveOnsName } from '@/integrations/ons'

const addr = await resolveOnsName(userInput)
// — empty string when not a registered name
// — the oct address when resolved
// — the input itself when the input is already a valid oct address
```

### React

```tsx
import { useOnsResolver } from '@/integrations/ons'

function RecipientHint({ value }: { value: string }) {
  const { state, address, record } = useOnsResolver(value)

  if (state === 'pending')      return <span>resolving…</span>
  if (state === 'passthrough')  return null                   // already an address
  if (state === 'not-found')    return <span>name not registered</span>
  if (state === 'error')        return <span>lookup failed</span>

  return (
    <span>
      {record?.label}.oct → <code>{address}</code>
    </span>
  )
}
```

The hook debounces input, caches results in memory, and short-circuits when the input is already a valid oct address.

---

## 4. Reverse lookup (address → name)

Explorers and activity feeds can enrich raw addresses with their primary ONS name, when the holder has set one:

```ts
import { reverseOnsLookup } from '@/integrations/ons'

const primaryName = await reverseOnsLookup(tx.from)
const display     = primaryName ? `${primaryName}.oct` : tx.from
```

Reverse lookups only return a value when the owner explicitly called `set_primary(label)` on the ONS contract. This is intentional: it lets users opt in to public identity per address, while keeping unlinked addresses anonymous.

---

## 5. Full record inspection

When you need more than just an address — expiry, owner, view pubkey, registration epoch — use `lookupOnsName`:

```ts
import { lookupOnsName } from '@/integrations/ons'

const record = await lookupOnsName('alice')
if (record) {
  record.destination   // plaintext oct address
  record.owner         // current owner
  record.viewPk        // base64 curve25519 view pubkey (for stealth routing)
  record.expiry        // absolute epoch
  record.registeredAt  // epoch of first registration
  record.isActive      // false once past expiry
}
```

The view pubkey is particularly useful for stealth-aware wallets: look up the pubkey, encrypt a stealth envelope for the recipient, submit the stealth output — sender and recipient stay unlinked on chain.

---

## 6. Cache behavior

The resolver maintains three per-config caches:

- address cache (`resolve`)
- record cache (`lookup`)
- reverse cache (`reverse`)

Each entry carries its own TTL. Defaults to 15 seconds and 128 entries per cache. Override at configuration time:

```ts
configureOns({ cacheTtlMs: 60_000 })
```

Bypass the cache for a single call:

```ts
await resolveOnsName('alice', { fresh: true })
```

Invalidate globally (e.g. after the user switches networks):

```ts
import { clearOnsCache } from '@/integrations/ons'
clearOnsCache()
```

---

## 7. Multiple networks at once

Block explorers that show both devnet and mainnet panes can build scoped clients without touching the global config:

```ts
import { createOnsClient } from '@/integrations/ons'

const devnet  = createOnsClient({ network: 'devnet' })
const mainnet = createOnsClient({ network: 'mainnet' })

const devnetAddr  = await devnet.resolve('alice')
const mainnetAddr = await mainnet.resolve('alice')
```

Scoped clients carry their own caches and never interact with the global singleton.

---

## 8. Integration reference (OctWa Wallet)

- `main/src/integrations/ons/` — the integration unit, copyable verbatim into any project.
- `main/src/utils/onsBootstrap.ts` — wallet-specific adapter that syncs the active RPC provider into the resolver.
- `main/src/App.tsx` — calls `syncOnsConfigFromActiveProvider()` on app load and on RPC provider changes.
- `main/src/components/AddressInput.tsx` — consumes `useOnsResolver` + `reverseOnsLookup` to render:
  - a preview chip when the user types a label (`alice` or `alice.oct`)
  - a reverse-lookup chip when the user pastes a raw oct address that has a primary name set on chain

The wallet never issues write transactions against the ONS contract. Registrations, transfers, and marketplace actions live inside the ONS dApp itself (`ONS/frontend/`).

---

## 9. Removing the integration

Because the resolver is isolated in one directory and every import path goes through `@/integrations/ons`, removing the feature is a three-step cleanup:

1. Delete `integrations/ons/`.
2. Remove the bootstrap call from app startup.
3. Drop the `useOnsResolver` / `reverseOnsLookup` hooks from host components.

Nothing in the ONS integration writes to app-level state, stores, or storage, so removal is clean.
