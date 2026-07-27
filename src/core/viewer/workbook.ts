import type { SpreadsheetData } from '@shared/ipc/api-contract'

/**
 * A raw worksheet as produced by the parser (SheetJS `sheet_to_json` with
 * `header: 1`): a name plus rows of arbitrary cell values. `shapeWorkbook`
 * turns these into the contract's string grid, capped so a monster workbook
 * can't freeze the renderer.
 */
export interface RawSheet {
  name: string
  rows: unknown[][]
}

export interface WorkbookLimits {
  maxRows: number
  maxCols: number
  maxSheets: number
}

/** Generous caps — big enough to be useful, small enough to stay responsive. */
export const DEFAULT_WORKBOOK_LIMITS: WorkbookLimits = {
  maxRows: 5000,
  maxCols: 200,
  maxSheets: 50
}

/** Stringify one cell; null/undefined become empty, everything else `String()`. */
function cellToString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * Cap sheets/rows/cols and stringify every cell, tracking whether any cap was
 * hit so the UI can show a "truncated" note. Pure and unit-tested.
 */
export function shapeWorkbook(
  sheets: RawSheet[],
  limits: WorkbookLimits = DEFAULT_WORKBOOK_LIMITS
): SpreadsheetData {
  let truncated = sheets.length > limits.maxSheets
  const out = sheets.slice(0, limits.maxSheets).map((sheet) => {
    let rows = sheet.rows
    if (rows.length > limits.maxRows) {
      rows = rows.slice(0, limits.maxRows)
      truncated = true
    }
    const shaped = rows.map((row) => {
      let cells = row
      if (cells.length > limits.maxCols) {
        cells = cells.slice(0, limits.maxCols)
        truncated = true
      }
      return cells.map(cellToString)
    })
    return { name: sheet.name, rows: shaped }
  })
  return { sheets: out, truncated }
}
