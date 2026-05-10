// Local bookmark store for names the user wants to follow (not owned).
//
// Dashboard's "names you own" list comes from the on-chain owner index, so
// bookmarks are now only used for `watched names` — the user's equivalent of
// "follow this label so I notice if it goes on sale".

const STORAGE_KEY = 'ons.bookmarks'

export interface WalletBookmarks {
  publics: string[]
}

type Store = Record<string, WalletBookmarks>

function readStore(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Store
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed
  } catch {
    return {}
  }
}

function writeStore(store: Store): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function ensure(store: Store, addr: string): WalletBookmarks {
  if (!store[addr]) store[addr] = { publics: [] }
  return store[addr]
}

export function loadBookmarks(addr: string): WalletBookmarks {
  if (!addr) return { publics: [] }
  const store = readStore()
  return store[addr] ?? { publics: [] }
}

export function addPublicBookmark(addr: string, label: string): WalletBookmarks {
  const store = readStore()
  const entry = ensure(store, addr)
  const normalized = label.trim().toLowerCase()
  if (normalized && !entry.publics.includes(normalized)) {
    entry.publics = [...entry.publics, normalized]
  }
  writeStore(store)
  return entry
}

export function removePublicBookmark(addr: string, label: string): WalletBookmarks {
  const store = readStore()
  const entry = ensure(store, addr)
  entry.publics = entry.publics.filter((l) => l !== label)
  writeStore(store)
  return entry
}
