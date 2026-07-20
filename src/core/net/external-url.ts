/**
 * Guard for URLs handed to the OS "open in browser" action. Only http(s) is
 * allowed — this keeps a malicious or malformed link from reaching
 * `shell.openExternal` with a `file:`, `javascript:`, or custom scheme.
 */
export function isSafeExternalUrl(url: string): boolean {
  // Scheme allow-list — only http(s), and something must follow the scheme.
  // (core is framework-free and can't rely on the DOM/Node `URL` global.)
  return /^https?:\/\/\S/i.test(url.trim())
}
