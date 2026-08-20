/**
 * Theme contract for the graph engine.
 *
 * A `GraphTheme` gives every node kind default tokens (surface/border/rings/
 * motion) and every edge highlight state its stroke. Renderers receive the
 * resolved per-node tokens and are free to use or ignore them — they are
 * ordinary React components. Overrides layer on top:
 *
 *   theme.nodes[kind]  →  nodeThemeOverride(node)  →  node.themeOverride
 */

import type { CSSProperties } from 'react';
import type { TargetAndTransition, Transition } from 'framer-motion';
import type {
  EdgeHighlight,
  GraphNode,
  LodThresholds,
  NodeHighlight,
  NodeKind,
  ZoomLimits,
} from '../core/types';

export type AnchorSide = 'top' | 'bottom' | 'left' | 'right';

export interface NodeThemeTokens {
  /** Extra classes applied to the node wrapper. */
  className?: string;
  /** Extra inline styles applied to the node wrapper. */
  style?: CSSProperties;
  /** Design tokens consumed by the default renderers. */
  surface?: string;
  border?: string;
  text?: string;
  radius?: number | string;
  /** Tailwind classes per highlight state (e.g. `selected: 'ring-8 ring-amber-500 …'`). */
  ring: Partial<Record<NodeHighlight, string>>;
  /** framer-motion presets applied by renderers to their inner element. */
  motion?: {
    whileHover?: TargetAndTransition;
    transition?: Transition;
  };
}

/** Fully merged tokens handed to a renderer (ring is complete, className/style always defined). */
export interface ResolvedNodeTheme extends NodeThemeTokens {
  className: string;
  style: CSSProperties;
  ring: Record<NodeHighlight, string>;
}

export interface EdgeThemeTokens {
  stroke: string;
  strokeWidth: number;
  opacity?: number;
  /** SVG stroke-dasharray, e.g. '20, 20'. */
  dasharray?: string;
  /** Arrow-head size in world px (fixed `userSpaceOnUse` units). */
  markerSize: number;
  /** Extra classes for the HTML edge label. */
  labelClassName?: string;
}

/** Fully merged edge style for one highlight state. */
export type ResolvedEdgeStyle = Required<Pick<EdgeThemeTokens, 'stroke' | 'strokeWidth' | 'markerSize'>> &
  Pick<EdgeThemeTokens, 'opacity' | 'dasharray' | 'labelClassName'>;

export interface GraphTheme {
  /** Canvas background colour. */
  background: string;
  nodes: Record<NodeKind, NodeThemeTokens>;
  edges: {
    base: EdgeThemeTokens;
    byHighlight: Partial<Record<EdgeHighlight, Partial<EdgeThemeTokens>>>;
  };
  /** Which side of the source/target slot an edge attaches to. */
  anchors: { source: AnchorSide; target: AnchorSide };
  /** On-screen px thresholds for node LOD (see core/lod.ts). */
  lod: LodThresholds;
  zoom: ZoomLimits;
  /** Chrome (controls / minimap / panels) palette. */
  chrome: {
    panelClassName: string;
    buttonClassName: string;
    minimap: { maskColor: string; className: string; nodeColor: (node: GraphNode) => string };
  };
}

export type NodeThemeOverrideFn = (node: GraphNode) => Partial<NodeThemeTokens> | undefined;
