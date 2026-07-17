import { describe, it, expect, vi } from 'vitest'
import { Throttle, type ThrottleDeps } from './resize-throttle'

interface FakeClock {
  deps: ThrottleDeps
  advance: (ms: number) => void
}

function fakeClock(): FakeClock {
  let t = 0
  let nextId = 1
  const timers: Array<{ id: number; cb: () => void; at: number }> = []
  return {
    deps: {
      now: () => t,
      setTimer: (cb, ms) => {
        const id = nextId++
        timers.push({ id, cb, at: t + ms })
        return id
      },
      clearTimer: (h) => {
        const i = timers.findIndex((x) => x.id === h)
        if (i >= 0) timers.splice(i, 1)
      }
    },
    advance: (ms) => {
      t += ms
      for (const timer of [...timers]) {
        if (timer.at <= t) {
          timers.splice(timers.indexOf(timer), 1)
          timer.cb()
        }
      }
    }
  }
}

describe('Throttle', () => {
  it('runs the first call immediately (leading edge)', () => {
    const clock = fakeClock()
    const fn = vi.fn()
    const th = new Throttle<[number, number]>(fn, 50, clock.deps)
    th.call(80, 24)
    expect(fn).toHaveBeenCalledExactlyOnceWith(80, 24)
  })

  it('coalesces a burst into a single trailing call with the latest args', () => {
    const clock = fakeClock()
    const fn = vi.fn()
    const th = new Throttle<[number, number]>(fn, 50, clock.deps)

    th.call(80, 24) // t=0 → immediate
    clock.advance(10)
    th.call(90, 30) // t=10 → scheduled
    clock.advance(10)
    th.call(100, 40) // t=20 → replaces pending
    expect(fn).toHaveBeenCalledTimes(1)

    clock.advance(30) // t=50 → trailing fires with the latest args
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(100, 40)
  })

  it('runs immediately again once the interval has fully elapsed', () => {
    const clock = fakeClock()
    const fn = vi.fn()
    const th = new Throttle<[number, number]>(fn, 50, clock.deps)
    th.call(1, 1) // t=0
    clock.advance(60)
    th.call(2, 2) // t=60, elapsed 60 ≥ 50 → immediate
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith(2, 2)
  })

  it('dispose cancels a pending trailing call', () => {
    const clock = fakeClock()
    const fn = vi.fn()
    const th = new Throttle<[number, number]>(fn, 50, clock.deps)
    th.call(1, 1) // immediate
    clock.advance(5)
    th.call(2, 2) // scheduled
    th.dispose()
    clock.advance(100)
    expect(fn).toHaveBeenCalledTimes(1) // trailing never fired
  })

  it('dispose is safe with nothing pending', () => {
    const clock = fakeClock()
    const th = new Throttle<[]>(() => {}, 50, clock.deps)
    expect(() => th.dispose()).not.toThrow()
  })
})
