/**
 * FeatureSwitcher — the visualization page's feature control, in the top bar.
 *
 *   [ ◀ ]  [ ● Overview ▾ ]  [ ▶ ]
 *
 * The outer arrows step to the previous / next feature (wrapping); the centre
 * shows the current feature and opens a dropdown to pick one directly.
 */

import { useEffect, useId, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FolderTree,
  LayoutDashboard,
  Network,
  ScrollText,
  type LucideIcon,
} from 'lucide-react';

export type FeatureKey = 'overview' | 'visualization' | 'rundown' | 'files';

export interface FeatureDef {
  key: FeatureKey;
  /** Short name shown in the control. */
  label: string;
  /** Full name shown in the dropdown. */
  title: string;
  description: string;
  icon: LucideIcon;
  /** Icon colour on the dark bar. */
  accent: string;
}

export const FEATURES: readonly FeatureDef[] = [
  {
    key: 'overview',
    label: 'Overview',
    title: 'Project Overview',
    description: 'What this codebase is and how it is put together',
    icon: LayoutDashboard,
    accent: 'text-rose-400',
  },
  {
    key: 'visualization',
    label: 'Visualization',
    title: 'Visualization',
    description: 'Dependency graph by role or by folder',
    icon: Network,
    accent: 'text-sky-400',
  },
  {
    key: 'rundown',
    label: 'Rundown',
    title: 'The Rundown',
    description: 'Layers, data flow and cross-cutting concerns',
    icon: ScrollText,
    accent: 'text-teal-300',
  },
  {
    key: 'files',
    label: 'Files + Code',
    title: 'Files + Source Code',
    description: 'Browse the tree and read any file',
    icon: FolderTree,
    accent: 'text-amber-300',
  },
];

export const DEFAULT_FEATURE: FeatureKey = 'overview';

export function isFeatureKey(value: string | null | undefined): value is FeatureKey {
  return FEATURES.some((f) => f.key === value);
}

/** The feature `steps` places after `key` in FEATURES order, wrapping at both ends. */
export function stepFeature(key: FeatureKey, steps: number): FeatureKey {
  const i = FEATURES.findIndex((f) => f.key === key);
  const n = FEATURES.length;
  return FEATURES[(((i < 0 ? 0 : i) + steps) % n + n) % n].key;
}

export interface FeatureSwitcherProps {
  active: FeatureKey;
  onChange: (key: FeatureKey) => void;
  className?: string;
}

const ARROW =
  'flex items-center justify-center w-8 self-stretch text-slate-400 hover:text-white hover:bg-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500';

export default function FeatureSwitcher({ active, onChange, className = '' }: FeatureSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = FEATURES.find((f) => f.key === active) ?? FEATURES[0];
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (key: FeatureKey) => {
    setOpen(false);
    if (key !== active) onChange(key);
  };

  return (
    <div ref={rootRef} data-testid="feature-switcher" data-open={open ? 'true' : 'false'} className={`relative ${className}`}>
      <div className="flex items-stretch h-9 rounded-md bg-slate-700 overflow-hidden divide-x divide-slate-600">
        <button
          type="button"
          data-testid="feature-prev"
          aria-label="Previous feature"
          title="Previous feature"
          onClick={() => onChange(stepFeature(active, -1))}
          className={ARROW}
        >
          <ChevronLeft size={16} />
        </button>

        <button
          type="button"
          data-testid="feature-current"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center justify-center gap-2 px-3 min-w-[164px] text-sm font-medium text-white hover:bg-slate-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500"
        >
          <CurrentIcon size={15} className={`shrink-0 ${current.accent}`} />
          <span className="truncate">{current.label}</span>
          <ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
        </button>

        <button
          type="button"
          data-testid="feature-next"
          aria-label="Next feature"
          title="Next feature"
          onClick={() => onChange(stepFeature(active, 1))}
          className={ARROW}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Features"
          className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 rounded-xl bg-slate-800 border border-slate-700 shadow-2xl shadow-black/40 py-1 z-50"
        >
          {FEATURES.map((f) => {
            const Icon = f.icon;
            const isActive = f.key === active;
            return (
              <button
                key={f.key}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                data-testid={`feature-option-${f.key}`}
                onClick={() => choose(f.key)}
                className={`w-full flex items-start gap-3 px-3 py-2 text-left transition-colors focus:outline-none focus-visible:bg-slate-700 ${
                  isActive ? 'bg-slate-700/60' : 'hover:bg-slate-700'
                }`}
              >
                <span className="w-8 h-8 shrink-0 rounded-lg bg-slate-900/60 flex items-center justify-center">
                  <Icon size={16} className={f.accent} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-white">{f.title}</span>
                  <span className="block text-xs text-slate-400 leading-snug mt-0.5">{f.description}</span>
                </span>
                {isActive && <Check size={16} className="shrink-0 mt-1 text-sky-400" aria-hidden />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
