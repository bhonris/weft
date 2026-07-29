import { describe, it, expect } from 'vitest'
import { parseStatus, changeCount } from './porcelain'

/** Build a NUL-joined porcelain-v2 blob from record tokens (trailing NUL like git). */
const z = (...tokens: string[]): string => tokens.join('\0') + '\0'

describe('parseStatus — branch headers', () => {
  it('reads branch, upstream, and ahead/behind', () => {
    const out = parseStatus(
      z(
        '# branch.oid abc123',
        '# branch.head main',
        '# branch.upstream origin/main',
        '# branch.ab +2 -3'
      )
    )
    expect(out.branch).toBe('main')
    expect(out.upstream).toBe('origin/main')
    expect(out.ahead).toBe(2)
    expect(out.behind).toBe(3)
    expect(out.changes).toEqual([])
  })

  it('marks a detached HEAD and no upstream', () => {
    const out = parseStatus(z('# branch.head (detached)'))
    expect(out.branch).toBe('(detached)')
    expect(out.upstream).toBeNull()
    expect(out.ahead).toBe(0)
    expect(out.behind).toBe(0)
  })

  it('tolerates multiple headers joined by newlines in one token', () => {
    const out = parseStatus('# branch.head dev\n# branch.ab +1 -0\0')
    expect(out.branch).toBe('dev')
    expect(out.ahead).toBe(1)
    expect(out.behind).toBe(0)
  })

  it('returns an all-empty result for empty input', () => {
    expect(parseStatus('')).toEqual({
      branch: null,
      upstream: null,
      ahead: 0,
      behind: 0,
      changes: []
    })
  })
})

describe('parseStatus — ordinary changes', () => {
  it('classifies a staged-only modification (M.)', () => {
    const out = parseStatus(z('1 M. N... 100644 100644 100644 aaa bbb src/a.ts'))
    expect(out.changes).toEqual([{ rel: 'src/a.ts', group: 'staged', status: 'M' }])
  })

  it('classifies an unstaged-only modification (.M)', () => {
    const out = parseStatus(z('1 .M N... 100644 100644 100644 aaa bbb src/b.ts'))
    expect(out.changes).toEqual([{ rel: 'src/b.ts', group: 'unstaged', status: 'M' }])
  })

  it('emits BOTH staged and unstaged for MM', () => {
    const out = parseStatus(z('1 MM N... 100644 100644 100644 aaa bbb src/c.ts'))
    expect(out.changes).toEqual([
      { rel: 'src/c.ts', group: 'staged', status: 'M' },
      { rel: 'src/c.ts', group: 'unstaged', status: 'M' }
    ])
  })

  it('classifies a staged addition (A.)', () => {
    const out = parseStatus(z('1 A. N... 000000 100644 100644 000 bbb new.txt'))
    expect(out.changes).toEqual([{ rel: 'new.txt', group: 'staged', status: 'A' }])
  })

  it('classifies a staged deletion (D.)', () => {
    const out = parseStatus(z('1 D. N... 100644 000000 000000 aaa 000 gone.txt'))
    expect(out.changes).toEqual([{ rel: 'gone.txt', group: 'staged', status: 'D' }])
  })

  it('preserves spaces in paths', () => {
    const out = parseStatus(z('1 .M N... 100644 100644 100644 aaa bbb my docs/a b.md'))
    expect(out.changes[0]?.rel).toBe('my docs/a b.md')
  })

  it('maps copy (C) and typechange (T) status letters', () => {
    const copy = parseStatus(z('1 C. N... 100644 100644 100644 aaa bbb copied.ts'))
    expect(copy.changes[0]?.status).toBe('C')
    const typechange = parseStatus(z('1 .T N... 120000 100644 100644 aaa bbb link.ts'))
    expect(typechange.changes[0]?.status).toBe('T')
  })
})

describe('parseStatus — renames', () => {
  it('parses a staged rename and its original path from the following token', () => {
    const out = parseStatus(z('2 R. N... 100644 100644 100644 aaa bbb R100 new/name.ts', 'old/name.ts'))
    expect(out.changes).toEqual([
      { rel: 'new/name.ts', origRel: 'old/name.ts', group: 'staged', status: 'R' }
    ])
  })

  it('does not consume a following non-rename record as an origPath', () => {
    const out = parseStatus(
      z('2 R. N... 100644 100644 100644 aaa bbb R100 new.ts', 'old.ts', '? untracked.ts')
    )
    expect(out.changes).toEqual([
      { rel: 'new.ts', origRel: 'old.ts', group: 'staged', status: 'R' },
      { rel: 'untracked.ts', group: 'untracked', status: '?' }
    ])
  })
})

describe('parseStatus — untracked & conflicts', () => {
  it('classifies untracked files', () => {
    const out = parseStatus(z('? a.log', '? dir/b.tmp'))
    expect(out.changes).toEqual([
      { rel: 'a.log', group: 'untracked', status: '?' },
      { rel: 'dir/b.tmp', group: 'untracked', status: '?' }
    ])
  })

  it('classifies an unmerged (conflict) entry', () => {
    const out = parseStatus(z('u UU N... 100644 100644 100644 100644 aa bb cc conflict.ts'))
    expect(out.changes).toEqual([{ rel: 'conflict.ts', group: 'conflict', status: 'U' }])
  })

  it('ignores `!` (ignored) records', () => {
    const out = parseStatus(z('! node_modules/x.js', '? real.ts'))
    expect(out.changes).toEqual([{ rel: 'real.ts', group: 'untracked', status: '?' }])
  })
})

describe('changeCount', () => {
  it('counts distinct files (a staged+unstaged file counts once)', () => {
    const changes = [
      { rel: 'a.ts' },
      { rel: 'a.ts' },
      { rel: 'b.ts' },
      { rel: 'c.ts' }
    ]
    expect(changeCount(changes)).toBe(3)
  })

  it('is 0 for no changes', () => {
    expect(changeCount([])).toBe(0)
  })
})
