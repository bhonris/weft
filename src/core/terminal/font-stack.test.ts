import { describe, it, expect } from 'vitest'
import { TERMINAL_FONT_FAMILY } from './font-stack'

/**
 * Regression guard for the Thai-tofu bug: the terminal font stack once listed
 * only `Consolas, "Cascadia Mono", "Courier New", monospace` — none of which
 * carry Thai glyphs — so typed Thai rendered as boxes / detached marks. These
 * tests fail loudly if a future edit drops Thai coverage or reorders the stack
 * so that a proportional font precedes the monospace ones (which would break
 * ASCII column alignment).
 */
describe('TERMINAL_FONT_FAMILY', () => {
  const fonts = TERMINAL_FONT_FAMILY.split(',').map((f) => f.trim().replace(/^"|"$/g, ''))

  it('leads with fixed-width fonts so ASCII columns stay aligned', () => {
    expect(fonts[0]).toBe('Consolas')
    // The first three entries must all be monospace typefaces.
    expect(fonts.slice(0, 3)).toEqual(['Consolas', 'Cascadia Mono', 'Courier New'])
  })

  it('includes at least one Thai-capable fallback', () => {
    const thaiCapable = ['Leelawadee UI', 'Tahoma', 'Noto Sans Thai', 'Chakra Petch']
    expect(fonts.some((f) => thaiCapable.includes(f))).toBe(true)
  })

  it('includes the bundled Chakra Petch as the guaranteed Thai backstop', () => {
    // Chakra Petch is imported in the renderer with its Thai subset, so it is
    // present regardless of OS-installed fonts.
    expect(fonts).toContain('Chakra Petch')
  })

  it('lists the guaranteed backstop after OS Thai fonts but before generic monospace', () => {
    expect(fonts.indexOf('Chakra Petch')).toBeGreaterThan(fonts.indexOf('Leelawadee UI'))
    expect(fonts.indexOf('Chakra Petch')).toBeLessThan(fonts.indexOf('monospace'))
  })

  it('ends with the generic monospace family', () => {
    expect(fonts.at(-1)).toBe('monospace')
  })
})
