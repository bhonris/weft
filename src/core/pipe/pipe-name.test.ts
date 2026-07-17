import { describe, it, expect } from 'vitest'
import { statusEndpointPath } from './pipe-name'

describe('statusEndpointPath', () => {
  it('builds a Windows named-pipe path', () => {
    expect(statusEndpointPath('win32', 'abc123', 'C:/tmp')).toBe('\\\\.\\pipe\\weft-status-abc123')
  })

  it('builds a POSIX UDS path under the runtime dir', () => {
    expect(statusEndpointPath('linux', 'abc123', '/run/user/1000')).toBe(
      '/run/user/1000/weft-status-abc123.sock'
    )
  })

  it('strips trailing slashes and unsafe characters', () => {
    expect(statusEndpointPath('darwin', 'a/b..c!', '/tmp///')).toBe('/tmp/weft-status-abc.sock')
  })
})
