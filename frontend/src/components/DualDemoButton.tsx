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

const BUTTON_HEIGHT = 56;
const CONTAINER_WIDTH = 380;
const EXPANDED_HEIGHT = 260;
const GAP = 12;
const SPLIT_BUTTON_WIDTH = (CONTAINER_WIDTH - GAP) / 2;

const ease = { duration: 0.7, ease: 'easeInOut' } as const;

export default function DualDemoButton({ onSelect }: DualDemoButtonProps) {
  const [split, setSplit] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!split) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSplit(false);
        setHoveredIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [split]);

  return (
    <div
      ref={containerRef}
      className="relative mx-auto"
      style={{
        width: CONTAINER_WIDTH,
        height: BUTTON_HEIGHT,
      }}
    >
      {/* Original "Try Demo" button -- visible before split */}
      <button
        onClick={() => setSplit(true)}
        className="absolute inset-0 bg-white hover:bg-gray-50 text-gray-900 rounded-full font-medium text-lg border border-gray-200 transition-all hover:border-gray-300 hover:scale-[1.02]"
        style={{
          opacity: split ? 0 : 1,
          transform: split ? 'scale(0.8)' : 'scale(1)',
          transition: 'opacity 300ms ease, transform 300ms ease',
          pointerEvents: split ? 'none' : 'auto',
          width: 220,
          left: '50%',
          marginLeft: -110,
        }}
      >
        Try Demo
      </button>

      {/* Split buttons container */}
      <div
        className="absolute top-0 left-0"
        style={{
          width: CONTAINER_WIDTH,
          display: 'flex',
          gap: GAP,
          opacity: split ? 1 : 0,
          transform: split ? 'scale(1)' : 'scale(0.85)',
          transition: 'opacity 400ms ease, transform 400ms ease',
          pointerEvents: split ? 'auto' : 'none',
        }}
      >
        {DEMOS.map((demo, index) => {
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={demo.id}
              className="relative"
              style={{
                width: SPLIT_BUTTON_WIDTH,
                height: BUTTON_HEIGHT,
              }}
            >
              <motion.button
                layout
                transition={ease}
                onClick={() => onSelect(demo.id)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="absolute top-0 left-0 bg-white text-gray-900 font-medium text-base border border-gray-200 cursor-pointer overflow-hidden flex flex-col items-center"
                style={{
                  width: SPLIT_BUTTON_WIDTH,
                  zIndex: isHovered ? 20 : 1,
                }}
                animate={{
                  height: isHovered ? EXPANDED_HEIGHT : BUTTON_HEIGHT,
                  borderRadius: isHovered ? 24 : 28,
                  scale: isHovered ? 1.05 : 1,
                  boxShadow: isHovered 
                    ? '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' 
                    : '0 0px 0px 0px rgba(0, 0, 0, 0)'
                }}
                initial={{ borderRadius: 28, scale: 1 }}
              >
                {/* Button label container */}
                <motion.div
                  layout
                  transition={ease}
                  className="w-full flex items-center justify-center shrink-0"
                  style={{ height: BUTTON_HEIGHT }}
                >
                  <motion.span layout transition={ease} className="truncate px-3">
                    {demo.label}
                  </motion.span>
                </motion.div>

                {/* Expandable summary area */}
                <AnimatePresence>
                  {isHovered && (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.4 }}
                      className="px-4 pb-4 w-full"
                    >
                      <div className="border-t border-gray-100 mb-3" />
                      <p className="text-sm text-gray-500 leading-relaxed text-center px-2">
                        {demo.summary}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
