/**
 * FeatureRail — the visualization page's feature switcher, flush with the
 * upper-left corner of the feature area and overlaying it (absolutely
 * positioned by the page, so it never shifts the feature underneath).
 *
 * Three levels of reveal:
 *   idle      → one tab: the active feature's icon
 *   hover     → the other three tabs unfold in place (keyboard focus and a tap
 *               on the collapsed tab do the same)
 *   hover tab → a flap grows out of the rail's right edge at that row with the
 *               title (same material as the rail, so it reads as one piece);
 *               click switches the feature
 */

import { useCallback, useEffect, useRef, useState, type FocusEvent } from 'react';
import { FolderTree, LayoutDashboard, Network, ScrollText, type LucideIcon } from 'lucide-react';

export type FeatureKey = 'overview' | 'visualization' | 'rundown' | 'files';

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  icon: LucideIcon;
  /** Tailwind classes for the icon tile (tint + icon colour). */
  accent: string;
}

export const FEATURES: readonly FeatureDef[] = [
  { key: 'overview', label: 'Project Overview', icon: LayoutDashboard, accent: 'bg-rose-100 text-rose-600' },
  { key: 'visualization', label: 'Visualization', icon: Network, accent: 'bg-sky-100 text-sky-600' },
  { key: 'rundown', label: 'The Rundown', icon: ScrollText, accent: 'bg-teal-100 text-teal-700' },
  { key: 'files', label: 'Files + Source Code', icon: FolderTree, accent: 'bg-amber-100 text-amber-700' },
];

export const DEFAULT_FEATURE: FeatureKey = 'overview';

/** Width of the rail in px (a 32px icon tile centred in a 48px row). Pages reserve this much to its right. */
export const FEATURE_RAIL_WIDTH = 48;

/** Grace period before the rail folds after the pointer leaves, so a short excursion doesn't snap it shut. */
export const FEATURE_RAIL_CLOSE_DELAY_MS = 140;

export function isFeatureKey(value: string | null | undefined): value is FeatureKey {
  return FEATURES.some((f) => f.key === value);
}

export interface FeatureRailProps {
  active: FeatureKey;
  onChange: (key: FeatureKey) => void;
  className?: string;
}

export default function FeatureRail({ active, onChange, className = '' }: FeatureRailProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);
  const unfold = useCallback(() => {
    cancelClose();
    setOpen(true);
  }, [cancelClose]);
  const foldSoon = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), FEATURE_RAIL_CLOSE_DELAY_MS);
  }, [cancelClose]);
  useEffect(() => cancelClose, [cancelClose]);

  const handleBlur = (e: FocusEvent<HTMLElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
  };

  return (
    <nav
      aria-label="Features"
      data-testid="feature-rail"
      data-open={open ? 'true' : 'false'}
      onMouseEnter={unfold}
      onMouseLeave={foldSoon}
      onFocus={unfold}
      onBlur={handleBlur}
      style={{ width: FEATURE_RAIL_WIDTH }}
      className={`flex flex-col items-stretch rounded-br-2xl bg-white/90 backdrop-blur-sm border-r border-b border-slate-200/80 shadow-lg shadow-slate-900/10 ${className}`}
    >
      {FEATURES.map((f, i) => {
        const Icon = f.icon;
        const isActive = f.key === active;
        const shown = open || isActive;
        // Rows fill the rail edge to edge; the last row on screen takes the rail's rounded corner.
        const isLastShown = open ? i === FEATURES.length - 1 : isActive;
        return (
          // Each tab is its own fold so the active one stays put while the others unfold around it.
          <div
            key={f.key}
            data-testid={`feature-fold-${f.key}`}
            data-shown={shown ? 'true' : 'false'}
            className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
              shown ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            {/* The row gap is a margin on the button so a folded row contributes zero height. */}
            <div className={`min-h-0 flex flex-col ${shown ? 'overflow-visible' : 'overflow-hidden'}`}>
              <button
                type="button"
                data-testid={`feature-tab-${f.key}`}
                aria-label={f.label}
                aria-current={isActive ? 'page' : undefined}
                aria-hidden={!shown}
                tabIndex={shown ? 0 : -1}
                title={f.label}
                onClick={() => {
                  if (isActive) {
                    if (!open) setOpen(true); // touch: a tap on the collapsed tab unfolds the rail
                    return;
                  }
                  onChange(f.key);
                }}
                className={`group relative flex items-center justify-center h-10 w-full text-left transition-[border-radius] duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 ${
                  isActive ? 'bg-slate-900' : ''
                } ${isLastShown ? 'rounded-br-2xl' : 'mb-1'}`}
              >
                <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${f.accent}`}>
                  <Icon size={17} />
                </span>
                {/*
                  Title flap: anchored at the row's right edge (= the rail's edge, over
                  its border) and zero-width until the tab is hovered or focused, so it
                  grows straight out of the rail.
                */}
                <span
                  data-testid={`feature-title-${f.key}`}
                  className="absolute top-0 h-10 flex items-center max-w-0 opacity-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-slate-800 bg-white border-y border-r border-slate-200/80 rounded-r-xl shadow-[8px_6px_18px_-8px_rgba(15,23,42,0.25)] transition-[max-width,opacity,padding] duration-200 ease-out motion-reduce:transition-none group-hover:max-w-[240px] group-hover:opacity-100 group-hover:px-3 group-focus-visible:max-w-[240px] group-focus-visible:opacity-100 group-focus-visible:px-3"
                  style={{ left: '100%' }}
                >
                  {f.label}
                </span>
              </button>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
