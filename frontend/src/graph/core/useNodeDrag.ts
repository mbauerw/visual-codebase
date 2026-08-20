/**
 * useNodeDrag — pointer handlers that let a NodeWrapper be dragged when the
 * canvas has `nodesDraggable` (and the node is not `draggable: false`).
 *
 * Model
 *  - pointerdown (button 0, space NOT held) records the start (client point +
 *    the current offsets of the node and — for containers — its descendants).
 *    Nothing is captured yet, so a plain click still works.
 *  - the first pointermove beyond DRAG_THRESHOLD_PX captures the pointer on the
 *    wrapper, sets `data-dragging` on wrapper + canvas, and from then on writes
 *    `start + clientDelta / zoom` into the position store (one `setMany` per
 *    move for containers, so every moved node is notified once).
 *  - pointerup / pointercancel release, fire `onNodeDragEnd(id, {x, y})` with the
 *    node's new absolute position, and swallow the click the browser fires next.
 *
 * The canvas gesture layer skips its own pan for a button-0 pointerdown inside
 * `[data-node-draggable]` unless space is held (see useCanvasGestures), so
 * dragging never fights panning; with space held this hook bails and the
 * canvas pans as usual.
 */

import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { GraphNode, PositionDelta } from './types';
import { useGraphContext } from './GraphContext';
import { ZERO_OFFSET } from './positionStore';
import { isSpaceHeld } from './spaceKey';

export const DRAG_THRESHOLD_PX = 4;

export interface NodeDragHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => void;
  /** Cancels a not-yet-active press when the pointer leaves the node. */
  onPointerLeave: (e: ReactPointerEvent<HTMLElement>) => void;
}

export interface NodeDrag {
  /** `nodesDraggable && node.draggable !== false` — the wrapper renders `data-node-draggable` when true. */
  enabled: boolean;
  handlers: NodeDragHandlers;
  /** True exactly once for the click that follows a completed drag; the wrapper must swallow it. */
  consumeClickSuppression: () => boolean;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  /** id → offset at pointerdown for the node and (containers) its descendants. */
  startOffsets: Map<string, PositionDelta>;
  ids: readonly string[];
  /** Beyond the threshold (captured, `data-dragging`). */
  active: boolean;
  el: HTMLElement;
  canvas: HTMLElement | null;
}

const NOOP_HANDLERS: NodeDragHandlers = {
  onPointerDown: () => {},
  onPointerMove: () => {},
  onPointerUp: () => {},
  onPointerCancel: () => {},
  onPointerLeave: () => {},
};

function isContainer(node: GraphNode): boolean {
  return node.kind === 'folder' || node.kind === 'category';
}

export function useNodeDrag(node: GraphNode): NodeDrag {
  const { store, positions, callbacks, descendantIds, nodesDraggable } = useGraphContext();
  const enabled = nodesDraggable && node.draggable !== false;

  const stateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const suppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Latest node/callbacks without re-creating handlers on every render.
  const nodeRef = useRef(node);
  nodeRef.current = node;
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const finish = useCallback((s: DragState, notify: boolean) => {
    if (!s.active) return;
    try {
      s.el.releasePointerCapture(s.pointerId);
    } catch {
      /* already released */
    }
    delete s.el.dataset.dragging;
    if (s.canvas) delete s.canvas.dataset.dragging;
    if (!notify) return;
    const n = nodeRef.current;
    const off = positions.get(n.id) ?? ZERO_OFFSET;
    callbacksRef.current.onNodeDragEnd?.(n.id, { x: n.x + off.dx, y: n.y + off.dy });
    // The click the browser dispatches right after this pointerup must not select the node.
    suppressClickRef.current = true;
    if (suppressTimerRef.current !== null) clearTimeout(suppressTimerRef.current);
    suppressTimerRef.current = setTimeout(() => {
      suppressClickRef.current = false;
      suppressTimerRef.current = null;
    }, 0);
  }, [positions]);

  // Unmount mid-drag: release capture and clean the attributes.
  useEffect(
    () => () => {
      const s = stateRef.current;
      stateRef.current = null;
      if (s) finish(s, false);
      if (suppressTimerRef.current !== null) clearTimeout(suppressTimerRef.current);
    },
    [finish],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || isSpaceHeld()) return;
      const n = nodeRef.current;
      const ids = isContainer(n) ? [n.id, ...descendantIds(n.id)] : [n.id];
      const startOffsets = new Map<string, PositionDelta>();
      for (const id of ids) startOffsets.set(id, positions.get(id) ?? ZERO_OFFSET);
      const el = e.currentTarget;
      // A stale pending press (pointerup happened off-node) is simply replaced.
      stateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsets,
        ids,
        active: false,
        el,
        canvas: el.closest('[data-graph-canvas]') as HTMLElement | null,
      };
    },
    [descendantIds, positions],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = stateRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      const cdx = e.clientX - s.startX;
      const cdy = e.clientY - s.startY;
      if (!s.active) {
        if (Math.hypot(cdx, cdy) <= DRAG_THRESHOLD_PX) return;
        s.active = true;
        try {
          s.el.setPointerCapture(e.pointerId);
        } catch {
          /* capture unsupported */
        }
        s.el.dataset.dragging = 'true';
        if (s.canvas) s.canvas.dataset.dragging = 'true';
      }
      const zoom = store.peek().zoom || 1;
      const wdx = cdx / zoom;
      const wdy = cdy / zoom;
      if (s.ids.length === 1) {
        const start = s.startOffsets.get(s.ids[0]) ?? ZERO_OFFSET;
        positions.set(s.ids[0], { dx: start.dx + wdx, dy: start.dy + wdy });
      } else {
        positions.setMany(
          s.ids.map((id) => {
            const start = s.startOffsets.get(id) ?? ZERO_OFFSET;
            return [id, { dx: start.dx + wdx, dy: start.dy + wdy }] as const;
          }),
        );
      }
    },
    [positions, store],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const s = stateRef.current;
      if (!s || e.pointerId !== s.pointerId) return;
      stateRef.current = null;
      finish(s, true);
    },
    [finish],
  );

  const onPointerLeave = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const s = stateRef.current;
    if (!s || s.active || e.pointerId !== s.pointerId) return;
    stateRef.current = null;
  }, []);

  const handlers = useMemo<NodeDragHandlers>(
    () =>
      enabled
        ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave }
        : NOOP_HANDLERS,
    [enabled, onPointerDown, onPointerMove, onPointerUp, onPointerLeave],
  );

  const consumeClickSuppression = useCallback(() => {
    if (!suppressClickRef.current) return false;
    suppressClickRef.current = false;
    return true;
  }, []);

  return { enabled, handlers, consumeClickSuppression };
}
