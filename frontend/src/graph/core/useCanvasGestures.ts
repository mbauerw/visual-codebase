/**
 * Pan / zoom / click gestures for the canvas container.
 *
 * Native listeners (attached once per container/store/enabled change) drive
 * the viewport store directly — no React state, no re-render per pointer move.
 * Options are read through a ref so callers can pass fresh callbacks every
 * render without re-attaching listeners.
 *
 * Opt-outs (checked with `closest()` on the event target):
 *   [data-graph-nopan]     pointerdown inside does not start a pan
 *   [data-graph-nowheel]   wheel inside is left to the browser (scrollable panels)
 *   [data-node-id] / [data-edge-id] / [data-graph-overlay]  not "background" for click / dblclick
 *   [data-node-draggable]  a button-0 pointerdown inside starts a NODE drag (useNodeDrag),
 *                          not a pan — unless space is held (then it pans as usual)
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { Point, Viewport } from './types';
import { zoomAtPoint } from './viewportMath';
import type { ViewportStore } from './viewportStore';
import { isSpaceHeld } from './spaceKey';

export interface CanvasGestureOptions {
  /** Default true. */
  enabled?: boolean;
  /** Default true: double-click on the background zooms in ×1.5 about the cursor. */
  zoomOnDoubleClick?: boolean;
  /** Mouse buttons that start a pan. Default [0, 1, 2]. */
  panButtons?: number[];
  onBackgroundClick?: () => void;
  /** Multiplies the wheel exponent (1 = d3-zoom default feel). */
  wheelSensitivity?: number;
}

const DEFAULT_PAN_BUTTONS = [0, 1, 2];
const PAN_THRESHOLD_PX = 4;
const DBLCLICK_ZOOM_FACTOR = 1.5;
const DBLCLICK_ZOOM_MS = 200;
const NOT_BACKGROUND_SELECTOR = '[data-node-id],[data-edge-id],[data-graph-overlay]';

type Phase = 'idle' | 'pending' | 'panning';

function targetElement(e: Event): Element | null {
  const t = e.target;
  return t instanceof Element ? t : null;
}

function isInside(e: Event, selector: string): boolean {
  const el = targetElement(e);
  return !!el && !!el.closest(selector);
}

