import { useState } from 'react';

interface DualDemoButtonProps {
  onSelect: (analysisId: string) => void;
}

const DEMOS = [
  {
    id: '0e88d1ec-c6d9-4153-812f-ccf7ed35fb55',
    label: 'nanoChat',
    summary: '',
  },
  {
    id: 'acc4fa1d-8bc1-4d2f-b4d8-88e57e7c280f',
    label: 'codebase-remap',
    summary: '',
  },
] as const;

export default function DualDemoButton({ onSelect }: DualDemoButtonProps) {
  const [split, setSplit] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Matches the original "Try Demo" button dimensions roughly
  // px-8 py-4 text-lg rounded-full => approx 180x56
  const BUTTON_HEIGHT = 56;
  const CONTAINER_WIDTH = 380;
  const EXPANDED_HEIGHT = 260;
  const GAP = 12;
  const SPLIT_BUTTON_WIDTH = (CONTAINER_WIDTH - GAP) / 2;

  return (
    <div
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

      {/* Split buttons container -- absolutely positioned so it never affects layout */}
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
          const currentHeight = isHovered ? EXPANDED_HEIGHT : BUTTON_HEIGHT;

          return (
            <div
              key={demo.id}
              className="relative"
              style={{
                width: SPLIT_BUTTON_WIDTH,
                height: BUTTON_HEIGHT,
              }}
            >
              <button
                onClick={() => onSelect(demo.id)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="absolute top-0 left-0 bg-white text-gray-900 font-medium text-base border border-gray-200 cursor-pointer overflow-hidden"
                style={{
                  width: SPLIT_BUTTON_WIDTH,
                  height: currentHeight,
                  borderRadius: isHovered ? 20 : 9999,
                  transition:
                    'height 300ms ease, border-radius 300ms ease, background-color 150ms ease, border-color 150ms ease, box-shadow 300ms ease',
                  zIndex: isHovered ? 20 : 1,
                  boxShadow: isHovered
                    ? '0 12px 32px rgba(0,0,0,0.10)'
                    : '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                {/* Button label area -- always visible, vertically centered in the original button height */}
                <div
                  className="flex items-center justify-center"
                  style={{ height: BUTTON_HEIGHT }}
                >
                  <span className="truncate px-3">{demo.label}</span>
                </div>

                {/* Expandable summary area */}
                <div
                  className="px-4 pb-4"
                  style={{
                    opacity: isHovered ? 1 : 0,
                    transition: 'opacity 250ms ease 80ms',
                  }}
                >
                  <div className="border-t border-gray-100 mb-3" />
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {demo.summary}
                  </p>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
