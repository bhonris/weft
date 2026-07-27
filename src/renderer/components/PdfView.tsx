import { fileUrl } from '@core/viewer/file-url'
import type { OpenFile } from '@core/workspace/open-files'

/**
 * Render a PDF through Chromium's built-in viewer by pointing an `<iframe>` at
 * the `weft-file://` byte protocol (content-type application/pdf routes it to
 * the plugin). No third-party PDF library.
 */
export function PdfView({ file }: { file: OpenFile }): React.ReactElement {
  return (
    <iframe
      className="viewer__pdf"
      data-testid="viewer-pdf"
      title={file.name}
      src={fileUrl(file.path)}
    />
  )
}
