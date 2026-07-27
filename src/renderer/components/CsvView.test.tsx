import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { CsvView } from './CsvView'
import type { OpenFile } from '@core/workspace/open-files'

const readFileText = vi.fn<(path: string) => Promise<string>>()

beforeEach(() => {
  readFileText.mockReset()
  Object.defineProperty(window, 'api', { value: { readFileText }, configurable: true })
})
afterEach(cleanup)

const file = (name: string): OpenFile => ({ name, path: `/p/${name}` })

describe('CsvView', () => {
  it('reads and renders a CSV as a table', async () => {
    readFileText.mockResolvedValueOnce('a,b\nfoo,bar')
    render(<CsvView file={file('data.csv')} />)
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'a' })).toBeDefined())
    expect(screen.getByText('foo')).toBeDefined()
    expect(screen.getByText('bar')).toBeDefined()
    expect(readFileText).toHaveBeenCalledWith('/p/data.csv')
  })

  it('splits TSV on tabs', async () => {
    readFileText.mockResolvedValueOnce('a\tb\n1\t2')
    render(<CsvView file={file('data.tsv')} />)
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'a' })).toBeDefined())
    expect(screen.getByRole('columnheader', { name: 'b' })).toBeDefined()
  })

  it('shows an error when the read fails', async () => {
    readFileText.mockRejectedValueOnce(new Error('too large'))
    render(<CsvView file={file('big.csv')} />)
    await waitFor(() => expect(screen.getByText(/too large/)).toBeDefined())
  })
})
