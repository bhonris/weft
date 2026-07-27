/**
 * Render a grid of string cells as an HTML table with a sticky header row (the
 * first row). Shared by the CSV and spreadsheet viewers. Purely presentational
 * and jsdom-testable.
 */
export function DataTable({ rows }: { rows: string[][] }): React.ReactElement {
  if (rows.length === 0) {
    return <div className="viewer__empty">This file has no rows.</div>
  }
  const [header, ...body] = rows
  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0)
  const cols = Array.from({ length: columnCount })

  return (
    <div className="viewer__table-wrap" data-testid="viewer-table">
      <table className="viewer__table">
        <thead>
          <tr>
            <th className="viewer__table-gutter" scope="col" aria-label="row number" />
            {cols.map((_, c) => (
              <th key={c} scope="col">
                {header?.[c] ?? ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, r) => (
            <tr key={r}>
              <td className="viewer__table-gutter">{r + 1}</td>
              {cols.map((_, c) => (
                <td key={c}>{row[c] ?? ''}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
