import { describe, it, expect } from 'vitest'
import { contentTypeForFile } from './content-type'

describe('contentTypeForFile', () => {
  it('maps images', () => {
    expect(contentTypeForFile('a.png')).toBe('image/png')
    expect(contentTypeForFile('a.JPG')).toBe('image/jpeg')
    expect(contentTypeForFile('a.svg')).toBe('image/svg+xml')
    expect(contentTypeForFile('a.webp')).toBe('image/webp')
  })

  it('maps pdf and media', () => {
    expect(contentTypeForFile('doc.pdf')).toBe('application/pdf')
    expect(contentTypeForFile('s.mp3')).toBe('audio/mpeg')
    expect(contentTypeForFile('v.mp4')).toBe('video/mp4')
    expect(contentTypeForFile('v.webm')).toBe('video/webm')
  })

  it('falls back to octet-stream for the unknown', () => {
    expect(contentTypeForFile('a.bin')).toBe('application/octet-stream')
    expect(contentTypeForFile('README')).toBe('application/octet-stream')
  })
})
