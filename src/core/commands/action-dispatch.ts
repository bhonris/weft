import type { KeyAction } from '../keybindings/keybinding-router'
import type { CommandId } from './registry'

/**
 * Bridge from a pure {@link KeyAction} (what a chord classifies to) to the
 * {@link CommandId} it invokes — so a global chord and its command-palette
 * entry run the SAME handler through one dispatcher (`runCommand`). This is the
 * fix for the dual-dispatch drift that let a copy-pasted case displace
 * `viewer.save` in Cycle 6: there is now exactly one place that performs a
 * command's side effect, and chords resolve INTO it rather than duplicating it.
 *
 * Returns `null` when the action must NOT flow through the command dispatcher:
 *   - `passthrough` — the key belongs to the terminal.
 *   - `terminal-search` — the `Ctrl+Shift+F` chord passes through so the focused
 *     `TerminalPane` opens its own (pane-local) search; routing it through a
 *     command would `preventDefault` and the terminal would never see the key.
 *   - `jump-tab` — parameterized by number (`Ctrl+1`..`9`); it has no registry
 *     command, so the caller applies it directly.
 *
 * The switch is exhaustive over `KeyAction['kind']`: adding a new action kind
 * without mapping it here is a compile error, not a silent passthrough.
 */
export function commandIdForAction(action: KeyAction): CommandId | null {
  switch (action.kind) {
    case 'new-tab':
      return 'tab.new'
    case 'close-tab':
      return 'tab.close'
    case 'close-file':
      return 'viewer.close'
    case 'next-tab':
      return 'tab.next'
    case 'prev-tab':
      return 'tab.prev'
    case 'move-tab':
      return action.dir === -1 ? 'tab.moveLeft' : 'tab.moveRight'
    case 'command-palette':
      return 'general.commandPalette'
    case 'quick-open':
      return 'general.quickOpen'
    case 'help-overlay':
      return 'general.keyboardHelp'
    case 'focus-region':
      return action.region === 'terminal' ? 'focus.terminal' : 'focus.explorer'
    case 'focus-cycle':
      return action.dir === 1 ? 'focus.cycleNext' : 'focus.cyclePrev'
    case 'jump-tab':
    case 'terminal-search':
    case 'passthrough':
      return null
  }
}

/**
 * Inverse of {@link commandIdForAction}: the {@link KeyAction} a command chord
 * should produce, or `null` for commands that have no chord form (palette-only
 * or region-local actions like `general.cycleTheme` or `tab.rename`). Used to
 * turn a persisted `chord → commandId` override back into a routable action.
 *
 * Accepts a plain string (persisted overrides aren't statically typed) and
 * returns `null` for anything unrecognized, so a stale or hand-edited override
 * can never crash keymap resolution.
 */
export function actionForCommand(id: string): KeyAction | null {
  switch (id) {
    case 'tab.new':
      return { kind: 'new-tab' }
    case 'tab.close':
      return { kind: 'close-tab' }
    case 'viewer.close':
      return { kind: 'close-file' }
    case 'tab.next':
      return { kind: 'next-tab' }
    case 'tab.prev':
      return { kind: 'prev-tab' }
    case 'tab.moveLeft':
      return { kind: 'move-tab', dir: -1 }
    case 'tab.moveRight':
      return { kind: 'move-tab', dir: 1 }
    case 'focus.terminal':
      return { kind: 'focus-region', region: 'terminal' }
    case 'focus.explorer':
      return { kind: 'focus-region', region: 'explorer' }
    case 'focus.cycleNext':
      return { kind: 'focus-cycle', dir: 1 }
    case 'focus.cyclePrev':
      return { kind: 'focus-cycle', dir: -1 }
    case 'general.commandPalette':
      return { kind: 'command-palette' }
    case 'general.quickOpen':
      return { kind: 'quick-open' }
    case 'general.keyboardHelp':
      return { kind: 'help-overlay' }
    case 'general.terminalSearch':
      return { kind: 'terminal-search' }
    default:
      return null
  }
}
