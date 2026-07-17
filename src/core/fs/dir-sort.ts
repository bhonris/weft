import type { DirEntry } from '@shared/ipc/api-contract'

/** Directory names ignored by default in the explorer tree. */
export const DEFAULT_IGNORES: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  '.hg',
  '.svn'
])

/** True when an entry should be hidden from the tree by default. */
export function isIgnored(name: string, ignores: ReadonlySet<string> = DEFAULT_IGNORES): boolean {
  return ignores.has(name)
}

/**
 * Sort directory entries the way an explorer expects: directories first, then
 * files, each group case-insensitively alphabetical. Symlinks sort with files.
 * Pure and stable — the ordering is unit-tested independent of any filesystem.
 */
export function sortEntries(entries: readonly DirEntry[]): DirEntry[] {
  return [...entries].sort((a, b) => {
    const aDir = a.kind === 'dir'
    const bDir = b.kind === 'dir'
    if (aDir !== bDir) return aDir ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })
}
