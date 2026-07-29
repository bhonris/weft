# Rich file viewer — images, PDF, spreadsheets, CSV, media

## Feature specification

Today weft's viewer is text-only: every file the explorer / quick-open opens is
read as UTF‑8 and shown in Monaco (view / edit / diff / Markdown preview). Open a
PNG, a PDF, or an `.xlsx` and you get garbage bytes or a read error.

This feature makes the viewer **format-aware**. A file is classified into a
*viewer kind* and rendered with the right surface:

| Kind          | Extensions (examples)                              | Surface |
|---------------|----------------------------------------------------|---------|
| `text`        | code, config, logs, unknown (default)              | Monaco (unchanged) |
| `image`       | png jpg jpeg gif webp bmp ico avif apng svg        | `<img>` (fit / actual-size) |
| `pdf`         | pdf                                                | `<iframe>` → Chromium's built-in PDF viewer |
| `spreadsheet` | xlsx xlsm xlsb xls                                 | HTML table with a sheet switcher |
| `csv`         | csv tsv                                             | HTML table (parsed in pure core) |
| `audio`       | mp3 wav ogg oga opus flac m4a aac                  | `<audio controls>` |
| `video`       | mp4 webm ogv mov m4v mkv                           | `<video controls>` |
| `binary`      | zip exe dll woff docx … (curated known-binary set) | "No preview" placeholder |

Bytes for image/pdf/media are served over a **custom `weft-file://` scheme**
registered in main (path-guarded to open project roots) rather than shovelled
through IPC as base64 — Chromium streams them and renders PDFs natively.
Spreadsheets are parsed in main (SheetJS) and returned as structured JSON.

## Scope & out of scope

**In scope:** classification; the `weft-file://` byte protocol; image/pdf/media
views; CSV/TSV table; xlsx/xls table (read-only); graceful placeholder for
unsupported binaries; toolbar that adapts per kind; CSP extension.

**Out of scope (this pass):** editing any non-text format; writing spreadsheets;
`.docx`/`.pptx` rendering (they fall to the placeholder); image editing/annotation;
virtualized rendering of enormous sheets (we cap rows/cols/sheets instead);
thumbnails in the explorer tree; syntax-aware SVG source editing (SVG renders as
an image now — open-with-default for the source).

## User stories

- As a developer reviewing what Claude generated, I want to open a screenshot or
  a generated chart **inside weft** so I don't have to leave the app.
- As an analyst, I want to open an `.xlsx`/`.csv` and read it as a table so I can
  sanity-check data a session produced.
- As a user, I want a PDF to render in-app rather than failing to open.
- As a user, when I open something weft can't preview (a `.zip`, a `.docx`), I
  want a clear "no preview — open in your default app / reveal in folder" panel,
  never a screen of mojibake.

## Acceptance criteria

- [ ] Opening a raster image, an SVG, or a PDF renders it (no Monaco, no error).
- [ ] Opening a `.csv`/`.tsv` shows a table with correct columns for quoted
      fields, embedded delimiters, and CRLF/LF rows.
- [ ] Opening an `.xlsx`/`.xls` shows its sheets; switching sheets works; very
      large sheets are capped with a visible "truncated" note.
- [ ] Opening `.mp3`/`.mp4` (and siblings) yields working playback controls.
- [ ] Opening an unsupported binary shows the placeholder with working
      "Open with default app" and "Reveal" actions.
- [ ] Text files behave exactly as before (view / edit / diff / Markdown preview).
- [ ] The byte protocol refuses paths outside any open project root (403).
- [ ] Renderer reload never loads a file outside a project root; no CSP violation
      in the console for any supported kind.
- [ ] Unit coverage stays ≥ the gate (95/90); new pure logic fully covered.

## Architecture & technical design

Follows the layer boundary — the *decision* is pure and tested; main is a thin
adapter; the renderer is a view.

