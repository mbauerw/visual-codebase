/**
 * Constants for the nested containment diagram.
 *
 * Uses a light amber color scheme inspired by CodeCanvas,
 * with progressively darker shades for deeper nesting levels.
 */

/**
 * Tailwind amber color palette for folder depth visualization.
 * Each index corresponds to a nesting depth level.
 * Uses progressively darker amber shades for nested containers.
 */
export const FOLDER_DEPTH_COLORS = [
  '#fef3c7', // amber-100 - depth 0 (root level)
  '#fde68a', // amber-200 - depth 1
  '#fcd34d', // amber-300 - depth 2
  '#fbbf24', // amber-400 - depth 3
  '#f59e0b', // amber-500 - depth 4
  '#d97706', // amber-600 - depth 5
  '#b45309', // amber-700 - depth 6
  '#92400e', // amber-800 - depth 7
] as const;

/**
 * Border colors for each depth level (slightly darker than background).
 */
export const FOLDER_BORDER_COLORS = [
  '#fcd34d', // amber-300 for depth 0
  '#fbbf24', // amber-400 for depth 1
  '#f59e0b', // amber-500 for depth 2
  '#d97706', // amber-600 for depth 3
  '#b45309', // amber-700 for depth 4
  '#92400e', // amber-800 for depth 5
  '#78350f', // amber-900 for depth 6
  '#451a03', // amber-950 for depth 7
] as const;

/**
 * Text colors for each depth level (ensure readability).
 */
export const FOLDER_TEXT_COLORS = [
  '#92400e', // amber-800 for depth 0-1
  '#78350f', // amber-900 for depth 2-3
  '#451a03', // amber-950 for depth 4+
] as const;

/**
 * Get the background color for a given depth level.
 */
export function getDepthColor(depth: number): string {
  return FOLDER_DEPTH_COLORS[Math.min(depth, FOLDER_DEPTH_COLORS.length - 1)];
}

/**
 * Get the border color for a given depth level.
 */
export function getDepthBorderColor(depth: number): string {
  return FOLDER_BORDER_COLORS[Math.min(depth, FOLDER_BORDER_COLORS.length - 1)];
}

/**
 * Get the text color for a given depth level.
 */
export function getDepthTextColor(depth: number): string {
  if (depth <= 1) return FOLDER_TEXT_COLORS[0];
  if (depth <= 3) return FOLDER_TEXT_COLORS[1];
  return FOLDER_TEXT_COLORS[2];
}

/**
 * Background opacity is no longer needed with solid amber colors.
 * Kept for backwards compatibility but returns 1.
 */
export function getDepthOpacity(_depth: number): number {
  return 1;
}

/**
 * Container padding values (in pixels).
 */
export const CONTAINER_PADDING = {
  top: 40,      // Space for header label
  right: 20,
  bottom: 20,
  left: 20,
} as const;

/**
 * Minimum container dimensions.
 */
export const MIN_CONTAINER_SIZE = {
  width: 140,
  height: 100,
} as const;

/**
 * Z-index layering for nested containers.
 */
export function getDepthZIndex(depth: number): number {
  return depth + 1;
}

/**
 * Canvas background color (amber-50).
 */
export const CANVAS_BACKGROUND = '#fffbeb';
