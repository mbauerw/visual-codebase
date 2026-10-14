/**
 * Role-layout node renderers (ports of CustomNode / CategoryNode / Categorybackground).
 */

import type { NodeRendererRegistry } from '../../core/types';
import { RoleFileNode } from './RoleFileNode';
import { RoleCategoryNode } from './RoleCategoryNode';
import { RoleSectionNode } from './RoleSectionNode';

export { RoleFileNode, getRoleFileVisualScale } from './RoleFileNode';
export { RoleCategoryNode } from './RoleCategoryNode';
export { RoleSectionNode } from './RoleSectionNode';

export const roleRenderers: NodeRendererRegistry = {
  file: RoleFileNode,
  category: RoleCategoryNode,
  section: RoleSectionNode,
};
