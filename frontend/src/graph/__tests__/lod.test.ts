import { describe, expect, it } from 'vitest';
import { getLod, nodeScreenWidth } from '../core/lod';
import type { GraphNode, LodThresholds } from '../core/types';

const T: LodThresholds = { farBelowPx: 100, nearAbovePx: 200 };
const H = 0.15;

function node(width: number, scale?: number): GraphNode {
  return { id: 'n', kind: 'file', x: 0, y: 0, width, height: 40, depth: 0, data: null, scale };
}

describe('nodeScreenWidth', () => {
  it('multiplies width, scale and zoom', () => {
    expect(nodeScreenWidth(node(200), 0.5)).toBe(100);
    expect(nodeScreenWidth(node(200, 1.5), 0.5)).toBe(150);
    expect(nodeScreenWidth(node(200), 1)).toBe(200);
  });
  it('treats a missing scale as 1', () => {
    expect(nodeScreenWidth(node(120), 2)).toBe(240);
  });
});

describe('getLod without prev', () => {
  it('uses the plain thresholds', () => {
    expect(getLod(0, T)).toBe('far');
    expect(getLod(99.9, T)).toBe('far');
    expect(getLod(100, T)).toBe('mid');
    expect(getLod(150, T)).toBe('mid');
    expect(getLod(200, T)).toBe('mid');
    expect(getLod(200.1, T)).toBe('near');
    expect(getLod(1e6, T)).toBe('near');
  });
});

describe('getLod hysteresis', () => {
  it('far → mid: a value just inside the band keeps far, crossing the band flips', () => {
    // band above farBelowPx: [100, 115) (boundary values avoided: 100*1.15 is not exact in fp)
    expect(getLod(100, T, 'far')).toBe('far');
    expect(getLod(114.5, T, 'far')).toBe('far');
    expect(getLod(115.5, T, 'far')).toBe('mid');
    expect(getLod(150, T, 'far')).toBe('mid');
  });

  it('mid → far: a value just below farBelowPx keeps mid, crossing the band flips', () => {
    // band below farBelowPx: (85, 100)
    expect(getLod(99, T, 'mid')).toBe('mid');
    expect(getLod(85.5, T, 'mid')).toBe('mid');
    expect(getLod(84.5, T, 'mid')).toBe('far');
    expect(getLod(0, T, 'mid')).toBe('far');
  });

  it('mid → near: a value just above nearAbovePx keeps mid, crossing the band flips', () => {
    // band above nearAbovePx: (200, 230]
    expect(getLod(201, T, 'mid')).toBe('mid');
    expect(getLod(229.5, T, 'mid')).toBe('mid');
    expect(getLod(230.5, T, 'mid')).toBe('near');
  });

  it('near → mid: a value just below nearAbovePx keeps near, crossing the band flips', () => {
    // band below nearAbovePx: [170, 200]
    expect(getLod(199, T, 'near')).toBe('near');
    expect(getLod(170.5, T, 'near')).toBe('near');
    expect(getLod(169.5, T, 'near')).toBe('mid');
    expect(getLod(120, T, 'near')).toBe('mid');
  });

  it('jumps across two levels still work (far ↔ near)', () => {
    expect(getLod(1000, T, 'far')).toBe('near');
    expect(getLod(229.5, T, 'far')).toBe('mid'); // must exceed nearAbovePx*(1+h) to enter near
    expect(getLod(230.5, T, 'far')).toBe('near');
    expect(getLod(0, T, 'near')).toBe('far');
    expect(getLod(85.5, T, 'near')).toBe('mid'); // must drop below farBelowPx*(1-h) to enter far
    expect(getLod(84.5, T, 'near')).toBe('far');
  });

  it('honours a custom hysteresis and treats 0 as no hysteresis', () => {
    expect(getLod(120, T, 'far', 0.3)).toBe('far'); // 100 * 1.3 = 130
    expect(getLod(130.5, T, 'far', 0.3)).toBe('mid');
    expect(getLod(100, T, 'far', 0)).toBe('mid');
    expect(getLod(99.9, T, 'mid', 0)).toBe('far');
    expect(getLod(200.1, T, 'mid', 0)).toBe('near');
  });

  it('is stable when the value oscillates inside a band', () => {
    let level = getLod(50, T);
    expect(level).toBe('far');
    const samples = [90, 105, 110, 98, 112, 114, 100];
    for (const px of samples) {
      level = getLod(px, T, level, H);
      expect(level).toBe('far');
    }
    level = getLod(116, T, level, H);
    expect(level).toBe('mid');
    // now inside the lower band → stays mid
    for (const px of [95, 90, 86, 100]) {
      level = getLod(px, T, level, H);
      expect(level).toBe('mid');
    }
  });
});
