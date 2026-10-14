/**
 * Node dragging through the real GraphCanvas (nodesDraggable): threshold,
 * transform updates in world units, container drags descendants, edges follow,
 * onNodeDragEnd payload, click suppression, space = pan, disabled = pan.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GraphCanvas, type GraphCanvasProps } from '../core/GraphCanvas';
import { createScene } from '../core/sceneUtils';
import type { GraphCanvasHandle, GraphEdge, GraphNode } from '../core/types';
import { setSpaceHeld } from '../core/spaceKey';
import { createStubTheme } from './testUtils';

function n(id: string, x: number, y: number, w: number, h: number, extra: Partial<GraphNode> = {}): GraphNode {
  return { id, kind: 'file', x, y, width: w, height: h, depth: 0, data: null, ...extra };
}

/*
 * cat (folder 0,0 400x300)
 *   ├─ f1 (40,40 100x40)
 *   └─ f2 (250,200 100x40)
 * loner (600,0 100x40)
 * edge f1 → f2, edge f2 → loner
 */
function buildScene() {
  const nodes: GraphNode[] = [
    n('cat', 0, 0, 400, 300, { kind: 'folder' }),
    n('f1', 40, 40, 100, 40, { parentId: 'cat', depth: 1 }),
    n('f2', 250, 200, 100, 40, { parentId: 'cat', depth: 1 }),
    n('loner', 600, 0, 100, 40),
    n('pinned', 600, 200, 100, 40, { draggable: false }),
  ];
  const edges: GraphEdge[] = [
    { id: 'e12', source: 'f1', target: 'f2' },
    { id: 'e2l', source: 'f2', target: 'loner' },
  ];
  return createScene(nodes, edges);
}

const theme = createStubTheme();

function renderCanvas(props: Partial<GraphCanvasProps> = {}) {
  const ref = createRef<GraphCanvasHandle>();
  const scene = props.scene ?? buildScene();
  const utils = render(<GraphCanvas ref={ref} scene={scene} theme={theme} renderers={{}} fitViewOnSceneChange={false} {...props} />);
  const canvas = screen.getByTestId('graph-canvas');
  const node = (id: string) => screen.getByTestId(`graph-node-${id}`);
  const transform = (id: string) => node(id).style.transform;
  const edgePath = (id: string) => screen.getByTestId(`graph-edge-${id}`).querySelector('path')!.getAttribute('d')!;
  return { ...utils, ref, scene, canvas, node, transform, edgePath };
}

function press(el: Element, x: number, y: number, pointerId = 1) {
  fireEvent.pointerDown(el, { pointerId, button: 0, buttons: 1, clientX: x, clientY: y, isPrimary: true });
}
function move(el: Element, x: number, y: number, pointerId = 1) {
  fireEvent.pointerMove(el, { pointerId, buttons: 1, clientX: x, clientY: y, isPrimary: true });
}
function release(el: Element, x: number, y: number, pointerId = 1) {
  fireEvent.pointerUp(el, { pointerId, button: 0, buttons: 0, clientX: x, clientY: y, isPrimary: true });
}

afterEach(() => {
  setSpaceHeld(false);
});

