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
    case 'next-tab':
      return 'tab.next'
    case 'prev-tab':
      return 'tab.prev'
    case 'move-tab':
      return action.dir === -1 ? 'tab.moveLeft' : 'tab.moveRight'
    case 'command-palette':
      return 'general.commandPalette'
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
