import { z } from 'zod'
import type { WorkspaceState } from '@shared/ipc/api-contract'

/** Current persisted schema version. Bump when the shape changes. */
export const WORKSPACE_VERSION = 1

export const tabStateSchema = z.object({
  tabId: z.string(),
  sessionId: z.string(),
  title: z.string(),
  cwd: z.string(),
  command: z.enum(['claude', 'shell']),
  windowId: z.string()
})

export const windowBoundsSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})

export const workspaceStateSchema = z.object({
  version: z.literal(WORKSPACE_VERSION),
  tabs: z.array(tabStateSchema),
  tabOrder: z.array(z.string()),
  explorerRoots: z.array(z.string()),
  theme: z.enum(['system', 'light', 'dark']),
  windowBounds: windowBoundsSchema.optional()
})

// Compile-time guarantee that a parsed blob is always a valid WorkspaceState,
// so the schema and the API interface cannot silently drift apart.
type SchemaOutput = z.infer<typeof workspaceStateSchema>
const _assertSchemaConformsToApi: SchemaOutput extends WorkspaceState ? true : never = true
void _assertSchemaConformsToApi
