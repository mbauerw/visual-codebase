import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import type { CodebaseRundown, ReactFlowNode } from '../../types';
import RundownNarrative from './RundownNarrative';
import RundownLayers from './RundownLayers';
import RundownFlowDiagram from './RundownFlowDiagram';
import RundownFlowTimeline from './RundownFlowTimeline';
import RundownCrossCutting from './RundownCrossCutting';

// ── Design tokens ─────────────────────────────────────────────────────
const CREAM_BG = '#faf8f3';
const TEXT_HEADING = '#1a1a1a';
const TEXT_BODY = '#333333';
const TEXT_MUTED = '#808080';
const METHODOLOGY_TEXT = '#666666';
const BORDER_LIGHT = '#e5e0d8';
const TAB_INACTIVE_TEXT = '#808080';
const DOT_COLOR = '#b0aca6';

const INDICATOR_PAD_X = 12;
const INDICATOR_TRANSLATE_Y = 4;
const CORNER_RADIUS = 14;

const CONTENT_MAX_HEIGHT = 540;

// ── Per-tab color palette ─────────────────────────────────────────────
// bg: light pastel for indicator + content card
// accent: saturated shade for the badge pill
const TAB_COLORS: Record<string, { bg: string; accent: string }> = {
  'summary': { bg: 'rgb(230, 243, 243)', accent: '#79deeb' },   // teal / cyan
  'architecture-layers': { bg: 'rgb(243, 230, 238)', accent: '#eb79a5' },   // light rose
  'flow-diagram': { bg: 'rgb(243, 236, 228)', accent: '#eb9a79' },   // burnt orange
  'cross-cutting': { bg: 'rgb(235, 230, 243)', accent: '#a579eb' },   // lavender
};

const DEFAULT_TAB_COLOR = TAB_COLORS['summary'];

// ── Default data ──────────────────────────────────────────────────────
const DEFAULT_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'architecture-layers', label: 'Architecture Layers' },
  { id: 'flow-diagram', label: 'Flow Diagram' },
  { id: 'cross-cutting', label: 'Cross Cutting' },
];

// ── SVG corner cutout paths ───────────────────────────────────────────
function CornerCutoutLeft({ fill }: { fill: string }) {
  return (
    <svg
      width={CORNER_RADIUS}
      height={CORNER_RADIUS}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute',
        bottom: 0,
        left: -CORNER_RADIUS,
        display: 'block',
      }}
      aria-hidden="true"
    >
      <path d="M0 14H14V0C14 7.732 7.732 14 0 14Z" fill={fill} />
    </svg>
  );
}

function CornerCutoutRight({ fill }: { fill: string }) {
  return (
    <svg
      width={CORNER_RADIUS}
      height={CORNER_RADIUS}
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute',
        bottom: 0,
        right: -CORNER_RADIUS,
        display: 'block',
      }}
      aria-hidden="true"
    >
      <path d="M14 14H0V0C0 7.732 6.268 14 14 14Z" fill={fill} />
    </svg>
  );
}

