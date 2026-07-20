/**
 * Pure cost model for Claude Code usage. No I/O — token counts come from parsed
 * transcripts (see `transcript.ts`) and prices from the bundled table below.
 */

/** Token counts for one or more assistant turns, split by billing category. */
export interface TokenUsage {
  input: number
  output: number
  cacheRead: number
  /** 5-minute ephemeral cache writes (billed at 1.25× base input). */
  cacheWrite5m: number
  /** 1-hour ephemeral cache writes (billed at 2× base input). */
  cacheWrite1h: number
}

/** USD per 1,000,000 tokens for a model's base input and output. */
export interface ModelPrice {
  input: number
  output: number
}

export function emptyUsage(): TokenUsage {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 }
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite5m: a.cacheWrite5m + b.cacheWrite5m,
    cacheWrite1h: a.cacheWrite1h + b.cacheWrite1h
  }
}

/** Accumulate `source`'s per-model usage into `target` (mutates `target`). */
export function mergeUsageInto(
  target: Record<string, TokenUsage>,
  source: Record<string, TokenUsage>
): void {
  for (const [model, usage] of Object.entries(source)) {
    target[model] = addUsage(target[model] ?? emptyUsage(), usage)
  }
}

// Cache pricing multipliers, relative to a model's base input rate.
const CACHE_READ_MULT = 0.1
const CACHE_WRITE_5M_MULT = 1.25
const CACHE_WRITE_1H_MULT = 2

/** Fallback for models not in the table (current Opus-tier rate). */
export const DEFAULT_PRICE: ModelPrice = { input: 5, output: 25 }

// Matched by substring (regex) against the model id — dated snapshots like
// `claude-sonnet-4-5-20250929` still hit the right rule. Order = most specific
// first. Rates are USD per 1M tokens.
const PRICING_RULES: ReadonlyArray<{ match: RegExp; price: ModelPrice }> = [
  { match: /opus-4-[5678]/, price: { input: 5, output: 25 } },
  { match: /opus-4-[01]|3-opus/, price: { input: 15, output: 75 } },
  { match: /fable-5|mythos-5|mythos-preview/, price: { input: 10, output: 50 } },
  { match: /sonnet-5/, price: { input: 3, output: 15 } },
  { match: /sonnet-4|3-7-sonnet|3-5-sonnet|3-sonnet/, price: { input: 3, output: 15 } },
  { match: /haiku-4-5/, price: { input: 1, output: 5 } },
  { match: /3-5-haiku/, price: { input: 0.8, output: 4 } },
  { match: /3-haiku/, price: { input: 0.25, output: 1.25 } }
]

/** The pricing for a model id, falling back to {@link DEFAULT_PRICE}. */
export function priceForModel(model: string): ModelPrice {
  for (const rule of PRICING_RULES) {
    if (rule.match.test(model)) return rule.price
  }
  return DEFAULT_PRICE
}

/** Estimated USD cost of `usage` billed at `model`'s rates. */
export function costForUsage(usage: TokenUsage, model: string): number {
  const price = priceForModel(model)
  const inRate = price.input / 1_000_000
  const outRate = price.output / 1_000_000
  return (
    usage.input * inRate +
    usage.output * outRate +
    usage.cacheRead * inRate * CACHE_READ_MULT +
    usage.cacheWrite5m * inRate * CACHE_WRITE_5M_MULT +
    usage.cacheWrite1h * inRate * CACHE_WRITE_1H_MULT
  )
}
