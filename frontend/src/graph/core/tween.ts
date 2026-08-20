/**
 * Minimal, dependency-free tween with injectable timing so it can be driven
 * deterministically in tests (`now` / `raf` / `caf`).
 */

import type { Viewport } from './types';

export type Easing = (t: number) => number;

/** Default easing. `easeInOutCubic(0) === 0`, `easeInOutCubic(1) === 1`. */
export const easeInOutCubic: Easing = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Component-wise linear interpolation of x / y / zoom. */
export function lerpViewport(a: Viewport, b: Viewport, t: number): Viewport {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    zoom: lerp(a.zoom, b.zoom, t),
  };
}

export interface TweenOptions {
  /** ms. `<= 0` (or non-finite) → completes synchronously. */
  duration: number;
  /** Default `easeInOutCubic`. */
  easing?: Easing;
  /** Receives the EASED progress in `[0, 1]`; the final call is always exactly `1`. */
  onUpdate: (t01: number) => void;
  /** Called once, after the final `onUpdate(1)`. Not called on cancel. */
  onComplete?: () => void;
  /** Clock (ms). Default `performance.now`. */
  now?: () => number;
  /** Frame scheduler. Default `requestAnimationFrame`. */
  raf?: (cb: FrameRequestCallback) => number;
  /** Frame canceller. Default `cancelAnimationFrame`. */
  caf?: (id: number) => void;
}

export interface TweenHandle {
  /** Stops the tween. `onComplete` is NOT called; `finished` resolves. Idempotent. */
  cancel(): void;
  /** Resolves on completion AND on cancel. */
  finished: Promise<void>;
}

const defaultNow = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const defaultRaf = (cb: FrameRequestCallback): number =>
  typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(cb)
    : (setTimeout(() => cb(defaultNow()), 16) as unknown as number);

const defaultCaf = (id: number): void => {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
};

/**
 * Start a tween. Progress is sampled once per animation frame as
 * `min(1, (now() - start) / duration)`, passed through `easing`, and handed to
 * `onUpdate`. When progress reaches 1: `onUpdate(1)`, then `onComplete()`, then
 * `finished` resolves.
 *
 * `duration <= 0` → `onUpdate(1)` + `onComplete()` synchronously (no frame is
 * scheduled) and `finished` is already resolved.
 */
export function tween(opts: TweenOptions): TweenHandle {
  const { duration, onUpdate, onComplete } = opts;
  const easing = opts.easing ?? easeInOutCubic;
  const now = opts.now ?? defaultNow;
  const raf = opts.raf ?? defaultRaf;
  const caf = opts.caf ?? defaultCaf;

  let resolveFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });

  if (!(duration > 0) || !Number.isFinite(duration)) {
    onUpdate(1);
    onComplete?.();
    resolveFinished();
    return { cancel: () => {}, finished };
  }

  let done = false;
  let rafId: number | null = null;
  const start = now();

  const step = (): void => {
    if (done) return;
    rafId = null;
    const raw = Math.min(1, Math.max(0, (now() - start) / duration));
    if (raw >= 1) {
      done = true;
      onUpdate(1);
      onComplete?.();
      resolveFinished();
      return;
    }
    onUpdate(easing(raw));
    if (!done) rafId = raf(step);
  };

  rafId = raf(step);

  return {
    cancel: () => {
      if (done) return;
      done = true;
      if (rafId !== null) {
        caf(rafId);
        rafId = null;
      }
      resolveFinished();
    },
    finished,
  };
}
