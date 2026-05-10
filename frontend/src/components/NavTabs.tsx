import { classNames } from '../lib/format'

export type NavTab = 'search' | 'register' | 'marketplace' | 'dashboard' | 'about'

const TABS: Array<{ id: NavTab; label: string }> = [
  { id: 'search',       label: 'search' },
  { id: 'register',     label: 'register' },
  { id: 'marketplace',  label: 'marketplace' },
  { id: 'dashboard',    label: 'my names' },
  { id: 'about',        label: 'about' },
]

interface Props {
  current: NavTab
  onChange: (tab: NavTab) => void
}

export function NavTabs({ current, onChange }: Props) {
  return (
    <nav className="nav-tabs" role="tablist" aria-label="ons navigation">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={tab.id === current}
          className={classNames('nav-tab', tab.id === current && 'is-active')}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