- **`src/core/viewer/`** (pure, unit-tested)
  - `file-kind.ts` — `viewerKindForFile(name): ViewerKind` + the extension sets;
    exports `extensionOf` (shared with `file-language.ts`).
  - `content-type.ts` — `contentTypeForFile(name)` for the protocol response.
  - `file-url.ts` — `fileUrl(absPath)` (renderer builds the `weft-file://` URL)
    and `pathFromFileUrl(url)` (main decodes it). One module, both directions,
    one test.
  - `delimited.ts` — `delimiterForFile(name)` + `parseDelimited(text, delim)`
    (RFC‑4180-ish: quotes, `""` escapes, embedded delimiters/newlines).
  - `workbook.ts` — `shapeWorkbook(rawSheets, limits)` caps rows/cols/sheets and
    stringifies cells; returns `SpreadsheetData` + a `truncated` flag.
- **`src/main/`**
  - `services/file-protocol.ts` — `handleFileRequest(url, deps)` → `Response`;
    decodes the URL, guards it with `isInsideAnyRoot`, streams bytes with the
    right content-type. Testable in node (fake `readFile`/roots).
  - `services/spreadsheet-service.ts` — `SpreadsheetService(fs, parse, limits)`;
    size-guards, reads bytes, delegates parsing to an **injected** `parse`
    (SheetJS is wired only in `container.ts`), shapes via `shapeWorkbook`.
  - `ipc/register-fs.ts` — new `readSpreadsheet` handler (path-guarded to roots).
  - `container.ts` — registers `protocol.handle('weft-file', …)`, wires the real
    SheetJS parser (isolated dynamic import so build/typecheck/units don't depend
    on the package), constructs `SpreadsheetService`.
  - `index.ts` — `protocol.registerSchemesAsPrivileged` (standard/secure/stream/
    supportFetchAPI) **before** `app.whenReady` (required by Electron).
- **`src/shared/`** — `channels.ts` (`readSpreadsheet`), `api-contract.ts`
  (`Sheet`, `SpreadsheetData`, `readSpreadsheet` on `WeftApi` + the `Pick`).
- **`src/preload/create-bridge.ts`** — `readSpreadsheet`.
- **`src/renderer/`**
  - `ViewerPane.tsx` — dispatches on `viewerKindForFile(file.name)`; the text
    path is unchanged; the toolbar hides Edit/Diff/Preview for non-text kinds.
  - New components: `ImageView`, `PdfView`, `MediaView`, `CsvTableView`,
    `SpreadsheetView`, `UnsupportedView`.
  - `styles.css` — styles for the new surfaces.

Data flow (binary): explorer/quick-open → `openFile` → `ViewerPane` picks kind →
`fileUrl(path)` as `<img>/<iframe>/<audio>` src → Chromium fetches `weft-file://`
→ main `handleFileRequest` guards + streams. Data flow (spreadsheet): `ViewerPane`
→ `window.api.readSpreadsheet(path)` → main service → `SpreadsheetData` → table.

## API contract

New IPC: `readSpreadsheet(path: string): Promise<SpreadsheetData>`
(channel `fs:read-spreadsheet`). Rejects on non-string arg, on paths outside an
open root, and on oversize/parse failure. `SpreadsheetData = { sheets: { name,
rows: string[][] }[]; truncated: boolean }`.

New URL scheme (not IPC): `weft-file://f/<percent-encoded-abs-path>` → streamed
file bytes; 400 (bad url) / 403 (outside roots) / 404 (missing).

## Database changes

None. No schema/persistence changes (viewer state is not persisted).

## UI/UX considerations

- Image: centered on a checkerboard, fit-to-pane by default with an
  "Actual size" toggle; shows natural dimensions.
- PDF: fills the pane via the native viewer.
- Table (csv/xlsx): sticky header row, horizontal scroll, sheet tabs for xlsx,
  a "truncated" banner when caps hit.
