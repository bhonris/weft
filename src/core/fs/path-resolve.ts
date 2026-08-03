/**
 * Resolve a path token clicked in the terminal to an absolute OS path, against
 * the tab's cwd. Pure string logic (no `node:path`, so it runs in the renderer),
 * separator-aware like {@link ./path-guard}. Absolute tokens (Windows drive or
 * POSIX/`\`-rooted) pass through with `.`/`..` collapsed; relative tokens are
 * joined onto `cwd`. The result uses the base's separator style (the cwd's, for
 * relative tokens) so it round-trips cleanly with `isPathInside` and the OS.
 */
function isWindowsAbsolute(token: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(token)
}

function isRootedAbsolute(token: string): boolean {
  return /^[\\/]/.test(token)
}

export function resolveClickedPath(cwd: string, token: string): string {
  const absolute = isWindowsAbsolute(token) || isRootedAbsolute(token)
  const base = absolute ? token : cwd
  const source = absolute ? token : `${cwd}/${token}`

  // Normalize to `/`, peel off a drive (`C:`) or root (`/`) prefix, then collapse
  // `.`/`..` segments over the remainder.
  const norm = source.replace(/\\/g, '/')
  let prefix = ''
  let rest = norm
  const drive = /^([A-Za-z]:)\//.exec(norm)
  if (drive) {
    prefix = `${drive[1]}/`
    rest = norm.slice(drive[0].length)
  } else if (norm.startsWith('/')) {
    prefix = '/'
    rest = norm.slice(1)
  }

  // A drive-rooted path is Windows → backslashes, even when the token used
  // forward slashes; otherwise follow the base's separator style.
  const sep = drive || base.includes('\\') ? '\\' : '/'

  const segs: string[] = []
  for (const s of rest.split('/')) {
    if (s === '' || s === '.') continue
    if (s === '..') {
      if (segs.length > 0) segs.pop()
      continue
    }
    segs.push(s)
  }

  const joined = prefix + segs.join('/')
  return sep === '\\' ? joined.replace(/\//g, '\\') : joined
}
