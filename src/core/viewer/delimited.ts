import { extensionOf } from './file-language'

/** The delimiter for a delimited-text file: tab for `.tsv`, comma otherwise. */
export function delimiterForFile(name: string): string {
  return extensionOf(name) === 'tsv' ? '\t' : ','
}

/**
 * Parse delimited text (CSV/TSV) into a grid of string cells. RFC‑4180-ish:
 * fields may be double-quoted, a `""` inside a quoted field is a literal quote,
 * and quoted fields may contain the delimiter and newlines. Rows split on LF or
 * CRLF. A trailing newline does not produce a spurious empty final row.
 *
 * Pure and single-pass — no dependency, unit-tested. Ragged rows are returned
 * as-is (the renderer pads visually); the caller decides header treatment.
 */
export function parseDelimited(text: string, delimiter = ','): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const endField = (): void => {
    row.push(field)
    field = ''
  }
  const endRow = (): void => {
    endField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++ // consume the escaped quote
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === delimiter) {
      endField()
    } else if (ch === '\n') {
      endRow()
    } else if (ch === '\r') {
      // Swallow CR; a following LF ends the row, a lone CR also ends it.
      if (text[i + 1] === '\n') {
        endRow()
        i++
      } else {
        endRow()
      }
    } else {
      field += ch
    }
  }

  // Flush the final field/row unless the input ended exactly on a row boundary
  // (last char a newline → `field`/`row` already empty) or the input was empty.
  if (field.length > 0 || row.length > 0) endRow()
  return rows
}
