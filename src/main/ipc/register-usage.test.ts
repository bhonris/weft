import { describe, it, expect, vi } from 'vitest'
import { registerUsageIpc } from './register-usage'
import type { IpcMainLike, IpcEventLike } from './register'
import type { UsageService, UsageSessionRef } from '../services/usage-service'
import type { UsageHistoryService } from '../services/usage-history-service'
import type { PlanLimitsService } from '../services/plan-limits-service'
import { emptySummary } from '@core/usage/summary'
import type { PlanLimits, SessionUsage } from '@shared/ipc/api-contract'
import { CH } from '@shared/ipc/channels'

class FakeIpcMain implements IpcMainLike {
  handlers = new Map<string, (e: IpcEventLike, ...a: unknown[]) => unknown>()
  handle(channel: string, listener: (e: IpcEventLike, ...a: unknown[]) => unknown): void {
    this.handlers.set(channel, listener)
  }
  on(): void {}
  invoke(channel: string, ...args: unknown[]): unknown {
    return this.handlers.get(channel)!({ sender: { id: 1, send: () => {} } }, ...args)
  }
}

const noopHistory = { panel: vi.fn(async () => ({ weekly: emptySummary(), sessions: [] })) } as unknown as UsageHistoryService
const noopPlan = { get: vi.fn(async () => null) } as unknown as PlanLimitsService

describe('registerUsageIpc', () => {
  it('summarizes the current sessions on usage:get', async () => {
    const ipcMain = new FakeIpcMain()
    const summary = { ...emptySummary(), sessionCount: 2, costUsd: 1.23 }
    const usageService = { summarize: vi.fn(async () => summary) } as unknown as UsageService
    const sessions: UsageSessionRef[] = [
      { sessionId: 's1', cwd: 'C:/a' },
      { sessionId: 's2', cwd: 'C:/b' }
    ]

    registerUsageIpc({
      ipcMain,
      usageService,
      historyService: noopHistory,
      planLimitsService: noopPlan,
      getSessions: () => sessions
    })
    const out = await ipcMain.invoke(CH.getUsage)

    expect(usageService.summarize).toHaveBeenCalledWith(sessions)
    expect(out).toBe(summary)
  })

  it('returns the session model/effort on usage:session-info, and null for bad args', async () => {
    const ipcMain = new FakeIpcMain()
    const info = { model: 'claude-opus-4-8', effort: 'high' }
    const usageService = {
      summarize: vi.fn(),
      sessionInfo: vi.fn(async () => info)
    } as unknown as UsageService

    registerUsageIpc({
      ipcMain,
      usageService,
      historyService: noopHistory,
      planLimitsService: noopPlan,
      getSessions: () => []
    })

    expect(await ipcMain.invoke(CH.getSessionInfo, 'C:/p', 's1')).toBe(info)
    expect(usageService.sessionInfo).toHaveBeenCalledWith({ cwd: 'C:/p', sessionId: 's1' })

    // Missing/invalid args resolve to null without touching the service.
    expect(await ipcMain.invoke(CH.getSessionInfo, 'C:/p')).toBeNull()
    expect(await ipcMain.invoke(CH.getSessionInfo, 123, 's1')).toBeNull()
    expect(usageService.sessionInfo).toHaveBeenCalledTimes(1)
  })

  it('assembles the panel payload from history + plan-limit services on usage:panel', async () => {
    const ipcMain = new FakeIpcMain()
    const weekly = { ...emptySummary(), costUsd: 4.2, totalTokens: 1000 }
    const sessions: SessionUsage[] = [
      { sessionId: 's1', project: 'weft', model: 'claude-opus-4-8', costUsd: 4.2, totalTokens: 1000, lastActive: '2026-07-20T10:00:00Z' }
    ]
    const planLimits: PlanLimits = {
      fiveHour: { utilization: 20, resetsAt: null },
      sevenDay: { utilization: 60, resetsAt: null },
      sevenDayOpus: null,
      fetchedAt: '2026-07-20T12:00:00Z',
      stale: false
    }
    const historyService = { panel: vi.fn(async () => ({ weekly, sessions })) } as unknown as UsageHistoryService
    const planLimitsService = { get: vi.fn(async () => planLimits) } as unknown as PlanLimitsService

    registerUsageIpc({
      ipcMain,
      usageService: { summarize: vi.fn() } as unknown as UsageService,
      historyService,
      planLimitsService,
      getSessions: () => []
    })
    const out = await ipcMain.invoke(CH.getUsagePanel)

    expect(out).toEqual({ planLimits, weekly, sessions })
  })
})
