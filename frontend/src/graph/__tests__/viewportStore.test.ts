import { describe, expect, it, vi } from 'vitest';
import { createViewportStore } from '../core/viewportStore';
import { createFrameHarness } from './testUtils';

function setup(init: Parameters<typeof createViewportStore>[0] = {}) {
  const frames = createFrameHarness();
  const store = createViewportStore({
    raf: frames.raf,
    caf: frames.caf,
    now: frames.now,
    limits: { min: 0.1, max: 4 },
    containerSize: { width: 800, height: 600 },
    ...init,
  });
  return { frames, store };
}

describe('createViewportStore', () => {
  it('starts from the given viewport / limits / size', () => {
    const { store } = setup({ viewport: { x: 5, y: 6, zoom: 2 } });
    expect(store.get()).toEqual({ x: 5, y: 6, zoom: 2 });
    expect(store.peek()).toEqual({ x: 5, y: 6, zoom: 2 });
    expect(store.getLimits()).toEqual({ min: 0.1, max: 4 });
    expect(store.getContainerSize()).toEqual({ width: 800, height: 600 });
    // visible rect: (0 - 5) / 2 … 800 / 2 wide
    expect(store.getVisibleWorldRect()).toEqual({ x: -2.5, y: -3, width: 400, height: 300 });
  });

  it('set() writes the transform synchronously to an attached element', () => {
    const { store } = setup();
    const el = document.createElement('div');
    store.attachWorld(el);
    expect(el.style.transform).toBe('translate(0px, 0px) scale(1)');
    store.set({ x: 10, y: -20, zoom: 1.5 });
    expect(el.style.transform).toBe('translate(10px, -20px) scale(1.5)');
    // committed snapshot has not moved yet
    expect(store.get()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(store.peek()).toEqual({ x: 10, y: -20, zoom: 1.5 });
  });

  it('attachWorld() applies the current (pending) transform immediately', () => {
    const { store } = setup();
    store.set({ x: 3, y: 4, zoom: 0.5 });
    const el = document.createElement('div');
    store.attachWorld(el);
    expect(el.style.transform).toBe('translate(3px, 4px) scale(0.5)');
    store.attachWorld(null);
    store.set({ x: 9, y: 9, zoom: 1 });
    expect(el.style.transform).toBe('translate(3px, 4px) scale(0.5)');
  });

  it('setInteracting() promotes the world only while active', () => {
    const { store } = setup();
    const el = document.createElement('div');
    store.attachWorld(el);
    expect(el.style.willChange).toBe('');
    store.setInteracting(true);
    expect(el.style.willChange).toBe('transform');
    store.setInteracting(false);
    expect(el.style.willChange).toBe('');
  });

  it('attachWorld() applies the current interacting state', () => {
    const { store } = setup();
    store.setInteracting(true);
    const el = document.createElement('div');
    store.attachWorld(el);
    expect(el.style.willChange).toBe('transform');
    // Re-attach after the gesture ended: promotion is cleared.
    store.setInteracting(false);
    const el2 = document.createElement('div');
    el2.style.willChange = 'transform';
    store.attachWorld(el2);
    expect(el2.style.willChange).toBe('');
  });

  it('coalesces multiple set() calls into one commit + one notification', () => {
    const { store, frames } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ x: 1, y: 1, zoom: 1 });
    store.set({ x: 2, y: 2, zoom: 1 });
    store.set({ x: 3, y: 3, zoom: 1 });
    expect(frames.pending()).toBe(1);
    expect(listener).not.toHaveBeenCalled();
    expect(store.get()).toEqual({ x: 0, y: 0, zoom: 1 });
    frames.flush();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ x: 3, y: 3, zoom: 1 });
    expect(frames.pending()).toBe(0);
    // Nothing more happens without further set() calls
    frames.flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('clamps zoom to the limits (set, init, setLimits)', () => {
    const { store, frames } = setup({ viewport: { x: 0, y: 0, zoom: 100 } });
    expect(store.get().zoom).toBe(4);
    store.set({ x: 0, y: 0, zoom: 0.001 });
    expect(store.peek().zoom).toBe(0.1);
    frames.flush();
    expect(store.get().zoom).toBe(0.1);
    store.set({ x: 0, y: 0, zoom: 3 });
    frames.flush();
    store.setLimits({ min: 0.5, max: 2 });
    expect(store.getLimits()).toEqual({ min: 0.5, max: 2 });
    expect(store.peek().zoom).toBe(2);
    frames.flush();
    expect(store.get().zoom).toBe(2);
  });

  it('setContainerSize commits and notifies immediately, only when changed', () => {
    const { store } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getVisibleWorldRect();
    store.setContainerSize({ width: 800, height: 600 });
    expect(listener).not.toHaveBeenCalled();
    expect(store.getVisibleWorldRect()).toBe(before);
    store.setContainerSize({ width: 400, height: 300 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getContainerSize()).toEqual({ width: 400, height: 300 });
    expect(store.getVisibleWorldRect()).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  });

  it('setContainerSize flushes a pending viewport in the same commit', () => {
    const { store, frames } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.set({ x: 10, y: 0, zoom: 1 });
    store.setContainerSize({ width: 100, height: 100 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.get()).toEqual({ x: 10, y: 0, zoom: 1 });
    expect(frames.pending()).toBe(0);
  });

  it('snapshots are referentially stable between commits', () => {
    const { store, frames } = setup();
    const vp = store.get();
    const size = store.getContainerSize();
    const rect = store.getVisibleWorldRect();
    expect(store.get()).toBe(vp);
    expect(store.getContainerSize()).toBe(size);
    expect(store.getVisibleWorldRect()).toBe(rect);
    store.set({ x: 1, y: 2, zoom: 1 });
    // still the committed objects until the frame
    expect(store.get()).toBe(vp);
    expect(store.getVisibleWorldRect()).toBe(rect);
    frames.flush();
    const vp2 = store.get();
    expect(vp2).not.toBe(vp);
    expect(store.get()).toBe(vp2);
    expect(store.getContainerSize()).toBe(size);
    // A no-op commit keeps the committed object
    store.set({ x: 1, y: 2, zoom: 1 });
    frames.flush();
    expect(store.get()).toBe(vp2);
  });

  it('subscribe returns an unsubscribe function', () => {
    const { store, frames } = setup();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set({ x: 1, y: 0, zoom: 1 });
    frames.flush();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.set({ x: 2, y: 0, zoom: 1 });
    frames.flush();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('animateTo tweens through set() and resolves at the target', async () => {
    const { store, frames } = setup();
    const el = document.createElement('div');
    store.attachWorld(el);
    const promise = store.animateTo({ x: 100, y: 50, zoom: 2 }, 500);
    let resolved = false;
    void promise.then(() => {
      resolved = true;
    });
    // first frame: partial progress
    frames.flush(100);
    expect(store.peek().x).toBeGreaterThan(0);
    expect(store.peek().x).toBeLessThan(100);
    expect(el.style.transform).not.toBe('translate(0px, 0px) scale(1)');
    for (let i = 0; i < 10 && !resolved; i++) {
      frames.flush(100);
      await Promise.resolve();
    }
    await promise;
    expect(store.peek()).toEqual({ x: 100, y: 50, zoom: 2 });
    frames.flush();
    expect(store.get()).toEqual({ x: 100, y: 50, zoom: 2 });
    expect(el.style.transform).toBe('translate(100px, 50px) scale(2)');
  });

  it('animateTo with duration 0 sets directly', async () => {
    const { store } = setup();
    await store.animateTo({ x: 7, y: 8, zoom: 9 }, 0);
    expect(store.peek()).toEqual({ x: 7, y: 8, zoom: 4 });
  });

  it('cancelAnimation stops further updates; a new animateTo cancels the old one', async () => {
    const { store, frames } = setup();
    const p1 = store.animateTo({ x: 100, y: 0, zoom: 1 }, 1000);
    frames.flush(200);
    const mid = store.peek();
    expect(mid.x).toBeGreaterThan(0);
    store.cancelAnimation();
    await p1; // resolves on cancel
    frames.flush(200);
    frames.flush(200);
    expect(store.peek()).toEqual(mid);

    const p2 = store.animateTo({ x: -100, y: 0, zoom: 1 }, 1000);
    frames.flush(100);
    const afterStart = store.peek().x;
    store.animateTo({ x: 0, y: 0, zoom: 1 }, 1000);
    await p2; // superseded → resolved
    frames.flush(100);
    // Heading to 0 now (still positive); the old tween would have gone negative
    expect(store.peek().x).toBeGreaterThan(0);
    expect(store.peek().x).toBeLessThan(afterStart);
    for (let i = 0; i < 12; i++) frames.flush(100);
    expect(store.peek()).toEqual({ x: 0, y: 0, zoom: 1 });
  });

  it('destroy cancels the pending commit and the animation', () => {
    const { store, frames } = setup();
    const listener = vi.fn();
    store.subscribe(listener);
    store.animateTo({ x: 100, y: 0, zoom: 1 }, 1000);
    store.set({ x: 1, y: 1, zoom: 1 });
    store.destroy();
    expect(frames.pending()).toBe(0);
    frames.flush(500);
    expect(listener).not.toHaveBeenCalled();
    store.set({ x: 5, y: 5, zoom: 1 });
    expect(frames.pending()).toBe(0);
  });
});
