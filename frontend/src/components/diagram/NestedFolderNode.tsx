/**
 * NestedFolderNode - Container node for folders in the nested diagram.
 *
 * Uses a light amber color scheme with progressively darker shades
 * for deeper nesting levels, similar to CodeCanvas.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Folder } from 'lucide-react';
import type { NestedFolderNodeData } from './types';
import {
  getDepthColor,
  getDepthBorderColor,
  getDepthTextColor,
  getDepthZIndex,
} from './constants';

export type NestedFolderNodeType = Node<NestedFolderNodeData, 'nestedFolder'>;

function NestedFolderNode({ data, selected }: NodeProps<NestedFolderNodeType>) {
  const { label, depth, fileCount, width, height } = data;

  const bgColor = getDepthColor(depth);
  const borderColor = getDepthBorderColor(depth);
  const textColor = getDepthTextColor(depth);
  const zIndex = getDepthZIndex(depth);

  return (
    <div
      className={`
        relative transition-all duration-200 group
        ${selected ? 'ring-2 ring-amber-600 ring-offset-2 ring-offset-amber-50' : ''}
      `}
      style={{
        width,
        height,
        backgroundColor: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '16px',
        zIndex,
        isolation: 'isolate',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* Hidden handles for edge connections */}
      <Handle
        type="target"
        position={Position.Top}
        style={{ visibility: 'hidden', top: 0 }}
        id="target-top"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ visibility: 'hidden', bottom: 0 }}
        id="source-bottom"
      />

      {/* Folder header label - positioned at top-left inside the container */}
      <div
        className="absolute flex items-center gap-1.5 px-2.5 py-1 select-none"
        style={{
          top: 10,
          left: 14,
        }}
      >
        <Folder size={18} style={{ color: textColor }} />

        <span
          className="font-semibold text-sm"
          style={{ color: textColor }}
          title={data.path}
        >
          {label}
        </span>

        {fileCount > 0 && (
          <span
            className="px-1.5 py-0.5 rounded-full text-xs font-medium"
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

export default memo(NestedFolderNode);
