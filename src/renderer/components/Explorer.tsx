import { useEffect, useState } from 'react'
import type { DirEntry } from '@shared/ipc/api-contract'
import { useViewerStore } from '../store/viewer-store'

/**
 * Lazy file tree for the active project's cwd. Directories load their children
 * on first expand via `window.api.listDir`; files open with the OS default
 * handler. Read-only in v1 (Monaco viewer arrives separately).
 */
export function Explorer({ root }: { root: string | null }): React.ReactElement {
  const [entries, setEntries] = useState<DirEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEntries(null)
    setError(null)
    if (!root) return
    let cancelled = false
    window.api
      .listDir(root)
      .then((list) => {
        if (!cancelled) setEntries(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [root])

  if (!root) return <div className="explorer__empty">No project open</div>
  if (error) return <div className="explorer__empty">Cannot read folder: {error}</div>
  if (entries === null) return <div className="explorer__empty">Loading…</div>

  return (
    <ul className="explorer__list" role="tree" data-testid="explorer-tree">
      {entries.map((e) => (
        <ExplorerNode key={e.path} entry={e} depth={0} />
      ))}
    </ul>
  )
}

function ExplorerNode({ entry, depth }: { entry: DirEntry; depth: number }): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<DirEntry[] | null>(null)
  const isDir = entry.kind === 'dir'

  const openInViewer = useViewerStore((s) => s.openFile)

  const onClick = async (): Promise<void> => {
    if (!isDir) {
      // Single click: in-app read-only Monaco viewer (spec §2 diff-on-demand).
      openInViewer(entry.path, entry.name)
      return
    }
    if (!open && children === null) {
      try {
        setChildren(await window.api.listDir(entry.path))
      } catch {
        setChildren([])
      }
    }
    setOpen((o) => !o)
  }

  return (
    <li role="treeitem" aria-expanded={isDir ? open : undefined}>
      <button
        type="button"
        className={`explorer__item explorer__item--${entry.kind}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => void onClick()}
        onDoubleClick={() => {
          // Double click: hand off to the OS default handler.
          if (!isDir) void window.api.openWithDefault(entry.path)
        }}
        title={entry.path}
      >
        <span className="explorer__glyph">{isDir ? (open ? '▾' : '▸') : '·'}</span>
        {entry.name}
      </button>
      {isDir && open && children && (
        <ul className="explorer__list" role="group">
          {children.map((c) => (
            <ExplorerNode key={c.path} entry={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}
