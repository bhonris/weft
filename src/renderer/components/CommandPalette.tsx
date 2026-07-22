import { useEffect, useMemo, useRef, useState } from 'react'
import { COMMANDS, type Command, type CommandId } from '@core/commands/registry'
import { fuzzyFilter } from '@core/commands/fuzzy'

interface CommandPaletteProps {
  open: boolean
  /** Defaults to the full registry; injectable for tests. */
  commands?: readonly Command[]
  /** Run the chosen command (renderer owns the id → handler mapping). */
  onRun: (id: CommandId) => void
  onClose: () => void
}

const optionId = (i: number): string => `weft-cmd-opt-${i}`

/**
 * The keyboard-only command palette (Ctrl+Shift+P). An accessible combobox +
 * listbox: type to fuzzy-filter, ↑/↓/Home/End move the highlight,
 * Enter runs, Esc closes. Focus is parked on the input (aria-activedescendant
 * model) and restored to the previously-focused element on close.
 */
export function CommandPalette({
  open,
  commands = COMMANDS,
  onRun,
  onClose
}: CommandPaletteProps): React.ReactElement | null {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)
  // Set when closing via a run: the command owns focus afterward, so the
  // open→false effect must not restore focus and clobber it.
  const skipRestoreRef = useRef(false)

  const results = useMemo(
    () => fuzzyFilter(query, commands, (c) => c.title).map((r) => r.item),
    [query, commands]
  )

  // On open: remember focus, reset query/highlight, focus the input.
  // On close: restore focus to wherever it was.
  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      setQuery('')
      setActive(0)
      inputRef.current?.focus()
    } else {
      // Clear on close too, not just on open: otherwise a stale query survives
      // in state between opens, and if the next open's reset races the first
      // keystroke (observed on newer Chromium), the old text gets prepended.
      setQuery('')
      setActive(0)
      if (!skipRestoreRef.current) restoreRef.current?.focus?.()
      skipRestoreRef.current = false
    }
  }, [open])

  // Keep the highlight in range as the filtered list shrinks.
  useEffect(() => {
    setActive((a) => (results.length === 0 ? 0 : Math.min(a, results.length - 1)))
  }, [results])

  if (!open) return null

  const run = (id: CommandId): void => {
    // Restore focus to the pre-palette element synchronously, THEN run — a
    // command that moves focus (e.g. Focus Terminal) wins; one that doesn't
    // (e.g. Cycle Theme) leaves focus sensibly where it was.
    skipRestoreRef.current = true
    restoreRef.current?.focus?.()
    onRun(id)
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
        const cmd = results[active]
        if (cmd) run(cmd.id)
        break
      }
      case 'Tab':
        // Focus trap: the palette is modal; keep focus on the input.
        e.preventDefault()
        break
    }
  }

  return (
    <div
      className="palette-backdrop"
      data-testid="command-palette"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onKeyDown={onKeyDown}
      >
        <input
          ref={inputRef}
          className="palette__input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls="weft-cmd-list"
          aria-activedescendant={results[active] ? optionId(active) : undefined}
          aria-autocomplete="list"
          aria-label="Search commands"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="palette__list" id="weft-cmd-list" role="listbox" aria-label="Commands">
          {results.map((c, i) => (
            <li
              key={c.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={`palette__opt${i === active ? ' palette__opt--active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault() // keep DOM focus on the input
                run(c.id)
              }}
            >
              <span className="palette__opt-title">{c.title}</span>
              <span className="palette__opt-cat">{c.category}</span>
              {c.shortcutHint && <kbd className="palette__opt-kbd">{c.shortcutHint}</kbd>}
            </li>
          ))}
          {results.length === 0 && (
            <li className="palette__empty" aria-disabled="true">
              No matching commands
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
