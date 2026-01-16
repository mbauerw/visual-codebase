import { memo } from 'react';

/**
 * SubtleAnalyzeBackground
 *
 * An ultra-subtle, whisper-quiet background for the Analyze section.
 * Designed to be almost invisible while adding a touch of warmth and depth.
 *
 * Design Philosophy:
 * - Barely perceptible color washes using project palette
 * - Very slow animations (20-30s cycles) that are nearly imperceptible
 * - Soft grain texture for organic feel without distraction
 * - Faint dot pattern to add visual interest without competing with content
 * - No flashy effects - professional and elegant
 *
 * Colors: #8FBCFA (blue), #FF9A9D (coral), #F6D785 (yellow)
 * All colors used at very low opacity (3-12%) for maximum subtlety.
 */

const keyframes = `
  @keyframes breathe {
    0%, 100% {
      opacity: 0.08;
      transform: scale(1);
    }
    50% {
      opacity: 0.12;
      transform: scale(1.02);
    }
  }

  @keyframes drift {
    0%, 100% {
      transform: translate(0, 0);
    }
    50% {
      transform: translate(8px, -5px);
    }
  }

  @keyframes driftReverse {
    0%, 100% {
      transform: translate(0, 0);
    }
    50% {
      transform: translate(-6px, 4px);
    }
  }
`;

function SubtleAnalyzeBackground() {
  return (
    <>
      <style>{keyframes}</style>

      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        {/* Base: Very subtle warm-to-cool gradient wash */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(
              135deg,
              rgba(143, 188, 250, 0.03) 0%,
              rgba(255, 255, 255, 0) 25%,
              rgba(246, 215, 133, 0.025) 50%,
              rgba(255, 255, 255, 0) 75%,
              rgba(255, 154, 157, 0.02) 100%
            )`,
          }}
        />

        {/* Soft grain texture overlay for organic depth */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Faint dot grid - adds subtle structure */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.035]">
          <defs>
            <pattern
              id="subtleAnalyzeDots"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="20"
                cy="20"
                r="0.75"
                fill="#94a3b8"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#subtleAnalyzeDots)" />
        </svg>

        {/* Blue color wash - top left corner */}
        <div
          className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(143, 188, 250, 0.12) 0%, rgba(143, 188, 250, 0) 60%)',
            filter: 'blur(80px)',
            animation: 'breathe 25s ease-in-out infinite',
          }}
        />

        {/* Coral color wash - right side */}
        <div
          className="absolute top-1/3 -right-32 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 154, 157, 0.08) 0%, rgba(255, 154, 157, 0) 60%)',
            filter: 'blur(70px)',
            animation: 'drift 30s ease-in-out infinite',
          }}
        />

        {/* Yellow color wash - bottom area */}
        <div
          className="absolute -bottom-32 left-1/4 w-[450px] h-[450px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(246, 215, 133, 0.08) 0%, rgba(246, 215, 133, 0) 60%)',
            filter: 'blur(75px)',
            animation: 'driftReverse 28s ease-in-out infinite',
          }}
        />

        {/* Subtle secondary blue accent - bottom right */}
        <div
          className="absolute bottom-1/4 right-1/3 w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(143, 188, 250, 0.06) 0%, rgba(143, 188, 250, 0) 60%)',
            filter: 'blur(50px)',
            animation: 'breathe 22s ease-in-out infinite 5s',
          }}
        />

        {/* Very soft vignette for depth and focus toward center */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 50% 50%, transparent 0%, rgba(248, 250, 252, 0.4) 100%)',
          }}
        />

        {/* Bottom edge fade to white for clean transition */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32"
          style={{
            background: 'linear-gradient(to top, rgba(255, 255, 255, 0.6) 0%, transparent 100%)',
          }}
        />
      </div>
    </>
  );
}

export default memo(SubtleAnalyzeBackground);
