import { useEffect, useState } from 'react'
import { parseDelimited, delimiterForFile } from '@core/viewer/delimited'
import type { OpenFile } from '@core/workspace/open-files'
import { DataTable } from './DataTable'

/**
 * Read a CSV/TSV file's text (same 5 MB-guarded `readFileText` path as the
 * editor) and render it as a table. Delimiter is chosen from the extension;
 * parsing is the pure-core `parseDelimited`.
 */
export function CsvView({ file }: { file: OpenFile }): React.ReactElement {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setRows(null)
    setError(null)
    window.api
      .readFileText(file.path)
      .then((text) => {
        if (!cancelled) setRows(parseDelimited(text, delimiterForFile(file.name)))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [file.path, file.name])

  if (error) return <div className="viewer__error">Cannot open file: {error}</div>
  if (rows === null) return <div className="viewer__empty">Loading…</div>
  return <DataTable rows={rows} />
}
