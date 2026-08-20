/**
 * Viewport store — the camera for a GraphCanvas.
 *
 * `set()` writes the world transform imperatively (no React work) and schedules
 * a single rAF commit; the committed snapshot is what React reads through the
 * `useSyncExternalStore` hooks in `useViewport.ts`. Snapshots (`get()`,
 * `getContainerSize()`, `getVisibleWorldRect()`) are referentially stable
 * between commits so store consumers never loop.
 */

import type { Rect, Size, Viewport, ZoomLimits } from './types';
import { clampZoom, getVisibleWorldRect } from './viewportMath';
import { lerpViewport, tween, type TweenHandle } from './tween';

export interface ViewportStore {
  /** Last COMMITTED snapshot (stable object until it changes). */
  get(): Viewport;
  /** Latest value passed to `set()` (may be uncommitted). */
  peek(): Viewport;
  getContainerSize(): Size;
  /** Cached per commit. */
  getVisibleWorldRect(): Rect;
  getLimits(): ZoomLimits;
  subscribe(listener: () => void): () => void;
  /** Clamps zoom; writes `world.style.transform` NOW; schedules ONE commit via raf. */
  set(v: Viewport): void;
  /** Commits immediately (notifies) — only when the size actually changed. */
  setContainerSize(size: Size): void;
  setLimits(limits: ZoomLimits): void;
  /** Applies the current transform to the element immediately. */
  attachWorld(el: HTMLElement | null): void;
  /** Tween via `set()`; cancels any running animation; `durationMs <= 0` → `set()` directly. */
  animateTo(v: Viewport, durationMs: number): Promise<void>;
  cancelAnimation(): void;
  /** Cancels raf/animation and drops subscribers. */
  destroy(): void;
}

export interface ViewportStoreInit {
  viewport?: Viewport;
  limits?: ZoomLimits;
  containerSize?: Size;
  raf?: (cb: FrameRequestCallback) => number;
  caf?: (id: number) => void;
  now?: () => number;
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
const DEFAULT_LIMITS: ZoomLimits = { min: 0.05, max: 2 };
const DEFAULT_SIZE: Size = { width: 0, height: 0 };

export function viewportTransform(v: Viewport): string {
  return `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
}

function defaultRaf(cb: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(cb);
  return setTimeout(() => cb(Date.now()), 16) as unknown as number;
}

function defaultCaf(id: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}

function defaultNow(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function sameViewport(a: Viewport, b: Viewport): boolean {
  return a.x === b.x && a.y === b.y && a.zoom === b.zoom;
}

export function createViewportStore(init: ViewportStoreInit = {}): ViewportStore {
  const raf = init.raf ?? defaultRaf;
  const caf = init.caf ?? defaultCaf;
  const now = init.now ?? defaultNow;

  let limits: ZoomLimits = init.limits ? { ...init.limits } : { ...DEFAULT_LIMITS };
  const initial = init.viewport ?? DEFAULT_VIEWPORT;
  let pending: Viewport = { x: initial.x, y: initial.y, zoom: clampZoom(initial.zoom, limits) };
  let committed: Viewport = pending;
  let containerSize: Size = init.containerSize
    ? { width: init.containerSize.width, height: init.containerSize.height }
    : { ...DEFAULT_SIZE };
  let visibleRect: Rect = getVisibleWorldRect(committed, containerSize);

  let world: HTMLElement | null = null;
  let rafId: number | null = null;
  let animation: TweenHandle | null = null;
  let destroyed = false;
  const listeners = new Set<() => void>();

  const applyTransform = (): void => {
    if (world) world.style.transform = viewportTransform(pending);
  };

  const notify = (): void => {
    for (const listener of Array.from(listeners)) listener();
  };

  /**
   * Copy pending → committed, refresh the cached rect (only when something it
   * depends on changed, so snapshots stay referentially stable) and notify once.
   */
  const commit = (sizeChanged = false): void => {
    if (rafId !== null) {
      caf(rafId);
      rafId = null;
    }
    const viewportChanged = !sameViewport(committed, pending);
    if (viewportChanged) committed = pending;
    if (viewportChanged || sizeChanged) visibleRect = getVisibleWorldRect(committed, containerSize);
    notify();
  };

  const scheduleCommit = (): void => {
    if (destroyed || rafId !== null) return;
    rafId = raf(() => {
      rafId = null;
      commit();
    });
  };

  const set = (v: Viewport): void => {
    if (destroyed) return;
    pending = { x: v.x, y: v.y, zoom: clampZoom(v.zoom, limits) };
    applyTransform();
    scheduleCommit();
  };

  const cancelAnimation = (): void => {
    if (!animation) return;
    const handle = animation;
    animation = null;
    handle.cancel();
  };

  return {
    get: () => committed,
    peek: () => pending,
    getContainerSize: () => containerSize,
    getVisibleWorldRect: () => visibleRect,
    getLimits: () => limits,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    set,

    setContainerSize(size) {
      if (destroyed) return;
      if (size.width === containerSize.width && size.height === containerSize.height) return;
      containerSize = { width: size.width, height: size.height };
      commit(true);
    },

    setLimits(next) {
      limits = { min: next.min, max: next.max };
      // Re-clamp the current camera if the new limits exclude it.
      if (clampZoom(pending.zoom, limits) !== pending.zoom) set(pending);
    },

    attachWorld(el) {
      world = el;
      applyTransform();
    },

    animateTo(v, durationMs) {
      cancelAnimation();
      if (destroyed) return Promise.resolve();
      const from = pending;
      const to: Viewport = { x: v.x, y: v.y, zoom: clampZoom(v.zoom, limits) };
      if (!(durationMs > 0)) {
        set(to);
        return Promise.resolve();
      }
      const handle = tween({
        duration: durationMs,
        onUpdate: (t) => set(lerpViewport(from, to, t)),
        onComplete: () => {
          if (animation === handle) animation = null;
        },
        now,
        raf,
        caf,
      });
      animation = handle;
      return handle.finished;
    },

    cancelAnimation,

    destroy() {
      cancelAnimation();
      if (rafId !== null) {
        caf(rafId);
        rafId = null;
      }
      listeners.clear();
      world = null;
      destroyed = true;
    },
  };
}
