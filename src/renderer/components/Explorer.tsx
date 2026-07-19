import { useEffect, useMemo, useRef, useState } from 'react'
import type { DirEntry } from '@shared/ipc/api-contract'
import { useViewerStore } from '../store/viewer-store'
import { treeNav, nextExpanded, type NavNode } from '@core/explorer/tree-nav'

/** A flattened, currently-visible tree row. */
interface VisibleNode {
  entry: DirEntry
  depth: number
  isDir: boolean
  expanded: boolean
}

/**
 * Lazy file tree for the active project's cwd, navigable entirely by keyboard
 * (WAI-ARIA tree pattern via `core/explorer/tree-nav`): a flat roving-tabindex
 * list where ↑/↓ move, →/← expand/collapse or hop parent/child, Enter/Space
 * open a file or toggle a directory. Directories load children on first expand.
 */
export function Explorer({ root }: { root: string | null }): React.ReactElement {
  const [rootEntries, setRootEntries] = useState<DirEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [childrenByPath, setChildrenByPath] = useState<Record<string, DirEntry[]>>({})
  const [activeIndex, setActiveIndex] = useState(0)
  const treeRef = useRef<HTMLUListElement>(null)
  const openInViewer = useViewerStore((s) => s.openFile)

  // Reset when the project changes.
  useEffect(() => {
    setExpanded(new Set())
    setChildrenByPath({})
    setActiveIndex(0)
  }, [root])

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

  // Load (and refresh) the root listing.
  useEffect(() => {
    setError(null)
    if (!root) {
      setRootEntries(null)
      return
    }
    let cancelled = false
    window.api
      .listDir(root)
      .then((list) => {
        if (!cancelled) setRootEntries(list)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [root, version])

  // Load (and refresh) every expanded directory's children.
  useEffect(() => {
    if (!root || expanded.size === 0) return
    let cancelled = false
    const paths = [...expanded]
    void Promise.all(
      paths.map((p) =>
        window.api
          .listDir(p)
          .then((list) => [p, list] as const)
          .catch(() => [p, [] as DirEntry[]] as const)
      )
    ).then((pairs) => {
      if (cancelled) return
      setChildrenByPath((prev) => {
        const next = { ...prev }
        for (const [p, list] of pairs) next[p] = list
        return next
      })
    })
    return () => {
      cancelled = true
    }
  }, [expanded, version, root])

  // Flatten the tree into the currently-visible rows.
  const visible = useMemo(() => {
    const out: VisibleNode[] = []
    const walk = (entries: DirEntry[], depth: number): void => {
      for (const e of entries) {
        const isDir = e.kind === 'dir'
        const isExp = isDir && expanded.has(e.path)
        out.push({ entry: e, depth, isDir, expanded: isExp })
        if (isExp) {
          const kids = childrenByPath[e.path]
          if (kids) walk(kids, depth + 1)
        }
      }
    }
    if (rootEntries) walk(rootEntries, 0)
    return out
  }, [rootEntries, expanded, childrenByPath])

  const active = visible.length > 0 ? Math.min(activeIndex, visible.length - 1) : 0

  const focusIdx = (i: number): void => {
    const el = treeRef.current?.querySelector<HTMLElement>(`[data-idx="${i}"]`)
    el?.focus()
  }

  const setPathExpanded = (path: string, expanded: boolean): void =>
    setExpanded((s) => nextExpanded(s, path, expanded) as Set<string>)

  const activate = (n: VisibleNode): void => {
    if (n.isDir) {
      setPathExpanded(n.entry.path, !n.expanded)
    } else {
      openInViewer(n.entry.path, n.entry.name)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    const navNodes: NavNode[] = visible.map((v) => ({
      depth: v.depth,
      isDir: v.isDir,
      expanded: v.expanded
    }))
    const intent = treeNav(navNodes, active, e.key)
    if (intent.type === 'none') return
    e.preventDefault()
    e.stopPropagation()
    const cur = visible[active]
    switch (intent.type) {
      case 'move':
        setActiveIndex(intent.index)
        focusIdx(intent.index)
        break
      case 'expand':
        if (cur?.isDir) setPathExpanded(cur.entry.path, true)
        break
      case 'collapse':
        if (cur?.isDir) setPathExpanded(cur.entry.path, false)
        break
      case 'activate':
        if (cur) activate(cur)
        break
    }
  }

  if (!root) return <div className="explorer__empty">No project open</div>
  if (error) return <div className="explorer__empty">Cannot read folder: {error}</div>
  if (rootEntries === null) return <div className="explorer__empty">Loading…</div>
  if (visible.length === 0) return <div className="explorer__empty">Empty folder</div>

  return (
    <ul
      className="explorer__list"
      role="tree"
      aria-label="Files"
      data-testid="explorer-tree"
      ref={treeRef}
      onKeyDown={onKeyDown}
    >
      {visible.map((n, i) => (
        <li
          key={n.entry.path}
          role="treeitem"
          aria-level={n.depth + 1}
          aria-selected={i === active}
          aria-expanded={n.isDir ? n.expanded : undefined}
        >
          <button
            type="button"
            data-idx={i}
            tabIndex={i === active ? 0 : -1}
            className={`explorer__item explorer__item--${n.entry.kind}${
              i === active ? ' explorer__item--active' : ''
            }`}
            style={{ paddingLeft: `${8 + n.depth * 14}px` }}
            onClick={() => {
              setActiveIndex(i)
              activate(n)
            }}
            onDoubleClick={() => {
              if (!n.isDir) void window.api.openWithDefault(n.entry.path)
            }}
            title={n.entry.path}
          >
            <span className="explorer__glyph">
              {n.isDir ? (n.expanded ? '▾' : '▸') : '·'}
            </span>
            {n.entry.name}
          </button>
        </li>
      ))}
    </ul>
  )
}
