import { describe, expect, it, vi } from 'vitest';
import { easeInOutCubic, lerp, lerpViewport, tween } from '../core/tween';

/** Deterministic clock + frame queue. */
function fakeTiming(start = 0) {
  let time = start;
  let nextId = 1;
  const queue = new Map<number, FrameRequestCallback>();
  return {
    now: () => time,
    raf: (cb: FrameRequestCallback) => {
      const id = nextId++;
      queue.set(id, cb);
      return id;
    },
    caf: (id: number) => {
      queue.delete(id);
    },
    /** Advance the clock and run every frame that was queued BEFORE this call. */
    frame(dt: number) {
      time += dt;
      const pending = [...queue.entries()];
      queue.clear();
      for (const [, cb] of pending) cb(time);
    },
    get pending() {
      return queue.size;
    },
  };
}

describe('easing / lerp', () => {
  it('easeInOutCubic is 0 at 0, 1 at 1, 0.5 at 0.5 and monotonic', () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5);
    let prev = -1;
    for (let i = 0; i <= 100; i++) {
      const v = easeInOutCubic(i / 100);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('lerp / lerpViewport interpolate linearly', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(lerp(10, 0, 1)).toBe(0);
    expect(lerpViewport({ x: 0, y: 100, zoom: 1 }, { x: 10, y: 0, zoom: 3 }, 0.5)).toEqual({ x: 5, y: 50, zoom: 2 });
    expect(lerpViewport({ x: 0, y: 0, zoom: 1 }, { x: 10, y: 20, zoom: 3 }, 0)).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(lerpViewport({ x: 0, y: 0, zoom: 1 }, { x: 10, y: 20, zoom: 3 }, 1)).toEqual({ x: 10, y: 20, zoom: 3 });
  });
});

describe('tween', () => {
  it('runs 0 → 1 monotonically and calls onComplete exactly once', async () => {
    const timing = fakeTiming();
    const values: number[] = [];
    const onComplete = vi.fn();
    const handle = tween({
      duration: 100,
      onUpdate: (t) => values.push(t),
      onComplete,
      now: timing.now,
      raf: timing.raf,
      caf: timing.caf,
    });

    // nothing happens synchronously for a positive duration
    expect(values).toEqual([]);
    expect(onComplete).not.toHaveBeenCalled();

    timing.frame(0); // first frame fires at the start time → progress 0
    for (let i = 0; i < 20 && timing.pending > 0; i++) timing.frame(16);

    expect(values[0]).toBe(0);
    expect(values.length).toBeGreaterThan(3);
    expect(values[values.length - 1]).toBe(1);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(timing.pending).toBe(0);

    await expect(handle.finished).resolves.toBeUndefined();
    // extra frames after completion do nothing
    timing.frame(16);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(values[values.length - 1]).toBe(1);
  });

  it('applies the easing to onUpdate and lands exactly on 1', () => {
    const timing = fakeTiming(1000);
    const values: number[] = [];
    tween({
      duration: 100,
      easing: (t) => t * t,
      onUpdate: (t) => values.push(t),
      now: timing.now,
      raf: timing.raf,
      caf: timing.caf,
    });
    timing.frame(0); // t = 0
    timing.frame(50); // t = 0.5 → 0.25
    timing.frame(50); // t = 1
    expect(values).toEqual([0, 0.25, 1]);
  });

  it('uses easeInOutCubic by default', () => {
    const timing = fakeTiming();
    const values: number[] = [];
    tween({ duration: 100, onUpdate: (t) => values.push(t), now: timing.now, raf: timing.raf, caf: timing.caf });
    timing.frame(25);
    expect(values[0]).toBeCloseTo(easeInOutCubic(0.25));
  });

  it('cancel stops frames, resolves finished, and does not call onComplete', async () => {
    const timing = fakeTiming();
    const values: number[] = [];
    const onComplete = vi.fn();
    const handle = tween({
      duration: 100,
      onUpdate: (t) => values.push(t),
      onComplete,
      now: timing.now,
      raf: timing.raf,
      caf: timing.caf,
    });
    timing.frame(10);
    timing.frame(10);
    const countAtCancel = values.length;
    expect(timing.pending).toBe(1);

    handle.cancel();
    expect(timing.pending).toBe(0); // caf was called
    await expect(handle.finished).resolves.toBeUndefined();

    timing.frame(200);
    expect(values.length).toBe(countAtCancel);
    expect(onComplete).not.toHaveBeenCalled();

    // idempotent
    handle.cancel();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('cancel after completion is a no-op', async () => {
    const timing = fakeTiming();
    const onComplete = vi.fn();
    const handle = tween({ duration: 10, onUpdate: () => {}, onComplete, now: timing.now, raf: timing.raf, caf: timing.caf });
    timing.frame(20);
    expect(onComplete).toHaveBeenCalledTimes(1);
    handle.cancel();
    await handle.finished;
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('duration <= 0 completes synchronously with onUpdate(1) + onComplete', async () => {
    for (const duration of [0, -5, NaN]) {
      const raf = vi.fn();
      const onUpdate = vi.fn();
      const onComplete = vi.fn();
      const handle = tween({ duration, onUpdate, onComplete, raf, now: () => 0, caf: () => {} });
      expect(onUpdate).toHaveBeenCalledTimes(1);
      expect(onUpdate).toHaveBeenCalledWith(1);
      expect(onComplete).toHaveBeenCalledTimes(1);
      expect(raf).not.toHaveBeenCalled();
      await expect(handle.finished).resolves.toBeUndefined();
      handle.cancel(); // harmless
      expect(onComplete).toHaveBeenCalledTimes(1);
    }
  });

  it('a tween cancelled from inside onUpdate schedules no further frame', () => {
    const timing = fakeTiming();
    let handle: ReturnType<typeof tween> | null = null;
    const onUpdate = vi.fn(() => handle?.cancel());
    handle = tween({ duration: 100, onUpdate, now: timing.now, raf: timing.raf, caf: timing.caf });
    timing.frame(10);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(timing.pending).toBe(0);
  });

  it('falls back to real timers when none are injected', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] });
    try {
      const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
        return setTimeout(() => cb(performance.now()), 16) as unknown as number;
      });
      const onComplete = vi.fn();
      const handle = tween({ duration: 30, onUpdate: () => {}, onComplete });
      await vi.advanceTimersByTimeAsync(200);
      expect(rafSpy).toHaveBeenCalled();
      expect(onComplete).toHaveBeenCalledTimes(1);
      await expect(handle.finished).resolves.toBeUndefined();
      rafSpy.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });
});
