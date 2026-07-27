import { useState } from 'react'
import { fileUrl } from '@core/viewer/file-url'
import type { OpenFile } from '@core/workspace/open-files'

/**
 * Render an image file via the `weft-file://` byte protocol. Fit-to-pane by
 * default with an "Actual size" toggle; reports natural dimensions once loaded.
 * A load failure (missing file / 403) shows an inline error, never a broken glyph.
 */
export function ImageView({ file }: { file: OpenFile }): React.ReactElement {
  const [actualSize, setActualSize] = useState(false)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)
  const [failed, setFailed] = useState(false)

  return (
    <div className="viewer__media-pane" data-testid="viewer-image">
      <div className="viewer__media-bar">
        <button
          type="button"
          className={`viewer__mode${actualSize ? ' viewer__mode--on' : ''}`}
          onClick={() => setActualSize((v) => !v)}
          data-testid="viewer-image-actual"
        >
          {actualSize ? 'Fit' : 'Actual size'}
        </button>
        {dims && (
          <span className="viewer__media-meta">
            {dims.w} × {dims.h} px
          </span>
        )}
      </div>
      <div className="viewer__media-body viewer__media-body--checker">
        {failed ? (
          <div className="viewer__error">Cannot load image.</div>
        ) : (
          <img
            className={`viewer__image${actualSize ? ' viewer__image--actual' : ''}`}
            src={fileUrl(file.path)}
            alt={file.name}
            onLoad={(e) =>
              setDims({
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight
              })
            }
            onError={() => setFailed(true)}
          />
        )}
      </div>
    </div>
  )
}
