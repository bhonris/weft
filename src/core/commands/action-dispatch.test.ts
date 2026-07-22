import { describe, it, expect } from 'vitest'
import { commandIdForAction, actionForCommand } from './action-dispatch'
import { COMMANDS } from './registry'
import type { KeyAction } from '../keybindings/keybinding-router'
import type { CommandId } from './registry'

/** Every KeyAction shape routeKey can emit, with each parameter branch covered. */
const ALL_ACTIONS: KeyAction[] = [
  { kind: 'new-tab' },
  { kind: 'close-tab' },
  { kind: 'next-tab' },
  { kind: 'prev-tab' },
  { kind: 'jump-tab', index: 0 },
  { kind: 'command-palette' },
  { kind: 'help-overlay' },
  { kind: 'focus-region', region: 'terminal' },
  { kind: 'focus-region', region: 'explorer' },
  { kind: 'focus-cycle', dir: 1 },
  { kind: 'focus-cycle', dir: -1 },
  { kind: 'move-tab', dir: 1 },
  { kind: 'move-tab', dir: -1 },
  { kind: 'terminal-font', dir: 1 },
  { kind: 'terminal-font', dir: -1 },
  { kind: 'terminal-font', dir: 0 },
  { kind: 'terminal-search' },
  { kind: 'passthrough' }
]

describe('commandIdForAction', () => {
  it.each<[KeyAction, CommandId | null]>([
    [{ kind: 'new-tab' }, 'tab.new'],
    [{ kind: 'close-tab' }, 'tab.close'],
    [{ kind: 'next-tab' }, 'tab.next'],
    [{ kind: 'prev-tab' }, 'tab.prev'],
    [{ kind: 'move-tab', dir: -1 }, 'tab.moveLeft'],
    [{ kind: 'move-tab', dir: 1 }, 'tab.moveRight'],
    [{ kind: 'command-palette' }, 'general.commandPalette'],
    [{ kind: 'help-overlay' }, 'general.keyboardHelp'],
    [{ kind: 'focus-region', region: 'terminal' }, 'focus.terminal'],
    [{ kind: 'focus-region', region: 'explorer' }, 'focus.explorer'],
    [{ kind: 'focus-cycle', dir: 1 }, 'focus.cycleNext'],
    [{ kind: 'focus-cycle', dir: -1 }, 'focus.cyclePrev'],
    [{ kind: 'terminal-font', dir: 1 }, 'view.terminalFontIn'],
    [{ kind: 'terminal-font', dir: -1 }, 'view.terminalFontOut'],
    [{ kind: 'terminal-font', dir: 0 }, 'view.terminalFontReset'],
    // Not command-dispatched — must return null so the caller handles/passes them.
    [{ kind: 'jump-tab', index: 3 }, null],
    [{ kind: 'terminal-search' }, null],
    [{ kind: 'passthrough' }, null]
  ])('maps %o to %s', (action, expected) => {
    expect(commandIdForAction(action)).toBe(expected)
  })

  // The core Expansion-7 guarantee: a chord and its palette entry can never
  // drift because a chord resolves to a real CommandId whose registry `routes`
  // matches the action that produced it. (This is what the Cycle-6 viewer.save
  // duplicate-case bug would have failed.)
  it('every dispatched action resolves to a command whose declared route matches', () => {
    for (const action of ALL_ACTIONS) {
      const id = commandIdForAction(action)
      if (id === null) continue
      const cmd = COMMANDS.find((c) => c.id === id)
      expect(cmd, `dispatch produced unknown command id "${id}"`).toBeDefined()
      expect(cmd!.routes, `${id} route drifted from action ${action.kind}`).toBe(action.kind)
    }
  })

  // The reverse guarantee: every command that DECLARES a global route is
  // actually wired into the dispatcher (no orphan `routes`). `terminal-search`
  // is the one intentional exception — its chord passes through so the focused
  // TerminalPane opens its own search (see action-dispatch.ts).
  it('every routed command is reachable through the dispatcher', () => {
    const produced = new Set(
      ALL_ACTIONS.map(commandIdForAction).filter((id): id is CommandId => id !== null)
    )
    for (const cmd of COMMANDS) {
      if (!cmd.routes || cmd.routes === 'terminal-search') continue
      expect(produced.has(cmd.id), `command ${cmd.id} declares routes but is not dispatched`).toBe(
        true
      )
    }
  })
})

describe('actionForCommand (inverse — for rebinding)', () => {
  // Commands that dispatch through runCommand round-trip both ways. terminal-search
  // is excluded: it has a chord action but that action is passthrough (handled by
  // TerminalPane), so commandIdForAction deliberately maps it back to null.
  const ROUND_TRIP: CommandId[] = [
    'tab.new',
    'tab.close',
    'tab.next',
    'tab.prev',
    'tab.moveLeft',
    'tab.moveRight',
    'focus.terminal',
    'focus.explorer',
    'focus.cycleNext',
    'focus.cyclePrev',
    'view.terminalFontIn',
    'view.terminalFontOut',
    'view.terminalFontReset',
    'general.commandPalette',
    'general.keyboardHelp'
  ]

  it('round-trips with commandIdForAction for every dispatched command', () => {
    for (const id of ROUND_TRIP) {
      const action = actionForCommand(id)
      expect(action, `${id} should have a chord action`).not.toBeNull()
      expect(commandIdForAction(action!)).toBe(id)
    }
  })

  it('gives terminal-search a chord action even though it is passthrough (asymmetric)', () => {
    expect(actionForCommand('general.terminalSearch')).toEqual({ kind: 'terminal-search' })
    // commandIdForAction maps it back to null — the intentional passthrough case.
    expect(commandIdForAction({ kind: 'terminal-search' })).toBeNull()
  })

  it('returns null for palette-only / region-local commands (no chord form)', () => {
    for (const id of [
      'general.cycleTheme',
      'general.toggleResume',
      'tab.rename',
      'viewer.save',
      // Whole-window zoom is palette-only now (Ctrl+= family drives terminal font).
      'view.zoomIn',
      'view.zoomOut',
      'view.zoomReset'
    ]) {
      expect(actionForCommand(id)).toBeNull()
    }
  })

  it('returns null for an unknown id (defensive against stale overrides)', () => {
    expect(actionForCommand('nope.not.a.command')).toBeNull()
  })
})
