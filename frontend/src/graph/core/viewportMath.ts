/**
 * Pure viewport / camera math.
 *
 * Convention (see `Viewport` in ./types.ts): `screen = world * zoom + (x, y)`.
 * All functions are side-effect free and never return NaN/Infinity for
 * degenerate input (zero-size bounds or container, zoom of 0) — they fall
 * back to a clamped zoom of 1 / identity scale instead.
 */

import type { Point, Rect, Size, Viewport, ZoomLimits } from './types';

/** Zoom that is safe to divide by: falls back to 1 for 0 / negative / non-finite. */
function safeZoom(zoom: number): number {
  return zoom > 0 && Number.isFinite(zoom) ? zoom : 1;
}

/**
 * Clamp `zoom` into `[limits.min, limits.max]`. A NaN zoom is treated as 1
 * before clamping (so the result is always a finite number inside the limits;
 * ±Infinity clamps to the corresponding limit).
 */
export function clampZoom(zoom: number, limits: ZoomLimits): number {
  const z = Number.isNaN(zoom) ? 1 : zoom;
  return Math.min(limits.max, Math.max(limits.min, z));
}

/**
 * Zoom by `factor` about `screenPoint` (container-relative pixels) so the
 * world point currently under `screenPoint` stays under it.
 *
 *   z' = clamp(z * factor)
 *   t' = p - ((p - t) / z) * z'
 *
 * A non-positive / non-finite `factor` leaves the zoom unchanged (only clamped).
 */
export function zoomAtPoint(vp: Viewport, screenPoint: Point, factor: number, limits: ZoomLimits): Viewport {
  const f = factor > 0 && Number.isFinite(factor) ? factor : 1;
  const z = safeZoom(vp.zoom);
  const nextZoom = clampZoom(z * f, limits);
  const world = screenToWorld(vp, screenPoint);
  return {
    x: screenPoint.x - world.x * nextZoom,
    y: screenPoint.y - world.y * nextZoom,
    zoom: nextZoom,
  };
}

/** Screen (container-relative px) → world: `(p - t) / z`. */
export function screenToWorld(vp: Viewport, p: Point): Point {
  const z = safeZoom(vp.zoom);
  return { x: (p.x - vp.x) / z, y: (p.y - vp.y) / z };
}

/** World → screen (container-relative px): `p * z + t`. */
export function worldToScreen(vp: Viewport, p: Point): Point {
  return { x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y };
}

/**
 * Viewport that fits `bounds` inside a container of `size`, centred, with a
 * margin of `padding` (fraction of the container, default 0.1) on every side:
 *
 *   zoom = clamp(min(w / (bw * (1 + 2p)), h / (bh * (1 + 2p))))
 *
 * Degenerate input (any of bw, bh, w, h ≤ 0 or non-finite, or a padding that
 * makes `1 + 2p` non-positive) → `zoom = clamp(1)`; the bounds centre is still
 * centred in the container.
 */
export function getViewportForBounds(
  bounds: Rect,
  size: Size,
  opts: { padding?: number; limits: ZoomLimits },
): Viewport {
  const p = opts.padding ?? 0.1;
  const padScale = 1 + 2 * p;
  const bw = bounds.width;
  const bh = bounds.height;
  const w = size.width;
  const h = size.height;

  const degenerate =
    !(bw > 0) || !(bh > 0) || !(w > 0) || !(h > 0) || !(padScale > 0) ||
    !Number.isFinite(bw) || !Number.isFinite(bh) || !Number.isFinite(w) || !Number.isFinite(h);

  const zoom = degenerate
    ? clampZoom(1, opts.limits)
    : clampZoom(Math.min(w / (bw * padScale), h / (bh * padScale)), opts.limits);

  const cx = Number.isFinite(bounds.x) ? bounds.x + (Number.isFinite(bw) ? bw / 2 : 0) : 0;
  const cy = Number.isFinite(bounds.y) ? bounds.y + (Number.isFinite(bh) ? bh / 2 : 0) : 0;
  const cw = Number.isFinite(w) ? w : 0;
  const ch = Number.isFinite(h) ? h : 0;

  return getViewportForCenter({ x: cx, y: cy }, { width: cw, height: ch }, zoom);
}

/** Viewport (at `zoom`) that places `worldPoint` at the centre of a container of `size`. */
export function getViewportForCenter(worldPoint: Point, size: Size, zoom: number): Viewport {
  return {
    x: size.width / 2 - worldPoint.x * zoom,
    y: size.height / 2 - worldPoint.y * zoom,
    zoom,
  };
}

/**
 * World-space rect currently visible in a container of `size`, optionally
 * expanded by `padWorld` world units on every side (for culling margins).
 */
export function getVisibleWorldRect(vp: Viewport, size: Size, padWorld = 0): Rect {
  const z = safeZoom(vp.zoom);
  const topLeft = screenToWorld(vp, { x: 0, y: 0 });
  const pad = Number.isFinite(padWorld) ? padWorld : 0;
  return {
    x: topLeft.x - pad,
    y: topLeft.y - pad,
    width: size.width / z + 2 * pad,
    height: size.height / z + 2 * pad,
  };
}

/** Closed-interval overlap test (rects that merely touch count as intersecting). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width &&
    b.x <= a.x + a.width &&
    a.y <= b.y + b.height &&
    b.y <= a.y + a.height
  );
}

/**
 * Culling rect: `rect` grown by `padFraction` of its own size on every side,
 * then snapped OUTWARDS to a `grid`-world-px lattice so the result only changes
 * when the view crosses a grid line (stable visible set during small pans).
 */
export function quantiseCullRect(rect: Rect, padFraction = 0.25, grid = 512): Rect {
  const padX = rect.width * padFraction;
  const padY = rect.height * padFraction;
  const x0 = Math.floor((rect.x - padX) / grid) * grid;
  const y0 = Math.floor((rect.y - padY) / grid) * grid;
  const x1 = Math.ceil((rect.x + rect.width + padX) / grid) * grid;
  const y1 = Math.ceil((rect.y + rect.height + padY) / grid) * grid;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function sameRect(a: Rect, b: Rect): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
