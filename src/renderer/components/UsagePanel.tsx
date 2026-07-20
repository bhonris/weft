import { useUsageStore } from '../store/usage-store'
import { formatUsd, formatTokens } from '@core/usage/summary'
import { formatUtilization, formatResetIn } from '@core/usage/plan-limits'
import type { PlanWindow, SessionUsage, PlanLimits } from '@shared/ipc/api-contract'

/** One plan-limit meter (5-hour / weekly / weekly-Opus). */
function Meter({
  label,
  window,
  now
}: {
  label: string
  window: PlanWindow | null
  now: number
}): React.ReactElement | null {
  if (!window) return null
  const pct = window.utilization
  const level = pct >= 90 ? 'crit' : pct >= 75 ? 'warn' : 'ok'
  const resets = formatResetIn(window.resetsAt, now)
  return (
    <div className="usage-meter" data-testid={`usage-meter-${label}`}>
      <div className="usage-meter__head">
        <span className="usage-meter__label">{label}</span>
        <span className="usage-meter__pct">{formatUtilization(pct)}</span>
      </div>
      <div
        className="usage-meter__track"
        role="progressbar"
        aria-label={`${label} usage`}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="usage-meter__fill"
          data-level={level}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      {resets && <div className="usage-meter__reset">{resets}</div>}
    </div>
  )
}

/** The plan-limit section — meters, or an "unavailable" note when we have none. */
function PlanLimitsSection({
  limits,
  now
}: {
  limits: PlanLimits | null
  now: number
}): React.ReactElement {
  const hasAny =
    limits && (limits.fiveHour || limits.sevenDay || limits.sevenDayOpus)
  return (
    <section className="usage-section" data-testid="usage-plan">
      <h3 className="usage-section__title">Plan limits</h3>
      {hasAny ? (
        <>
          <Meter label="5-hour" window={limits.fiveHour} now={now} />
          <Meter label="Weekly" window={limits.sevenDay} now={now} />
          <Meter label="Weekly Opus" window={limits.sevenDayOpus} now={now} />
          {limits.stale && (
            <div className="usage-note" data-testid="usage-plan-stale">
              Showing last-known usage — live figures are temporarily unavailable.
            </div>
          )}
        </>
      ) : (
        <div className="usage-note" data-testid="usage-plan-unavailable">
          Plan limits unavailable. Sign in to Claude Code to see your 5-hour and
          weekly usage.
        </div>
      )}
    </section>
  )
}

/** A single recent-session row. */
function SessionRow({
  session,
  now
}: {
  session: SessionUsage
  now: number
}): React.ReactElement {
  return (
    <li className="usage-session" title={session.sessionId}>
      <div className="usage-session__top">
        <span className="usage-session__project">{session.project}</span>
        <span className="usage-session__cost">{formatUsd(session.costUsd)}</span>
      </div>
      <div className="usage-session__meta">
        <span className="usage-session__tokens">{formatTokens(session.totalTokens)} tokens</span>
        <span className="usage-session__ago">{relativeTime(session.lastActive, now)}</span>
      </div>
    </li>
  )
}

/** Compact "3h ago" / "2d ago" from an ISO time (empty when unknown). */
function relativeTime(iso: string, now: number): string {
  if (!iso) return ''
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return ''
  const mins = Math.max(0, Math.round((now - at) / 60000))
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/**
 * The Usage sidebar panel: subscription plan-limit meters, a computed rolling
 * 7-day cost/token total across all projects, and a recent-sessions list. Data
 * comes from `usage:panel` (polled by App.tsx while this panel is active).
 */
export function UsagePanel(): React.ReactElement {
  const panel = useUsageStore((s) => s.panel)
  // A single render-time "now" keeps every relative label consistent.
  const now = Date.now()

  if (!panel) {
    return <div className="usage-panel__empty">Loading usage…</div>
  }

  return (
    <div className="usage-panel" data-testid="usage-panel">
      <PlanLimitsSection limits={panel.planLimits} now={now} />

      <section className="usage-section" data-testid="usage-weekly">
        <h3 className="usage-section__title">Last 7 days</h3>
        <div className="usage-weekly">
          <span className="usage-weekly__cost">{formatUsd(panel.weekly.costUsd)}</span>
          <span className="usage-weekly__tokens">
            {formatTokens(panel.weekly.totalTokens)} tokens
          </span>
        </div>
        <div className="usage-note usage-note--sub">across all projects</div>
      </section>

      <section className="usage-section" data-testid="usage-sessions">
        <h3 className="usage-section__title">Recent sessions</h3>
        {panel.sessions.length === 0 ? (
          <div className="usage-note">No recorded sessions yet.</div>
        ) : (
          <ul className="usage-session-list">
            {panel.sessions.map((s) => (
              <SessionRow key={s.sessionId} session={s} now={now} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
