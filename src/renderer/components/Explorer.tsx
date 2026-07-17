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
  // Bumped on every external fs change; open nodes re-list themselves.
  const [version, setVersion] = useState(0)

  // Watch the root; any add/change/unlink refreshes the visible tree (≤1s AC).
  useEffect(() => {
    if (!root) return
    let watchId: string | null = null
    let disposed = false
    void window.api.watchDir(root).then((res) => {
      if (disposed) {
        void window.api.unwatchDir(res.watchId)
        return
      }
      watchId = res.watchId
    })
    const offChange = window.api.onFsChange((e) => {
      if (watchId !== null && e.watchId === watchId) setVersion((v) => v + 1)
    })
    return () => {
      disposed = true
      offChange()
      if (watchId !== null) void window.api.unwatchDir(watchId)
    }
  }, [root])

  useEffect(() => {
    setError(null)
    if (!root) {
      setEntries(null)
      return
    }
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
  }, [root, version])

  if (!root) return <div className="explorer__empty">No project open</div>
  if (error) return <div className="explorer__empty">Cannot read folder: {error}</div>
  if (entries === null) return <div className="explorer__empty">Loading…</div>

  return (
    <ul className="explorer__list" role="tree" data-testid="explorer-tree">
      {entries.map((e) => (
        <ExplorerNode key={e.path} entry={e} depth={0} version={version} />
      ))}
    </ul>
  )
}

function ExplorerNode({
  entry,
  depth,
  version
}: {
  entry: DirEntry
  depth: number
  version: number
}): React.ReactElement {
  const [open, setOpen] = useState(false)
  const [children, setChildren] = useState<DirEntry[] | null>(null)
  const isDir = entry.kind === 'dir'

  // Keep an expanded directory current when external changes arrive.
  useEffect(() => {
    if (!isDir || !open) return
    let cancelled = false
    window.api
      .listDir(entry.path)
      .then((list) => {
        if (!cancelled) setChildren(list)
      })
      .catch(() => {
        if (!cancelled) setChildren([])
      })
    return () => {
      cancelled = true
    }
  }, [version, isDir, open, entry.path])

  const openInViewer = useViewerStore((s) => s.openFile)

  const onClick = (): void => {
    if (!isDir) {
      // Single click: in-app read-only Monaco viewer (spec §2 diff-on-demand).
      openInViewer(entry.path, entry.name)
      return
    }
    // The effect above owns (re)fetching whenever the node is open.
    setOpen((o) => !o)
  }

  return (
    <li role="treeitem" aria-expanded={isDir ? open : undefined}>
      <button
        type="button"
        className={`explorer__item explorer__item--${entry.kind}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={onClick}
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
            <ExplorerNode key={c.path} entry={c} depth={depth + 1} version={version} />
          ))}
        </ul>
      )}
    </li>
  )
}
