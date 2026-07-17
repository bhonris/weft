import { randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { CH } from '@shared/ipc/channels'
import type { CreateSessionOpts } from '@shared/ipc/api-contract'
import type { PtyManager } from '../services/pty-manager'

/** The webContents-like sender carried on every IPC event. */
export interface IpcSenderLike {
  readonly id: number
  send(channel: string, payload: unknown): void
}

export interface IpcEventLike {
  readonly sender: IpcSenderLike
}

/** The ipcMain surface we depend on — satisfied by electron's ipcMain and by a fake. */
export interface IpcMainLike {
  handle(channel: string, listener: (event: IpcEventLike, ...args: unknown[]) => unknown): void
  on(channel: string, listener: (event: IpcEventLike, ...args: unknown[]) => void): void
}

export interface RegisterDeps {
  ipcMain: IpcMainLike
  pty: PtyManager
  /** Opens an OS directory picker; resolves to the chosen path or null. */
  pickDirectory: () => Promise<string | null>
  /** Injectable for deterministic tests. */
  generateId?: () => string
  /** Extra environment for spawned sessions (defaults to process.env). */
  baseEnv?: NodeJS.ProcessEnv
  /** Default shell when command is 'shell'. */
  shellPath?: string
  /** Command used by openProject (default 'claude'; tests may use 'shell'). */
  defaultCommand?: 'claude' | 'shell'
  /** Status-reporting hook injection (spec §4.4). */
  hooks?: {
    /** Named-pipe/UDS path the forwarder writes to (set as WEFT_STATUS_ENDPOINT). */
    endpoint: string
    /** Inline JSON for `claude --settings` registering the reporting hooks. */
    settingsJson: string
  }
}

/** Build the child-process env, dropping undefined values and tagging the tab. */
function buildEnv(
  base: NodeJS.ProcessEnv,
  tabId: string,
  statusEndpoint?: string
): Record<string, string> {
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined) env[key] = value
  }
  env['CLAUDE_IDE_TAB'] = tabId
  if (statusEndpoint !== undefined) env['WEFT_STATUS_ENDPOINT'] = statusEndpoint
  return env
}

/**
 * Wire the session-lifecycle IPC channels to the PtyManager. Attaching a
 * renderer view forwards live PTY output to that specific sender and returns the
 * replay snapshot; detaching leaves the PTY running (spec §4.7).
 */
export function registerSessionIpc(deps: RegisterDeps): void {
  const { ipcMain, pty } = deps
  const genId = deps.generateId ?? (() => randomUUID())
  const baseEnv = deps.baseEnv ?? process.env
  const shellPath =
    deps.shellPath ?? (process.platform === 'win32' ? 'powershell.exe' : 'bash')

  // Track live attachments per (sender, tab) so detach removes exactly one.
  const attachments = new Map<string, { detach: () => void }>()
  const key = (senderId: number, tabId: string): string => `${senderId}:${tabId}`

  function createSession(opts: CreateSessionOpts): { tabId: string; sessionId: string } {
    const tabId = genId()
    const sessionId = genId()
    const isClaude = opts.command === 'claude'
    const file = isClaude ? 'claude' : shellPath
    const hookArgs =
      isClaude && deps.hooks ? ['--settings', deps.hooks.settingsJson] : []
    const args = isClaude
      ? ['--session-id', sessionId, ...hookArgs, ...(opts.args ?? [])]
      : opts.args ?? []
    pty.create({
      tabId,
      sessionId,
      file,
      args,
      cwd: opts.cwd,
      env: buildEnv(baseEnv, tabId, deps.hooks?.endpoint)
    })
    return { tabId, sessionId }
  }

  ipcMain.handle(CH.createSession, (_event, opts) => {
    const { tabId } = createSession(opts as CreateSessionOpts)
    return { tabId }
  })

  ipcMain.on(CH.writeToSession, (_event, tabId, data) => {
    if (pty.has(tabId as string)) pty.write(tabId as string, data as string)
  })

  ipcMain.on(CH.resizeSession, (_event, tabId, cols, rows) => {
    if (pty.has(tabId as string)) pty.resize(tabId as string, cols as number, rows as number)
  })

  ipcMain.handle(CH.closeSession, (_event, tabId) => {
    pty.close(tabId as string)
  })

  ipcMain.handle(CH.attachSession, (event, tabId) => {
    const id = tabId as string
    const sender = event.sender
    const handle = pty.attach(
      id,
      (data) => sender.send(CH.sessionData, { tabId: id, data }),
      ({ exitCode }) => sender.send(CH.sessionExit, { tabId: id, exitCode })
    )
    attachments.set(key(sender.id, id), handle)
    return { snapshot: handle.snapshot }
  })

  ipcMain.handle(CH.detachSession, (event, tabId) => {
    const k = key(event.sender.id, tabId as string)
    const handle = attachments.get(k)
    if (handle) {
      handle.detach()
      attachments.delete(k)
    }
  })

  ipcMain.handle(CH.openProject, async () => {
    const dir = await deps.pickDirectory()
    if (!dir) return null
    const { tabId } = createSession({ cwd: dir, command: deps.defaultCommand ?? 'claude' })
    return { tabId, cwd: dir, title: basename(dir) || dir }
  })
}
