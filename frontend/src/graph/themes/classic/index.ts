/**
 * "Classic" — the shipping dark slate/amber look, wrapped as a theme pack.
 * Role boxes on a circle per section, pyramid/grid of files inside.
 */

import { roleTheme } from '../../theme/roleTheme';
import { roleRenderers } from '../../renderers/role';
import { computeRoleLayout } from '../../layouts/roleLayout';
import { toRoleScene } from '../../layouts/roleScene';
import type { RoleThemePack } from '../types';

export const classicPack: RoleThemePack = {
  id: 'classic',
  label: 'Classic',
  description: 'Dark slate, role circles per section, pyramid of files by dependency tier.',
  theme: roleTheme,
  renderers: roleRenderers,
  buildScene: ({ nodes, edges }) => toRoleScene(computeRoleLayout(nodes, edges), edges),
  filterPalette: 'dark',
};