- Placeholder / media: centered, themed, keyboard-reachable buttons.
- All surfaces follow the app theme and the `img-src/media-src/frame-src` CSP.
- Errors render in the existing `viewer__error` region, never as raw bytes.

## Security considerations

- The protocol scheme is **not** `bypassCSP`; every path is run through
  `isInsideAnyRoot` (same guard as fs writes) so it can only serve files under an
  open project. Standard-scheme URL normalization collapses `..` before we see it.
- `readSpreadsheet` is path-guarded identically.
- SheetJS parses only local, user-opened files; we pin the CVE-patched build from
  the official SheetJS CDN (npm's `xlsx@0.18.5` carries CVE‑2023‑30533). Parsing
  runs in main, never the renderer.
- Size caps: 5 MB stays for text; 25 MB for spreadsheets; images/pdf/media stream
  (no whole-file buffer in the renderer).

## Performance considerations

- Bytes stream over the protocol — no base64 IPC copies for large media/PDF.
- Spreadsheets capped (default 5000 rows × 200 cols × 50 sheets) so a monster
  workbook can't freeze the renderer; the cap is reported, not silent.
- CSV parsing is O(n) single-pass.

## Edge cases & error handling

- Path outside roots → 403 / IPC rejection → viewer error panel.
- Missing file mid-render → 404 → broken-image / error handled per surface.
- Empty CSV → empty table (no crash). Ragged rows → cells padded per-row as-is.
- xls (legacy BIFF) supported by SheetJS; `.docx`/`.pptx` → `binary` placeholder.
- SheetJS not installed → `readSpreadsheet` rejects with an actionable message;
  every other kind still works.
- SVG renders as an image (no script execution in `<img>` context).

## Testing strategy

- **Unit (pure core):** `file-kind`, `content-type`, `file-url` round-trip,
  `parseDelimited` (quotes/escapes/newlines/tsv), `shapeWorkbook` (caps/flag).
- **Unit (main):** `handleFileRequest` (ok/400/403/404, content-type),
  `SpreadsheetService` (size guard, delegates parse, shapes), `register-fs`
  readSpreadsheet handler (guard + delegate).
- **Unit (preload):** bridge `readSpreadsheet` invoke.
- **Unit (renderer, jsdom):** `CsvTableView`, `UnsupportedView`, `MediaView`,
  `ImageView` (src = fileUrl), and `ViewerPane` kind dispatch (non-Monaco paths).
- **E2E:** open a fixture image/pdf/csv from the explorer; assert the right
  surface renders and text files are unaffected.

## Dependencies

- SheetJS `xlsx` (CVE-patched, from the SheetJS CDN tarball). Isolated behind an
  injected parser so build/typecheck/units don't import it.

## Migration & rollback plan

Additive. No persisted state changes. Rollback = revert the branch; text viewing
is untouched.

## Open questions

- Should SVG offer a "view source" toggle later? (Deferred; open-with-default for now.)
- Worth an in-tree image thumbnail later? (Out of scope.)

## Todo

- [x] core: file-kind, content-type, file-url, delimited, workbook (+ tests)
- [x] shared: channels + api-contract types
- [x] main: file-protocol, spreadsheet-service, register-fs handler (+ tests)
- [x] main: container protocol registration + SheetJS wiring; index privileged scheme
- [x] preload: bridge readSpreadsheet (+ test); CSP in index.html
- [x] renderer: ViewerPane dispatch + kind components + styles (+ tests)
- [x] typecheck clean; 833 unit tests pass; coverage 98.95%/96.49%/97.42%/98.95% (≥ gate)
- [x] e2e `rich-viewer.spec.ts` green (image protocol round-trip, CSV table, placeholder)
- [ ] **install SheetJS** (`pnpm add https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) —
      the only step left; every other kind already works. Verify an `.xlsx`
      renders, then move this doc to `documents/completed/`.
