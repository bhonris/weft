import { extensionOf } from './file-language'

/**
 * Pure filename → viewer-surface decision. The renderer's `ViewerPane` switches
 * on this to pick a rendering surface; main uses the same extension sets for the
 * byte protocol's content-type. Kept out of the renderer so it is unit-tested
 * and the adapters stay thin.
 */
export type ViewerKind =
  | 'text'
  | 'image'
  | 'pdf'
  | 'spreadsheet'
  | 'csv'
  | 'audio'
  | 'video'
  | 'binary'

/** Raster + vector images rendered in an `<img>` (SVG loads inert there). */
const IMAGE = new Set([
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'bmp',
  'ico',
  'avif',
  'apng',
  'svg'
])

/** Audio the Chromium `<audio>` element can play (best-effort for the rest). */
const AUDIO = new Set(['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac'])

/** Video the Chromium `<video>` element can play (best-effort for the rest). */
const VIDEO = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v', 'mkv'])

/** Workbook formats parsed by the spreadsheet service (SheetJS). */
const SPREADSHEET = new Set(['xlsx', 'xlsm', 'xlsb', 'xls'])

/** Delimited text rendered as a table (parsed in pure core, no dependency). */
const DELIMITED = new Set(['csv', 'tsv'])

/**
 * Known-binary extensions we deliberately DON'T render — they get the "no
 * preview" placeholder instead of dumping raw bytes into Monaco. Anything not
 * listed here (and not another kind) falls through to `text`, preserving the
 * old behaviour for logs, dotfiles, and unrecognised-but-textual files.
 */
const BINARY = new Set([
  // Archives
  'zip', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar', 'tar',
  // Executables / objects
  'exe', 'dll', 'so', 'dylib', 'bin', 'dat', 'o', 'a', 'lib', 'obj', 'class',
  'jar', 'wasm', 'node', 'pyc', 'pdb',
  // Fonts
  'woff', 'woff2', 'ttf', 'otf', 'eot',
  // Databases
  'sqlite', 'db',
  // Images/media we can't render in-app
  'heic', 'tiff', 'tif', 'psd', 'ai', 'icns', 'wma', '3gp', 'flv', 'wmv',
  // Office documents we don't parse (yet)
  'doc', 'docx', 'ppt', 'pptx', 'odt', 'ods', 'odp'
])

/**
 * The viewer surface for a file name/path. Extension wins; unknown files are
 * `text` (Monaco falls back to plaintext), so this never regresses text viewing.
 */
export function viewerKindForFile(name: string): ViewerKind {
  const ext = extensionOf(name)
  if (IMAGE.has(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (SPREADSHEET.has(ext)) return 'spreadsheet'
  if (DELIMITED.has(ext)) return 'csv'
  if (AUDIO.has(ext)) return 'audio'
  if (VIDEO.has(ext)) return 'video'
  if (BINARY.has(ext)) return 'binary'
  return 'text'
}

/**
 * Whether a kind is served as raw bytes over the `weft-file://` protocol (as
 * opposed to text-over-IPC or the parsed-spreadsheet path).
 */
export function usesByteProtocol(kind: ViewerKind): boolean {
  return kind === 'image' || kind === 'pdf' || kind === 'audio' || kind === 'video'
}
