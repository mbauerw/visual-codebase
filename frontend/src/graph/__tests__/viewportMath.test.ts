import { describe, expect, it } from 'vitest';
import {
  clampZoom,
  getViewportForBounds,
  getViewportForCenter,
  getVisibleWorldRect,
  quantiseCullRect,
  rectsIntersect,
  sameRect,
  screenToWorld,
  worldToScreen,
  zoomAtPoint,
} from '../core/viewportMath';
import type { Point, Rect, Size, Viewport, ZoomLimits } from '../core/types';

const LIMITS: ZoomLimits = { min: 0.1, max: 4 };

function expectPointClose(a: Point, b: Point, digits = 6) {
  expect(a.x).toBeCloseTo(b.x, digits);
  expect(a.y).toBeCloseTo(b.y, digits);
}

describe('clampZoom', () => {
  it('clamps into [min, max]', () => {
    expect(clampZoom(0.01, LIMITS)).toBe(0.1);
    expect(clampZoom(10, LIMITS)).toBe(4);
    expect(clampZoom(1.5, LIMITS)).toBe(1.5);
    expect(clampZoom(0.1, LIMITS)).toBe(0.1);
    expect(clampZoom(4, LIMITS)).toBe(4);
  });

  it('never returns NaN / Infinity', () => {
    expect(clampZoom(NaN, LIMITS)).toBe(1);
    expect(clampZoom(Infinity, LIMITS)).toBe(4);
    expect(clampZoom(-Infinity, LIMITS)).toBe(0.1);
    expect(clampZoom(NaN, { min: 2, max: 3 })).toBe(2);
  });
});

describe('screenToWorld / worldToScreen', () => {
  const vp: Viewport = { x: 120, y: -40, zoom: 1.75 };

  it('follows screen = world * zoom + t', () => {
    expectPointClose(worldToScreen(vp, { x: 0, y: 0 }), { x: 120, y: -40 });
    expectPointClose(worldToScreen(vp, { x: 100, y: 200 }), { x: 100 * 1.75 + 120, y: 200 * 1.75 - 40 });
    expectPointClose(screenToWorld(vp, { x: 120, y: -40 }), { x: 0, y: 0 });
  });

  it('round-trips screenToWorld ∘ worldToScreen and the inverse', () => {
    const worldPts: Point[] = [
      { x: 0, y: 0 },
      { x: 12.5, y: -33.3 },
      { x: -1000, y: 4321 },
      { x: 1e6, y: -1e6 },
    ];
    for (const p of worldPts) {
      expectPointClose(screenToWorld(vp, worldToScreen(vp, p)), p, 5);
      expectPointClose(worldToScreen(vp, screenToWorld(vp, p)), p, 5);
    }
  });

  it('is identity for the identity viewport', () => {
    const id: Viewport = { x: 0, y: 0, zoom: 1 };
    expectPointClose(screenToWorld(id, { x: 7, y: 9 }), { x: 7, y: 9 });
    expectPointClose(worldToScreen(id, { x: 7, y: 9 }), { x: 7, y: 9 });
  });

  it('does not produce NaN/Infinity for a zero zoom', () => {
    const w = screenToWorld({ x: 10, y: 10, zoom: 0 }, { x: 30, y: 50 });
    expect(Number.isFinite(w.x)).toBe(true);
    expect(Number.isFinite(w.y)).toBe(true);
  });
});

