/**
 * The font stack for the xterm terminal, as a single ordered CSS `font-family`
 * list.
 *
 * WHY THIS IS A MODULE (and not an inline literal in TerminalPane): the ordering
 * encodes a real correctness requirement that is easy to break by accident, so
 * it lives in pure `core/` with a regression test.
 *
 * Ordering rationale — CSS resolves `font-family` fallback PER GLYPH:
 *  1. Monospace fonts first (`Consolas` → `Cascadia Mono` → `Courier New`) so
 *     ASCII/Latin renders in a fixed-width cell and terminal columns stay
 *     aligned. These are what the vast majority of terminal output uses.
 *  2. Thai-capable fonts next. `Consolas`, `Cascadia Mono` and `Courier New`
 *     contain NO Thai glyphs, so without these a Thai codepoint (U+0E01–U+0E5B)
 *     falls back to an arbitrary proportional system font and its combining
 *     vowels/tone marks render as tofu (□) or detached/overlapping marks. The OS
 *     Thai UI fonts (`Leelawadee UI`, `Tahoma` on Windows; `Noto Sans Thai`
 *     elsewhere) are tried first for readability, then `Chakra Petch` — which is
 *     BUNDLED and always present: `@fontsource/chakra-petch` is already imported
 *     in the renderer and its 400/500/600/700 CSS ships a Thai `@font-face`
 *     (`unicode-range: U+0E01-0E5B`). Chakra Petch is therefore the guaranteed
 *     backstop that makes Thai render even on a machine with no OS Thai font.
 *  3. Generic `monospace` last.
 *
 * Because ASCII lives entirely in the leading monospace fonts, the Thai fonts
 * are only ever reached for codepoints the monospace fonts lack — so adding them
 * cannot disturb Latin cell metrics.
 */
export const TERMINAL_FONT_FAMILY =
  'Consolas, "Cascadia Mono", "Courier New", "Leelawadee UI", "Tahoma", "Noto Sans Thai", "Chakra Petch", monospace'

/**
 * xterm row-height multiple. >1 gives Thai its stacked layers (lower vowel /
 * base / upper vowel / tone mark) the vertical room they need so nothing is
 * cropped, while staying tight enough that Latin-only output doesn't feel sparse.
 * Pairs with the grapheme-cluster Unicode provider (see TerminalPane), which
 * groups a base consonant + its marks into a single cell for the DOM renderer.
 */
export const TERMINAL_LINE_HEIGHT = 1.2
