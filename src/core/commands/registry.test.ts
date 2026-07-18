import { describe, it, expect } from 'vitest'
import { COMMANDS, CATEGORY_ORDER, type CommandCategory } from './registry'
import { parseChord } from './chord'
import { routeKey } from '../keybindings/keybinding-router'

describe('command registry', () => {
  it('has unique command ids', () => {
    const ids = COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every command a non-empty title and a known category', () => {
    for (const c of COMMANDS) {
      expect(c.title.trim().length).toBeGreaterThan(0)
      expect(CATEGORY_ORDER).toContain(c.category)
    }
  })

  it('every category in use appears in CATEGORY_ORDER', () => {
    const used = new Set<CommandCategory>(COMMANDS.map((c) => c.category))
    for (const cat of used) expect(CATEGORY_ORDER).toContain(cat)
  })

  // No-drift guard: a command that declares it routes through the global router
  // must have a shortcutHint that really produces exactly that KeyAction.
  it('each router-backed command shortcut resolves to its declared action', () => {
    for (const c of COMMANDS) {
      if (!c.routes) continue
      expect(c.shortcutHint, `${c.id} declares routes but no shortcutHint`).toBeTruthy()
      const parsed = parseChord(c.shortcutHint!)
      expect(parsed, `${c.id}: unparseable chord "${c.shortcutHint}"`).not.toBeNull()
      expect(routeKey(parsed!).kind, `${c.id}: "${c.shortcutHint}" drifted`).toBe(c.routes)
    }
  })

  // Local-shortcut commands (F2 rename, Ctrl+S save, Ctrl+Shift+F search) must
  // NOT be global chords — their keys route to passthrough by design.
  it('local-shortcut commands route to passthrough (handled in-context)', () => {
    for (const c of COMMANDS) {
      if (c.routes || !c.shortcutHint) continue
      const parsed = parseChord(c.shortcutHint)
      if (!parsed) continue
      expect(routeKey(parsed).kind, `${c.id}: "${c.shortcutHint}" should be local`).toBe(
        'passthrough'
      )
    }
  })

  it('includes the pillar commands', () => {
    const ids = new Set(COMMANDS.map((c) => c.id))
    for (const id of [
      'general.commandPalette',
      'general.keyboardHelp',
      'focus.terminal',
      'focus.explorer',
      'tab.rename',
      'viewer.save'
    ]) {
      expect(ids).toContain(id)
    }
  })
})
