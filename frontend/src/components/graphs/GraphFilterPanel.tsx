/**
 * GraphFilterPanel - search + language + role filter panel shared by the graph
 * layout wrappers. Two palettes: 'dark' (Role layout, slate) and 'amber'
 * (Nested layout). Markup and classes are identical to the former inline
 * panels in RoleLayoutGraph / NestedLayoutGraph.
 */

import { Search } from 'lucide-react';

import type { ArchitecturalRole, Language } from '../../types';
import { languageColors, roleColors } from '../../types';

export type GraphFilterPalette = 'dark' | 'amber';

export interface GraphFilterPanelProps {
  palette: GraphFilterPalette;
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  languageFilter: Language | 'all';
  onLanguageFilterChange?: (language: Language | 'all') => void;
  roleFilter: ArchitecturalRole | 'all';
  onRoleFilterChange?: (role: ArchitecturalRole | 'all') => void;
  availableLanguages: Language[];
  availableRoles: ArchitecturalRole[];
  /** Number of file nodes currently shown */
  visibleCount: number;
  /** Total number of file nodes in the graph */
  totalCount: number;
}

interface PaletteClasses {
  container: string;
  searchIcon: string;
  input: string;
  label: string;
  chipActive: string;
  chipInactive: string;
  stats: string;
}

const PALETTES: Record<GraphFilterPalette, PaletteClasses> = {
  dark: {
    container: 'bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-3 w-52',
    searchIcon: 'absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500',
    input:
      'w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-4 focus:ring-blue-500',
    label: 'text-xs text-slate-500 uppercase tracking-wide mb-1 block',
    chipActive: 'bg-blue-600 text-white',
    chipInactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600',
    stats: 'text-xs text-slate-500 pt-2 border-t border-slate-700',
  },
  amber: {
    container: 'bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3 w-52 shadow-lg',
    searchIcon: 'absolute left-2.5 top-1/2 -translate-y-1/2 text-amber-600',
    input:
      'w-full pl-8 pr-3 py-1.5 bg-white border border-amber-300 rounded text-sm text-amber-900 placeholder-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-500',
    label: 'text-xs text-amber-700 uppercase tracking-wide mb-1 block',
    chipActive: 'bg-amber-500 text-white',
    chipInactive: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    stats: 'text-xs text-amber-700 pt-2 border-t border-amber-300',
  },
};

const CHIP_BASE = 'px-2 py-1 text-xs rounded cursor-pointer transition-colors';

export default function GraphFilterPanel({
  palette,
  searchQuery,
  onSearchChange,
  languageFilter,
  onLanguageFilterChange,
  roleFilter,
  onRoleFilterChange,
  availableLanguages,
  availableRoles,
  visibleCount,
  totalCount,
}: GraphFilterPanelProps) {
  const p = PALETTES[palette];
  const chipClass = (active: boolean) => `${CHIP_BASE} ${active ? p.chipActive : p.chipInactive}`;

  return (
    <div className={p.container}>
      {/* Search */}
      <div className="relative">
        <Search size={16} className={p.searchIcon} />
        <input
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className={p.input}
        />
      </div>
      {/* Language Filter */}
      <div>
        <label className={p.label}>Language</label>
        <div className="flex flex-wrap gap-1">
          <button onClick={() => onLanguageFilterChange?.('all')} className={chipClass(languageFilter === 'all')}>
            All
          </button>
          {availableLanguages.map((lang) => (
            <button
              key={lang}
              onClick={() => onLanguageFilterChange?.(lang)}
              className={chipClass(languageFilter === lang)}
              style={{
                borderLeft: `2px solid ${languageColors[lang]}`,
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>
      {/* Role Filter */}
      <div>
        <label className={p.label}>Role</label>
        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
          <button onClick={() => onRoleFilterChange?.('all')} className={chipClass(roleFilter === 'all')}>
            All
          </button>
          {availableRoles.map((role) => (
            <button
              key={role}
              onClick={() => onRoleFilterChange?.(role)}
              className={chipClass(roleFilter === role)}
              style={{
                borderLeft: `2px solid ${roleColors[role]}`,
              }}
            >
              {role.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      {/* Stats */}
      <div className={p.stats}>
        Showing {visibleCount} of {totalCount} files
      </div>
    </div>
  );
}
