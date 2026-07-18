import { useEffect, useMemo, useRef } from 'react'
import {
  COMMANDS,
  CATEGORY_ORDER,
  KEYBOARD_REFERENCE,
  type Command
} from '@core/commands/registry'

interface KeyboardHelpProps {
  open: boolean
  /** Defaults to the full registry; injectable for tests. */
  commands?: readonly Command[]
  onClose: () => void
}

/** Render a chord hint ("Ctrl+Shift+P") as keycaps joined by "+". */
function Chord({ hint }: { hint: string }): React.ReactElement {
  const keys = hint.split('+')
  return (
    <span className="help__keys">
      {keys.map((key, i) => (
        <span key={i} className="help__keygroup">
          {i > 0 && <span className="help__plus">+</span>}
          <kbd>{key}</kbd>
        </span>
      ))}
    </span>
  )
}

/** Render a reference key string ("↑ / ↓", "Home / End", "always") as tokens. */
function RefKeys({ keys }: { keys: string }): React.ReactElement {
  const tokens = keys.split(/\s+/)
  return (
    <span className="help__keys">
      {tokens.map((tok, i) =>
        tok === '/' ? (
          <span key={i} className="help__plus">
            /
          </span>
        ) : (
          <kbd key={i} className="kbd--plain">
            {tok}
          </kbd>
        )
      )}
    </span>
  )
}

/**
 * The in-app keyboard cheat-sheet (Ctrl+Shift+/ or the "Keyboard Shortcuts"
 * command). A complete, grouped reference: every command (with its chord, or a
 * "palette" tag when it has no dedicated key) plus region-local key references
 * (explorer navigation, terminal). Modal + focus-trapped; Esc closes and focus
 * is restored to the previously-focused element.
 */
export function KeyboardHelp({
  open,
  commands = COMMANDS,
  onClose
}: KeyboardHelpProps): React.ReactElement | null {
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  // Every command grouped by category (palette-only commands included, tagged).
  const commandGroups = useMemo(
    () =>
      CATEGORY_ORDER.map((cat) => ({
        cat,
        items: commands.filter((c) => c.category === cat)
      })).filter((g) => g.items.length > 0),
    [commands]
  )

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
          <div>
            <h2 className="help__title">Keyboard shortcuts</h2>
            <p className="help__hint">
              Tip: press <kbd>Ctrl</kbd>
              <span className="help__plus">+</span>
              <kbd>Shift</kbd>
              <span className="help__plus">+</span>
              <kbd>P</kbd> to run any command by name.
            </p>
          </div>
          <button type="button" className="help__close" aria-label="close" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="help__groups">
          {commandGroups.map(({ cat, items }) => (
            <section key={cat} className="help__group">
              <h3 className="help__cat">{cat}</h3>
              <dl className="help__list">
                {items.map((c) => (
                  <div key={c.id} className="help__row">
                    <dt className="help__row-title">{c.title}</dt>
                    <dd className="help__row-kbd">
                      {c.shortcutHint ? (
                        <Chord hint={c.shortcutHint} />
                      ) : (
                        <span className="help__via">palette</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          {KEYBOARD_REFERENCE.map((sec) => (
            <section key={sec.title} className="help__group">
              <h3 className="help__cat">
                {sec.title}
                {sec.note && <span className="help__cat-note"> {sec.note}</span>}
              </h3>
              <dl className="help__list">
                {sec.rows.map((r) => (
                  <div key={r.label} className="help__row">
                    <dt className="help__row-title">{r.label}</dt>
                    <dd className="help__row-kbd">
                      <RefKeys keys={r.keys} />
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
