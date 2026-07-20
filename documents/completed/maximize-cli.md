# Feature: Maximize CLI (focus mode)

## Feature specification

A non-invasive way to temporarily give the Claude CLI the full workbench split
area **without closing the open file(s)**. Today the editor pane and the CLI
dock share the in-project area whenever a file is open; the only way to get a
full-size CLI is to close the viewer (`viewer.close`), which loses the open-file
tabs. This feature adds a **Maximize CLI** toggle: while active, the editor pane
and the dock divider are hidden and the CLI fills the whole split area; the
viewer's open files are untouched, so toggling off restores the exact split.

"Full screen" here means **full workbench pane** — the tab strip, file explorer,
and status bar all remain; only the editor pane collapses. It is not OS
fullscreen and does not hide the explorer.

## Scope & out of scope

In scope:
- A boolean, session-only "CLI maximized" UI state on the dock store.
- Three ways to toggle it: the **Ctrl+`** key (escalation — see below), a
  command-palette entry (**Toggle Maximize CLI**), and a status-bar button
  (shown only when a file is open).
- Ctrl+` escalation: the existing "Focus Terminal" chord now does focus →
  maximize → restore. First press focuses the terminal; pressing it again while
  the terminal is already focused toggles full-pane. A double-tap from anywhere
  therefore yields a full-screen CLI with no dedicated second chord.
- Auto-reset: opening/switching/closing a viewer file reveals the editor again
  (so you never open a file into a hidden pane).

Out of scope:
- Persisting the maximized state across app restarts (it resets to split view).
- Hiding the explorer / tab strip / status bar (true "zen" mode).
- Maximizing the **editor** (hiding the CLI) — the CLI is always present by design.
- Any change to PTY/session lifecycle — layout only.

## User stories

- As a developer pairing with Claude, I want to temporarily expand the CLI to
  full pane while keeping my file open, so that I can focus on the conversation
  and snap back to my code with one keystroke.

## Acceptance criteria

- [x] With a file open, toggling Maximize CLI hides the editor pane + divider and
      the CLI fills the split area; the open file is NOT closed.
- [x] Toggling off restores the previous split (same dock position/size).
- [x] Ctrl+` focuses the terminal; a second press (already focused) maximizes and
      a third restores — the palette command and status-bar button toggle the
      same state.
- [x] The status-bar toggle appears only when a file is open (nothing to maximize
      otherwise).
- [x] Opening, switching, or closing a viewer file resets maximized → the editor
      is shown.
- [x] While maximized, the viewer is not a focus-cycle region (Ctrl+F6 skips it).
- [x] Ctrl+` is already a reserved Weft chord (swallowed, never reaches the PTY);
      the escalation adds no new terminal-facing key.

## Architecture & technical design

Layout is driven by `hasViewerFile` in `renderer/App.tsx`. Introduce
`showEditor = hasViewerFile && !cliMaximized` and use it wherever the editor
region, dock divider, and CLI flex/`data-split` were gated on `hasViewerFile`.

- `renderer/store/dock-store.ts` — add transient `maximized: boolean` +
  `toggleMaximized()` / `setMaximized()`. NOT part of the persisted `DockState`
  core type, so `restore`/`saveWorkspace` ignore it (session-only by construction).
- `core/commands/registry.ts` — add `view.maximizeCli` as a **palette-only**
  command (category Viewer, no `routes`/`shortcutHint`), consistent with the
  other viewer commands. The primary trigger is Ctrl+`, not a dedicated chord, so
  no new `KeyAction` kind / keymap entry / action-dispatch mapping is introduced.
- `renderer/App.tsx`:
  - `runCommand('view.maximizeCli')` toggles the dock store (palette + button).
  - `runCommand('focus.terminal')` (the Ctrl+` chord and the palette entry) now
    escalates: `terminalRef.contains(document.activeElement)` decides between
    focusing the terminal and toggling maximize. State-dependent behavior stays
    OUT of the pure router — the chord still maps to `focus-region: terminal`;
    only the renderer handler is state-aware.
  - a status-bar button; an effect that resets `maximized` on
    viewer-file-path change; `presentRegions` gates `viewer` on `!maximized`.

## UI/UX considerations

- Status-bar button matches the existing theme/resume/notify controls; label +
  `aria-label` reflect state ("Maximize CLI" vs "Show editor").
- No absolutely-positioned overlay on xterm (would risk covering terminal text).

## Security considerations

None — pure client-side layout state; no new IPC, no filesystem/PTY access.

## Performance considerations

Negligible: one boolean, a couple of extra store reads, and conditional rendering
of already-rendered regions.

## Edge cases & error handling

- No file open: toggling is a no-op visually (CLI already fills the area); the
  status-bar button is hidden.
- Open a different file while maximized → reset reveals it (no "opened into a
  hidden pane" trap).
- Ctrl+` while focus is elsewhere: focuses the terminal (press again to
  maximize) — no accidental maximize from a single press.
- Ctrl+` is already a reserved Weft chord and is swallowed by TerminalPane's key
  handler; the escalation adds no new terminal-facing key.

## Testing strategy

- Unit: dock-store (`maximized` default/toggle/set; unaffected by `restore`).
- Renderer: App tests for the palette command, the status-bar button, the Ctrl+`
  focus→maximize→restore escalation, hidden-button-when-no-file, and
  reset-on-file-navigate.

## Dependencies

None.

## Migration & rollback plan

No schema change (state is session-only). Rollback = revert the diff.

## Open questions

- None outstanding. Trigger revised from a dedicated Ctrl+Shift+Enter chord to
  overloading Ctrl+` (focus → maximize → restore); session-only persistence kept.

## Todo list

- [x] dock-store: `maximized` + `toggleMaximized`/`setMaximized` (+ tests)
- [x] registry: `view.maximizeCli` as a palette-only command
- [x] App: `showEditor` layout, `view.maximizeCli` toggle, Ctrl+` escalation in
      `focus.terminal`, reset effect, status-bar button, presentRegions gate
- [x] App tests (palette, button, Ctrl+` escalation, hidden-when-no-file, reset)
- [x] Run `pnpm typecheck` + `pnpm test:cov` green (coverage 98.64% stmts /
      96.62% branches / 97.67% funcs — above the 95/90 gate)
