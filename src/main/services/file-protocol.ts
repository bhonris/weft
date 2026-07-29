import { basename } from 'node:path'
import { pathFromFileUrl } from '@core/viewer/file-url'
import { contentTypeForFile } from '@core/viewer/content-type'
import { isInsideAnyRoot } from '@core/fs/path-guard'

/**
 * Adapter behind the `weft-file://` scheme (registered in `container.ts` via
 * `protocol.handle`). Kept as a pure function of the request URL + injected
 * deps so it is unit-tested in node with fakes — no Electron, no real fs.
 *
 * Security: every decoded path is run through {@link isInsideAnyRoot} against
 * the open project roots, so the renderer can only ever fetch bytes for files
 * inside a project it already has open. Standard-scheme URL normalisation
 * collapses `..` before we see the URL; the guard is the authoritative check.
 */
export interface FileProtocolDeps {
  /** Absolute paths of the open project roots (the only servable directories). */
  getRoots: () => string[]
  /** Read a file's raw bytes (satisfied by fs.promises.readFile). */
  readFile: (path: string) => Promise<Uint8Array>
}

export async function handleFileRequest(
  url: string,
  deps: FileProtocolDeps
): Promise<Response> {
  const path = pathFromFileUrl(url)
  if (path === null) return new Response('bad request', { status: 400 })
  if (!isInsideAnyRoot(deps.getRoots(), path)) {
    return new Response('forbidden', { status: 403 })
  }
  try {
    const bytes = await deps.readFile(path)
    return new Response(bytes, {
      status: 200,
      headers: { 'content-type': contentTypeForFile(basename(path)) }
    })
  } catch {
    return new Response('not found', { status: 404 })
  }
}
