/**
 * The canonical catalog of Weft commands — the single source of truth shared by
 * the command palette, the keyboard-help overlay, and (for globally-bound
 * commands) the keybinding router. Pure metadata only: the `run` handlers are
 * injected by the renderer at wire-up time and never live in core.
 *
 * `routes` names the `KeyAction` a command's global chord produces; commands
 * whose shortcut is handled region-locally (F2 rename on a focused tab, Ctrl+S
 * while the viewer is focused, Ctrl+Shift+F terminal search) omit it — their
 * shortcut deliberately routes to `passthrough`. A test asserts every `routes`
 * command's `shortcutHint` really produces that action (no drift).
 */
import type { KeyAction } from '../keybindings/keybinding-router'

export type CommandCategory = 'Tabs' | 'Focus' | 'Explorer' | 'Viewer' | 'General'

export type CommandId =
  | 'tab.new'
  | 'tab.newShell'
  | 'tab.openProject'
  | 'tab.close'
  | 'tab.next'
  | 'tab.prev'
  | 'tab.moveLeft'
  | 'tab.moveRight'
  | 'tab.rename'
  | 'focus.terminal'
  | 'focus.explorer'
  | 'focus.cycleNext'
  | 'focus.cyclePrev'
  | 'viewer.view'
  | 'viewer.edit'
  | 'viewer.diff'
  | 'viewer.reveal'
  | 'viewer.close'
  | 'viewer.save'
  | 'general.commandPalette'
  | 'general.keyboardHelp'
  | 'general.terminalSearch'
  | 'general.cycleTheme'
  | 'general.toggleResume'
  | 'general.toggleNotifications'
  | 'general.resetKeybindings'

export interface Command {
  id: CommandId
  title: string
  category: CommandCategory
  /** Human-readable shortcut label, e.g. "Ctrl+Shift+P". */
  shortcutHint?: string
  /** The router action this command's GLOBAL chord produces (omit if local). */
  routes?: KeyAction['kind']
}

export const COMMANDS: readonly Command[] = [
  // ── Tabs ──
  { id: 'tab.new', title: 'New Tab', category: 'Tabs', shortcutHint: 'Ctrl+T', routes: 'new-tab' },
  { id: 'tab.newShell', title: 'New Shell Tab', category: 'Tabs' },
  { id: 'tab.openProject', title: 'Open Project…', category: 'Tabs' },
  {
    id: 'tab.close',
    title: 'Close Tab',
    category: 'Tabs',
    shortcutHint: 'Ctrl+W',
    routes: 'close-tab'
  },
  {
    id: 'tab.next',
    title: 'Next Tab',
    category: 'Tabs',
    shortcutHint: 'Ctrl+Tab',
    routes: 'next-tab'
  },
  {
    id: 'tab.prev',
    title: 'Previous Tab',
    category: 'Tabs',
    shortcutHint: 'Ctrl+Shift+Tab',
    routes: 'prev-tab'
  },
  {
    id: 'tab.moveLeft',
    title: 'Move Tab Left',
    category: 'Tabs',
    shortcutHint: 'Ctrl+Shift+PageUp',
    routes: 'move-tab'
  },
  {
    id: 'tab.moveRight',
    title: 'Move Tab Right',
    category: 'Tabs',
    shortcutHint: 'Ctrl+Shift+PageDown',
    routes: 'move-tab'
  },
  { id: 'tab.rename', title: 'Rename Tab', category: 'Tabs', shortcutHint: 'F2' },

  // ── Focus ──
  {
    id: 'focus.terminal',
    title: 'Focus Terminal',
    category: 'Focus',
    shortcutHint: 'Ctrl+`',
    routes: 'focus-region'
  },
  {
    id: 'focus.explorer',
    title: 'Focus Explorer',
    category: 'Focus',
    shortcutHint: 'Ctrl+Shift+E',
    routes: 'focus-region'
  },
  {
    id: 'focus.cycleNext',
    title: 'Focus Next Region',
    category: 'Focus',
    shortcutHint: 'Ctrl+F6',
    routes: 'focus-cycle'
  },
  {
    id: 'focus.cyclePrev',
    title: 'Focus Previous Region',
    category: 'Focus',
    shortcutHint: 'Ctrl+Shift+F6',
    routes: 'focus-cycle'
  },

  // ── Viewer ──
  { id: 'viewer.view', title: 'Viewer: View Mode', category: 'Viewer' },
  { id: 'viewer.edit', title: 'Viewer: Edit Mode', category: 'Viewer' },
  { id: 'viewer.diff', title: 'Viewer: Diff vs HEAD', category: 'Viewer' },
  { id: 'viewer.reveal', title: 'Reveal File in OS', category: 'Viewer' },
  { id: 'viewer.close', title: 'Close Viewer', category: 'Viewer' },
  { id: 'viewer.save', title: 'Save File', category: 'Viewer', shortcutHint: 'Ctrl+S' },

  // ── General ──
  {
    id: 'general.commandPalette',
    title: 'Command Palette',
    category: 'General',
    shortcutHint: 'Ctrl+Shift+P',
    routes: 'command-palette'
  },
  {
    id: 'general.keyboardHelp',
    title: 'Keyboard Shortcuts',
    category: 'General',
    shortcutHint: 'Ctrl+Shift+/',
    routes: 'help-overlay'
  },
  {
    id: 'general.terminalSearch',
    title: 'Search in Terminal',
    category: 'General',
    shortcutHint: 'Ctrl+Shift+F',
    routes: 'terminal-search'
  },
  { id: 'general.cycleTheme', title: 'Cycle Theme', category: 'General' },
  { id: 'general.toggleResume', title: 'Toggle Resume on Restore', category: 'General' },
  { id: 'general.toggleNotifications', title: 'Toggle Notifications', category: 'General' },
  { id: 'general.resetKeybindings', title: 'Reset Keybindings to Defaults', category: 'General' }
]

/** Categories in display order for the help overlay grouping. */
export const CATEGORY_ORDER: readonly CommandCategory[] = ['General', 'Tabs', 'Focus', 'Viewer']

/**
 * Reference-only rows for the keyboard-help cheat-sheet that are NOT executable
 * commands — region-local keys handled inside a component (explorer tree
 * navigation, terminal passthrough/search). Kept here so the in-app overlay is a
 * complete reference. `keys` is a display string (space-separated tokens; `/`
 * marks alternatives).
 */
export interface ReferenceRow {
  label: string
  keys: string
}
export interface ReferenceSection {
  title: string
  note?: string
  rows: readonly ReferenceRow[]
}

export const KEYBOARD_REFERENCE: readonly ReferenceSection[] = [
  {
    title: 'Explorer',
    note: 'when focused',
    rows: [
      { label: 'Move up / down', keys: '↑ / ↓' },
      { label: 'Expand folder / step in', keys: '→' },
      { label: 'Collapse / jump to parent', keys: '←' },
      { label: 'First / last item', keys: 'Home / End' },
      { label: 'Open file / toggle folder', keys: 'Enter' }
    ]
  },
  {
    title: 'Terminal',
    rows: [
      { label: 'Shell keys pass straight through (Ctrl+C, arrows, F-keys…)', keys: 'always' },
      { label: 'Search: next / previous / close', keys: 'Enter / ↑ / Esc' }
    ]
  }
]
