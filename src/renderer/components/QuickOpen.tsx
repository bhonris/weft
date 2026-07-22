import { useEffect, useMemo, useRef, useState } from 'react'
import type { IndexedFile } from '@shared/ipc/api-contract'
import { fuzzyFilter } from '@core/commands/fuzzy'

interface QuickOpenProps {
  open: boolean
  /** The active project root to index, or null when no project is open. */
  cwd: string | null
  /** Open the chosen file in the viewer (renderer owns the store). */
  onOpen: (path: string, name: string) => void
  onClose: () => void
  /** File source; injectable for tests. Defaults to the preload bridge. */
  loadFiles?: (root: string) => Promise<IndexedFile[]>
}

const optionId = (i: number): string => `weft-file-opt-${i}`

/** Default file source — a stable module-level identity so it can sit in the
 *  load effect's dependency list without re-firing it on every render. */
const bridgeLoadFiles = (root: string): Promise<IndexedFile[]> =>
  window.api.listFilesDeep(root)

/** The directory portion of a `/`-joined relative path ('' for a root file). */
function dirOf(rel: string): string {
  const slash = rel.lastIndexOf('/')
  return slash === -1 ? '' : rel.slice(0, slash)
}

/**
 * The keyboard-only quick file finder (Ctrl+Shift+O) — weft's answer to VS
 * Code's Ctrl+P (which is unavailable here: plain Ctrl belongs to the terminal).
 * An accessible combobox + listbox over the active project's files: type to
 * fuzzy-filter by path, ↑/↓/Home/End move the highlight, Enter opens, Esc
 * closes. Mirrors CommandPalette's a11y + focus-restore model.
 */
export function QuickOpen({
  open,
  cwd,
  onOpen,
  onClose,
  loadFiles = bridgeLoadFiles
}: QuickOpenProps): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [files, setFiles] = useState<IndexedFile[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  // Set when closing via an open-file: the viewer owns focus afterward, so the
  // open→false effect must not restore focus and clobber it.
  const skipRestoreRef = useRef(false)
  // Discards results from a fetch that a reopen/close superseded.
  const loadTokenRef = useRef(0)

  const results = useMemo(
    () => fuzzyFilter(query, files, (f) => f.rel).map((r) => r.item),
    [query, files]
  )

  // On open: remember focus, reset state, focus the input, and (re)index the
  // project. On close: restore focus to wherever it was.
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      setQuery('')
      setActive(0)
      inputRef.current?.focus()
      const token = ++loadTokenRef.current
      if (cwd === null) {
        setFiles([])
        setLoading(false)
        return
      }
      setFiles([])
      setLoading(true)
      loadFiles(cwd)
        .then((list) => {
          if (loadTokenRef.current === token) {
            setFiles(list)
            setLoading(false)
          }
        })
        .catch(() => {
          if (loadTokenRef.current === token) {
            setFiles([])
            setLoading(false)
          }
        })
    } else {
      loadTokenRef.current++ // invalidate any in-flight fetch
      if (!skipRestoreRef.current) restoreRef.current?.focus?.()
      skipRestoreRef.current = false
    }
  }, [open, cwd, loadFiles])

  // Keep the highlight in range as the filtered list shrinks.
  useEffect(() => {
    setActive((a) => (results.length === 0 ? 0 : Math.min(a, results.length - 1)))
  }, [results])

  if (!open) return null

  const openFile = (file: IndexedFile): void => {
    // Restore focus to the pre-finder element synchronously, THEN open — the
    // viewer will take focus itself if appropriate.
    skipRestoreRef.current = true
    restoreRef.current?.focus?.()
    onOpen(file.path, file.name)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => (results.length === 0 ? 0 : (a + 1) % results.length))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => (results.length === 0 ? 0 : (a - 1 + results.length) % results.length))
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(Math.max(0, results.length - 1))
        break
      case 'Enter': {
        e.preventDefault()
        const file = results[active]
        if (file) openFile(file)
        break
      }
      case 'Tab':
        // Focus trap: the finder is modal; keep focus on the input.
        e.preventDefault()
        break
    }
  }

  const emptyMessage =
    cwd === null
      ? 'Open a project to search its files'
      : loading
        ? 'Indexing files…'
        : 'No matching files'

  return (
    <div
      className="palette-backdrop"
      data-testid="quick-open"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Go to file"
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="palette__input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="weft-file-list"
          aria-activedescendant={results[active] ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Search files"
          placeholder="Search files by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="palette__list" id="weft-file-list" role="listbox" aria-label="Files">
          {results.map((f, i) => {
            const dir = dirOf(f.rel)
            return (
              <li
                key={f.rel}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                className={`palette__opt${i === active ? ' palette__opt--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault() // keep DOM focus on the input
                  openFile(f)
                }}
              >
                <span className="palette__opt-title">{f.name}</span>
                {dir && <span className="palette__opt-path">{dir}</span>}
              </li>
            )
          })}
          {results.length === 0 && (
            <li className="palette__empty" aria-disabled="true">
              {emptyMessage}
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
