/**
 * NestedFileNode — compact file card for the nested (folder) layout
 * (port of the former React Flow NestedFileNode).
 *
 * White card with a language-coloured left border, FileCode icon, the file
 * name, then a language-abbreviation pill + compact role label. Fills the
 * layout slot (`w-full h-full`); the theme ring class is applied for the
 * highlight state; hover scale on the inner framer-motion element. No React
 * Flow handles — edges anchor to the slot (theme: source bottom, target top).
 *
 * LOD: 'far' → hide the metadata row.
 */

import { motion } from 'framer-motion';
import { FileCode } from 'lucide-react';
import type { NodeRenderProps } from '../../core/types';
import type { ReactFlowNodeData } from '../../../types';
import { languageColors, roleColors } from '../../../types';

/**
 * Returns a short role label (snake_case to Title Case, removes language prefixes).
 */
export function getCompactRoleLabel(role: string): string {
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
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Returns a 2-3 letter language abbreviation.
 */
export function getLanguageAbbreviation(language: string): string {
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

export function NestedFileNode({ node, highlight, lod, theme }: NodeRenderProps<ReactFlowNodeData>) {
  const data = node.data;
  const langColor = languageColors[data.language] || languageColors.unknown;
  const roleColor = roleColors[data.role] || roleColors.unknown;
  const compactRoleLabel = getCompactRoleLabel(data.role);
  const langAbbrev = getLanguageAbbreviation(data.language);
  const ring = theme.ring[highlight] ?? '';
  const isSelected = highlight === 'selected' || highlight === 'tierlist';

  return (
    <div data-testid="nested-file-node" className={`w-full h-full rounded-lg ${ring}`}>
      <motion.div
        className="w-full h-full rounded-lg px-2.5 py-2 flex flex-col justify-center gap-1 overflow-hidden cursor-pointer"
        style={{
          backgroundColor: theme.surface ?? '#ffffff',
          borderLeft: `4px solid ${langColor}`,
          boxShadow: isSelected
            ? '0 10px 15px -3px rgba(245, 158, 11, 0.3), 0 4px 6px -4px rgba(245, 158, 11, 0.3)'
            : '0 1px 3px rgba(0, 0, 0, 0.1)',
          transformOrigin: 'center center',
        }}
        title={`${data.path}\n${data.description || ''}`}
        initial={false}
        animate={{ scale: isSelected ? 1.05 : 1 }}
        whileHover={theme.motion?.whileHover ?? { scale: 1.05 }}
        transition={theme.motion?.transition}
      >
        {/* File name row */}
        <div className="flex items-center gap-1.5 min-w-0">
          <FileCode size={14} className="flex-shrink-0" style={{ color: langColor }} />
          <span
            className="text-sm font-medium truncate leading-tight"
            style={{ color: theme.text ?? '#1f2937' }}
            title={data.label}
          >
            {data.label}
          </span>
        </div>

        {/* Metadata row (hidden when far away) */}
        {lod !== 'far' && (
          <div data-testid="nested-file-node-meta" className="flex items-center gap-1.5 min-w-0">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none flex-shrink-0"
              style={{ backgroundColor: `${langColor}20`, color: langColor }}
            >
              {langAbbrev}
            </span>
            <span
              className="text-[10px] truncate leading-none"
              style={{ color: roleColor }}
              title={compactRoleLabel}
            >
              {compactRoleLabel}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
