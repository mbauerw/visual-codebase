/**
 * Theme pack registry for the role layout.
 *
 * `activeRoleThemePack` is what `RoleLayoutGraph` renders; `roleThemePacks`
 * is the list the `/graph-dev` harness lets you switch between.
 */

import type { RoleThemePack } from './types';
import { classicPack } from './classic';

export type { RoleThemePack, ThemeSceneInput, ThemeSceneState, ThemeSceneActions, ThemeOverlayProps } from './types';
export { useThemeSceneState } from './useThemeSceneState';
export { classicPack } from './classic';

export const roleThemePacks: readonly RoleThemePack[] = [classicPack];

export const activeRoleThemePack: RoleThemePack = classicPack;

export function findRoleThemePack(id: string | null | undefined): RoleThemePack | undefined {
  return roleThemePacks.find((p) => p.id === id);
}