describe('zoomAtPoint', () => {
  it('keeps the world point under the cursor fixed', () => {
    const vp: Viewport = { x: 50, y: 80, zoom: 1.2 };
    const cursor: Point = { x: 300, y: 220 };
    const before = screenToWorld(vp, cursor);

    const zoomedIn = zoomAtPoint(vp, cursor, 1.5, LIMITS);
    expect(zoomedIn.zoom).toBeCloseTo(1.8);
    expectPointClose(screenToWorld(zoomedIn, cursor), before);

    const zoomedOut = zoomAtPoint(zoomedIn, cursor, 0.25, LIMITS);
    expect(zoomedOut.zoom).toBeCloseTo(0.45);
    expectPointClose(screenToWorld(zoomedOut, cursor), before);
  });

  it('keeps the point fixed even when the zoom is clamped', () => {
    const vp: Viewport = { x: -20, y: 15, zoom: 3 };
    const cursor: Point = { x: 10, y: 400 };
    const before = screenToWorld(vp, cursor);
    const next = zoomAtPoint(vp, cursor, 100, LIMITS);
    expect(next.zoom).toBe(LIMITS.max);
    expectPointClose(screenToWorld(next, cursor), before);

    const down = zoomAtPoint(vp, cursor, 0.0001, LIMITS);
    expect(down.zoom).toBe(LIMITS.min);
    expectPointClose(screenToWorld(down, cursor), before);
  });

  it('is a no-op translation when the zoom is already at the limit', () => {
    const vp: Viewport = { x: 33, y: 44, zoom: LIMITS.max };
    const next = zoomAtPoint(vp, { x: 100, y: 100 }, 2, LIMITS);
    expect(next).toEqual(vp);
  });

  it('matches the documented formula t\' = p - ((p - t) / z) * z\'', () => {
    const vp: Viewport = { x: 10, y: 20, zoom: 2 };
    const p: Point = { x: 100, y: 60 };
    const next = zoomAtPoint(vp, p, 2, LIMITS);
    expect(next.zoom).toBe(4);
    expect(next.x).toBeCloseTo(100 - ((100 - 10) / 2) * 4);
    expect(next.y).toBeCloseTo(60 - ((60 - 20) / 2) * 4);
  });

  it('ignores a non-positive / non-finite factor', () => {
    const vp: Viewport = { x: 10, y: 20, zoom: 2 };
    expect(zoomAtPoint(vp, { x: 0, y: 0 }, 0, LIMITS)).toEqual(vp);
    expect(zoomAtPoint(vp, { x: 0, y: 0 }, NaN, LIMITS)).toEqual(vp);
    expect(zoomAtPoint(vp, { x: 0, y: 0 }, -1, LIMITS)).toEqual(vp);
  });
});

describe('getViewportForCenter', () => {
  it('places the world point at the container centre', () => {
    const size: Size = { width: 800, height: 600 };
    const vp = getViewportForCenter({ x: 100, y: 50 }, size, 2);
    expect(vp.zoom).toBe(2);
    expectPointClose(worldToScreen(vp, { x: 100, y: 50 }), { x: 400, y: 300 });
  });
});

describe('getViewportForBounds', () => {
  const size: Size = { width: 1000, height: 500 };
  const bounds: Rect = { x: 100, y: 200, width: 400, height: 100 };

  it('centres the bounds in the container', () => {
    const vp = getViewportForBounds(bounds, size, { limits: LIMITS });
    const centre = worldToScreen(vp, { x: 300, y: 250 });
    expectPointClose(centre, { x: 500, y: 250 });
  });

  it('uses the default 10% padding and the limiting axis', () => {
    // width axis: 1000 / (400 * 1.2) = 2.083..; height axis: 500 / (100 * 1.2) = 4.166.. → width limits → 2.083..
    const vp = getViewportForBounds(bounds, size, { limits: LIMITS });
    expect(vp.zoom).toBeCloseTo(1000 / (400 * 1.2));
    // the bounds fit inside the container with the padding on each side
    const tl = worldToScreen(vp, { x: bounds.x, y: bounds.y });
    const br = worldToScreen(vp, { x: bounds.x + bounds.width, y: bounds.y + bounds.height });
    expect(tl.x).toBeGreaterThanOrEqual(0);
    expect(tl.y).toBeGreaterThanOrEqual(0);
    expect(br.x).toBeLessThanOrEqual(size.width);
    expect(br.y).toBeLessThanOrEqual(size.height);
    expect(tl.x).toBeCloseTo(size.width * 0.1 / 1.2, 5); // left margin = padding fraction of the padded box
  });

  it('respects an explicit padding', () => {
    const vp0 = getViewportForBounds(bounds, size, { padding: 0, limits: LIMITS });
    expect(vp0.zoom).toBeCloseTo(1000 / 400);
    const vp05 = getViewportForBounds(bounds, size, { padding: 0.5, limits: LIMITS });
    expect(vp05.zoom).toBeCloseTo(1000 / (400 * 2));
    // still centred
    expectPointClose(worldToScreen(vp05, { x: 300, y: 250 }), { x: 500, y: 250 });
  });

  it('respects the zoom limits', () => {
    const tiny: Rect = { x: 0, y: 0, width: 1, height: 1 };
    const vpMax = getViewportForBounds(tiny, size, { limits: LIMITS });
    expect(vpMax.zoom).toBe(LIMITS.max);
    expectPointClose(worldToScreen(vpMax, { x: 0.5, y: 0.5 }), { x: 500, y: 250 });

    const huge: Rect = { x: 0, y: 0, width: 1e6, height: 1e6 };
    const vpMin = getViewportForBounds(huge, size, { limits: LIMITS });
    expect(vpMin.zoom).toBe(LIMITS.min);
  });

  it('handles degenerate bounds and container sizes without NaN/Infinity', () => {
    const cases: Array<[Rect, Size]> = [
      [{ x: 0, y: 0, width: 0, height: 0 }, size],
      [{ x: 10, y: 10, width: 0, height: 50 }, size],
      [bounds, { width: 0, height: 0 }],
      [bounds, { width: 0, height: 100 }],
    ];
    for (const [b, s] of cases) {
      const vp = getViewportForBounds(b, s, { limits: LIMITS });
      expect(Number.isFinite(vp.x)).toBe(true);
      expect(Number.isFinite(vp.y)).toBe(true);
      expect(vp.zoom).toBe(clampZoom(1, LIMITS));
    }
    // and the clamp is applied to the fallback zoom
    const vp = getViewportForBounds({ x: 0, y: 0, width: 0, height: 0 }, size, { limits: { min: 2, max: 3 } });
    expect(vp.zoom).toBe(2);
    // the (degenerate) bounds centre is still centred
    const vpPoint = getViewportForBounds({ x: 40, y: 60, width: 0, height: 0 }, size, { limits: LIMITS });
    expectPointClose(worldToScreen(vpPoint, { x: 40, y: 60 }), { x: 500, y: 250 });
  });
});

