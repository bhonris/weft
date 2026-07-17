import { useEffect, useRef, useState } from 'react'
import { useViewerStore } from '../store/viewer-store'
import type { monaco as MonacoNs } from '../monaco-setup'

type Editor = ReturnType<typeof MonacoNs.editor.create>

/**
 * Monaco viewer: read-only View, side-by-side Diff vs HEAD, and a light Edit
 * mode (type + Ctrl+S save; dirty ● indicator). No LSP — full authoring is v2.
 * DOM/Monaco-bound; verified by the Playwright-Electron E2E, not units.
 */
export function ViewerPane(): React.ReactElement | null {
  const file = useViewerStore((s) => s.file)
  const mode = useViewerStore((s) => s.mode)
  const setMode = useViewerStore((s) => s.setMode)
  const close = useViewerStore((s) => s.close)
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Leaving the file or switching mode exits edit state.
  useEffect(() => {
    setEditing(false)
    setDirty(false)
    setSaveError(null)
  }, [file, mode])

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
          readOnly: !editing,
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
            readOnly: true,
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
          editorRef.current = editor
          const changeSub = model.onDidChangeContent(() => setDirty(true))
          // Ctrl+S saves through the validated IPC.
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            void window.api
              .saveFile(file.path, model.getValue())
              .then(() => {
                setDirty(false)
                setSaveError(null)
              })
              .catch((e: unknown) =>
                setSaveError(e instanceof Error ? e.message : String(e))
              )
          })
          dispose = () => {
            changeSub.dispose()
            editorRef.current = null
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
  }, [file, mode, editing])

  if (!file) return null

  return (
    <section className="viewer" data-testid="viewer-pane">
      <header className="viewer__bar">
        <span className="viewer__name" title={file.path}>
          {dirty && (
            <span className="viewer__dirty" data-testid="viewer-dirty" title="unsaved changes">
              ●{' '}
            </span>
          )}
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
            className={`viewer__mode${mode === 'view' && !editing ? ' viewer__mode--on' : ''}`}
            onClick={() => {
              setMode('view')
              setEditing(false)
            }}
          >
            View
          </button>
          <button
            type="button"
            className={`viewer__mode${mode === 'view' && editing ? ' viewer__mode--on' : ''}`}
            data-testid="viewer-edit-toggle"
            title="Edit this file (Ctrl+S saves)"
            onClick={() => {
              setMode('view')
              setEditing(true)
            }}
          >
            Edit
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
      {saveError && (
        <div className="viewer__error" role="alert">
          Save failed: {saveError}
        </div>
      )}
      {error ? (
        <div className="viewer__error">Cannot open file: {error}</div>
      ) : (
        <div className="viewer__editor" ref={hostRef} data-testid="viewer-editor" />
      )}
    </section>
  )
}
