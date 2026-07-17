import { describe, it, expect, vi } from 'vitest'
import { resolveBinary } from './resolve-binary'
import type { ExecFn } from './diff-service'

describe('resolveBinary', () => {
  it('resolves a bare name via where.exe on Windows (first hit wins)', async () => {
    const exec: ExecFn = vi.fn(async (file, args) => {
      expect(file).toBe('where.exe')
      expect(args).toEqual(['claude'])
      return { stdout: 'C:\\Users\\me\\.local\\bin\\claude.exe\r\nC:\\other\\claude.exe\r\n' }
    })
    expect(await resolveBinary('claude', exec, 'win32')).toBe(
      'C:\\Users\\me\\.local\\bin\\claude.exe'
    )
  })

  it('uses which on POSIX', async () => {
    const exec: ExecFn = vi.fn(async (file) => {
      expect(file).toBe('which')
      return { stdout: '/usr/local/bin/claude\n' }
    })
    expect(await resolveBinary('claude', exec, 'linux')).toBe('/usr/local/bin/claude')
  })

  it('passes explicit paths through untouched', async () => {
    const exec = vi.fn() as unknown as ExecFn
    expect(await resolveBinary('C:\\custom\\claude.exe', exec, 'win32')).toBe(
      'C:\\custom\\claude.exe'
    )
    expect(await resolveBinary('./bin/claude', exec, 'linux')).toBe('./bin/claude')
    expect(exec).not.toHaveBeenCalled()
  })

  it('returns the name unchanged when lookup fails (missing binary keeps its honest error)', async () => {
    const exec: ExecFn = vi.fn(async () => {
      throw new Error('INFO: Could not find files')
    })
    expect(await resolveBinary('claude', exec, 'win32')).toBe('claude')
  })

  it('returns the name unchanged on empty lookup output', async () => {
    const exec: ExecFn = vi.fn(async () => ({ stdout: '\n' }))
    expect(await resolveBinary('claude', exec, 'win32')).toBe('claude')
  })
})
