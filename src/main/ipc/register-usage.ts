import { CH } from '@shared/ipc/channels'
import type { IpcMainLike } from './register'
import type { UsageService, UsageSessionRef } from '../services/usage-service'
import type { UsageHistoryService } from '../services/usage-history-service'
import type { PlanLimitsService } from '../services/plan-limits-service'
import type { UsagePanelData } from '@shared/ipc/api-contract'

export interface UsageRegisterDeps {
  ipcMain: IpcMainLike
  usageService: UsageService
  /** All-projects history (weekly totals + recent-sessions list). */
  historyService: UsageHistoryService
  /** Subscription plan-limit meters (5h / weekly / weekly-Opus). */
  planLimitsService: PlanLimitsService
  /** The live claude sessions whose usage should be aggregated. */
  getSessions: () => UsageSessionRef[]
}

/** Wire the `usage:get` and `usage:panel` channels to their services. */
export function registerUsageIpc(deps: UsageRegisterDeps): void {
  deps.ipcMain.handle(CH.getUsage, () => deps.usageService.summarize(deps.getSessions()))
  deps.ipcMain.handle(CH.getSessionInfo, (_e, cwd, sessionId) =>
    typeof cwd === 'string' && typeof sessionId === 'string'
      ? deps.usageService.sessionInfo({ cwd, sessionId })
      : Promise.resolve(null)
  )
  deps.ipcMain.handle(CH.getUsagePanel, async (): Promise<UsagePanelData> => {
    const [history, planLimits] = await Promise.all([
      deps.historyService.panel(),
      deps.planLimitsService.get()
    ])
    return { planLimits, weekly: history.weekly, sessions: history.sessions }
  })
}
