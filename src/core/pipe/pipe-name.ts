/**
 * Derive the local status-endpoint path for this app instance. Windows uses a
 * named pipe; POSIX uses a Unix domain socket under the runtime dir. NEVER a
 * TCP port (deliberate security decision — see spec §4.4/§8). Pure: platform
 * and directories are injected.
 */
export function statusEndpointPath(
  platform: string,
  instanceId: string,
  runtimeDir: string
): string {
  const safe = instanceId.replace(/[^a-zA-Z0-9-]/g, '')
  if (platform === 'win32') {
    return `\\\\.\\pipe\\weft-status-${safe}`
  }
  return `${runtimeDir.replace(/\/+$/, '')}/weft-status-${safe}.sock`
}
