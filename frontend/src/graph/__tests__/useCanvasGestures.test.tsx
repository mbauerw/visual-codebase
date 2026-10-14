import { fireEvent, render } from '@testing-library/react';
import { useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Point, Viewport } from '../core/types';
import { useCanvasGestures, type CanvasGestureOptions } from '../core/useCanvasGestures';
import { createViewportStore, type ViewportStore } from '../core/viewportStore';
import { createFrameHarness } from './testUtils';
import { setSpaceHeld } from '../core/spaceKey';

const RECT = { left: 10, top: 20, width: 800, height: 600 };

function Canvas({ store, opts }: { store: ViewportStore; opts?: CanvasGestureOptions }) {
  const ref = useRef<HTMLDivElement>(null);
  useCanvasGestures(ref, store, opts);
  return (
    <div data-testid="canvas" ref={ref}>
      <div data-testid="node" data-node-id="n1" />
      <div data-testid="draggable-node" data-node-id="n2" data-node-draggable="" />
      <div data-testid="edge" data-edge-id="e1" />
      <div data-testid="overlay" data-graph-overlay="">
        <button data-testid="overlay-btn">x</button>
      </div>
      <div data-testid="nopan" data-graph-nopan="" />
      <div data-testid="nowheel" data-graph-nowheel="" />
    </div>
  );
}

function setup(opts?: CanvasGestureOptions, init?: Parameters<typeof createViewportStore>[0]) {
  const frames = createFrameHarness();
  const store = createViewportStore({
    raf: frames.raf,
    caf: frames.caf,
    now: frames.now,
    limits: { min: 0.1, max: 4 },
    containerSize: { width: RECT.width, height: RECT.height },
    ...init,
  });
  const utils = render(<Canvas store={store} opts={opts} />);
  const canvas = utils.getByTestId('canvas');
  canvas.getBoundingClientRect = () =>
    ({ ...RECT, right: RECT.left + RECT.width, bottom: RECT.top + RECT.height, x: RECT.left, y: RECT.top, toJSON: () => ({}) }) as DOMRect;
  return { ...utils, frames, store, canvas };
}

const screenToWorld = (vp: Viewport, p: Point): Point => ({ x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom });

describe('useCanvasGestures — pan', () => {
  it('pans the store beyond the 4px threshold and suppresses the following click', () => {
    const onBackgroundClick = vi.fn();
    const { canvas, store } = setup({ onBackgroundClick });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    // within threshold: nothing yet
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 102, clientY: 102 });
    expect(store.peek()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(canvas.dataset.panning).toBeUndefined();
    // beyond threshold: pan
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 110, clientY: 95 });
    expect(store.peek()).toEqual({ x: 10, y: -5, zoom: 1 });
    expect(canvas.dataset.panning).toBe('true');
    expect(canvas.style.cursor).toBe('grabbing');
    expect(canvas.setPointerCapture).toHaveBeenCalledWith(1);
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 130, clientY: 60 });
    expect(store.peek()).toEqual({ x: 30, y: -40, zoom: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 130, clientY: 60 });
    expect(canvas.dataset.panning).toBeUndefined();
    expect(canvas.style.cursor).toBe('');
    // the click that the browser fires after the pointerup is swallowed
    fireEvent.click(canvas, { clientX: 130, clientY: 60 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
    // …but only that one
    fireEvent.click(canvas, { clientX: 130, clientY: 60 });
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it('a pan keeps the zoom and is relative to the viewport at pointerdown', () => {
    const { canvas, store } = setup(undefined, { viewport: { x: 50, y: 60, zoom: 2 } });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 20, clientY: 0 });
    expect(store.peek()).toEqual({ x: 70, y: 60, zoom: 2 });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 20, clientY: 0 });
  });

  it('ignores moves from other pointers and pointerdown inside [data-graph-nopan]', () => {
    const { canvas, store, getByTestId } = setup();
    fireEvent.pointerDown(getByTestId('nopan'), { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(store.peek()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(canvas.dataset.panning).toBeUndefined();
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });

    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 2, clientX: 50, clientY: 50 });
    expect(store.peek()).toEqual({ x: 0, y: 0, zoom: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
  });

  it('a button-0 press inside [data-node-draggable] does not pan (the node drags) unless space is held; other buttons still pan', () => {
    const { canvas, store, getByTestId } = setup();
    const node = getByTestId('draggable-node');
    fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(store.peek()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(canvas.dataset.panning).toBeUndefined();
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });

    // middle button on the same node pans
    fireEvent.pointerDown(node, { pointerId: 1, button: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(store.peek()).toEqual({ x: 50, y: 50, zoom: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 1, clientX: 50, clientY: 50 });

    // space held: button 0 pans again
    setSpaceHeld(true);
    try {
      fireEvent.pointerDown(node, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
      fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 10, clientY: 0 });
      expect(store.peek()).toEqual({ x: 60, y: 50, zoom: 1 });
      fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 10, clientY: 0 });
    } finally {
      setSpaceHeld(false);
    }
  });

  it('respects panButtons and preventDefaults pointerdown only for the middle button', () => {
    const { canvas, store } = setup({ panButtons: [1] });
    const left = fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    expect(left).toBe(true); // not default-prevented
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(store.peek()).toEqual({ x: 0, y: 0, zoom: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 50, clientY: 50 });

    const middle = fireEvent.pointerDown(canvas, { pointerId: 1, button: 1, clientX: 0, clientY: 0 });
    expect(middle).toBe(false); // default prevented
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 50 });
    expect(store.peek()).toEqual({ x: 50, y: 50, zoom: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 1, clientX: 50, clientY: 50 });
  });

  it('pointercancel ends a pan', () => {
    const { canvas, store } = setup();
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 0 });
    expect(canvas.dataset.panning).toBe('true');
    fireEvent.pointerCancel(canvas, { pointerId: 1 });
    expect(canvas.dataset.panning).toBeUndefined();
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 90, clientY: 0 });
    expect(store.peek()).toEqual({ x: 50, y: 0, zoom: 1 });
  });

  it('promotes the world layer only while a pan is active — never for wheel zoom', () => {
    const { canvas, store } = setup();
    const world = document.createElement('div');
    store.attachWorld(world);

    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 100, clientY: 100 });
    expect(world.style.willChange).toBe(''); // pending, not yet panning
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 110, clientY: 95 });
    expect(world.style.willChange).toBe('transform'); // panning
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 110, clientY: 95 });
    expect(world.style.willChange).toBe(''); // demoted on pan end

    fireEvent.wheel(canvas, { clientX: 100, clientY: 100, deltaY: -100, deltaMode: 0 });
    expect(world.style.willChange).toBe(''); // zoom must not promote
  });

  it('pointercancel demotes the world layer', () => {
    const { canvas, store } = setup();
    const world = document.createElement('div');
    store.attachWorld(world);
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 0 });
    expect(world.style.willChange).toBe('transform');
    fireEvent.pointerCancel(canvas, { pointerId: 1 });
    expect(world.style.willChange).toBe('');
  });

  it('does nothing when enabled === false', () => {
    const onBackgroundClick = vi.fn();
    const { canvas, store } = setup({ enabled: false, onBackgroundClick });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 0 });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 50, clientY: 0 });
    fireEvent.click(canvas);
    expect(store.peek()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
  });
});

