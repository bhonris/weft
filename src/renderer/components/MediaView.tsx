import { fileUrl } from '@core/viewer/file-url'
import type { OpenFile } from '@core/workspace/open-files'

/**
 * Play an audio or video file with the native `<audio>`/`<video>` controls,
 * streamed over the `weft-file://` byte protocol. Playback support is the
 * browser's (Chromium) — unsupported codecs surface the element's own error.
 */
export function MediaView({
  file,
  kind
}: {
  file: OpenFile
  kind: 'audio' | 'video'
}): React.ReactElement {
  const src = fileUrl(file.path)
  return (
    <div className="viewer__media-pane" data-testid="viewer-media">
      <div className="viewer__media-body">
        {kind === 'audio' ? (
          <audio className="viewer__audio" controls src={src} data-testid="viewer-audio" />
        ) : (
          <video className="viewer__video" controls src={src} data-testid="viewer-video" />
        )}
      </div>
    </div>
  )
}
