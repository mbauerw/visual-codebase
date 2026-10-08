/**
 * NestedFolderNode — folder container for the nested (folder) layout
 * (port of the former React Flow NestedFolderNode).
 *
 * Depth-coloured amber background/border (see theme/nestedTheme.ts) with a
 * header row: Folder icon, folder name and a file-count pill. Fills the layout
 * slot; the wrapper is interactive so a body click bubbles to
 * `onNodeClick(folder)` and the wrapper marks it `container-selected`.
 *
 * LOD: 'far' → hide the count pill.
 */

import { Folder } from 'lucide-react';
import type { NodeRenderProps } from '../../core/types';
import {
  getDepthBorderColor,
  getDepthColor,
  getDepthTextColor,
  type NestedFolderNodeData,
} from '../../theme/nestedTheme';

export function NestedFolderNode({ node, highlight, lod, theme }: NodeRenderProps<NestedFolderNodeData>) {
  const { label, path, depth, fileCount } = node.data;

  const bgColor = getDepthColor(depth);
  const borderColor = getDepthBorderColor(depth);
  const textColor = getDepthTextColor(depth);
  const ring = theme.ring[highlight] ?? '';
  const radius = theme.radius ?? 16;

  return (
    <div
      data-testid="nested-folder-node"
      // `shadow-sm` (not an inline box-shadow) so the Tailwind ring composes with it
      className={`w-full h-full relative shadow-sm transition-shadow duration-200 cursor-pointer ${ring}`}
      style={{
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
      }}
    >
      {/* Folder header label - top-left inside the container */}
      <div
        className="absolute flex items-center gap-1.5 px-2.5 py-0 select-none max-w-[calc(100%-20px)]"
        style={{ top: 10, left: 14 }}
      >
        <Folder size={18} className="flex-shrink-0" style={{ color: textColor }} />

        <span className="font-semibold text-lg truncate" style={{ color: textColor }} title={path}>
          {label}
        </span>

        {fileCount > 0 && lod !== 'far' && (
          <span
            data-testid="nested-folder-count"
            className="px-1.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0"
            style={{
              backgroundColor: borderColor,
              color: depth <= 2 ? '#78350f' : '#fffbeb',
            }}
          >
            {fileCount}
          </span>
        )}
      </div>
    </div>
  );
}
