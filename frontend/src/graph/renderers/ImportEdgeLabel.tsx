/**
 * Label content for an import edge: an optional cross-language badge
 * ("TS → Py") above a pill listing the imported names (or the module path).
 * Ported from components/ImportEdge.tsx; positioning is EdgeLabelLayer's job.
 */

import type { EdgeHighlight, GraphEdge } from '../core/types';
import type { Language, ReactFlowEdgeData } from '../../types';

/** Short language labels for the cross-language indicator. */
export const languageShortLabels: Record<Language, string> = {
  javascript: 'JS',
  typescript: 'TS',
  python: 'Py',
  java: 'Java',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rs',
  swift: 'Swift',
  unknown: '?',
};

/**
 * 1 name → truncated at 18 chars (15 + '...'); 2 names → joined; more →
 * `first, +N`; no names → module path truncated at 15 (12 + '...'); else ''.
 */
export function formatImportLabel(data: ReactFlowEdgeData | undefined): string {
  const names = data?.imported_names ?? [];
  if (names.length === 0) {
    const mp = data?.module_path ?? '';
    return mp.length <= 15 ? mp : mp.slice(0, 12) + '...';
  }
  if (names.length === 1) {
    const name = names[0];
    return name.length <= 18 ? name : name.slice(0, 15) + '...';
  }
  if (names.length === 2) {
    return names.join(', ');
  }
  return `${names[0]}, +${names.length - 1}`;
}

export interface ImportEdgeLabelProps {
  edge: GraphEdge;
  highlight: EdgeHighlight;
  className?: string;
}

export function ImportEdgeLabel({ edge, highlight, className }: ImportEdgeLabelProps) {
  const data = edge.data;
  const importedNames = data?.imported_names ?? [];
  const hasImports = importedNames.length > 0;
  const isCrossLanguage = data?.is_cross_language ?? false;
  const sourceLanguage: Language = data?.source_language ?? 'unknown';
  const targetLanguage: Language = data?.target_language ?? 'unknown';

  const label = formatImportLabel(data);
  if (!label && !isCrossLanguage) return null;

  const crossLangLabel = isCrossLanguage
    ? `${languageShortLabels[sourceLanguage]} → ${languageShortLabels[targetLanguage]}`
    : null;

  const selected = highlight === 'selected';
  const dimmed = highlight === 'dimmed';

  return (
    <div
      className={[
        'flex flex-col items-center gap-0.5',
        dimmed ? 'opacity-30' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      data-highlight={highlight}
    >
      {isCrossLanguage && (
        <div
          data-testid="edge-label-cross-language"
          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/90 text-amber-950 border border-amber-400"
          title={`Cross-language: ${sourceLanguage} to ${targetLanguage}`}
        >
          {crossLangLabel}
        </div>
      )}
      {label && (
        <div
          data-testid="edge-label-pill"
          className={[
            'px-2 py-1 rounded text-xs font-mono',
            isCrossLanguage
              ? 'bg-amber-900/90 border border-amber-600 text-amber-100 hover:bg-amber-800'
              : 'bg-slate-800/90 border border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white',
            'transition-colors cursor-pointer max-w-[150px] truncate',
            selected ? 'ring-2 ring-blue-400 bg-slate-700' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          title={hasImports ? importedNames.join(', ') : data?.module_path ?? ''}
        >
          {label}
        </div>
      )}
    </div>
  );
}
