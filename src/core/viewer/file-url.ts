/**
 * The custom `weft-file://` scheme the renderer uses as the `src`/`href` of
 * `<img>`, `<iframe>` (PDF), and `<audio>/<video>` elements so Chromium streams
 * the bytes (main serves them, guarded to open project roots). Both directions
 * live here, pure and unit-tested: the renderer builds the URL, main decodes it.
 *
 * URL shape: `weft-file://f/<percent-encoded-abs-path>`. The fixed host `f`
 * satisfies the standard-scheme URL parser; the absolute OS path (backslashes
 * normalised to `/`) is percent-encoded segment-by-segment so drive colons,
 * spaces, and unicode survive the round-trip.
 */
const SCHEME = 'weft-file'
const PREFIX = `${SCHEME}://f`

/** Build the `weft-file://` URL for an absolute OS path. */
export function fileUrl(absPath: string): string {
  const norm = absPath.replace(/\\/g, '/')
  const withSlash = norm.startsWith('/') ? norm : `/${norm}`
  const encoded = withSlash.split('/').map(encodeURIComponent).join('/')
  return `${PREFIX}${encoded}`
}

/**
 * Recover the absolute OS path from a `weft-file://` request URL, or null when
 * the URL isn't one of ours. A query/fragment is stripped; a leading slash
 * before a Windows drive letter (`/C:/…`) is removed so the result is a real
 * OS path.
 */
export function pathFromFileUrl(url: string): string | null {
  if (!url.startsWith(PREFIX)) return null
  let rest = url.slice(PREFIX.length)
  const cut = rest.search(/[?#]/)
  if (cut >= 0) rest = rest.slice(0, cut)
  let decoded: string
  try {
    decoded = decodeURIComponent(rest)
  } catch {
    return null
  }
  // `/C:/Users/...` → `C:/Users/...` on Windows; POSIX paths keep their slash.
  return /^\/[A-Za-z]:\//.test(decoded) ? decoded.slice(1) : decoded
}
