/**
 * NestedFileNode - Compact file node for nested containment diagrams.
 *
 * Designed to be compact and work with the light amber theme.
 * Uses white background with colored accents for language/role.
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { FileCode } from 'lucide-react';
import type { NestedFileNodeData } from './types';
import { languageColors, roleColors } from '../../types';

export type NestedFileNodeType = Node<NestedFileNodeData, 'nestedFile'>;

/**
 * Returns a short role label (snake_case to Title Case, removes prefixes).
 */
function getCompactRoleLabel(role: string): string {
  const prefixes = ['go_', 'rust_', 'swift_', 'react_'];
  let cleanRole = role;

  for (const prefix of prefixes) {
    if (role.startsWith(prefix)) {
      cleanRole = role.slice(prefix.length);
      break;
    }
  }

  return cleanRole
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Returns a 2-3 letter language abbreviation.
 */
function getLanguageAbbreviation(language: string): string {
  const abbreviations: Record<string, string> = {
    javascript: 'JS',
    typescript: 'TS',
    python: 'PY',
    java: 'JV',
    csharp: 'C#',
    go: 'GO',
    rust: 'RS',
    swift: 'SW',
    unknown: '?',
  };
  return abbreviations[language] || language.slice(0, 2).toUpperCase();
}

function NestedFileNode({ data, selected }: NodeProps<NestedFileNodeType>) {
  const langColor = languageColors[data.language] || languageColors.unknown;
  const roleColor = roleColors[data.role] || roleColors.unknown;
  const compactRoleLabel = getCompactRoleLabel(data.role);
  const langAbbrev = getLanguageAbbreviation(data.language);

  return (
    <div
      className={`
        relative px-2.5 py-2 rounded-lg
        min-w-[130px] max-w-[170px]
        transition-all duration-200
        cursor-pointer
        hover:scale-105 hover:z-10
        ${selected
          ? 'ring-2 ring-amber-600 shadow-lg shadow-amber-500/30 ring-offset-1 ring-offset-amber-100 scale-105 z-20'
          : 'hover:ring-1 hover:ring-amber-400 hover:shadow-md'
        }
      `}
      style={{
        backgroundColor: '#ffffff',
        borderLeft: `4px solid ${langColor}`,
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      }}
      title={`${data.path}\n${data.description || ''}`}
    >
      {/* Target handle - imports enter from top */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-amber-400 !w-2 !h-2 !border !border-amber-500 !-top-1"
        id="target"
      />

      {/* Main content */}
      <div className="flex flex-col gap-1">
        {/* File name row */}
        <div className="flex items-center gap-1.5">
          <FileCode size={14} className="flex-shrink-0" style={{ color: langColor }} />
          <span
            className="text-sm font-medium text-slate-800 truncate leading-tight"
            title={data.label}
          >
            {data.label}
          </span>
        </div>

        {/* Metadata row */}
        <div className="flex items-center gap-1.5">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none"
            style={{ backgroundColor: `${langColor}20`, color: langColor }}
          >
            {langAbbrev}
          </span>
          <span
            className="text-[10px] text-slate-500 truncate leading-none"
            style={{ color: roleColor }}
            title={compactRoleLabel}
          >
            {compactRoleLabel}
          </span>
        </div>
      </div>

      {/* Source handle - exports leave from bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-amber-400 !w-2 !h-2 !border !border-amber-500 !-bottom-1"
        id="source"
      />
    </div>
  );
}

export default memo(NestedFileNode);
