/**
 * GraphMiniMap — an SVG overview of the scene with the current viewport
 * outlined; click or drag to move the camera (replaces React Flow's <MiniMap />).
 *
 * This is the one piece of chrome that subscribes to the viewport; it
 * re-renders on rAF-committed viewport changes, nothing else does.
 */

import { memo, useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useGraphActions, useGraphScene, useGraphTheme } from '../core/GraphContext';
import { useContainerSizeValue, useViewport } from '../core/useViewport';
import { getVisibleWorldRect } from '../core/viewportMath';
import { GraphPanel, type GraphPanelPosition } from './GraphPanel';
import type { GraphNode, Rect } from '../core/types';

export interface GraphMiniMapProps {
  width?: number;
  height?: number;
  position?: GraphPanelPosition;
  className?: string;
  /** Overrides theme.chrome.minimap.maskColor */
  maskColor?: string;
  /** Overrides theme.chrome.minimap.nodeColor */
  nodeColor?: (node: GraphNode) => string;
  /** Extra padding around the scene bounds, as a fraction (default 0.05). */
  padding?: number;
}

/** Static node rects — memoised so viewport commits only re-render the mask. */
const MiniMapNodes = memo(function MiniMapNodes({
  nodes,
  colorFn,
  strokeW,
  rx,
}: {
  nodes: GraphNode[];
  colorFn: (n: GraphNode) => string;
  strokeW: number;
  rx: number;
}) {
  return (
    <>
      {nodes.map((n) => (
        <rect
          key={n.id}
          x={n.x}
          y={n.y}
          width={n.width}
          height={n.height}
          fill={n.kind === 'file' ? colorFn(n) : 'none'}
          stroke={n.kind === 'file' ? 'none' : colorFn(n)}
          strokeWidth={n.kind === 'file' ? 0 : strokeW}
          rx={rx}
        />
      ))}
    </>
  );
});

function padRect(r: Rect, frac: number): Rect {
  const px = Math.max(r.width, 1) * frac;
  const py = Math.max(r.height, 1) * frac;
  return { x: r.x - px, y: r.y - py, width: Math.max(r.width, 1) + px * 2, height: Math.max(r.height, 1) + py * 2 };
}

export function GraphMiniMap({
  width = 200,
  height = 150,
  position = 'bottom-right',
  className = '',
  maskColor,
  nodeColor,
  padding = 0.05,
}: GraphMiniMapProps) {
  const scene = useGraphScene();
  const theme = useGraphTheme();
  const actions = useGraphActions();
  const viewport = useViewport();
  const containerSize = useContainerSizeValue();
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const view = useMemo(() => padRect(scene.bounds, padding), [scene.bounds, padding]);
  const mapNodes = useMemo(() => scene.nodes.filter((n) => n.kind !== 'section'), [scene.nodes]);
  const visible = useMemo(() => getVisibleWorldRect(viewport, containerSize), [viewport, containerSize]);
  const colorFn = nodeColor ?? theme.chrome.minimap.nodeColor;
  const mask = maskColor ?? theme.chrome.minimap.maskColor;

  // Map a pointer event on the svg to world coords (respecting preserveAspectRatio="xMidYMid meet").
  const toWorld = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const el = svgRef.current;
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return null;
      const scale = Math.min(r.width / view.width, r.height / view.height);
      const offX = (r.width - view.width * scale) / 2;
      const offY = (r.height - view.height * scale) / 2;
      return {
        x: view.x + (e.clientX - r.left - offX) / scale,
        y: view.y + (e.clientY - r.top - offY) / scale,
      };
    },
    [view]
  );

  const centerOn = useCallback(
    (e: ReactPointerEvent<SVGSVGElement>) => {
      const w = toWorld(e);
      if (!w) return;
      const vp = actions.getViewport();
      actions.setViewport({
        x: containerSize.width / 2 - w.x * vp.zoom,
        y: containerSize.height / 2 - w.y * vp.zoom,
        zoom: vp.zoom,
      });
    },
    [toWorld, actions, containerSize]
  );

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    centerOn(e);
  };
  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (dragging.current) centerOn(e);
  };
  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const maskPath =
    `M${view.x},${view.y}h${view.width}v${view.height}h${-view.width}z ` +
    `M${visible.x},${visible.y}h${visible.width}v${visible.height}h${-visible.width}z`;

  return (
    <GraphPanel position={position} className={`m-4 ${className}`}>
      <svg
        ref={svgRef}
        data-testid="graph-minimap"
        width={width}
        height={height}
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        className={`rounded shadow cursor-pointer ${theme.chrome.minimap.className}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <MiniMapNodes
          nodes={mapNodes}
          colorFn={colorFn}
          strokeW={Math.max(view.width, view.height) / 400}
          rx={Math.max(view.width, view.height) / 300}
        />
        <path d={maskPath} fill={mask} fillRule="evenodd" pointerEvents="none" />
        <rect
          x={visible.x}
          y={visible.y}
          width={visible.width}
          height={visible.height}
          fill="none"
          stroke="currentColor"
          strokeWidth={Math.max(view.width, view.height) / 250}
          pointerEvents="none"
        />
      </svg>
    </GraphPanel>
  );
}