function cursorPoint(container: HTMLElement, e: MouseEvent): Point {
  const rect = container.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

/** d3-zoom's wheel → zoom-factor formula (exponential in deltaY). */
export function wheelZoomFactor(e: WheelEvent, sensitivity = 1): number {
  const modeScale = e.deltaMode === 1 ? 0.05 : e.deltaMode ? 1 : 0.002;
  return Math.exp(-e.deltaY * modeScale * (e.ctrlKey ? 10 : 1) * sensitivity);
}

export function useCanvasGestures(
  containerRef: RefObject<HTMLElement>,
  store: ViewportStore,
  opts: CanvasGestureOptions = {},
): void {
  const optsRef = useRef<CanvasGestureOptions>(opts);
  optsRef.current = opts;
  const enabled = opts.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    let phase: Phase = 'idle';
    let pointerId = -1;
    let startClient: Point = { x: 0, y: 0 };
    let startViewport: Viewport = store.peek();
    let savedCursor = '';
    let suppressClick = false;
    let suppressTimer: ReturnType<typeof setTimeout> | null = null;

    const endPan = (): void => {
      if (phase === 'panning') {
        try {
          container.releasePointerCapture(pointerId);
        } catch {
          /* pointer already released */
        }
        delete container.dataset.panning;
        container.style.cursor = savedCursor;
      }
      phase = 'idle';
      pointerId = -1;
    };

    const onPointerDown = (e: PointerEvent): void => {
      if (phase !== 'idle') return;
      const buttons = optsRef.current.panButtons ?? DEFAULT_PAN_BUTTONS;
      if (!buttons.includes(e.button)) return;
      if (isInside(e, '[data-graph-nopan]')) return;
      // Draggable node under the pointer: the node takes button 0 (space = force pan).
      if (e.button === 0 && !isSpaceHeld() && isInside(e, '[data-node-draggable]')) return;
      // Middle button: stop the browser's autoscroll. Never for button 0 (would
      // break focus / text selection semantics elsewhere in the page).
      if (e.button === 1) e.preventDefault();
      phase = 'pending';
      pointerId = e.pointerId;
      startClient = { x: e.clientX, y: e.clientY };
      startViewport = store.peek();
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (phase === 'idle' || e.pointerId !== pointerId) return;
      const dx = e.clientX - startClient.x;
      const dy = e.clientY - startClient.y;
      if (phase === 'pending') {
        if (Math.hypot(dx, dy) <= PAN_THRESHOLD_PX) return;
        phase = 'panning';
        try {
          container.setPointerCapture(pointerId);
        } catch {
          /* capture unsupported */
        }
        container.dataset.panning = 'true';
        savedCursor = container.style.cursor;
        container.style.cursor = 'grabbing';
      }
      store.set({ x: startViewport.x + dx, y: startViewport.y + dy, zoom: startViewport.zoom });
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (phase === 'idle' || e.pointerId !== pointerId) return;
      const panned = phase === 'panning';
      endPan();
      if (panned) {
        // The click that follows this pointerup must not count as a background click.
        suppressClick = true;
        if (suppressTimer !== null) clearTimeout(suppressTimer);
        suppressTimer = setTimeout(() => {
          suppressClick = false;
          suppressTimer = null;
        }, 0);
      }
    };

    const onClick = (e: MouseEvent): void => {
      if (suppressClick) {
        suppressClick = false;
        return;
      }
      if (isInside(e, NOT_BACKGROUND_SELECTOR)) return;
      optsRef.current.onBackgroundClick?.();
    };

    const onWheel = (e: WheelEvent): void => {
      if (isInside(e, '[data-graph-nowheel]')) return;
      e.preventDefault();
      const k = wheelZoomFactor(e, optsRef.current.wheelSensitivity ?? 1);
      if (k === 1) return;
      store.set(zoomAtPoint(store.peek(), cursorPoint(container, e), k, store.getLimits()));
    };

    const onDoubleClick = (e: MouseEvent): void => {
      if (optsRef.current.zoomOnDoubleClick === false) return;
      if (isInside(e, NOT_BACKGROUND_SELECTOR)) return;
      e.preventDefault();
      const target = zoomAtPoint(store.peek(), cursorPoint(container, e), DBLCLICK_ZOOM_FACTOR, store.getLimits());
      void store.animateTo(target, DBLCLICK_ZOOM_MS);
    };

    const preventDefault = (e: Event): void => {
      e.preventDefault();
    };

    const nonPassive: AddEventListenerOptions = { passive: false };

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('pointercancel', onPointerUp);
    container.addEventListener('click', onClick);
    container.addEventListener('dblclick', onDoubleClick);
    container.addEventListener('wheel', onWheel, nonPassive);
    container.addEventListener('contextmenu', preventDefault);
    // Safari trackpad pinch (non-standard events).
    container.addEventListener('gesturestart', preventDefault, nonPassive);
    container.addEventListener('gesturechange', preventDefault, nonPassive);
    container.addEventListener('gestureend', preventDefault, nonPassive);

    return () => {
      endPan();
      if (suppressTimer !== null) clearTimeout(suppressTimer);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('pointercancel', onPointerUp);
      container.removeEventListener('click', onClick);
      container.removeEventListener('dblclick', onDoubleClick);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', preventDefault);
      container.removeEventListener('gesturestart', preventDefault);
      container.removeEventListener('gesturechange', preventDefault);
      container.removeEventListener('gestureend', preventDefault);
    };
  }, [containerRef, store, enabled]);
}
