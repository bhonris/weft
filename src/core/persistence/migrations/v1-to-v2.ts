/**
 * v1 → v2: adds `resumeEnabled` (conversation resume on restart, default off —
 * resuming spends tokens, so it must be an explicit opt-in). Existing fields
 * pass through untouched; tab `sessionId`s from v1 may be tabId placeholders,
 * which simply means "nothing to resume" for those tabs.
 */
export function v1ToV2(blob: Record<string, unknown>): Record<string, unknown> {
  return { ...blob, version: 2, resumeEnabled: false }
}