// ── Sidebar sub-component ─────────────────────────────────────────────
function Sidebar({
  aboutTitle,
  aboutText,
  methodologyItems,
}: {
  aboutTitle: string;
  aboutText: string;
  methodologyItems: string[];
}) {
  return (
    <aside className="flex flex-col" style={{ minWidth: 0 }}>
      <div style={{ marginBottom: 32 }}>
        <h4
          style={{
            fontSize: '1.35rem',
            fontWeight: 600,
            lineHeight: 1.3,
            color: TEXT_HEADING,
            margin: 0,
            marginBottom: 16,
            letterSpacing: '-0.01em',
          }}
        >
          {aboutTitle}
        </h4>
        <p
          style={{
            fontSize: '0.95rem',
            fontWeight: 400,
            lineHeight: 1.7,
            color: TEXT_BODY,
            margin: 0,
          }}
        >
          {aboutText}
        </p>
      </div>

      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: TEXT_MUTED,
            }}
          >
            Methodology
          </span>
          <a
            href="#"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Learn more about the methodology"
            className="inline-flex items-center hover:opacity-70 transition-opacity"
            style={{ color: TEXT_MUTED, textDecoration: 'none' }}
          >
            <ArrowUpRight size={12} />
          </a>
        </div>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {methodologyItems.map((item, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  flexShrink: 0,
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  backgroundColor: DOT_COLOR,
                  marginTop: 7,
                }}
              />
              <span
                style={{
                  fontSize: '0.875rem',
                  color: METHODOLOGY_TEXT,
                  lineHeight: 1.6,
                }}
              >
                {item}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

// ── Props ─────────────────────────────────────────────────────────────
interface RundownProps {
  rundown: CodebaseRundown;
  graphNodes?: ReactFlowNode[];
  onFileClick?: (filePath: string) => void;
  onLayerClick?: (roles: string[]) => void;
  validFilePaths?: string[];
  title?: string;
  eyebrow?: string;
  aboutTitle?: string;
  aboutText?: string;
  methodologyItems?: string[];
}

// ── Sidebar description text per tab ──────────────────────────────────
const TAB_ABOUT: Record<string, { title: string; text: string; items: string[] }> = {
  'summary': {
    title: 'About this section',
    text: 'A high-level narrative overview of how this codebase is structured, how its pieces connect, and the primary data flows that drive its behavior.',
    items: [
      'Generated from AST parsing and AI analysis',
      'Covers architecture, key patterns, and dependencies',
      'Click a file to view in the source code panel below',
    ],
  },
  'architecture-layers': {
    title: 'About architecture layers',
    text: 'Each layer represents a distinct responsibility tier in the codebase. Files are grouped by their architectural role, from user-facing UI down to data persistence.',
    items: [
      'Layers are ordered top-to-bottom by abstraction level',
      'Role badges show the file categories in each layer',
      'Click a layer to filter the graph by those roles',
      'Click file paths to navigate to the source',
    ],
  },
  'flow-diagram': {
    title: 'About data flows',
    text: 'Flows trace how data moves through the architecture layers for key user scenarios. Each step shows which layer handles the work and the key files involved.',
    items: [
      'Desktop: interactive diagram with layer nodes',
      'Mobile: vertical timeline view',
      'Select different flows to see alternate paths',
      'Click file paths to navigate to the source',
    ],
  },
  'cross-cutting': {
    title: 'About cross-cutting concerns',
    text: 'Cross-cutting concerns are responsibilities that span multiple layers, such as authentication, error handling, logging, and configuration. They represent shared infrastructure used across the codebase.',
    items: [
      'Each card describes a concern and its scope',
      'Files listed are the key touchpoints for that concern',
      'Click file paths to navigate to the source',
    ],
  },
};

// ── Component ─────────────────────────────────────────────────────────
export default function Rundown({
  rundown,
  graphNodes,
  onFileClick,
  onLayerClick,
  validFilePaths = [],
  title = 'The Rundown',
  eyebrow = '',
}: RundownProps) {
  const [activeTabId, setActiveTabId] = useState(DEFAULT_TABS[0].id);
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeFlowIndex, setActiveFlowIndex] = useState(0);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const tabBarRef = useRef<HTMLDivElement>(null);

  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const [hoverPillStyle, setHoverPillStyle] = useState<{
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Build tabs dynamically based on available rundown data
  const tabs = useMemo(() => {
    const available = [...DEFAULT_TABS];
    // Could filter out tabs with no data, but keep them all for consistency
    return available;
  }, []);

  // Extract structural keywords from rundown data for narrative highlighting
  const narrativeKeywords = useMemo(() => {
    const kws: string[] = [];
    for (const layer of rundown.layers) {
      if (layer.label) kws.push(layer.label);
    }
    for (const flow of rundown.flows) {
      if (flow.name) kws.push(flow.name);
    }
    for (const concern of rundown.cross_cutting) {
      if (concern.name) kws.push(concern.name);
    }
    return kws;
  }, [rundown.layers, rundown.flows, rundown.cross_cutting]);

  const activeLabel =
    tabs.find((t) => t.id === activeTabId)?.label ?? '';

  const aboutContent = TAB_ABOUT[activeTabId] ?? TAB_ABOUT['summary'];
  const activeColor = TAB_COLORS[activeTabId] ?? DEFAULT_TAB_COLOR;

  const measureTab = useCallback((tabId: string) => {
    const el = tabRefs.current.get(tabId);
    const bar = tabBarRef.current;
    if (!el || !bar) return null;
    const barRect = bar.getBoundingClientRect();
    const tabRect = el.getBoundingClientRect();
    return {
      left: tabRect.left - barRect.left,
      width: tabRect.width,
      height: tabRect.height,
    };
  }, []);

  useEffect(() => {
    const metrics = measureTab(activeTabId);
    if (metrics) {
      setIndicatorStyle(metrics);
      if (!isInitialized) {
        requestAnimationFrame(() => setIsInitialized(true));
      }
    }
  }, [activeTabId, measureTab, isInitialized]);

  useEffect(() => {
    const handleResize = () => {
      const metrics = measureTab(activeTabId);
      if (metrics) setIndicatorStyle(metrics);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [activeTabId, measureTab]);

  useEffect(() => {
    if (!hoveredTabId || hoveredTabId === activeTabId) {
      setHoverPillStyle(null);
      return;
    }
    const metrics = measureTab(hoveredTabId);
    if (metrics) {
      setHoverPillStyle({
        left: metrics.left + (metrics.width - metrics.width * 0.92) / 2,
        width: metrics.width * 0.92,
        height: metrics.height * 0.7,
      });
    }
  }, [hoveredTabId, activeTabId, measureTab]);

  const activeIndex = tabs.findIndex((t) => t.id === activeTabId);
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === tabs.length - 1;

  const handleTabKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    let nextIndex: number | null = null;
    if (e.key === 'ArrowRight') {
      nextIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      nextIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      nextIndex = 0;
    } else if (e.key === 'End') {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex !== null) {
      e.preventDefault();
      const nextTab = tabs[nextIndex];
      setActiveTabId(nextTab.id);
      tabRefs.current.get(nextTab.id)?.focus();
    }
  };

  // ── Render tab content based on active tab ──────────────────────────
  const renderTabContent = () => {
    switch (activeTabId) {
      case 'summary':
        return (
          <RundownNarrative
            narrative={rundown.narrative}
            validFilePaths={validFilePaths}
            keywords={narrativeKeywords}
            onFileClick={onFileClick}
          />
        );

      case 'architecture-layers':
        return (
          <RundownLayers
            layers={rundown.layers}
            graphNodes={graphNodes}
            onFileClick={onFileClick}
          />
        );

      case 'flow-diagram': {
        const flows = rundown.flows;
        if (!flows || flows.length === 0) {
          return (
            <p style={{ color: TEXT_MUTED, textAlign: 'center', padding: 40 }}>
              No flow data available.
            </p>
          );
        }
        const activeFlow = flows[activeFlowIndex] ?? flows[0];
        return (
          <div className='pt-4'>
            {/* Flow selector if multiple flows */}
            {flows.length > 1 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {flows.map((flow, i) => (
                  <button
                    key={flow.id}
                    onClick={() => setActiveFlowIndex(i)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                    style={{
                      backgroundColor: i === activeFlowIndex
                        ? `${activeColor.accent}40`
                        : 'rgba(0,0,0,0.05)',
                      color: i === activeFlowIndex ? TEXT_HEADING : TEXT_MUTED,
                      border: i === activeFlowIndex
                        ? `1px solid ${activeColor.accent}`
                        : '1px solid transparent',
                    }}
                  >
                    {flow.name}
                  </button>
                ))}
              </div>
            )}

            {/* Desktop: diagram, Mobile: timeline */}
            <div className="hidden sm:block">
              <RundownFlowDiagram
                flow={activeFlow}
                layers={rundown.layers}
                entryPoints={rundown.entry_points}
                onFileClick={onFileClick}
              />
            </div>
            <div className="block sm:hidden">
              <RundownFlowTimeline
                flow={activeFlow}
                layers={rundown.layers}
                onFileClick={onFileClick}
              />
            </div>
          </div>
        );
      }

      case 'cross-cutting':
        return (
          <RundownCrossCutting
            crossCutting={rundown.cross_cutting}
            onFileClick={onFileClick}
          />
        );

      default:
        return null;
    }
  };

  return (
    <section
      className="w-full py-16 px-5 sm:px-10 lg:px-16"
      style={{ backgroundColor: CREAM_BG }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto mb-10">
        {eyebrow && (
          <p
            className="text-sm tracking-widest mb-3"
            style={{
              color: TEXT_MUTED,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              letterSpacing: '0.15em',
            }}
          >
            {eyebrow}
          </p>
        )}
        <h2
          className="font-bold leading-tight max-w-lg"
          style={{
            color: TEXT_HEADING,
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </h2>
      </div>

      {/* ── Two-column content ──────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-10">
        {/* Left side: Tabs + Content card (~65%) */}
        <div className="flex-[1.85] min-w-0">
          {/* Tab bar container */}
          <div
            ref={tabBarRef}
            className="relative overflow-x-auto"
            role="tablist"
            aria-label="Rundown tabs"
            style={{
              paddingBottom: INDICATOR_TRANSLATE_Y,
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {/* Tab buttons row */}
            <div className="flex relative" style={{ zIndex: 2, minWidth: 'max-content' }}>
              {tabs.map((tab, index) => {
                const isActive = tab.id === activeTabId;
                return (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      if (el) tabRefs.current.set(tab.id, el);
                    }}
                    role="tab"
                    aria-selected={isActive}
                    aria-controls={`tabpanel-${tab.id}`}
                    id={`tab-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTabId(tab.id)}
                    onMouseEnter={() => setHoveredTabId(tab.id)}
                    onMouseLeave={() => setHoveredTabId(null)}
                    onKeyDown={(e) => handleTabKeyDown(e, index)}
                    className="relative px-5 py-2.5 text-sm whitespace-nowrap cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded-t"
                    style={{
                      color: isActive ? TEXT_HEADING : TAB_INACTIVE_TEXT,
                      fontWeight: isActive ? 600 : 400,
                      backgroundColor: 'transparent',
                      border: 'none',
                      transition: 'color 200ms ease',
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Hover pill */}
            <div
              className="absolute top-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                left: hoverPillStyle?.left ?? 0,
                width: hoverPillStyle?.width ?? 0,
                height: hoverPillStyle?.height ?? 0,
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
                opacity: hoverPillStyle ? 1 : 0,
                transition: 'left 200ms ease, width 200ms ease, opacity 150ms ease',
              }}
              aria-hidden="true"
            />

            {/* Active tab indicator */}
            {indicatorStyle && (
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: 0,
                  left: indicatorStyle.left - INDICATOR_PAD_X + 10,
                  width: indicatorStyle.width + INDICATOR_PAD_X * 2 - 20,
                  height: indicatorStyle.height + INDICATOR_TRANSLATE_Y,
                  backgroundColor: activeColor.bg,
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  transition: isInitialized
                    ? 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1), background-color 300ms ease'
                    : 'none',
                  zIndex: 1,
                }}
                aria-hidden="true"
              >
                {!isFirst && <CornerCutoutLeft fill={activeColor.bg} />}
                {!isLast && <CornerCutoutRight fill={activeColor.bg} />}
              </div>
            )}
          </div>

          {/* Content card */}
          <div
            id={`tabpanel-${activeTabId}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTabId}`}
            className="rounded-b-2xl relative"
            style={{
              backgroundColor: activeColor.bg,
              borderTopLeftRadius: isFirst ? 0 : '1rem',
              borderTopRightRadius: isLast ? 0 : '1rem',
              transition: 'background-color 300ms ease',
              minHeight: CONTENT_MAX_HEIGHT + 100
            }}
          >
            {/* Controls bar: badge */}
            {activeTabId != 'flow-diagram' && (
            <div className="flex items-center justify-end px-8 pt-6 pb-2">
              <span
                className="inline-flex items-center px-5 py-1.5 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: activeColor.accent,
                  color: TEXT_HEADING,
                  transition: 'background-color 300ms ease',
                }}
              >
                {activeLabel}
              </span>
            </div>
            )}
            {/* Scrollable content area */}
            <div
              className="px-12 py-6"
              style={{
                maxHeight: activeTabId != 'flow-diagram' ? CONTENT_MAX_HEIGHT : CONTENT_MAX_HEIGHT + 100,
                overflowX: 'auto',
                overflowY: activeTabId != 'flow-diagram' ? 'auto' : 'hidden',
              }}
            >
              {renderTabContent()}
            </div>
          </div>
        </div>

        {/* Right side: Sidebar (~35%) */}
        <div className="flex-[1] min-w-[280px] max-w-[420px] lg:pt-12">
          {/* Mobile divider */}
          <div
            className="block lg:hidden"
            style={{
              borderTop: `1px solid ${BORDER_LIGHT}`,
              marginBottom: 32,
            }}
          />
          <Sidebar
            aboutTitle={aboutContent.title}
            aboutText={aboutContent.text}
            methodologyItems={aboutContent.items}
          />
        </div>
      </div>
    </section>
  );
}
