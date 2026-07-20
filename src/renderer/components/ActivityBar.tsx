import { useActivityStore } from '../store/activity-store'
import type { SidebarPanel } from '@shared/ipc/api-contract'

interface ActivityItem {
  id: SidebarPanel
  label: string
  glyph: string
  /** 'top' items sit at the top; 'bottom' items are pinned to the bottom. */
  place: 'top' | 'bottom'
}

// VS Code-style: primary panels at the top, utility panels pinned bottom.
const ITEMS: ActivityItem[] = [
  { id: 'explorer', label: 'Explorer', glyph: '🗂', place: 'top' },
  { id: 'issues', label: 'GitHub Issues', glyph: '🐙', place: 'top' },
  { id: 'usage', label: 'Usage', glyph: '📊', place: 'bottom' }
]

/**
 * The vertical activity bar on the far left of the workbench. Each icon selects
 * a sidebar panel (explorer / usage); the active one is `aria-selected`. Keyboard
 * focusable via a roving `tablist`.
 */
export function ActivityBar(): React.ReactElement {
  const active = useActivityStore((s) => s.active)
  const setActive = useActivityStore((s) => s.setActive)
  const top = ITEMS.filter((i) => i.place === 'top')
  const bottom = ITEMS.filter((i) => i.place === 'bottom')

  const button = (item: ActivityItem): React.ReactElement => (
    <button
      key={item.id}
      type="button"
      role="tab"
      aria-selected={active === item.id}
      aria-label={item.label}
      title={item.label}
      tabIndex={active === item.id ? 0 : -1}
      data-testid={`activity-${item.id}`}
      className={`activity-bar__item${active === item.id ? ' activity-bar__item--active' : ''}`}
      onClick={() => setActive(item.id)}
    >
      <span aria-hidden="true">{item.glyph}</span>
    </button>
  )

  return (
    <nav
      className="activity-bar"
      role="tablist"
      aria-orientation="vertical"
      aria-label="Sidebar panels"
      data-testid="activity-bar"
    >
      <div className="activity-bar__group">{top.map(button)}</div>
      <div className="activity-bar__group activity-bar__group--bottom">{bottom.map(button)}</div>
    </nav>
  )
}
