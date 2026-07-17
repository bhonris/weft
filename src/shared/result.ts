/**
 * Result<T, E> — errors cross the IPC seam as data, never as thrown exceptions
 * that vanish across the process boundary.
 */
export type Result<T, E = string> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok
}
