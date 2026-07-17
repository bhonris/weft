import type { ExecFn } from './diff-service'

/**
 * Resolve a bare command name to an absolute executable path.
 *
 * node-pty/ConPTY does NOT perform shell-style PATH + PATHEXT resolution —
 * spawning the bare name `claude` fails with "File not found" even when
 * `claude.exe` is on PATH. So main resolves once via the OS lookup tool
 * (`where.exe` on Windows, `which` elsewhere) and spawns the full path.
 * On lookup failure the name is returned unchanged, so the spawn-error
 * banner still reports the genuinely-missing case.
 */
export async function resolveBinary(
  name: string,
  exec: ExecFn,
  platform: string = process.platform
): Promise<string> {
  // Absolute or relative paths (or names with extensions) pass through.
  if (/[\\/]/.test(name)) return name
  try {
    const tool = platform === 'win32' ? 'where.exe' : 'which'
    const { stdout } = await exec(tool, [name], { cwd: '.' })
    const first = stdout
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find((l) => l.length > 0)
    return first ?? name
  } catch {
    return name
  }
}
