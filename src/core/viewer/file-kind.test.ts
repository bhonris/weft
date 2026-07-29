import { describe, it, expect } from 'vitest'
import { viewerKindForFile, usesByteProtocol } from './file-kind'

describe('viewerKindForFile', () => {
  it('classifies images (raster + svg)', () => {
    for (const f of ['a.png', 'b.JPG', 'c.jpeg', 'd.gif', 'e.webp', 'f.bmp', 'g.ico', 'h.avif', 'i.svg']) {
      expect(viewerKindForFile(f)).toBe('image')
    }
  })

  it('classifies pdf', () => {
    expect(viewerKindForFile('report.pdf')).toBe('pdf')
    expect(viewerKindForFile('/docs/A.PDF')).toBe('pdf')
  })

  it('classifies spreadsheets and delimited text separately', () => {
    for (const f of ['book.xlsx', 'macro.xlsm', 'old.xls', 'bin.xlsb']) {
      expect(viewerKindForFile(f)).toBe('spreadsheet')
    }
    expect(viewerKindForFile('data.csv')).toBe('csv')
    expect(viewerKindForFile('data.tsv')).toBe('csv')
  })

  it('classifies audio and video', () => {
    expect(viewerKindForFile('song.mp3')).toBe('audio')
    expect(viewerKindForFile('voice.flac')).toBe('audio')
    expect(viewerKindForFile('clip.mp4')).toBe('video')
    expect(viewerKindForFile('screen.webm')).toBe('video')
  })

  it('classifies known-binary formats as binary (placeholder)', () => {
    for (const f of ['pkg.zip', 'app.exe', 'lib.dll', 'font.woff2', 'sheet.docx', 'data.sqlite']) {
      expect(viewerKindForFile(f)).toBe('binary')
    }
  })

  it('defaults unknown/textual files to text (never regresses text viewing)', () => {
    expect(viewerKindForFile('app.ts')).toBe('text')
    expect(viewerKindForFile('server.log')).toBe('text')
    expect(viewerKindForFile('README')).toBe('text')
    expect(viewerKindForFile('.gitignore')).toBe('text')
    expect(viewerKindForFile('mystery.zzz')).toBe('text')
  })
})

describe('usesByteProtocol', () => {
  it('is true for streamed media/document kinds', () => {
    expect(usesByteProtocol('image')).toBe(true)
    expect(usesByteProtocol('pdf')).toBe(true)
    expect(usesByteProtocol('audio')).toBe(true)
    expect(usesByteProtocol('video')).toBe(true)
  })

  it('is false for text/table/binary kinds', () => {
    expect(usesByteProtocol('text')).toBe(false)
    expect(usesByteProtocol('csv')).toBe(false)
    expect(usesByteProtocol('spreadsheet')).toBe(false)
    expect(usesByteProtocol('binary')).toBe(false)
  })
})
