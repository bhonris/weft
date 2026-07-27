import type { SpreadsheetData } from '@shared/ipc/api-contract'
import {
  shapeWorkbook,
  DEFAULT_WORKBOOK_LIMITS,
  type RawSheet,
  type WorkbookLimits
} from '@core/viewer/workbook'

/** Parse workbook bytes into raw sheets — the SheetJS wiring lives in container. */
export type WorkbookParse = (data: Uint8Array) => RawSheet[]

export interface SpreadsheetFsLike {
  readFile(path: string): Promise<Uint8Array>
  stat(path: string): Promise<{ size: number }>
}

/** Above this, the workbook lands as a viewer error instead of a long stall. */
export const MAX_SPREADSHEET_BYTES = 25 * 1024 * 1024

/**
 * Reads and parses spreadsheet files for the viewer. The heavy parser (SheetJS)
 * is injected so this class is unit-tested with a fake, and the layer boundary
 * holds: shaping/capping is pure core (`shapeWorkbook`), the file read + size
 * guard is the only I/O here.
 */
export class SpreadsheetService {
  constructor(
    private readonly fs: SpreadsheetFsLike,
    private readonly parse: WorkbookParse,
    private readonly limits: WorkbookLimits = DEFAULT_WORKBOOK_LIMITS
  ) {}

  async read(path: string): Promise<SpreadsheetData> {
    const { size } = await this.fs.stat(path)
    if (size > MAX_SPREADSHEET_BYTES) {
      const mb = (size / (1024 * 1024)).toFixed(1)
      throw new Error(
        `spreadsheet is ${mb} MB — too large for the viewer (limit 25 MB); use "open with default app" instead`
      )
    }
    const bytes = await this.fs.readFile(path)
    return shapeWorkbook(this.parse(bytes), this.limits)
  }
}
