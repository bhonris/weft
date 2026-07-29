import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MediaView } from './MediaView'
import { PdfView } from './PdfView'
import type { OpenFile } from '@core/workspace/open-files'

afterEach(cleanup)

describe('MediaView / PdfView', () => {
  it('renders an <audio> element pointed at the weft-file URL', () => {
    const file: OpenFile = { name: 'song.mp3', path: '/p/song.mp3' }
    render(<MediaView file={file} kind="audio" />)
    const audio = screen.getByTestId('viewer-audio') as HTMLAudioElement
    expect(audio.getAttribute('src')).toBe('weft-file://f/p/song.mp3')
  })

  it('renders a <video> element for video kind', () => {
    const file: OpenFile = { name: 'clip.mp4', path: '/p/clip.mp4' }
    render(<MediaView file={file} kind="video" />)
    expect(screen.getByTestId('viewer-video')).toBeDefined()
  })

  it('renders a PDF iframe with the file as its title', () => {
    const file: OpenFile = { name: 'report.pdf', path: '/p/report.pdf' }
    render(<PdfView file={file} />)
    const frame = screen.getByTitle('report.pdf') as HTMLIFrameElement
    expect(frame.getAttribute('src')).toBe('weft-file://f/p/report.pdf')
  })
})
