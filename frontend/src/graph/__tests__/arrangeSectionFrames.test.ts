import { describe, expect, it } from 'vitest';
import { arrangeSectionFrames, type FrameSize } from '../themes/layoutUtils';
import type { RoleSectionCategory } from '../layouts/roleLayout';

const GAP = 100;
const sizes = (entries: Partial<Record<RoleSectionCategory, FrameSize>>) =>
  new Map(Object.entries(entries) as [RoleSectionCategory, FrameSize][]);

describe('arrangeSectionFrames', () => {
  it('puts Tests beneath Backend when Backend is the smaller of the two', () => {
    const pos = arrangeSectionFrames(
      sizes({
        frontend: { width: 2000, height: 1500 },
        backend: { width: 1200, height: 800 },
        test: { width: 1100, height: 600 },
      }),
      GAP
    );
    expect(pos.get('frontend')).toEqual({ x: 0, y: 0 });
    expect(pos.get('backend')).toEqual({ x: 2100, y: 0 });
    expect(pos.get('test')).toEqual({ x: 2100, y: 900 });
  });

  it('puts Tests beneath Frontend when Frontend is smaller, pushing Backend clear of it', () => {
    const pos = arrangeSectionFrames(
      sizes({
        frontend: { width: 1100, height: 700 },
        backend: { width: 2000, height: 1500 },
        test: { width: 1400, height: 600 },
      }),
      GAP
    );
    expect(pos.get('frontend')).toEqual({ x: 0, y: 0 });
    expect(pos.get('test')).toEqual({ x: 0, y: 800 });
    // Column is as wide as Tests (1400), so Backend starts after it
    expect(pos.get('backend')).toEqual({ x: 1500, y: 0 });
  });

  it('stacks Backend under Frontend and gives Tests its own column when Tests is largest', () => {
    const pos = arrangeSectionFrames(
      sizes({
        frontend: { width: 1100, height: 700 },
        backend: { width: 1300, height: 600 },
        test: { width: 2500, height: 2000 },
      }),
      GAP
    );
    expect(pos.get('frontend')).toEqual({ x: 0, y: 0 });
    expect(pos.get('backend')).toEqual({ x: 0, y: 800 });
    expect(pos.get('test')).toEqual({ x: 1400, y: 0 });
  });

  it('keeps Frontend and Backend in a row when there are no tests', () => {
    const pos = arrangeSectionFrames(
      sizes({ frontend: { width: 1100, height: 700 }, backend: { width: 1300, height: 600 } }),
      GAP
    );
    expect(pos.get('frontend')).toEqual({ x: 0, y: 0 });
    expect(pos.get('backend')).toEqual({ x: 1200, y: 0 });
    expect(pos.has('test')).toBe(false);
  });

  it('puts Tests beneath the only other section', () => {
    const pos = arrangeSectionFrames(
      sizes({ backend: { width: 1300, height: 600 }, test: { width: 1100, height: 500 } }),
      GAP
    );
    expect(pos.get('backend')).toEqual({ x: 0, y: 0 });
    expect(pos.get('test')).toEqual({ x: 0, y: 700 });
  });
});
