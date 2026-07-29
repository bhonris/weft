import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { DataTable } from './DataTable'

afterEach(cleanup)

describe('DataTable', () => {
  it('renders the first row as header and the rest as body with a row gutter', () => {
    render(<DataTable rows={[['Name', 'Age'], ['Ada', '36'], ['Alan', '41']]} />)
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeDefined()
    expect(screen.getByRole('columnheader', { name: 'Age' })).toBeDefined()
    expect(screen.getByText('Ada')).toBeDefined()
    // Row-number gutter cells (1, 2) plus the data.
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('pads ragged rows to the widest row', () => {
    render(<DataTable rows={[['a'], ['x', 'y', 'z']]} />)
    // Header row has 3 data columns + gutter = 4 cells.
    const headerCells = screen.getAllByRole('columnheader')
    expect(headerCells).toHaveLength(4)
  })

  it('shows an empty message for no rows', () => {
    render(<DataTable rows={[]} />)
    expect(screen.getByText(/no rows/i)).toBeDefined()
  })
})
