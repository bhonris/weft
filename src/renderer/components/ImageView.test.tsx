import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { ImageView } from './ImageView'
import type { OpenFile } from '@core/workspace/open-files'

afterEach(cleanup)

const file: OpenFile = { name: 'shot.png', path: 'C:/p/shot.png' }

describe('ImageView', () => {
  it('points the img at the weft-file URL and toggles actual size', () => {
    render(<ImageView file={file} />)
    const img = screen.getByRole('img', { name: 'shot.png' }) as HTMLImageElement
    expect(img.getAttribute('src')).toBe('weft-file://f/C%3A/p/shot.png')
    expect(img.className).not.toContain('viewer__image--actual')

    fireEvent.click(screen.getByTestId('viewer-image-actual'))
    expect(
      (screen.getByRole('img', { name: 'shot.png' }) as HTMLImageElement).className
    ).toContain('viewer__image--actual')
  })

  it('shows an inline error when the image fails to load', () => {
    render(<ImageView file={file} />)
    fireEvent.error(screen.getByRole('img', { name: 'shot.png' }))
    expect(screen.getByText(/cannot load image/i)).toBeDefined()
  })
})
