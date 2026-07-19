# Feature brief: In-project workspace — file tabs + always-present CLI pane

**Status:** 📋 Operator-aligned candidate for **Cycle 8** (NOT started; Cycle 7 —
remappable keybindings — finishes first). When `/dmail` opens Cycle 8, Okabe
(Phase 1) should expand this brief into `## Expansion 8` acceptance criteria in
`documents/steiner-spec.md`.

## Problem

Today the in-project area is single-purpose: the Monaco viewer **overlays** the
terminal (`.viewer-pane { position:absolute; inset:0; z-index:5 }`), so opening a
file **hides the Claude CLI entirely**, and only **one file** can be open at a
time (`viewer-store` holds a single `file`). You can't read a file and watch
Claude work at the same time, and you can't keep several files open.

## What we're building (operator-aligned 2026-07-19)

Turn the in-project region into a real workspace:

1. **Multiple file/editor tabs** within a project — open several files, switch
   between them, close them (VS Code-style editor tabs), instead of one file
   replacing another.
2. **The Claude CLI is an always-present, moveable dock pane** — it stays visible
   *beside* the files instead of being covered by the viewer.
   - **Default position: bottom.** **Moveable** — the user can re-dock it (bottom
     / right / left). Resizable via a divider.
   - Dock position + size **persist** across restarts.
3. **CLI full-width when no file is open** — with zero file tabs open, the CLI
   fills the area exactly as today. Opening the first file reveals the split;
   closing the last file tab returns to full-width CLI.
4. **Fast "return to the CLI"** — a keyboard shortcut (extend the existing
   `Ctrl+`` focus-terminal) plus a visible affordance always jumps focus to the
   Claude session, regardless of layout.

One CLI per project (the project's single `claude` session — unchanged). The
"tabs" are files/views, **not** additional terminals.

## Scope & out of scope

**In scope**
- Editor tabs: open/switch/close multiple files; the active file drives the
  Monaco viewer (view / diff / edit modes as today).
- A split layout: editor area + dockable CLI pane, resizable, position-persistent.
- Full-width-CLI-when-empty behavior + focus-CLI shortcut/affordance.
- Keyboard operability (consistent with Cycle 6): the new tabs, the dock, and the
  focus jump must be reachable by keyboard; terminal passthrough invariant intact.

**Out of scope (for this cycle)**
- Multiple Claude sessions per project (still one CLI per project).
- Splitting the *editor* into side-by-side editors (multiple files visible at
  once) — tabs switch one editor. Could be a follow-up.
- macOS/Linux, LSP (unchanged deferrals).

## Key open questions (resolve when Cycle 8 opens)

- **Rendering approach for the moveable dock/split:** custom fl/grid split with a
  drag divider + a small "dock position" state machine, **or** re-introduce
  `dockview` (the original design named it for exactly this; it was dropped as
  unused in v0.2.0). Custom is lighter and avoids re-adding a heavy dep; dockview
  gives drag-docking for free. Lean custom unless drag-to-dock UX demands it.
- **Persistence shape:** dock position (`bottom|right|left`) + size ratio, and
  possibly the set of open file tabs per project — extends `WorkspaceState`
  (schema bump + migration, same pattern as `notificationsEnabled`).
- **Editor-tab model:** does the CLI count as a pinned tab, or is it purely the
  dock pane (files are the only tabs)? Aligned answer leans: **CLI = dock pane,
  files = tabs.**
- Interaction with **tear-off**: a torn-off window today carries one tab's
  session — how do editor tabs + dock behave in a torn-off window? (Likely: the
  dock/editor state is per-project-window.)

## Architecture notes (Beta worldline — keep the boundary)

- Pure `core/` logic for: the dock-position/size state + reducer, the open-file-
  tabs list + active-tab reducer, and the "empty ⇒ full-width CLI" rule — all
  unit-tested with fakes.
- `renderer/`: replace the overlay `viewer-pane` with a split container; add an
  editor-tab strip; `viewer-store` grows from a single `file` to an ordered set
  of open files + an active id.
- No `main/` PTY changes expected — one session per project stands; the terminal
  simply shares space instead of being overlaid.

## Testing strategy

- Unit: dock/tabs reducers (open/close/switch, empty→full-width, dock move/resize
  clamping), persistence migration round-trip.
- E2E: open two files → both are tabs → switch → CLI stays visible in the dock →
  close all → CLI returns to full width → focus-CLI shortcut works → dock resize
  + re-dock persists across a restart. Terminal passthrough still holds.
