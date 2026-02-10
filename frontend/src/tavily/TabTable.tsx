import { useState, useRef, useCallback, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';

// ── Design tokens (matching Tavily reference exactly) ─────────────────
const CREAM_BG = '#faf8f3';
const TAB_ACTIVE_BG = 'rgb(230, 243, 243)';
const ACCENT_CYAN = '#79deeb';
const TEXT_HEADING = '#1a1a1a';
const TEXT_BODY = '#333333';
const TEXT_MUTED = '#808080';
const METHODOLOGY_TEXT = '#666666';
const TAB_BORDER = '#e5e5e5';
const BORDER_LIGHT = '#e5e0d8';
const TAB_INACTIVE_TEXT = '#808080';
const DOT_COLOR = '#b0aca6';

const INDICATOR_PAD_X = 12;
const INDICATOR_TRANSLATE_Y = 4;
const CORNER_RADIUS = 14;

// ── Default data ──────────────────────────────────────────────────────
const DEFAULT_TABS = [
  { id: 'summary', label: 'Summary' },
  { id: 'architecture-layers', label: 'Architecture Layers' },
  { id: 'flow-diagram', label: 'Flow Diagram' },
  { id: 'cross-cutting', label: 'Cross Cutting' },

];

const DEFAULT_ABOUT_TEXT =
  'This benchmark evaluates how relevant retrieved documents are to a user query, using QuotientAI\'s document relevance detection and focusing on practical usefulness rather than keyword overlap. It is designed to reflect real-world retrieval behavior in production search and RAG systems.';

const DEFAULT_METHODOLOGY_ITEMS = [
  'Framework: Dynamic evaluation framework to mirror production',
  'Dataset: Open-sourced dynamic query generator',
  'Scoring: Relevance via QuotientAI API',
  'Normalization: Comparable document length across providers',
  'Retrieval: max 10 documents per query',
];

// ── SVG corner cutout paths ───────────────────────────────────────────
// These create the "inverse rounded corner" effect where the active tab
// connects seamlessly to the content card below it.
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
      {/* About section */}
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

      {/* Methodology section */}
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
interface TabTableProps {
  title?: string;
  eyebrow?: string;
  tabs?: { id: string; label: string }[];
  aboutTitle?: string;
  aboutText?: string;
  methodologyItems?: string[];
  children?: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────
export default function TabTable({
  title = 'The Rundown',
  eyebrow = '',
  tabs = DEFAULT_TABS,
  aboutTitle = 'About this benchmark',
  aboutText = DEFAULT_ABOUT_TEXT,
  methodologyItems = DEFAULT_METHODOLOGY_ITEMS,
  children,
}: TabTableProps) {
  const [activeTabId, setActiveTabId] = useState(tabs[0]?.id ?? '');
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const tabBarRef = useRef<HTMLDivElement>(null);

  // Track the position/size of the active tab indicator
  const [indicatorStyle, setIndicatorStyle] = useState<{
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Track the position/size of the hover pill
  const [hoverPillStyle, setHoverPillStyle] = useState<{
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const activeLabel =
    tabs.find((t) => t.id === activeTabId)?.label ?? '';

  // Measure a tab element relative to the tab bar
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

  // Measure active tab for the background indicator
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

  // Measure hovered tab for the translucent hover pill
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

  // Determine position of active tab for corner cutouts
  const activeIndex = tabs.findIndex((t) => t.id === activeTabId);
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === tabs.length - 1;

  // Keyboard navigation within tablist
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

  return (
    <section
      className="w-full py-16 px-5 sm:px-10 lg:px-16"
      style={{ backgroundColor: CREAM_BG }}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="max-w-[1400px] mx-auto mb-10">
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
            aria-label="Benchmark tabs"
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

            {/* Hover pill (translucent, follows hovered tab) */}
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

            {/* Active tab indicator (colored background that connects to content card) */}
            {indicatorStyle && (
              <div
                className="absolute pointer-events-none"
                style={{
                  bottom: 0,
                  left: indicatorStyle.left - INDICATOR_PAD_X,
                  width: indicatorStyle.width + INDICATOR_PAD_X * 2,
                  height: indicatorStyle.height + INDICATOR_TRANSLATE_Y,
                  backgroundColor: TAB_ACTIVE_BG,
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  transition: isInitialized
                    ? 'left 300ms cubic-bezier(0.4, 0, 0.2, 1), width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
                    : 'none',
                  zIndex: 1,
                }}
                aria-hidden="true"
              >
                {!isFirst && <CornerCutoutLeft fill={TAB_ACTIVE_BG} />}
                {!isLast && <CornerCutoutRight fill={TAB_ACTIVE_BG} />}
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
              backgroundColor: TAB_ACTIVE_BG,
              borderTopLeftRadius: isFirst ? 0 : '1rem',
              borderTopRightRadius: isLast ? 0 : '1rem',
              minHeight: 400,
            }}
          >
            {/* Controls bar: badge */}
            <div className="flex items-center justify-end px-8 pt-6 pb-2">
              <span
                className="inline-flex items-center px-5 py-1.5 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor: ACCENT_CYAN,
                  color: TEXT_HEADING,
                }}
              >
                {activeLabel}
              </span>
            </div>

            {/* Content area (blank placeholder or children) */}
            <div className="px-8 pb-8" style={{ minHeight: 340 }}>
              {children ?? (
                <div
                  className="w-full flex items-center justify-center"
                  style={{ minHeight: 320 }}
                >
                  <div className="w-full space-y-16 px-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="w-full"
                        style={{
                          borderTop: `1px dashed ${TAB_BORDER}`,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
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
            aboutTitle={aboutTitle}
            aboutText={aboutText}
            methodologyItems={methodologyItems}
          />
        </div>
      </div>
    </section>
  );
}
