import { useEffect, useRef, useState } from 'react'
import { useViewerStore } from '../store/viewer-store'

/**
 * Monaco read-only viewer + side-by-side diff ("review Claude's changes").
 * Monaco is imported lazily so its large chunk never blocks app startup.
 * DOM/Monaco-bound; verified by the Playwright-Electron E2E, not units.
 */
export function ViewerPane(): React.ReactElement | null {
  const file = useViewerStore((s) => s.file)
  const mode = useViewerStore((s) => s.mode)
  const setMode = useViewerStore((s) => s.setMode)
  const close = useViewerStore((s) => s.close)
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!file) return
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let dispose: (() => void) | null = null
    setError(null)

    void (async () => {
      try {
        const { monaco } = await import('../monaco-setup')
        const common = {
          readOnly: true,
          automaticLayout: true,
          minimap: { enabled: false },
          theme: 'vs-dark',
          renderWhitespace: 'none' as const
        }
        if (mode === 'diff') {
          const { original, modified } = await window.api.getDiff(file.path)
          if (disposed) return
          const editor = monaco.editor.createDiffEditor(host, {
            ...common,
            renderSideBySide: true
          })
          const originalModel = monaco.editor.createModel(original)
          const modifiedModel = monaco.editor.createModel(modified)
          editor.setModel({ original: originalModel, modified: modifiedModel })
          dispose = () => {
            editor.dispose()
            originalModel.dispose()
            modifiedModel.dispose()
          }
        } else {
          const content = await window.api.readFileText(file.path)
          if (disposed) return
          const model = monaco.editor.createModel(content)
          const editor = monaco.editor.create(host, { ...common, model })
          dispose = () => {
            editor.dispose()
            model.dispose()
          }
        }
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      disposed = true
      dispose?.()
    }
  }, [file, mode])

  if (!file) return null

  return (
    <section className="viewer" data-testid="viewer-pane">
      <header className="viewer__bar">
        <span className="viewer__name" title={file.path}>
          {file.name}
        </span>
        <div className="viewer__actions">
          <button
            type="button"
            className="viewer__mode"
            title="Show in the OS file manager"
            onClick={() => void window.api.revealInOs(file.path)}
          >
            Reveal
          </button>
          <button
            type="button"
            className={`viewer__mode${mode === 'view' ? ' viewer__mode--on' : ''}`}
            onClick={() => setMode('view')}
          >
            View
          </button>
          <button
            type="button"
            className={`viewer__mode${mode === 'diff' ? ' viewer__mode--on' : ''}`}
            onClick={() => setMode('diff')}
            data-testid="viewer-diff-toggle"
          >
            Diff vs HEAD
          </button>
          <button
            type="button"
            className="viewer__close"
            aria-label="close viewer"
            onClick={close}
          >
            ×
          </button>
        </div>
      </header>
      {error ? (
        <div className="viewer__error">Cannot open file: {error}</div>
      ) : (
        <div className="viewer__editor" ref={hostRef} data-testid="viewer-editor" />
      )}
    </section>
  )
}
