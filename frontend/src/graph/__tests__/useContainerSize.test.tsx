import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useContainerSizeObserver } from '../core/useContainerSize';
import { createViewportStore, type ViewportStore } from '../core/viewportStore';
import { createFrameHarness } from './testUtils';

type ROCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

function installResizeObserverMock() {
  const instances: Array<{ cb: ROCallback; observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = [];
  class RO {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    constructor(cb: ROCallback) {
      instances.push({ cb, observe: this.observe, disconnect: this.disconnect });
    }
  }
  const original = globalThis.ResizeObserver;
  vi.stubGlobal('ResizeObserver', RO);
  return {
    instances,
    resize(width: number, height: number) {
      for (const inst of instances) {
        inst.cb([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
      }
    },
    restore() {
      vi.stubGlobal('ResizeObserver', original);
    },
  };
}

function Box({ store, size }: { store: ViewportStore; size: { width: number; height: number } }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useContainerSizeObserver(ref, store);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        // Fake layout: jsdom always measures 0×0.
        if (el) {
          el.getBoundingClientRect = () =>
            ({ ...size, left: 0, top: 0, right: size.width, bottom: size.height, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
        }
      }}
    />
  );
}

describe('useContainerSizeObserver', () => {
  let ro: ReturnType<typeof installResizeObserverMock>;
  afterEach(() => ro?.restore());

  it('measures once on mount and pushes rounded sizes into the store', () => {
    ro = installResizeObserverMock();
    const frames = createFrameHarness();
    const store = createViewportStore({ raf: frames.raf, caf: frames.caf });
    const listener = vi.fn();
    store.subscribe(listener);
    render(<Box store={store} size={{ width: 640.4, height: 480.6 }} />);
    expect(store.getContainerSize()).toEqual({ width: 640, height: 481 });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(ro.instances).toHaveLength(1);
    expect(ro.instances[0].observe).toHaveBeenCalledTimes(1);
  });

  it('follows ResizeObserver entries, skipping unchanged and zero sizes', () => {
    ro = installResizeObserverMock();
    const frames = createFrameHarness();
    const store = createViewportStore({ raf: frames.raf, caf: frames.caf });
    render(<Box store={store} size={{ width: 300, height: 200 }} />);
    const listener = vi.fn();
    store.subscribe(listener);
    act(() => ro.resize(300, 200));
    expect(listener).not.toHaveBeenCalled();
    act(() => ro.resize(500.2, 250.4));
    expect(store.getContainerSize()).toEqual({ width: 500, height: 250 });
    expect(listener).toHaveBeenCalledTimes(1);
    act(() => ro.resize(0, 0));
    expect(store.getContainerSize()).toEqual({ width: 500, height: 250 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('ignores a zero initial rect (not laid out yet)', () => {
    ro = installResizeObserverMock();
    const frames = createFrameHarness();
    const store = createViewportStore({ raf: frames.raf, caf: frames.caf, containerSize: { width: 10, height: 10 } });
    render(<Box store={store} size={{ width: 0, height: 0 }} />);
    expect(store.getContainerSize()).toEqual({ width: 10, height: 10 });
  });

  it('disconnects the observer on unmount', () => {
    ro = installResizeObserverMock();
    const frames = createFrameHarness();
    const store = createViewportStore({ raf: frames.raf, caf: frames.caf });
    const { unmount } = render(<Box store={store} size={{ width: 300, height: 200 }} />);
    unmount();
    expect(ro.instances[0].disconnect).toHaveBeenCalledTimes(1);
  });
});
