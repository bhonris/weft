import { describe, it, expect, vi } from 'vitest'
import { handleFileRequest } from './file-protocol'
import { fileUrl } from '@core/viewer/file-url'

const ROOT = 'C:/proj'

const deps = (readFile: (p: string) => Promise<Uint8Array>) => ({
  getRoots: () => [ROOT],
  readFile: vi.fn(readFile)
})

describe('handleFileRequest', () => {
  it('serves bytes with the right content-type for a file inside a root', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const d = deps(async () => bytes)
    const res = await handleFileRequest(fileUrl('C:/proj/pics/a.png'), d)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes)
    expect(d.readFile).toHaveBeenCalledWith('C:/proj/pics/a.png')
  })

  it('rejects a malformed (non-weft) URL with 400', async () => {
    const d = deps(async () => new Uint8Array())
    const res = await handleFileRequest('https://evil/a.png', d)
    expect(res.status).toBe(400)
    expect(d.readFile).not.toHaveBeenCalled()
  })

  it('refuses a path outside every open root with 403', async () => {
    const d = deps(async () => new Uint8Array())
    const res = await handleFileRequest(fileUrl('C:/secret/passwords.png'), d)
    expect(res.status).toBe(403)
    expect(d.readFile).not.toHaveBeenCalled()
  })

  it('returns 404 when the file cannot be read', async () => {
    const d = deps(async () => {
      throw Object.assign(new Error('nope'), { code: 'ENOENT' })
    })
    const res = await handleFileRequest(fileUrl('C:/proj/missing.png'), d)
    expect(res.status).toBe(404)
  })
})
