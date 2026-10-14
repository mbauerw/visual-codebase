/**
 * Adapter: RoleLayoutResult (pure boxes) → GraphScene for the engine.
 *
 *   sections   → kind 'section'  (background layer, decorative)
 *   categories → kind 'category' (containers layer, interactive — the whole box
 *                clicks/drags; file nodes sit in a layer above, so a press on a
 *                file never reaches the category)
 *   files      → kind 'file'     (nodes layer, parentId = category, scale = scaleTier)
 */

import type { GraphEdge, GraphNode, GraphScene } from '../core/types';
import { createScene } from '../core/sceneUtils';
import type { RoleCategoryNodeData, RoleSectionNodeData } from '../theme/roleTheme';
import type { ReactFlowNodeData } from '../../types';
import type { RoleLayoutResult } from './roleLayout';

export interface RoleSceneOptions {
  /** Include the Frontend/Backend/Test sections in the scene (and therefore in fit bounds). Default true. */
  includeSections?: boolean;
}

export function toRoleScene(
  layout: RoleLayoutResult,
  edges: ReadonlyArray<GraphEdge>,
  opts: RoleSceneOptions = {}
): GraphScene {
  const { includeSections = true } = opts;
  const nodes: GraphNode[] = [];

  if (includeSections) {
    for (const s of layout.sections) {
      const data: RoleSectionNodeData = { label: s.label, category: s.category, color: s.color };
      nodes.push({
        id: s.id,
        kind: 'section',
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        depth: 0,
        interactive: false,
        draggable: false,
        data,
      });
    }
  }

  for (const c of layout.categories) {
    const data: RoleCategoryNodeData = {
      label: c.label,
      role: c.role,
      category: c.category,
      nodeCount: c.nodeCount,
    };
    nodes.push({
      id: c.id,
      kind: 'category',
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      depth: 0,
      data,
    });
  }

  for (const f of layout.files) {
    nodes.push({
      id: f.id,
      kind: 'file',
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      scale: f.scaleTier,
      parentId: f.categoryId,
      depth: 1,
      draggable: false,
      data: f.data as ReactFlowNodeData,
    });
  }

  return createScene(nodes, [...edges]);
}