describe('useNodeDrag via GraphCanvas', () => {
  it('does not drag (and lets the canvas pan) when nodesDraggable is off', () => {
    const { ref, node, transform } = renderCanvas();
    const f1 = node('f1');
    expect(f1.hasAttribute('data-node-draggable')).toBe(false);
    press(f1, 100, 100);
    move(f1, 130, 120);
    expect(transform('f1')).toBe('translate(40px, 40px)');
    expect(f1.dataset.dragging).toBeUndefined();
    // the press bubbled to the canvas gesture layer → pan
    expect(ref.current!.getViewport()).toEqual({ x: 30, y: 20, zoom: 1 });
    release(f1, 130, 120);
  });

  it('marks nodes draggable, ignores moves within the 4px threshold, then drags in world units and does not pan', () => {
    const onNodeDragEnd = vi.fn();
    const { ref, node, transform, edgePath, canvas } = renderCanvas({ nodesDraggable: true, onNodeDragEnd });
    const f1 = node('f1');
    expect(f1.hasAttribute('data-node-draggable')).toBe(true);
    const e12Before = edgePath('e12');
    const e2lBefore = edgePath('e2l');

    press(f1, 100, 100);
    move(f1, 102, 102); // ≤ 4px
    expect(transform('f1')).toBe('translate(40px, 40px)');
    expect(f1.dataset.dragging).toBeUndefined();
    expect(f1.setPointerCapture).not.toHaveBeenCalled();

    move(f1, 120, 110); // +20, +10
    expect(transform('f1')).toBe('translate(60px, 50px)');
    expect(f1.dataset.dragging).toBe('true');
    expect(canvas.dataset.dragging).toBe('true');
    expect(f1.setPointerCapture).toHaveBeenCalledWith(1);
    // the canvas did NOT pan
    expect(ref.current!.getViewport()).toEqual({ x: 0, y: 0, zoom: 1 });
    expect(canvas.dataset.panning).toBeUndefined();
    // the edge touching f1 followed; the other edge is untouched
    expect(edgePath('e12')).not.toBe(e12Before);
    expect(edgePath('e2l')).toBe(e2lBefore);
    // other nodes did not move
    expect(transform('f2')).toBe('translate(250px, 200px)');
    expect(transform('cat')).toBe('translate(0px, 0px)');

    move(f1, 90, 130); // -10, +30 from start
    expect(transform('f1')).toBe('translate(30px, 70px)');

    release(f1, 90, 130);
    expect(f1.dataset.dragging).toBeUndefined();
    expect(canvas.dataset.dragging).toBeUndefined();
    expect(f1.releasePointerCapture).toHaveBeenCalledWith(1);
    expect(onNodeDragEnd).toHaveBeenCalledTimes(1);
    expect(onNodeDragEnd).toHaveBeenCalledWith('f1', { x: 30, y: 70 });
    // offset persists after the drag
    expect(transform('f1')).toBe('translate(30px, 70px)');
  });

  it('divides the client delta by the zoom', () => {
    const { ref, node, transform } = renderCanvas({ nodesDraggable: true });
    act(() => ref.current!.setViewport({ x: 0, y: 0, zoom: 2 }));
    const f1 = node('f1');
    press(f1, 0, 0);
    move(f1, 40, -20);
    expect(transform('f1')).toBe('translate(60px, 30px)');
    release(f1, 40, -20);
  });

  it('a second drag continues from the current offset', () => {
    const { node, transform } = renderCanvas({ nodesDraggable: true });
    const f1 = node('f1');
    press(f1, 0, 0);
    move(f1, 10, 0);
    release(f1, 10, 0);
    expect(transform('f1')).toBe('translate(50px, 40px)');
    press(f1, 0, 0);
    move(f1, 0, 10);
    release(f1, 0, 10);
    expect(transform('f1')).toBe('translate(50px, 50px)');
  });

  it('dragging a container moves all its descendants (and their edges) by the same delta', () => {
    const onNodeDragEnd = vi.fn();
    const { node, transform, edgePath } = renderCanvas({ nodesDraggable: true, onNodeDragEnd });
    const cat = node('cat');
    const e12Before = edgePath('e12');
    const e2lBefore = edgePath('e2l');
    press(cat, 0, 0);
    move(cat, 50, 25);
    expect(transform('cat')).toBe('translate(50px, 25px)');
    expect(transform('f1')).toBe('translate(90px, 65px)');
    expect(transform('f2')).toBe('translate(300px, 225px)');
    expect(transform('loner')).toBe('translate(600px, 0px)');
    expect(cat.dataset.dragging).toBe('true');
    expect(node('f1').dataset.dragging).toBeUndefined();
    // f1→f2 moved rigidly (same shape, translated), f2→loner changed shape
    expect(edgePath('e12')).not.toBe(e12Before);
    expect(edgePath('e2l')).not.toBe(e2lBefore);
    release(cat, 50, 25);
    expect(onNodeDragEnd).toHaveBeenCalledTimes(1);
    expect(onNodeDragEnd).toHaveBeenCalledWith('cat', { x: 50, y: 25 });
    // a child keeps its own offset on top when dragged afterwards
    const f1 = node('f1');
    press(f1, 0, 0);
    move(f1, 10, 10);
    release(f1, 10, 10);
    expect(transform('f1')).toBe('translate(100px, 75px)');
    expect(transform('cat')).toBe('translate(50px, 25px)');
  });

  it('suppresses exactly the click that follows a drag; a plain click still selects', () => {
    const onNodeClick = vi.fn();
    const { node } = renderCanvas({ nodesDraggable: true, onNodeClick });
    const f1 = node('f1');
    // plain click (press + release without crossing the threshold)
    press(f1, 10, 10);
    move(f1, 12, 11);
    release(f1, 12, 11);
    fireEvent.click(f1);
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    expect(f1.dataset.dragging).toBeUndefined();
    // drag → the browser's click is swallowed
    press(f1, 10, 10);
    move(f1, 40, 40);
    release(f1, 40, 40);
    fireEvent.click(f1);
    expect(onNodeClick).toHaveBeenCalledTimes(1);
    // …but only that one
    fireEvent.click(f1);
    expect(onNodeClick).toHaveBeenCalledTimes(2);
  });

  it('pans instead of dragging while space is held', () => {
    const { ref, node, transform } = renderCanvas({ nodesDraggable: true });
    const f1 = node('f1');
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    press(f1, 0, 0);
    move(f1, 30, 10);
    expect(transform('f1')).toBe('translate(40px, 40px)');
    expect(f1.dataset.dragging).toBeUndefined();
    expect(ref.current!.getViewport()).toEqual({ x: 30, y: 10, zoom: 1 });
    release(f1, 30, 10);
    fireEvent.keyUp(window, { key: ' ', code: 'Space' });
    // released: dragging works again
    press(f1, 0, 0);
    move(f1, 30, 10);
    expect(transform('f1')).toBe('translate(70px, 50px)');
    release(f1, 30, 10);
  });

  it('respects node.draggable === false (falls through to a pan) and ignores non-primary buttons', () => {
    const { ref, node, transform } = renderCanvas({ nodesDraggable: true });
    const pinned = node('pinned');
    expect(pinned.hasAttribute('data-node-draggable')).toBe(false);
    press(pinned, 0, 0);
    move(pinned, 30, 10);
    expect(transform('pinned')).toBe('translate(600px, 200px)');
    expect(ref.current!.getViewport()).toEqual({ x: 30, y: 10, zoom: 1 });
    release(pinned, 30, 10);

    act(() => ref.current!.setViewport({ x: 0, y: 0, zoom: 1 }));
    const f1 = node('f1');
    fireEvent.pointerDown(f1, { pointerId: 2, button: 1, buttons: 4, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(f1, { pointerId: 2, buttons: 4, clientX: 20, clientY: 0 });
    expect(transform('f1')).toBe('translate(40px, 40px)');
    expect(ref.current!.getViewport()).toEqual({ x: 20, y: 0, zoom: 1 }); // middle button pans
    fireEvent.pointerUp(f1, { pointerId: 2, button: 1, clientX: 20, clientY: 0 });
  });

  it('a press that leaves the node before the threshold is cancelled', () => {
    const { node, transform } = renderCanvas({ nodesDraggable: true });
    const f1 = node('f1');
    press(f1, 0, 0);
    fireEvent.pointerLeave(f1, { pointerId: 1, clientX: 2, clientY: 2 });
    move(f1, 30, 30);
    expect(transform('f1')).toBe('translate(40px, 40px)');
    expect(f1.dataset.dragging).toBeUndefined();
  });

  it('clears offsets when the scene identity changes unless preservePositionsOnSceneChange', () => {
    const { rerender, node, transform, scene } = renderCanvas({ nodesDraggable: true });
    const f1 = node('f1');
    press(f1, 0, 0);
    move(f1, 10, 10);
    release(f1, 10, 10);
    expect(transform('f1')).toBe('translate(50px, 50px)');
    // same scene identity re-render → kept
    rerender(<GraphCanvas scene={scene} theme={theme} renderers={{}} fitViewOnSceneChange={false} nodesDraggable />);
    expect(transform('f1')).toBe('translate(50px, 50px)');
    // new scene → cleared
    rerender(<GraphCanvas scene={buildScene()} theme={theme} renderers={{}} fitViewOnSceneChange={false} nodesDraggable />);
    expect(transform('f1')).toBe('translate(40px, 40px)');
  });

  it('keeps offsets across scene changes with preservePositionsOnSceneChange', () => {
    const { rerender, node, transform } = renderCanvas({ nodesDraggable: true, preservePositionsOnSceneChange: true });
    const f1 = node('f1');
    press(f1, 0, 0);
    move(f1, 10, 10);
    release(f1, 10, 10);
    rerender(
      <GraphCanvas scene={buildScene()} theme={theme} renderers={{}} fitViewOnSceneChange={false} nodesDraggable preservePositionsOnSceneChange />,
    );
    expect(transform('f1')).toBe('translate(50px, 50px)');
  });
});