describe('useCanvasGestures — click', () => {
  it('a plain click on the container calls onBackgroundClick', () => {
    const onBackgroundClick = vi.fn();
    const { canvas } = setup({ onBackgroundClick });
    fireEvent.pointerDown(canvas, { pointerId: 1, button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(canvas, { pointerId: 1, button: 0, clientX: 6, clientY: 5 });
    fireEvent.click(canvas, { clientX: 6, clientY: 5 });
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it('clicks on nodes / edges / overlay children are not background clicks', () => {
    const onBackgroundClick = vi.fn();
    const { getByTestId } = setup({ onBackgroundClick });
    fireEvent.click(getByTestId('node'));
    fireEvent.click(getByTestId('edge'));
    fireEvent.click(getByTestId('overlay-btn'));
    expect(onBackgroundClick).not.toHaveBeenCalled();
    fireEvent.click(getByTestId('nopan'));
    expect(onBackgroundClick).toHaveBeenCalledTimes(1);
  });

  it('reads the latest onBackgroundClick without re-attaching listeners', () => {
    const first = vi.fn();
    const second = vi.fn();
    const frames = createFrameHarness();
    const store = createViewportStore({ raf: frames.raf, caf: frames.caf });
    const removeSpy = vi.spyOn(HTMLDivElement.prototype, 'removeEventListener');
    const utils = render(<Canvas store={store} opts={{ onBackgroundClick: first }} />);
    const canvas = utils.getByTestId('canvas');
    utils.rerender(<Canvas store={store} opts={{ onBackgroundClick: second }} />);
    expect(removeSpy).not.toHaveBeenCalled();
    fireEvent.click(canvas);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    removeSpy.mockRestore();
  });
});

describe('useCanvasGestures — wheel / dblclick / contextmenu', () => {
  it('wheel up zooms in about the cursor, wheel down zooms out', () => {
    const { canvas, store } = setup(undefined, { viewport: { x: 30, y: -10, zoom: 1 } });
    const client = { clientX: 210, clientY: 170 };
    const cursor = { x: client.clientX - RECT.left, y: client.clientY - RECT.top };
    const before = store.peek();
    const worldUnderCursor = screenToWorld(before, cursor);

    const cancelled = !fireEvent.wheel(canvas, { ...client, deltaY: -100, deltaMode: 0 });
    expect(cancelled).toBe(true); // preventDefault (passive:false)
    const zoomedIn = store.peek();
    expect(zoomedIn.zoom).toBeCloseTo(Math.exp(0.2), 10);
    expect(zoomedIn.zoom).toBeGreaterThan(before.zoom);
    const after = screenToWorld(zoomedIn, cursor);
    expect(after.x).toBeCloseTo(worldUnderCursor.x, 8);
    expect(after.y).toBeCloseTo(worldUnderCursor.y, 8);

    fireEvent.wheel(canvas, { ...client, deltaY: 100, deltaMode: 0 });
    expect(store.peek().zoom).toBeCloseTo(1, 10);
    fireEvent.wheel(canvas, { ...client, deltaY: 100, deltaMode: 0 });
    expect(store.peek().zoom).toBeLessThan(1);
    const after2 = screenToWorld(store.peek(), cursor);
    expect(after2.x).toBeCloseTo(worldUnderCursor.x, 8);
    expect(after2.y).toBeCloseTo(worldUnderCursor.y, 8);
  });

  it('honours deltaMode, ctrlKey (pinch) and wheelSensitivity', () => {
    const { canvas, store } = setup({ wheelSensitivity: 2 });
    fireEvent.wheel(canvas, { clientX: 10, clientY: 20, deltaY: -1, deltaMode: 1 });
    expect(store.peek().zoom).toBeCloseTo(Math.exp(0.05 * 2), 10);
    fireEvent.wheel(canvas, { clientX: 10, clientY: 20, deltaY: 1, deltaMode: 1 });
    fireEvent.wheel(canvas, { clientX: 10, clientY: 20, deltaY: -10, deltaMode: 0, ctrlKey: true });
    expect(store.peek().zoom).toBeCloseTo(Math.exp(10 * 0.002 * 10 * 2), 10);
  });

  it('wheel is clamped to the zoom limits', () => {
    const { canvas, store } = setup();
    for (let i = 0; i < 20; i++) fireEvent.wheel(canvas, { clientX: 10, clientY: 20, deltaY: -1000 });
    expect(store.peek().zoom).toBe(4);
  });

  it('wheel inside [data-graph-nowheel] is ignored (not prevented, no zoom)', () => {
    const { getByTestId, store } = setup();
    const notCancelled = fireEvent.wheel(getByTestId('nowheel'), { clientX: 10, clientY: 20, deltaY: -100 });
    expect(notCancelled).toBe(true);
    expect(store.peek().zoom).toBe(1);
  });

  it('dblclick on the background animates a 1.5× zoom about the cursor', () => {
    const { canvas, store, frames } = setup();
    const animateTo = vi.spyOn(store, 'animateTo');
    fireEvent.doubleClick(canvas, { clientX: 110, clientY: 120 });
    expect(animateTo).toHaveBeenCalledTimes(1);
    const [target, ms] = animateTo.mock.calls[0];
    expect(ms).toBe(200);
    expect(target.zoom).toBeCloseTo(1.5, 10);
    // world point under the cursor (100,100) stays fixed: t' = p - (p - t)/z * z'
    expect(target.x).toBeCloseTo(100 - 100 * 1.5, 10);
    expect(target.y).toBeCloseTo(100 - 100 * 1.5, 10);
    for (let i = 0; i < 20; i++) frames.flush(20);
    expect(store.peek().zoom).toBeCloseTo(1.5, 10);
  });

  it('dblclick with zoomOnDoubleClick=false does nothing', () => {
    const { canvas, store } = setup({ zoomOnDoubleClick: false });
    const animateTo = vi.spyOn(store, 'animateTo');
    fireEvent.doubleClick(canvas, { clientX: 110, clientY: 120 });
    expect(animateTo).not.toHaveBeenCalled();
  });

  it('dblclick on a node / overlay does not zoom', () => {
    const { store, getByTestId } = setup();
    const animateTo = vi.spyOn(store, 'animateTo');
    fireEvent.doubleClick(getByTestId('node'), { clientX: 110, clientY: 120 });
    fireEvent.doubleClick(getByTestId('overlay-btn'), { clientX: 110, clientY: 120 });
    expect(animateTo).not.toHaveBeenCalled();
  });

  it('prevents the context menu', () => {
    const { canvas } = setup();
    const notCancelled = fireEvent.contextMenu(canvas);
    expect(notCancelled).toBe(false);
  });

  it('removes listeners on unmount', () => {
    const onBackgroundClick = vi.fn();
    const { canvas, store, unmount } = setup({ onBackgroundClick });
    unmount();
    fireEvent.click(canvas);
    fireEvent.wheel(canvas, { clientX: 10, clientY: 20, deltaY: -100 });
    expect(onBackgroundClick).not.toHaveBeenCalled();
    expect(store.peek().zoom).toBe(1);
  });
});
