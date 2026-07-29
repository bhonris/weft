import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { UnsupportedView } from './UnsupportedView'
import type { OpenFile } from '@core/workspace/open-files'

const openWithDefault = vi.fn(async () => {})
const revealInOs = vi.fn(async () => {})

beforeEach(() => {
  openWithDefault.mockClear()
  revealInOs.mockClear()
  Object.defineProperty(window, 'api', {
    value: { openWithDefault, revealInOs },
    configurable: true
  })
})
afterEach(cleanup)

const file: OpenFile = { name: 'archive.zip', path: '/p/archive.zip' }

describe('UnsupportedView', () => {
  it('names the file and offers the OS handlers', () => {
    render(<UnsupportedView file={file} />)
    expect(screen.getByText('archive.zip')).toBeDefined()

    fireEvent.click(screen.getByText('Open with default app'))
    expect(openWithDefault).toHaveBeenCalledWith('/p/archive.zip')

    fireEvent.click(screen.getByText('Reveal in folder'))
    expect(revealInOs).toHaveBeenCalledWith('/p/archive.zip')
  })
})
