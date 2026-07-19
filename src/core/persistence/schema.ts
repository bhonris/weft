import { z } from 'zod'
import type { WorkspaceState } from '@shared/ipc/api-contract'

/** Current persisted schema version. Bump when the shape changes. */
export const WORKSPACE_VERSION = 5

export const tabStateSchema = z.object({
  tabId: z.string(),
  sessionId: z.string(),
  title: z.string(),
  cwd: z.string(),
  command: z.enum(['claude', 'shell']),
  windowId: z.string()
})

export const windowBoundsSchema = z.object({
  // .int() rejects NaN/Infinity (Number.isInteger) — a hand-edited or hostile
  // blob must never hand NaN geometry to BrowserWindow.
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int(),
  height: z.number().int()
})

export const workspaceStateSchema = z.object({
  version: z.literal(WORKSPACE_VERSION),
  tabs: z.array(tabStateSchema),
  tabOrder: z.array(z.string()),
  explorerRoots: z.array(z.string()),
  theme: z.enum(['system', 'light', 'dark', 'cyberpunk']),
  resumeEnabled: z.boolean(),
  notificationsEnabled: z.boolean(),
  keymapOverrides: z.record(z.string(), z.string()),
  dock: z.object({
    position: z.enum(['bottom', 'right', 'left']),
    // .finite() rejects NaN/Infinity; the store re-clamps the range on restore.
    size: z.number().finite()
  }),
  windowBounds: windowBoundsSchema.optional()
})

// Compile-time guarantee that a parsed blob is always a valid WorkspaceState,
// so the schema and the API interface cannot silently drift apart.
type SchemaOutput = z.infer<typeof workspaceStateSchema>
const _assertSchemaConformsToApi: SchemaOutput extends WorkspaceState ? true : never = true
void _assertSchemaConformsToApi
