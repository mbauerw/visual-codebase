import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DualDemoButtonProps {
  onSelect: (analysisId: string) => void;
}

const DEMOS = [
  {
    id: '0e88d1ec-c6d9-4153-812f-ccf7ed35fb55',
    label: 'nanoChat',
    summary: "Demo the remap of Andre Karpathy's nanoChat, an extremely lightweight experimental harness for training LLMs.",
  },
  {
    id: 'acc4fa1d-8bc1-4d2f-b4d8-88e57e7c280f',
    label: 'codebase-remap',
    summary: 'Demo the remap of the codebase-remap application itself. See how codebases are processed, analyzed, and visualized.',
  },
] as const;

const COLLAPSED_WIDTH = 220;
const COLLAPSED_HEIGHT = 56;
const EXPANDED_WIDTH = 380;
const HEADER_HEIGHT = 44;
const OPTION_HEIGHT = 44;
const OPTION_HOVERED_HEIGHT = 200;
const GAP = 12;
const PADDING_BOTTOM = 12;
const DIVIDER_GAP = 12;

const ease = { duration: 0.5, ease: [0.4, 0, 0.2, 1] } as const;

export default function DualDemoButton({ onSelect }: DualDemoButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setExpanded(false);
        setHoveredIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [expanded]);

  // Fix: Container now expands to the full height (including hovered state) to avoid jumping during interaction
  const expandedHeight = HEADER_HEIGHT + DIVIDER_GAP + OPTION_HOVERED_HEIGHT + PADDING_BOTTOM;

  return (
    <div
      ref={containerRef}
      className="relative mx-auto"
      style={{ width: EXPANDED_WIDTH, height: COLLAPSED_HEIGHT }}
    >
      <motion.div
        className="absolute overflow-hidden bg-white border border-gray-200"
        style={{ left: '50%', x: '-50%' }}
        animate={{
          width: expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
          height: expanded ? expandedHeight : COLLAPSED_HEIGHT,
          borderRadius: expanded ? 24 : 28,
          boxShadow: expanded
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
            : '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        }}
        whileHover={!expanded ? {
          scale: 1.05,
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          borderColor: 'rgb(209 213 219)',
        } : undefined}
        transition={ease}
      >
        {/* Header - clickable when collapsed */}
        <motion.div
          onClick={() => !expanded && setExpanded(true)}
          className={`flex items-center justify-center shrink-0 ${
            !expanded ? 'cursor-pointer' : ''
          }`}
          animate={{ height: expanded ? HEADER_HEIGHT : COLLAPSED_HEIGHT }}
          transition={ease}
        >
          <motion.span
            className="font-medium"
            animate={{
              fontSize: expanded ? '13px' : '18px',
              color: expanded ? 'rgb(107 114 128)' : 'rgb(17 24 39)',
            }}
            transition={{ duration: 0.4 }}
          >
            {expanded ? 'Choose a demo' : 'Try Demo'}
          </motion.span>
        </motion.div>

        {/* Demo options */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="px-4 pb-4"
            >
              <div className="border-t border-gray-100 mb-3" />
              <div className="flex items-start" style={{ gap: GAP }}>
                {DEMOS.map((demo, index) => {
                  const isHovered = hoveredIndex === index;
                  return (
                    <motion.button
                      key={demo.id}
                      onClick={() => onSelect(demo.id)}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      className="flex-1 flex flex-col bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 overflow-hidden cursor-pointer"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        height: isHovered ? OPTION_HOVERED_HEIGHT : OPTION_HEIGHT,
                      }}
                      whileHover={{ scale: 1.05, zIndex: 10 }}
                      transition={{
                        opacity: { duration: 0.3, delay: 0.15 + index * 0.08 },
                        y: { duration: 0.3, delay: 0.15 + index * 0.08 },
                        height: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                        scale: { duration: 0.2 },
                      }}
                    >
                      {/* Anchor the title at the top with a fixed height to prevent any movement */}
                      <div className="px-3 flex items-center justify-center shrink-0 w-full" style={{ height: OPTION_HEIGHT }}>
                        <span className="font-medium text-sm text-gray-900">{demo.label}</span>
                      </div>
                      <AnimatePresence>
                        {isHovered && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="px-3 pb-3 w-full"
                          >
                            <div className="border-t border-gray-200 mb-2" />
                            <p className="text-xs text-gray-500 leading-relaxed text-left">
                              {demo.summary}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}