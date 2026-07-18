# Feature: Turn OS notifications on/off

**Status:** ✅ Complete (2026-07-18)

## Feature specification

Give the operator a persisted **on/off switch for Weft's OS notifications**
(the toasts raised when an unfocused session enters `waiting` or `done`).
Today notifications are always on with no way to silence them; a user running
many sessions, screen-sharing, or focusing deeply may want them off. The switch
lives in the status bar (next to the existing theme / resume toggles) and in the
command palette, defaults to **on** (current behavior), and persists across
restarts.

**Why:** notifications are the product's "which session needs me?" signal, but
they're intrusive in some contexts (presentations, focus time, a wall of
sessions all finishing). A one-click, discoverable, persisted mute is the
minimum control a user expects over OS-level interruptions.

## Scope & out of scope

**In scope**
- A single **global** boolean `notificationsEnabled` (default `true`).
- Persisted in `WorkspaceState` (schema v2 → v3 migration).
- A status-bar toggle button mirroring the existing `↻ resume` button, plus a
  `general.toggleNotifications` command (palette + help overlay).
- Main-process enforcement: `NotificationService` suppresses all toasts when the
  flag is off, reading it from the `WorkspaceStore`.
- Tests: migration chain, default workspace, service suppression, sync
  serialization, renderer toggle.

**Out of scope**
- Per-tab or per-status granularity (e.g. "toast on done but not waiting", or
  muting one project). A single global switch only; finer control is a future
  follow-up noted in Open questions.
- Do-not-disturb scheduling / quiet hours.
- Changing the notification *content*, cooldown, or the waiting/done policy
  itself (unchanged from spec §4.4.7).
- In-app (non-OS) notification surfaces — the tab color/badge already covers the
  in-app signal and is never suppressed.

## User stories

- As a developer presenting my screen, I want to mute Weft's toasts with one
  click so that private project names and "needs you" popups don't appear.
- As a developer running many sessions, I want to turn notifications off during
  focused work so that a wall of finishing sessions doesn't spam the action
  center, and have that choice stick across restarts.
- As a keyboard-only user, I want to toggle notifications from the command
  palette so that I never need the mouse.

## Acceptance criteria

- [x] A `notificationsEnabled` boolean is persisted in `WorkspaceState`, defaults
      to `true`, and survives a restart (round-trips through `save`/`load`).
- [x] A v2 workspace blob migrates to v3 by adding `notificationsEnabled: true`
      (existing preferences preserved), and the full v0→v3 chain still yields a
      valid current-shape `WorkspaceState`.
- [x] With the flag **off**, `NotificationService` raises **no** OS toast for any
      `waiting`/`done` status change; with it **on**, behavior is unchanged
      (unfocused + waiting/done → toast, cooldown intact).
- [x] Toggling the flag takes effect for subsequent status changes **without an
      app restart** (main reads the current persisted value per event).
- [x] The status bar shows a toggle button reflecting the state
      (`🔔 notify on` / `🔕 notify off`) with an `aria-label`, mirroring the
      resume/theme buttons; clicking it flips and persists the flag.
- [x] A `general.toggleNotifications` command exists (command palette + keyboard
      help), and running it flips the flag.
- [x] The in-app tab color/badge signal is unaffected when notifications are off
      (muting is OS-toast-only).
- [x] Renderer test covers the toggle button/command; existing suite stays green
      (aside from the documented `hook-forwarder.integration` env-only failure);
      typecheck clean; coverage gate (95%) still met.

## Architecture & technical design

Follows the **exact pattern of the existing `resumeEnabled` toggle**, with one
deliberate difference: `resumeEnabled` is *consumed in the renderer*
(`restoreWorkspace`), whereas `notificationsEnabled` is *enforced in main*, since
`NotificationService` lives there.

Data flow when the user toggles:

```
status-bar button / palette command
  → session-store.setNotificationsEnabled(next)         (renderer state)
  → App persist effect fires (state.notificationsEnabled changed)
  → window.api.saveWorkspace(buildWorkspaceState(...))  (IPC)
  → WorkspaceStore.save → electron-store                (main, persisted)
```

Enforcement on the next status change:

```
StatusServer.onStatus(change)
  → notifications.handleStatus(change)
  → deps.isEnabled()  === workspaceStore.load().notificationsEnabled
  → if false, return early (no toast)
```

Because main's `WorkspaceStore` and the renderer's `saveWorkspace` share the same
`electron-store` instance (wired in `container.ts`), main always reads the
latest value on each event — no new IPC channel, no cached-in-main state to keep
in sync.

**Files touched**

- `src/shared/ipc/api-contract.ts` — add `notificationsEnabled: boolean` to
  `WorkspaceState`.
- `src/core/persistence/schema.ts` — bump `WORKSPACE_VERSION` to `3`; add the
  field to `workspaceStateSchema`.
- `src/core/persistence/default-workspace.ts` — default `notificationsEnabled: true`.
- `src/core/persistence/migrations/v2-to-v3.ts` (new) + `migrations/index.ts` —
  register `2: v2ToV3` adding `notificationsEnabled: true`.
