import { describe, it, expect } from 'vitest'
import { shapeWorkbook, type RawSheet } from './workbook'

describe('shapeWorkbook', () => {
  it('stringifies cells and preserves sheet order', () => {
    const raw: RawSheet[] = [
      { name: 'S1', rows: [['a', 1, true], [null, undefined, 2.5]] }
    ]
    expect(shapeWorkbook(raw)).toEqual({
      sheets: [{ name: 'S1', rows: [['a', '1', 'true'], ['', '', '2.5']] }],
      truncated: false
    })
  })

  it('caps rows and flags truncation', () => {
    const rows = Array.from({ length: 5 }, (_, i) => [i])
    const out = shapeWorkbook([{ name: 'S', rows }], { maxRows: 2, maxCols: 10, maxSheets: 10 })
    expect(out.truncated).toBe(true)
    expect(out.sheets[0]!.rows).toEqual([['0'], ['1']])
  })

  it('caps columns and flags truncation', () => {
    const out = shapeWorkbook([{ name: 'S', rows: [[1, 2, 3, 4]] }], {
      maxRows: 10,
      maxCols: 2,
      maxSheets: 10
    })
    expect(out.truncated).toBe(true)
    expect(out.sheets[0]!.rows).toEqual([['1', '2']])
  })

  it('caps sheets and flags truncation', () => {
    const raw: RawSheet[] = [
      { name: 'A', rows: [] },
      { name: 'B', rows: [] },
      { name: 'C', rows: [] }
    ]
    const out = shapeWorkbook(raw, { maxRows: 10, maxCols: 10, maxSheets: 2 })
    expect(out.truncated).toBe(true)
    expect(out.sheets.map((s) => s.name)).toEqual(['A', 'B'])
  })

  it('reports no truncation when within limits', () => {
    expect(shapeWorkbook([{ name: 'S', rows: [['x']] }]).truncated).toBe(false)
  })
})
