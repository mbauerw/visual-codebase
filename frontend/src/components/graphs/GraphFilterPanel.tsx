/**
 * GraphFilterPanel - search + language + role filter panel shared by the graph
 * layout wrappers. Palettes: 'dark' (slate), 'amber' and 'honey' (Role and
 * Nested layouts, matches the honeycomb wax-and-ink chrome). With `collapsible`
 * the panel starts closed behind a "Filters" header the user clicks to open.
 */

import { useId, useState } from 'react';
import { ChevronDown, Filter, Search } from 'lucide-react';

import type { ArchitecturalRole, Language } from '../../types';
import { languageColors, roleColors } from '../../types';

export type GraphFilterPalette = 'dark' | 'amber' | 'honey';

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
  /** Render behind a clickable "Filters" header, closed by default. */
  collapsible?: boolean;
}

interface PaletteClasses {
  container: string;
  searchIcon: string;
  input: string;
  label: string;
  chipActive: string;
  chipInactive: string;
  stats: string;
  /** Collapse header button. */
  header: string;
  /** "N active" badge shown on the header while filters are applied. */
  badge: string;
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
    header: 'text-sm font-medium text-slate-300 hover:text-white',
    badge: 'bg-blue-600 text-white',
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
    header: 'text-sm font-medium text-amber-800 hover:text-amber-950',
    badge: 'bg-amber-500 text-white',
  },
  // Matches the honeycomb chrome (HoneycombOverlay's Bloom / Fold label): wax
  // fill, ink outline + drop shadow, Rubik with tracked uppercase labels.
  honey: {
    container:
      'bg-[#fff6d6] border-[3px] border-[#2b1d0e] rounded-[20px] px-4 py-2.5 space-y-3 w-52 text-[#2b1d0e] font-[Rubik,system-ui,sans-serif] shadow-[0_4px_0_rgba(43,29,14,0.25)]',
    searchIcon: 'absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8a5a2b]',
    input:
      'w-full pl-8 pr-3 py-1.5 bg-white border-2 border-[#2b1d0e] rounded-full text-sm text-[#2b1d0e] placeholder-[#8a5a2b] focus:outline-none focus:ring-2 focus:ring-[#f3a712]',
    label: 'text-[11px] font-bold tracking-[0.14em] uppercase text-[#4a2f17] mb-1 block',
    chipActive: 'bg-[#f3a712] text-[#2b1d0e] font-semibold',
    chipInactive: 'bg-[#ffe9a8] text-[#4a2f17] hover:bg-[#f9cf6e]',
    stats: 'text-[12px] font-semibold tracking-[0.1em] text-[#2b1d0e] pt-2 border-t-2 border-[#2b1d0e]',
    header: 'text-[12px] font-bold tracking-[0.14em] uppercase hover:text-[#8a5a2b]',
    badge: 'bg-[#f3a712] text-[#2b1d0e] tracking-normal',
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
  collapsible = false,
}: GraphFilterPanelProps) {
  const p = PALETTES[palette];
  const chipClass = (active: boolean) => `${CHIP_BASE} ${active ? p.chipActive : p.chipInactive}`;
  const [open, setOpen] = useState(!collapsible);
  const bodyId = useId();
  const activeCount =
    (searchQuery.trim() ? 1 : 0) + (languageFilter !== 'all' ? 1 : 0) + (roleFilter !== 'all' ? 1 : 0);

  return (
    <div className={p.container}>
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={bodyId}
          className={`w-full flex items-center gap-2 cursor-pointer transition-colors ${p.header}`}
        >
          <Filter size={14} />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className={`px-1.5 rounded-full text-[10px] leading-4 ${p.badge}`}>{activeCount} active</span>
          )}
          <ChevronDown size={16} className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      )}
      {open && (
        <div id={bodyId} className="space-y-3">
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
      )}
    </div>
  );
}
