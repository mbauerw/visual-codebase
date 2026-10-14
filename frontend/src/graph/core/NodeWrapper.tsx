/**
 * NodeWrapper — the absolutely positioned slot for one node.
 *
 * Owns hit-testing, pointer callbacks, dragging (useNodeDrag), theme resolution
 * and the LOD / position-offset subscriptions; delegates all visuals to the
 * renderer registered for `node.kind`. Memoised so a node only re-renders when
 * its own props change (node object identity, highlight), its LOD level flips
 * or its position offset changes. The renderer itself is behind a second memo
 * (`NodeContent`) so a drag only re-renders the wrapper div, not the renderer.
 */

import { memo, useCallback, useMemo, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import type { GraphNode, LodLevel, NodeHighlight, NodeRenderProps } from './types';
import type { ResolvedNodeTheme } from '../theme/types';
import { useGraphCallbacks, useGraphRenderers, useGraphTheme, useNodeThemeOverride } from './GraphContext';
import { useLod } from './useViewport';
import { useNodeOffset } from './usePositions';
import { useNodeDrag } from './useNodeDrag';
import { resolveNodeTheme } from '../theme/resolve';

export interface NodeWrapperProps {
  node: GraphNode;
  highlight: NodeHighlight;
}

/** Fallback renderer for kinds without a registered component (dev aid). */
function FallbackNode({ node }: NodeRenderProps) {
  return (
    <div
      className="w-full h-full rounded border border-dashed border-gray-400 bg-gray-200/60 text-[10px] text-gray-700 overflow-hidden p-1"
      title={`${node.kind}: ${node.id}`}
    >
      {node.kind}: {node.id}
    </div>
  );
}

function joinClasses(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

interface NodeContentProps {
  Renderer: React.ComponentType<NodeRenderProps>;
  node: GraphNode;
  highlight: NodeHighlight;
  lod: LodLevel;
  theme: ResolvedNodeTheme;
}

/** Memo boundary around the renderer: position-only re-renders of the wrapper stop here. */
const NodeContent = memo(function NodeContent({ Renderer, node, highlight, lod, theme }: NodeContentProps) {
  return <Renderer node={node} highlight={highlight} lod={lod} theme={theme} />;
});

function NodeWrapperInner({ node, highlight }: NodeWrapperProps) {
  const theme = useGraphTheme();
  const renderers = useGraphRenderers();
  const callbacks = useGraphCallbacks();
  const override = useNodeThemeOverride();
  const lod = useLod(node);
  const offset = useNodeOffset(node.id);
  const drag = useNodeDrag(node);

  const resolved = useMemo(() => resolveNodeTheme(theme, node, override), [theme, node, override]);
  const Renderer = (renderers[node.kind] ?? FallbackNode) as React.ComponentType<NodeRenderProps>;

  const handleClick = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      // The click that follows a drag must not select the node.
      if (drag.consumeClickSuppression()) return;
      callbacks.onNodeClick?.(node, e);
    },
    [callbacks, node, drag]
  );
  const handleDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      e.stopPropagation();
      callbacks.onNodeDoubleClick?.(node, e);
    },
    [callbacks, node]
  );
  const handleEnter = useCallback(() => callbacks.onNodeHover?.(node), [callbacks, node]);
  const dragLeave = drag.handlers.onPointerLeave;
  const handleLeave = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      dragLeave(e);
      callbacks.onNodeHover?.(null);
    },
    [callbacks, dragLeave]
  );
  const handleContextMenu = useCallback((e: ReactMouseEvent) => e.preventDefault(), []);

  const style: CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    transform: `translate(${node.x + offset.dx}px, ${node.y + offset.dy}px)`,
    width: node.width,
    height: node.height,
    ...resolved.style,
    ...node.style,
  };

  return (
    <div
      data-testid={`graph-node-${node.id}`}
      data-node-id={node.id}
      data-node-kind={node.kind}
      data-highlight={highlight}
      data-lod={lod}
      data-node-draggable={drag.enabled ? '' : undefined}
      className={joinClasses(
        'graph-node',
        node.interactive === false && 'pointer-events-none',
        resolved.className,
        node.className
      )}
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onPointerDown={drag.handlers.onPointerDown}
      onPointerMove={drag.handlers.onPointerMove}
      onPointerUp={drag.handlers.onPointerUp}
      onPointerCancel={drag.handlers.onPointerCancel}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onContextMenu={handleContextMenu}
    >
      <NodeContent Renderer={Renderer} node={node} highlight={highlight} lod={lod} theme={resolved} />
    </div>
  );
}

export const NodeWrapper = memo(NodeWrapperInner);
NodeWrapper.displayName = 'NodeWrapper';
