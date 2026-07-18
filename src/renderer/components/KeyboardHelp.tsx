import { useEffect, useMemo, useRef } from 'react'
import { COMMANDS, CATEGORY_ORDER, type Command } from '@core/commands/registry'

interface KeyboardHelpProps {
  open: boolean
  /** Defaults to the full registry; injectable for tests. */
  commands?: readonly Command[]
  onClose: () => void
}

/**
 * A read-only cheat-sheet of every keyboard shortcut, grouped by category
 * (Ctrl+Shift+/). Modal + focus-trapped; Esc closes and focus is restored to
 * the previously-focused element. Only commands that advertise a `shortcutHint`
 * appear here — commands without a chord are still runnable via the palette.
 */
export function KeyboardHelp({
  open,
  commands = COMMANDS,
  onClose
}: KeyboardHelpProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  const groups = useMemo(() => {
    const withKeys = commands.filter((c) => c.shortcutHint)
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      items: withKeys.filter((c) => c.category === cat)
    })).filter((g) => g.items.length > 0)
  }, [commands])

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      dialogRef.current?.focus()
    } else {
      restoreRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      // Modal: keep focus within the dialog (Esc is the documented exit).
      e.preventDefault()
    }
  }

  return (
    <div
      className="help-backdrop"
      data-testid="keyboard-help"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="help"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <header className="help__head">
          <h2 className="help__title">Keyboard shortcuts</h2>
          <button type="button" className="help__close" aria-label="close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="help__groups">
          {groups.map(({ cat, items }) => (
            <section key={cat} className="help__group">
              <h3 className="help__cat">{cat}</h3>
              <dl className="help__list">
                {items.map((c) => (
                  <div key={c.id} className="help__row">
                    <dt className="help__row-title">{c.title}</dt>
                    <dd className="help__row-kbd">
                      <kbd>{c.shortcutHint}</kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
