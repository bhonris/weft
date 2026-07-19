import { useEffect, useMemo, useRef, useState } from 'react'
import { COMMANDS, type Command } from '@core/commands/registry'
import { actionForCommand } from '@core/commands/action-dispatch'
import { chordOf } from '@core/keybindings/keymap'
import {
  chordForCommand,
  rebindCommand,
  clearCommandBinding,
  type KeymapOverrides
} from '@core/keybindings/effective-keymap'

interface KeybindingsEditorProps {
  open: boolean
  overrides: KeymapOverrides
  /** Persist the next overrides map (renderer store setter). */
  onChange: (next: Record<string, string>) => void
  /** Defaults to the full registry; injectable for tests. */
  commands?: readonly Command[]
  onClose: () => void
}

const optionId = (i: number): string => `weft-kb-opt-${i}`

/** Present a canonical chord ("ctrl+shift+p") as titled keycaps. */
function formatChord(chord: string): string {
  return chord
    .split('+')
    .map((p) =>
      p === 'ctrl' ? 'Ctrl' : p === 'shift' ? 'Shift' : p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1)
    )
    .join('+')
}

function Keys({ chord }: { chord: string }): React.ReactElement {
  const parts = formatChord(chord).split('+')
  return (
    <span className="help__keys">
      {parts.map((key, i) => (
        <span key={i} className="help__keygroup">
          {i > 0 && <span className="help__plus">+</span>}
          <kbd>{key}</kbd>
        </span>
      ))}
    </span>
  )
}

/**
 * The keybindings editor (opened via the "Edit Keybindings" command). An
 * accessible, keyboard-operable listbox of remappable commands: ↑/↓ move the
 * highlight, Enter captures the next chord and rebinds (rejecting reserved
 * terminal chords, warning on conflicts), Backspace resets the highlighted
 * command to its default, "Reset all" clears everything, Esc closes. Modal +
 * focus-trapped; focus restores on close. All edits flow through the pure
 * `core/keybindings` helpers and are persisted by the caller.
 */
export function KeybindingsEditor({
  open,
  overrides,
  onChange,
  commands = COMMANDS,
  onClose
}: KeybindingsEditorProps): React.ReactElement | null {
  const bindable = useMemo(() => commands.filter((c) => actionForCommand(c.id) !== null), [commands])
  const [active, setActive] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      setActive(0)
      setCapturing(false)
      setMessage(null)
      dialogRef.current?.focus()
    } else {
      restoreRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  const titleOf = (id: string): string => commands.find((c) => c.id === id)?.title ?? id

  const applyRebind = (chord: string): void => {
    const cmd = bindable[active]
    if (!cmd) return
    const res = rebindCommand(overrides, cmd.id, chord)
    if (!res.ok) {
      setMessage(
        res.reason === 'protected'
          ? `${formatChord(chord)} is reserved for the terminal and can't be bound.`
          : "That key can't be bound."
      )
      return
    }
    onChange(res.overrides)
    setMessage(
      res.displaced && res.displaced !== cmd.id
        ? `Bound to ${formatChord(chord)} — was "${titleOf(res.displaced)}", now reassigned.`
        : `Bound to ${formatChord(chord)}.`
    )
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (capturing) {
      e.preventDefault()
      if (e.key === 'Escape') {
        setCapturing(false)
        setMessage('Rebind cancelled.')
        return
      }
      const chord = chordOf(e)
      if (!chord) return // bare modifier / non-Ctrl key: keep waiting
      applyRebind(chord)
      setCapturing(false)
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        onClose()
        break
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => (a + 1) % bindable.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => (a - 1 + bindable.length) % bindable.length)
        break
      case 'Home':
        e.preventDefault()
        setActive(0)
        break
      case 'End':
        e.preventDefault()
        setActive(bindable.length - 1)
        break
      case 'Enter':
        e.preventDefault()
        setCapturing(true)
        setMessage('Press the new shortcut… (Esc to cancel)')
        break
      case 'Backspace':
      case 'Delete': {
        e.preventDefault()
        const cmd = bindable[active]
        if (cmd) {
          onChange(clearCommandBinding(overrides, cmd.id))
          setMessage(`"${cmd.title}" reset to default.`)
        }
        break
      }
      case 'Tab':
        e.preventDefault() // modal focus trap
        break
    }
  }

  return (
    <div
      className="help-backdrop"
      data-testid="keybindings-editor"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="help kb-editor"
        role="dialog"
        aria-modal="true"
        aria-label="Edit keybindings"
        tabIndex={-1}
        ref={dialogRef}
        onKeyDown={onKeyDown}
      >
        <header className="help__head">
          <div>
            <h2 className="help__title">Keybindings</h2>
            <p className="help__hint">
              <kbd>↑</kbd>
              <kbd>↓</kbd> select · <kbd>Enter</kbd> rebind · <kbd>Backspace</kbd> reset ·{' '}
              <kbd>Esc</kbd> close
            </p>
          </div>
          <button
            type="button"
            className="kb-editor__resetall"
            aria-label="reset all keybindings"
            title="Reset all keybindings to defaults"
            onClick={() => {
              onChange({})
              setMessage('All keybindings reset to defaults.')
            }}
          >
            Reset all
          </button>
          <button type="button" className="help__close" aria-label="close" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="kb-editor__status" role="status" aria-live="polite">
          {message ?? ' '}
        </p>
        <ul className="palette__list" role="listbox" aria-label="Commands" aria-activedescendant={optionId(active)}>
          {bindable.map((c, i) => {
            const chord = chordForCommand(overrides, c.id)
            const isActive = i === active
            return (
              <li
                key={c.id}
                id={optionId(i)}
                role="option"
                aria-selected={isActive}
                className={`palette__opt${isActive ? ' palette__opt--active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  setActive(i)
                  setCapturing(true)
                  setMessage('Press the new shortcut… (Esc to cancel)')
                }}
              >
                <span className="palette__opt-title">{c.title}</span>
                {isActive && capturing ? (
                  <span className="kb-editor__capturing">press a key…</span>
                ) : chord ? (
                  <Keys chord={chord} />
                ) : (
                  <span className="help__via">unbound</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
