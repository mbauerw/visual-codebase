import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GraphProvider } from '../core/GraphContext';
import type { GraphNode } from '../core/types';
import {
  useContainerSizeValue,
  useLod,
  useViewport,
  useVisibleWorldRect,
  useZoom,
  useZoomBucket,
} from '../core/useViewport';
import { createViewportStore } from '../core/viewportStore';
import { createFrameHarness, createStubContext } from './testUtils';

function setup() {
  const frames = createFrameHarness();
  const store = createViewportStore({
    raf: frames.raf,
    caf: frames.caf,
    now: frames.now,
    limits: { min: 0.05, max: 2 },
    containerSize: { width: 800, height: 600 },
  });
  const value = createStubContext(store);
  const wrap = (ui: React.ReactElement) => <GraphProvider value={value}>{ui}</GraphProvider>;
  return { frames, store, wrap };
}

const fileNode: GraphNode = {
  id: 'n1',
  kind: 'file',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  depth: 0,
  data: null,
};

describe('useViewport hooks', () => {
  it('useZoom reads the committed zoom and updates after a flushed frame', () => {
    const { frames, store, wrap } = setup();
    function Zoom() {
      const zoom = useZoom();
      return <span data-testid="zoom">{zoom}</span>;
    }
    render(wrap(<Zoom />));
    expect(screen.getByTestId('zoom').textContent).toBe('1');
    act(() => {
      store.set({ x: 0, y: 0, zoom: 1.5 });
    });
    // not committed yet
    expect(screen.getByTestId('zoom').textContent).toBe('1');
    act(() => {
      frames.flush();
    });
    expect(screen.getByTestId('zoom').textContent).toBe('1.5');
  });

  it('a useZoom consumer does not re-render when only x/y change', () => {
    const { frames, store, wrap } = setup();
    let renders = 0;
    function Zoom() {
      renders++;
      const zoom = useZoom();
      return <span data-testid="zoom">{zoom}</span>;
    }
    render(wrap(<Zoom />));
    const initial = renders;
    act(() => {
      store.set({ x: 100, y: -50, zoom: 1 });
      frames.flush();
    });
    act(() => {
      store.set({ x: 200, y: -80, zoom: 1 });
      frames.flush();
    });
    expect(renders).toBe(initial);
    act(() => {
      store.set({ x: 200, y: -80, zoom: 2 });
      frames.flush();
    });
    expect(renders).toBe(initial + 1);
    expect(screen.getByTestId('zoom').textContent).toBe('2');
  });

  it('useViewport / useContainerSizeValue / useVisibleWorldRect track the store', () => {
    const { frames, store, wrap } = setup();
    let vpRenders = 0;
    function All() {
      vpRenders++;
      const vp = useViewport();
      const size = useContainerSizeValue();
      const rect = useVisibleWorldRect();
      return (
        <>
          <span data-testid="vp">{`${vp.x},${vp.y},${vp.zoom}`}</span>
          <span data-testid="size">{`${size.width}x${size.height}`}</span>
          <span data-testid="rect">{`${rect.x},${rect.y},${rect.width},${rect.height}`}</span>
        </>
      );
    }
    render(wrap(<All />));
    expect(screen.getByTestId('vp').textContent).toBe('0,0,1');
    expect(screen.getByTestId('size').textContent).toBe('800x600');
    expect(screen.getByTestId('rect').textContent).toBe('0,0,800,600');
    act(() => {
      store.set({ x: -100, y: -100, zoom: 2 });
      frames.flush();
    });
    expect(screen.getByTestId('vp').textContent).toBe('-100,-100,2');
    expect(screen.getByTestId('rect').textContent).toBe('50,50,400,300');
    act(() => {
      store.setContainerSize({ width: 400, height: 200 });
    });
    expect(screen.getByTestId('size').textContent).toBe('400x200');
    expect(screen.getByTestId('rect').textContent).toBe('50,50,200,100');
    const before = vpRenders;
    // No-op commit → no re-render (stable snapshots)
    act(() => {
      store.set({ x: -100, y: -100, zoom: 2 });
      frames.flush();
    });
    expect(vpRenders).toBe(before);
  });

  it('hooks accept an explicit store outside the provider', () => {
    const frames = createFrameHarness();
    const store = createViewportStore({ raf: frames.raf, caf: frames.caf, viewport: { x: 1, y: 2, zoom: 0.5 } });
    function Zoom() {
      return <span data-testid="zoom">{useZoom(store)}</span>;
    }
    render(<Zoom />);
    expect(screen.getByTestId('zoom').textContent).toBe('0.5');
  });

  it('useLod flips levels with hysteresis', () => {
    const { frames, store, wrap } = setup();
    function Lod() {
      return <span data-testid="lod">{useLod(fileNode)}</span>;
    }
    render(wrap(<Lod />));
    // width 100 * zoom 1 = 100px → mid (thresholds 40 / 140)
    expect(screen.getByTestId('lod').textContent).toBe('mid');
    const setZoom = (zoom: number) =>
      act(() => {
        store.set({ x: 0, y: 0, zoom });
        frames.flush();
      });
    setZoom(1.5); // 150px: above 140 but inside the +15% band (161) → stays mid
    expect(screen.getByTestId('lod').textContent).toBe('mid');
    setZoom(1.7); // 170px → near
    expect(screen.getByTestId('lod').textContent).toBe('near');
    setZoom(1.35); // 135px: below 140 but inside the −15% band (119) → stays near
    expect(screen.getByTestId('lod').textContent).toBe('near');
    setZoom(1); // 100px → mid
    expect(screen.getByTestId('lod').textContent).toBe('mid');
    setZoom(0.2); // 20px → far
    expect(screen.getByTestId('lod').textContent).toBe('far');
    setZoom(0.42); // 42px: above 40 but inside the band (46) → stays far
    expect(screen.getByTestId('lod').textContent).toBe('far');
    setZoom(0.6); // 60px → mid
    expect(screen.getByTestId('lod').textContent).toBe('mid');
  });

  it('useZoomBucket uses the reference width and hysteresis', () => {
    const { frames, store, wrap } = setup();
    function Bucket() {
      return <span data-testid="b">{useZoomBucket()}</span>;
    }
    render(wrap(<Bucket />));
    // 200 * 1 = 200px → near
    expect(screen.getByTestId('b').textContent).toBe('near');
    const setZoom = (zoom: number) =>
      act(() => {
        store.set({ x: 0, y: 0, zoom });
        frames.flush();
      });
    setZoom(0.65); // 130px: below 140 but inside the band → near
    expect(screen.getByTestId('b').textContent).toBe('near');
    setZoom(0.5); // 100px → mid
    expect(screen.getByTestId('b').textContent).toBe('mid');
    setZoom(0.1); // 20px → far
    expect(screen.getByTestId('b').textContent).toBe('far');
  });

  it('useZoomBucket honours a custom reference width', () => {
    const { wrap } = setup();
    function Bucket() {
      return <span data-testid="b">{useZoomBucket(20)}</span>;
    }
    render(wrap(<Bucket />));
    expect(screen.getByTestId('b').textContent).toBe('far');
  });
});
