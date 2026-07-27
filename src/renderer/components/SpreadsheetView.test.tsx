import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react'
import { SpreadsheetView } from './SpreadsheetView'
import type { OpenFile } from '@core/workspace/open-files'
import type { SpreadsheetData } from '@shared/ipc/api-contract'

const readSpreadsheet = vi.fn<(path: string) => Promise<SpreadsheetData>>()

beforeEach(() => {
  readSpreadsheet.mockReset()
  Object.defineProperty(window, 'api', { value: { readSpreadsheet }, configurable: true })
})
afterEach(cleanup)

const file: OpenFile = { name: 'book.xlsx', path: '/p/book.xlsx' }

describe('SpreadsheetView', () => {
  it('renders the first sheet and switches sheets on tab click', async () => {
    readSpreadsheet.mockResolvedValueOnce({
      sheets: [
        { name: 'Alpha', rows: [['h'], ['a1']] },
        { name: 'Beta', rows: [['h'], ['b1']] }
      ],
      truncated: false
    })
    render(<SpreadsheetView file={file} />)
    await waitFor(() => expect(screen.getByText('a1')).toBeDefined())

    fireEvent.click(screen.getByRole('tab', { name: 'Beta' }))
    expect(screen.getByText('b1')).toBeDefined()
  })

  it('shows a truncation banner when the workbook was capped', async () => {
    readSpreadsheet.mockResolvedValueOnce({
      sheets: [{ name: 'S', rows: [['h'], ['x']] }],
      truncated: true
    })
    render(<SpreadsheetView file={file} />)
    await waitFor(() => expect(screen.getByText(/truncated view/i)).toBeDefined())
  })

  it('surfaces a parse/read error', async () => {
    readSpreadsheet.mockRejectedValueOnce(new Error('needs the "xlsx" package'))
    render(<SpreadsheetView file={file} />)
    await waitFor(() => expect(screen.getByText(/xlsx.*package/)).toBeDefined())
  })
})
