import { describe, it, expect, vi } from 'vitest'
import {
  SpreadsheetService,
  MAX_SPREADSHEET_BYTES,
  type SpreadsheetFsLike
} from './spreadsheet-service'
import type { RawSheet } from '@core/viewer/workbook'

const fakeFs = (size: number, bytes = new Uint8Array([9])): SpreadsheetFsLike => ({
  stat: async () => ({ size }),
  readFile: async () => bytes
})

describe('SpreadsheetService', () => {
  it('reads, parses via the injected parser, and shapes the workbook', async () => {
    const parse = vi.fn(
      (): RawSheet[] => [{ name: 'Sheet1', rows: [['h', 1], ['a', 2]] }]
    )
    const svc = new SpreadsheetService(fakeFs(100), parse)
    const out = await svc.read('C:/proj/book.xlsx')
    expect(parse).toHaveBeenCalledOnce()
    expect(out).toEqual({
      sheets: [{ name: 'Sheet1', rows: [['h', '1'], ['a', '2']] }],
      truncated: false
    })
  })

  it('applies injected caps (truncation flag)', async () => {
    const parse = (): RawSheet[] => [{ name: 'S', rows: [[1], [2], [3]] }]
    const svc = new SpreadsheetService(fakeFs(100), parse, {
      maxRows: 1,
      maxCols: 10,
      maxSheets: 10
    })
    const out = await svc.read('C:/proj/book.xlsx')
    expect(out.truncated).toBe(true)
    expect(out.sheets[0]!.rows).toEqual([['1']])
  })

  it('rejects an oversize workbook before parsing', async () => {
    const parse = vi.fn((): RawSheet[] => [])
    const svc = new SpreadsheetService(fakeFs(MAX_SPREADSHEET_BYTES + 1), parse)
    await expect(svc.read('C:/proj/huge.xlsx')).rejects.toThrow(/too large/)
    expect(parse).not.toHaveBeenCalled()
  })
})
