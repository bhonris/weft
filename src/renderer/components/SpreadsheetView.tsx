import { useEffect, useState } from 'react'
import type { SpreadsheetData } from '@shared/ipc/api-contract'
import type { OpenFile } from '@core/workspace/open-files'
import { DataTable } from './DataTable'

/**
 * Render a parsed workbook (xlsx/xls) as a table with a sheet switcher. Parsing
 * happens in main (SheetJS) via `readSpreadsheet`; this view only picks a sheet
 * and renders. A "truncated" banner appears when row/col/sheet caps were hit.
 */
export function SpreadsheetView({ file }: { file: OpenFile }): React.ReactElement {
  const [data, setData] = useState<SpreadsheetData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sheetIdx, setSheetIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    setSheetIdx(0)
    window.api
      .readSpreadsheet(file.path)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [file.path])

  if (error) return <div className="viewer__error">Cannot open spreadsheet: {error}</div>
  if (data === null) return <div className="viewer__empty">Loading…</div>
  if (data.sheets.length === 0) {
    return <div className="viewer__empty">This workbook has no sheets.</div>
  }

  const active = Math.min(sheetIdx, data.sheets.length - 1)
  const sheet = data.sheets[active]!

  return (
    <div className="viewer__sheet-pane" data-testid="viewer-spreadsheet">
      {data.sheets.length > 1 && (
        <div className="viewer__sheet-tabs" role="tablist" aria-label="Sheets">
          {data.sheets.map((s, i) => (
            <button
              key={s.name + i}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`viewer__sheet-tab${i === active ? ' viewer__sheet-tab--active' : ''}`}
              onClick={() => setSheetIdx(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {data.truncated && (
        <div className="viewer__truncated" role="status">
          Large workbook — showing a truncated view. Open with the default app for the full file.
        </div>
      )}
      <DataTable rows={sheet.rows} />
    </div>
  )
}
