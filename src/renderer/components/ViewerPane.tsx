import { useEffect, useRef, useState } from 'react'
import { useViewerStore } from '../store/viewer-store'
import { useSessionStore } from '../store/session-store'
import { languageIdForFile, isMarkdown } from '@core/viewer/file-language'
import { monacoThemeForApp } from '@core/viewer/monaco-theme'
import { MarkdownPreview } from './MarkdownPreview'
import type { monaco as MonacoNs } from '../monaco-setup'

type Editor = ReturnType<typeof MonacoNs.editor.create>

/** Resolve the app theme to a Monaco theme name, reading the OS preference. */
function resolveMonacoTheme(appTheme: Parameters<typeof monacoThemeForApp>[0]): string {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  return monacoThemeForApp(appTheme, prefersDark)
}

/**
 * Monaco viewer: read-only View, side-by-side Diff vs HEAD, and a light Edit
 * mode (type + Ctrl+S save; dirty ● indicator). No LSP — full authoring is v2.
 * DOM/Monaco-bound; verified by the Playwright-Electron E2E, not units.
 */
export function ViewerPane(): React.ReactElement | null {
  const file = useViewerStore((s) => s.file)
  const openFiles = useViewerStore((s) => s.openFiles)
  const setActiveFileIdx = useViewerStore((s) => s.setActiveFile)
  const closeFileTab = useViewerStore((s) => s.closeFile)
  const mode = useViewerStore((s) => s.mode)
  const editing = useViewerStore((s) => s.editing)
  const preview = useViewerStore((s) => s.preview)
  const saveTick = useViewerStore((s) => s.saveTick)
  const setMode = useViewerStore((s) => s.setMode)
  const setEditing = useViewerStore((s) => s.setEditing)
  const setPreview = useViewerStore((s) => s.setPreview)
  const close = useViewerStore((s) => s.close)
  const theme = useSessionStore((s) => s.theme)
  const hostRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Latest save routine, kept in a ref so the saveTick effect stays stable.
  const doSaveRef = useRef<() => void>(() => {})
  doSaveRef.current = (): void => {
    const ed = editorRef.current
    const model = ed?.getModel()
    if (!file || !model || !useViewerStore.getState().editing) return
    void window.api
      .saveFile(file.path, model.getValue())
      .then(() => {
        setDirty(false)
        setSaveError(null)
      })
      .catch((e: unknown) => setSaveError(e instanceof Error ? e.message : String(e)))
  }

  // App-level Ctrl+S (viewer region focused) increments saveTick → save now.
  useEffect(() => {
    if (saveTick > 0) doSaveRef.current()
  }, [saveTick])

  // Leaving the file or switching mode clears transient save state.
  useEffect(() => {
    setDirty(false)
    setSaveError(null)
  }, [file, mode])

  // Rendered Markdown preview replaces the Monaco surface (view mode only).
  const showPreview = !!file && mode === 'view' && preview && isMarkdown(file.name)

  useEffect(() => {
    if (!file || showPreview) return
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let dispose: (() => void) | null = null
    setError(null)

    void (async () => {
      try {
        const { monaco } = await import('../monaco-setup')
        const language = languageIdForFile(file.name)
        const common = {
          readOnly: !editing,
          automaticLayout: true,
          minimap: { enabled: false },
          theme: resolveMonacoTheme(theme),
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
          const originalModel = monaco.editor.createModel(original, language)
          const modifiedModel = monaco.editor.createModel(modified, language)
          editor.setModel({ original: originalModel, modified: modifiedModel })
          dispose = () => {
            editor.dispose()
            originalModel.dispose()
            modifiedModel.dispose()
          }
        } else {
          const content = await window.api.readFileText(file.path)
          if (disposed) return
          const model = monaco.editor.createModel(content, language)
          const editor = monaco.editor.create(host, { ...common, model })
          editorRef.current = editor
          const changeSub = model.onDidChangeContent(() => setDirty(true))
          // Ctrl+S while the editor is focused saves through the shared routine
          // (the app-level viewer-region Ctrl+S uses the same path via saveTick).
          editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            doSaveRef.current()
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
    // `theme` is intentionally not a dep: the setTheme effect below applies it
    // globally without recreating the editor (which would drop unsaved edits).
  }, [file, mode, editing, showPreview])

  // Follow the app theme without tearing down the editor: setTheme is global.
  // Guarded on `file` so we never load the (large) Monaco chunk — or touch
  // `window` in its async resolution — when the viewer is closed. Without this,
  // the import resolves after a test env is torn down (App renders a fileless
  // ViewerPane) and throws "window is not defined".
  useEffect(() => {
    if (!file) return
    let cancelled = false
    void import('../monaco-setup').then(({ monaco }) => {
      if (!cancelled) monaco.editor.setTheme(resolveMonacoTheme(theme))
    })
    return () => {
      cancelled = true
    }
  }, [file, theme])

  if (!file) return null

  return (
    <section className="viewer" data-testid="viewer-pane">
      <div className="viewer__tabs" role="tablist" aria-label="Open files" data-testid="viewer-tabs">
        {openFiles.files.map((of, i) => {
          const isActive = i === openFiles.activeIndex
          return (
            <div
              key={of.path}
              className={`viewer__tab${isActive ? ' viewer__tab--active' : ''}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={isActive}
                className="viewer__tab-label"
                title={of.path}
                onClick={() => setActiveFileIdx(i)}
              >
                {isActive && dirty && (
                  <span className="viewer__dirty" data-testid="viewer-dirty" title="unsaved changes">
                    ●{' '}
                  </span>
                )}
                {of.name}
              </button>
              <button
                type="button"
                className="viewer__tab-close"
                aria-label={`close ${of.name}`}
                onClick={() => closeFileTab(of.path)}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <header className="viewer__bar">
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
            className={`viewer__mode${
              mode === 'view' && !editing && !showPreview ? ' viewer__mode--on' : ''
            }`}
            onClick={() => {
              setMode('view')
              setEditing(false)
            }}
          >
            View
          </button>
          {isMarkdown(file.name) && (
            <button
              type="button"
              className={`viewer__mode${showPreview ? ' viewer__mode--on' : ''}`}
              data-testid="viewer-preview-toggle"
              title="Render this Markdown file"
              onClick={() => {
                setMode('view')
                setEditing(false)
                setPreview(true)
              }}
            >
              Preview
            </button>
          )}
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
      ) : showPreview ? (
        <MarkdownPreview file={file} />
      ) : (
        <div className="viewer__editor" ref={hostRef} data-testid="viewer-editor" />
      )}
    </section>
  )
}
