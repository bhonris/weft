import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  /** Label for the confirming (destructive) button. */
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * A small modal confirmation used to guard a destructive action (currently:
 * closing an entire project tab, which terminates its Claude session). Modal +
 * focus-trapped like {@link KeyboardHelp}: Esc cancels, Enter confirms, and
 * focus is restored to the previously-focused element on close. Focus lands on
 * the Cancel button so an accidental Enter backs out rather than destroys.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.ReactElement | null {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (open) {
      restoreRef.current = document.activeElement as HTMLElement | null
      cancelRef.current?.focus()
    } else {
      restoreRef.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onConfirm()
    } else if (e.key === 'Tab') {
      // Modal: keep focus within the dialog (Esc / Enter are the exits).
      e.preventDefault()
    }
  }

  return (
    <div
      className="confirm-backdrop"
      data-testid="confirm-dialog"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div
        className="confirm"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onKeyDown={onKeyDown}
      >
        <h2 className="confirm__title">{title}</h2>
        <p className="confirm__msg">{message}</p>
        <div className="confirm__actions">
          <button
            type="button"
            className="confirm__btn"
            ref={cancelRef}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="confirm__btn confirm__btn--danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