describe('getVisibleWorldRect', () => {
  it('returns the world rect covering the container', () => {
    const vp: Viewport = { x: 100, y: 50, zoom: 2 };
    const size: Size = { width: 800, height: 600 };
    const r = getVisibleWorldRect(vp, size);
    expect(r).toEqual({ x: -50, y: -25, width: 400, height: 300 });
    // the screen corners map onto the rect corners
    expectPointClose(screenToWorld(vp, { x: 0, y: 0 }), { x: r.x, y: r.y });
    expectPointClose(screenToWorld(vp, { x: 800, y: 600 }), { x: r.x + r.width, y: r.y + r.height });
  });

  it('expands by padWorld on every side', () => {
    const r = getVisibleWorldRect({ x: 0, y: 0, zoom: 1 }, { width: 100, height: 100 }, 10);
    expect(r).toEqual({ x: -10, y: -10, width: 120, height: 120 });
  });

  it('is finite for a zero zoom', () => {
    const r = getVisibleWorldRect({ x: 0, y: 0, zoom: 0 }, { width: 100, height: 100 });
    expect(Number.isFinite(r.width)).toBe(true);
    expect(Number.isFinite(r.height)).toBe(true);
  });
});

describe('rectsIntersect', () => {
  const a: Rect = { x: 0, y: 0, width: 10, height: 10 };
  it('detects overlap, containment and touching', () => {
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsIntersect(a, { x: 2, y: 2, width: 2, height: 2 })).toBe(true);
    expect(rectsIntersect({ x: 2, y: 2, width: 2, height: 2 }, a)).toBe(true);
    expect(rectsIntersect(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(true); // touching edge
  });
  it('rejects disjoint rects', () => {
    expect(rectsIntersect(a, { x: 11, y: 0, width: 5, height: 5 })).toBe(false);
    expect(rectsIntersect(a, { x: 0, y: -20, width: 5, height: 5 })).toBe(false);
    expect(rectsIntersect(a, { x: -20, y: -20, width: 5, height: 5 })).toBe(false);
  });
});

describe('quantiseCullRect', () => {
  it('pads by the fraction and snaps outwards to the grid', () => {
    // 1000x500 at (100, 100), pad 25% → x∈[-150, 1350], y∈[-25, 725] → snapped to 512
    const q = quantiseCullRect({ x: 100, y: 100, width: 1000, height: 500 }, 0.25, 512);
    expect(q).toEqual({ x: -512, y: -512, width: 2048, height: 1536 });
  });
  it('is stable for small moves and changes when a grid line is crossed', () => {
    const a = quantiseCullRect({ x: 100, y: 100, width: 1000, height: 500 });
    const b = quantiseCullRect({ x: 130, y: 90, width: 1000, height: 500 });
    expect(sameRect(a, b)).toBe(true);
    // move right by ~500 → right edge 100+500+1000+250 = 1850 > 1536 → grows to 2048
    const c = quantiseCullRect({ x: 600, y: 100, width: 1000, height: 500 });
    expect(sameRect(a, c)).toBe(false);
    expect(c.x + c.width).toBe(2048);
  });
  it('sameRect compares all four fields', () => {
    expect(sameRect({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: 1 })).toBe(true);
    expect(sameRect({ x: 0, y: 0, width: 1, height: 1 }, { x: 0, y: 0, width: 1, height: 2 })).toBe(false);
  });
});
