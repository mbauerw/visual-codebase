/**
 * Pure theme resolution: merge node tokens in layers and pick edge styles.
 *
 *   theme.nodes[kind]  →  nodeThemeOverride(node)  →  node.themeOverride
 */

import type { EdgeHighlight, GraphNode, NodeHighlight } from '../core/types';
import type {
  EdgeThemeTokens,
  GraphTheme,
  NodeThemeOverrideFn,
  NodeThemeTokens,
  ResolvedEdgeStyle,
  ResolvedNodeTheme,
} from './types';

/** Every `NodeHighlight` value; compile-checked for completeness via `satisfies`. */
const NODE_HIGHLIGHT_KEYS = Object.keys({
  none: true,
  selected: true,
  tierlist: true,
  connected: true,
  'connected-tierlist': true,
  'edge-endpoint': true,
  'container-selected': true,
} satisfies Record<NodeHighlight, true>) as NodeHighlight[];

/** Copy `src` into `dst` skipping keys whose value is `undefined`. */
function assignDefined<T extends object>(dst: T, src: Partial<T> | undefined): T {
  if (!src) return dst;
  for (const key of Object.keys(src) as (keyof T)[]) {
    const v = src[key];
    if (v !== undefined) (dst as Record<keyof T, unknown>)[key] = v;
  }
  return dst;
}

/**
 * Shallow merge of node tokens, left → right (later wins). Special keys:
 *  - `ring`      merged per highlight key
 *  - `className` concatenated with a single space
 *  - `style`     shallow-merged
 *  - `motion`    shallow-merged
 * `undefined` values in an override are ignored (they never erase a base value).
 * The result is a fresh object; inputs are not mutated.
 */
export function mergeNodeTokens(
  base: NodeThemeTokens,
  ...overrides: (Partial<NodeThemeTokens> | undefined)[]
): NodeThemeTokens {
  const out: NodeThemeTokens = {
    ...base,
    ring: { ...(base.ring ?? {}) },
  };
  if (base.style) out.style = { ...base.style };
  if (base.motion) out.motion = { ...base.motion };

  for (const o of overrides) {
    if (!o) continue;
    const { ring, className, style, motion, ...rest } = o;
    assignDefined(out, rest as Partial<NodeThemeTokens>);
    if (ring) out.ring = assignDefined({ ...out.ring }, ring);
    if (className) out.className = out.className ? `${out.className} ${className}` : className;
    if (style) out.style = assignDefined({ ...(out.style ?? {}) }, style);
    if (motion) out.motion = assignDefined({ ...(out.motion ?? {}) }, motion);
  }
  return out;
}

/**
 * Resolve the tokens for one node: `theme.nodes[node.kind]` → `override?.(node)`
 * → `node.themeOverride`. Every `NodeHighlight` key of `ring` is present (missing
 * ones become `''`); `className` and `style` are always defined.
 */
export function resolveNodeTheme(
  theme: GraphTheme,
  node: GraphNode,
  override?: NodeThemeOverrideFn,
): ResolvedNodeTheme {
  const base: NodeThemeTokens = theme.nodes[node.kind] ?? { ring: {} };
  const merged = mergeNodeTokens(base, override?.(node), node.themeOverride);

  const ring = {} as Record<NodeHighlight, string>;
  for (const key of NODE_HIGHLIGHT_KEYS) ring[key] = merged.ring?.[key] ?? '';

  return {
    ...merged,
    className: merged.className ?? '',
    style: merged.style ?? {},
    ring,
  };
}

/** `{ ...theme.edges.base, ...theme.edges.byHighlight[highlight] }` (undefined override values ignored). */
export function resolveEdgeStyle(theme: GraphTheme, highlight: EdgeHighlight): ResolvedEdgeStyle {
  const merged: EdgeThemeTokens = { ...theme.edges.base };
  assignDefined(merged, theme.edges.byHighlight[highlight]);
  return merged;
}
