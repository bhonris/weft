import type { OpenFile } from '@core/workspace/open-files'

/**
 * Placeholder for files weft can't preview in-app (archives, executables,
 * office docs, unknown binaries). Never dumps bytes — offers the OS handlers
 * instead so the file is still one click from being useful.
 */
export function UnsupportedView({ file }: { file: OpenFile }): React.ReactElement {
  return (
    <div className="viewer__unsupported" data-testid="viewer-unsupported">
      <p className="viewer__unsupported-title">No in-app preview for this file type.</p>
      <p className="viewer__unsupported-name">{file.name}</p>
      <div className="viewer__unsupported-actions">
        <button
          type="button"
          className="viewer__mode"
          onClick={() => void window.api.openWithDefault(file.path)}
        >
          Open with default app
        </button>
        <button
          type="button"
          className="viewer__mode"
          onClick={() => void window.api.revealInOs(file.path)}
        >
          Reveal in folder
        </button>
      </div>
    </div>
  )
}