- `src/renderer/store/session-store.ts` — `notificationsEnabled` + setter
  (default `true`).
- `src/renderer/store/workspace-sync.ts` — `buildWorkspaceState` gains a
  `notificationsEnabled = true` param and emits it.
- `src/renderer/App.tsx` — load into store; include in the persist-effect change
  check; status-bar button; `general.toggleNotifications` case in `runCommand`.
- `src/core/commands/registry.ts` — `general.toggleNotifications` command id +
  entry.
- `src/main/services/notification-service.ts` — `isEnabled: () => boolean` dep;
  early return in `handleStatus`.
- `src/main/container.ts` — construct the workspace store before the
  `NotificationService` and wire
  `isEnabled: () => workspaceStore.load().notificationsEnabled`.

Layer-boundary compliance: the decision stays pure — `NotificationService` gains
one injected predicate; `container.ts` (the composition root, excluded from the
unit gate) supplies the Electron/store-backed implementation.

## API contract

No new IPC channels. `WorkspaceState` (used by `loadWorkspace`/`saveWorkspace`)
gains one required field:

```ts
interface WorkspaceState {
  // …existing…
  resumeEnabled: boolean
  notificationsEnabled: boolean   // v3; default true
}
```

## Database changes

electron-store JSON blob only. Schema `version` 2 → 3 with a `v2ToV3` migration
(`{ ...blob, version: 3, notificationsEnabled: true }`). The existing
pre-migration `config.bak` backup covers rollback.

## UI/UX considerations

- Button placed left of the `↻ resume` button in the status bar, same
  `status-bar__theme` styling. Label + icon reflect state
  (`🔔 notify on` / `🔕 notify off`); `aria-label="notifications: on|off"`;
  `title` explains it mutes OS toasts only.
- No animation; respects existing reduced-motion conventions (nothing new
  animates).
- Muting affects OS toasts only — the tab color/badge (the in-app signal) stays
  live so a muted user can still scan state visually.

## Security considerations

None new. No new inputs or IPC surface; one persisted boolean validated by the
existing zod schema.

## Performance considerations

Negligible. `workspaceStore.load()` per status change reads an in-process
electron-store cache; status changes are already dedup-throttled by the
`StatusServer` and rate-limited by the notification cooldown.

## Edge cases & error handling

- **Legacy blob without the field** — the v2→v3 migration adds it
  (`true`); a corrupt/unreadable blob falls back to `defaultWorkspace()` which
  also defaults it on.
- **Toggled off mid-session** — the very next status change reads the fresh
  value and suppresses; any toast already shown is not recalled (OS-owned).
- **Tear-off windows** — enforcement is central (main), so all windows honor one
  flag; no per-window drift.
- **Cooldown map** — unaffected; suppression returns before the cooldown check,
  so muting never consumes a cooldown slot.

## Testing strategy

- **Unit (core):** `migrations.test.ts` — v2→v3 adds the field, full chain
  0→3 validates; `default-workspace.test.ts` — field present + `true`;
  `validate.test.ts` if it enumerates fields.
- **Unit (main service):** `notification-service.test.ts` — new case: flag off ⇒
  `showToast` never called for waiting/done; flag on ⇒ existing behavior; verify
  suppression does not touch the cooldown map.
- **Unit (renderer store/sync):** `workspace-sync.test.ts` — `buildWorkspaceState`
  emits `notificationsEnabled`; default `true`.
- **Component:** `App.test.tsx` — the toggle button renders the state, clicking
  flips it, and the `general.toggleNotifications` command flips it (mirror the
  resume-toggle test).
- **Manual (Windows):** toggle off → trigger a `done`/`waiting` while unfocused →
  confirm no toast; toggle on → confirm toast returns; restart → state persists.

## Dependencies

None.

## Migration & rollback plan

Deploy: ship the v3 schema + migration; existing users auto-migrate on next
launch (backup written first). Rollback: revert the change; a v3 blob read by
the reverted (v2) code fails validation and falls back to `defaultWorkspace()`
(no crash, notifications default on) — acceptable, and the `config.bak` holds the
pre-migration copy.

## Open questions

- Should the switch offer per-status granularity later (mute `done` but keep
  `waiting`)? Deferred; single global switch for now.
- Should muting also silence a future in-app notification center (if one is
  added)? Out of scope until such a surface exists.

## Todo list

- [x] api-contract: add `notificationsEnabled` to `WorkspaceState`.
- [x] schema: bump version to 3 + add field.
- [x] default-workspace: default `true`.
- [x] migration v2→v3 + register in chain.
- [x] session-store: state + setter (default `true`).
- [x] workspace-sync: `buildWorkspaceState` param + emit.
- [x] App.tsx: load, persist-check, status-bar button, `runCommand` case.
- [x] commands/registry: `general.toggleNotifications`.
- [x] NotificationService: `isEnabled` dep + early return.
- [x] container.ts: reorder store before notifications + wire `isEnabled`.
- [x] Tests: migration, default-workspace, notification-service, workspace-sync,
      App.
- [x] `pnpm typecheck` clean + `pnpm test` green (sans documented env failure).
