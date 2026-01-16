/**
 * MediumAnalyzeBackground
 *
 * A polished medium-intensity animated background featuring:
 * - Organic morphing mesh blobs with glassmorphism effect
 * - Floating constellation particles with connecting lines
 * - Animated gradient ribbons that flow across the canvas
 * - Subtle noise texture overlay for depth
 * - Layered glow effects for dimensionality
 *
 * Design Philosophy:
 * This background creates an engaging, modern atmosphere without overwhelming
 * the content. The organic shapes suggest creativity and flow, while the
 * constellation particles hint at connections and structure - perfect for
 * a codebase visualization tool.
 *
 * Uses project colors: #8FBCFA (blue), #FF9A9D (coral), #F6D785 (yellow)
 */

export default function MediumAnalyzeBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient - soft and warm */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(165deg,
              #fafbfd 0%,
              #f5f7fa 25%,
              #f0f4f8 50%,
              #faf8f5 75%,
              #f8f9fb 100%
            )
          `,
        }}
      />

      {/* Morphing mesh blob - Primary (blue) */}
      <div
        className="absolute -top-24 -left-16 w-[420px] h-[420px] animate-morph-slow"
        style={{
          background: `
            radial-gradient(
              ellipse at 40% 40%,
              rgba(143, 188, 250, 0.45) 0%,
              rgba(143, 188, 250, 0.25) 35%,
              rgba(143, 188, 250, 0.08) 60%,
              transparent 80%
            )
          `,
          filter: 'blur(45px)',
          borderRadius: '60% 40% 70% 30% / 40% 50% 60% 50%',
        }}
      />

      {/* Morphing mesh blob - Secondary (coral) */}
      <div
        className="absolute -bottom-20 -right-20 w-[480px] h-[480px] animate-morph-medium"
        style={{
          background: `
            radial-gradient(
              ellipse at 60% 60%,
              rgba(255, 154, 157, 0.4) 0%,
              rgba(255, 154, 157, 0.2) 40%,
              rgba(255, 154, 157, 0.05) 65%,
              transparent 85%
            )
          `,
          filter: 'blur(50px)',
          borderRadius: '40% 60% 30% 70% / 60% 30% 70% 40%',
        }}
      />

      {/* Morphing mesh blob - Accent (yellow) */}
      <div
        className="absolute top-1/3 right-[10%] w-[300px] h-[300px] animate-morph-fast"
        style={{
          background: `
            radial-gradient(
              ellipse at 50% 50%,
              rgba(246, 215, 133, 0.5) 0%,
              rgba(246, 215, 133, 0.2) 45%,
              transparent 75%
            )
          `,
          filter: 'blur(40px)',
          borderRadius: '50% 50% 40% 60% / 60% 40% 60% 40%',
        }}
      />

      {/* Small accent blob - Blue (bottom left) */}
      <div
        className="absolute bottom-[15%] left-[20%] w-[180px] h-[180px] animate-float-gentle"
        style={{
          background: `
            radial-gradient(
              circle at 50% 50%,
              rgba(143, 188, 250, 0.35) 0%,
              rgba(143, 188, 250, 0.1) 50%,
              transparent 70%
            )
          `,
          filter: 'blur(30px)',
        }}
      />

      {/* Animated gradient ribbon - SVG layer */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Gradient definitions */}
          <linearGradient id="ribbonGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8FBCFA" stopOpacity="0.3" />
            <stop offset="50%" stopColor="#F6D785" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#FF9A9D" stopOpacity="0.25" />
          </linearGradient>

          <linearGradient id="ribbonGradient2" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FF9A9D" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#8FBCFA" stopOpacity="0.15" />
          </linearGradient>

          {/* Glow filter for particles */}
          <filter id="particleGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Flowing ribbon path 1 */}
        <path
          className="animate-ribbon-flow"
          d="M-50,150 Q200,50 400,180 T800,120 T1200,200"
          fill="none"
          stroke="url(#ribbonGradient1)"
          strokeWidth="60"
          strokeLinecap="round"
          opacity="0.6"
          style={{ filter: 'blur(20px)' }}
        />

        {/* Flowing ribbon path 2 */}
        <path
          className="animate-ribbon-flow-reverse"
          d="M1300,350 Q1000,450 700,320 T200,400 T-100,300"
          fill="none"
          stroke="url(#ribbonGradient2)"
          strokeWidth="50"
          strokeLinecap="round"
          opacity="0.5"
          style={{ filter: 'blur(25px)' }}
        />

        {/* Constellation particles group 1 - Blue theme */}
        <g className="animate-constellation-drift" filter="url(#particleGlow)">
          {/* Connecting lines */}
          <line x1="15%" y1="25%" x2="22%" y2="18%" stroke="#8FBCFA" strokeWidth="1" strokeOpacity="0.2" />
          <line x1="22%" y1="18%" x2="28%" y2="28%" stroke="#8FBCFA" strokeWidth="1" strokeOpacity="0.15" />
          <line x1="15%" y1="25%" x2="28%" y2="28%" stroke="#8FBCFA" strokeWidth="1" strokeOpacity="0.1" />

          {/* Particles */}
          <circle cx="15%" cy="25%" r="4" fill="#8FBCFA" fillOpacity="0.5" className="animate-pulse-gentle" />
          <circle cx="22%" cy="18%" r="3" fill="#8FBCFA" fillOpacity="0.4" className="animate-pulse-gentle-delayed" />
          <circle cx="28%" cy="28%" r="5" fill="#8FBCFA" fillOpacity="0.45" className="animate-pulse-gentle" />
        </g>

        {/* Constellation particles group 2 - Coral theme */}
        <g className="animate-constellation-drift-slow" filter="url(#particleGlow)">
          {/* Connecting lines */}
          <line x1="75%" y1="65%" x2="82%" y2="72%" stroke="#FF9A9D" strokeWidth="1" strokeOpacity="0.2" />
          <line x1="82%" y1="72%" x2="88%" y2="62%" stroke="#FF9A9D" strokeWidth="1" strokeOpacity="0.15" />
          <line x1="75%" y1="65%" x2="88%" y2="62%" stroke="#FF9A9D" strokeWidth="1" strokeOpacity="0.12" />

          {/* Particles */}
          <circle cx="75%" cy="65%" r="5" fill="#FF9A9D" fillOpacity="0.45" className="animate-pulse-gentle-delayed" />
          <circle cx="82%" cy="72%" r="3" fill="#FF9A9D" fillOpacity="0.4" className="animate-pulse-gentle" />
          <circle cx="88%" cy="62%" r="4" fill="#FF9A9D" fillOpacity="0.5" className="animate-pulse-gentle-delayed" />
        </g>

        {/* Constellation particles group 3 - Yellow theme */}
        <g className="animate-constellation-drift" filter="url(#particleGlow)">
          {/* Connecting lines */}
          <line x1="55%" y1="80%" x2="62%" y2="88%" stroke="#F6D785" strokeWidth="1" strokeOpacity="0.25" />
          <line x1="62%" y1="88%" x2="68%" y2="82%" stroke="#F6D785" strokeWidth="1" strokeOpacity="0.2" />

          {/* Particles */}
          <circle cx="55%" cy="80%" r="4" fill="#F6D785" fillOpacity="0.5" className="animate-pulse-gentle" />
          <circle cx="62%" cy="88%" r="3" fill="#F6D785" fillOpacity="0.45" className="animate-pulse-gentle-delayed" />
          <circle cx="68%" cy="82%" r="4" fill="#F6D785" fillOpacity="0.55" className="animate-pulse-gentle" />
        </g>

        {/* Scattered solo particles for depth */}
        <circle cx="8%" cy="45%" r="2.5" fill="#8FBCFA" fillOpacity="0.35" className="animate-twinkle" />
        <circle cx="92%" cy="35%" r="2" fill="#FF9A9D" fillOpacity="0.3" className="animate-twinkle-delayed" />
        <circle cx="35%" cy="12%" r="2" fill="#F6D785" fillOpacity="0.4" className="animate-twinkle" />
        <circle cx="45%" cy="55%" r="1.5" fill="#8FBCFA" fillOpacity="0.25" className="animate-twinkle-delayed" />
        <circle cx="70%" cy="15%" r="2.5" fill="#FF9A9D" fillOpacity="0.35" className="animate-twinkle" />
        <circle cx="12%" cy="75%" r="2" fill="#F6D785" fillOpacity="0.3" className="animate-twinkle-delayed" />
        <circle cx="85%" cy="90%" r="1.5" fill="#8FBCFA" fillOpacity="0.28" className="animate-twinkle" />
      </svg>

      {/* Geometric accent shapes */}
      <div className="absolute top-[12%] right-[25%] w-16 h-16 animate-rotate-gentle">
        <div
          className="w-full h-full"
          style={{
            border: '2px solid rgba(143, 188, 250, 0.25)',
            borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
          }}
        />
      </div>

      <div className="absolute bottom-[25%] left-[12%] w-10 h-10 animate-rotate-gentle-reverse">
        <div
          className="w-full h-full"
          style={{
            border: '2px solid rgba(255, 154, 157, 0.22)',
            borderRadius: '70% 30% 30% 70% / 70% 70% 30% 30%',
          }}
        />
      </div>

      <div className="absolute top-[55%] right-[8%] w-8 h-8 animate-float-gentle">
        <div
          className="w-full h-full bg-gradient-to-br from-[#F6D785]/20 to-transparent"
          style={{ borderRadius: '40% 60% 60% 40% / 60% 40% 60% 40%' }}
        />
      </div>

      {/* Subtle noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Soft vignette for depth and focus */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(
              ellipse 80% 60% at 50% 50%,
              transparent 30%,
              rgba(250, 251, 253, 0.4) 70%,
              rgba(248, 249, 251, 0.6) 100%
            )
          `,
        }}
      />

      {/* CSS Keyframes */}
      <style>{`
        /* Morphing blob animations - organic shape shifting */
        @keyframes morph-slow {
          0%, 100% {
            border-radius: 60% 40% 70% 30% / 40% 50% 60% 50%;
            transform: translate(0, 0) scale(1);
          }
          25% {
            border-radius: 40% 60% 50% 50% / 60% 40% 50% 60%;
            transform: translate(10px, -15px) scale(1.02);
          }
          50% {
            border-radius: 50% 50% 40% 60% / 50% 60% 40% 50%;
            transform: translate(-5px, -25px) scale(1);
          }
          75% {
            border-radius: 70% 30% 60% 40% / 40% 60% 50% 50%;
            transform: translate(-15px, -10px) scale(0.98);
          }
        }

        @keyframes morph-medium {
          0%, 100% {
            border-radius: 40% 60% 30% 70% / 60% 30% 70% 40%;
            transform: translate(0, 0) rotate(0deg) scale(1);
          }
          33% {
            border-radius: 60% 40% 50% 50% / 40% 60% 50% 50%;
            transform: translate(-20px, 15px) rotate(3deg) scale(1.03);
          }
          66% {
            border-radius: 50% 50% 60% 40% / 50% 50% 40% 60%;
            transform: translate(15px, 20px) rotate(-2deg) scale(0.97);
          }
        }

        @keyframes morph-fast {
          0%, 100% {
            border-radius: 50% 50% 40% 60% / 60% 40% 60% 40%;
            transform: translate(0, 0) scale(1);
          }
          50% {
            border-radius: 40% 60% 60% 40% / 40% 60% 40% 60%;
            transform: translate(-10px, -15px) scale(1.05);
          }
        }

        /* Gentle floating animation */
        @keyframes float-gentle {
          0%, 100% {
            transform: translateY(0) translateX(0);
          }
          25% {
            transform: translateY(-8px) translateX(4px);
          }
          50% {
            transform: translateY(-12px) translateX(-2px);
          }
          75% {
            transform: translateY(-5px) translateX(-6px);
          }
        }

        /* Ribbon flow animations */
        @keyframes ribbon-flow {
          0% {
            transform: translateX(-50px) translateY(0);
            opacity: 0.5;
          }
          50% {
            transform: translateX(0) translateY(-20px);
            opacity: 0.7;
          }
          100% {
            transform: translateX(-50px) translateY(0);
            opacity: 0.5;
          }
        }

        @keyframes ribbon-flow-reverse {
          0% {
            transform: translateX(50px) translateY(0);
            opacity: 0.4;
          }
          50% {
            transform: translateX(0) translateY(25px);
            opacity: 0.6;
          }
          100% {
            transform: translateX(50px) translateY(0);
            opacity: 0.4;
          }
        }

        /* Constellation drift animations */
        @keyframes constellation-drift {
          0%, 100% {
            transform: translate(0, 0);
          }
          25% {
            transform: translate(8px, -5px);
          }
          50% {
            transform: translate(12px, 8px);
          }
          75% {
            transform: translate(-4px, 6px);
          }
        }

        @keyframes constellation-drift-slow {
          0%, 100% {
            transform: translate(0, 0);
          }
          33% {
            transform: translate(-10px, 8px);
          }
          66% {
            transform: translate(6px, -6px);
          }
        }

        /* Pulse animations for particles */
        @keyframes pulse-gentle {
          0%, 100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }

        @keyframes pulse-gentle-delayed {
          0%, 100% {
            opacity: 0.7;
            transform: scale(1.1);
          }
          50% {
            opacity: 1;
            transform: scale(0.9);
          }
        }

        /* Twinkle animation for solo particles */
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 0.7;
            transform: scale(1.3);
          }
        }

        @keyframes twinkle-delayed {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1.2);
          }
          50% {
            opacity: 0.2;
            transform: scale(0.8);
          }
        }

        /* Rotation animations for geometric shapes */
        @keyframes rotate-gentle {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes rotate-gentle-reverse {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }

        /* Animation class assignments */
        .animate-morph-slow {
          animation: morph-slow 12s ease-in-out infinite;
        }

        .animate-morph-medium {
          animation: morph-medium 10s ease-in-out infinite;
        }

        .animate-morph-fast {
          animation: morph-fast 7s ease-in-out infinite;
        }

        .animate-float-gentle {
          animation: float-gentle 8s ease-in-out infinite;
        }

        .animate-ribbon-flow {
          animation: ribbon-flow 15s ease-in-out infinite;
        }

        .animate-ribbon-flow-reverse {
          animation: ribbon-flow-reverse 18s ease-in-out infinite;
        }

        .animate-constellation-drift {
          animation: constellation-drift 12s ease-in-out infinite;
        }

        .animate-constellation-drift-slow {
          animation: constellation-drift-slow 16s ease-in-out infinite;
        }

        .animate-pulse-gentle {
          animation: pulse-gentle 4s ease-in-out infinite;
        }

        .animate-pulse-gentle-delayed {
          animation: pulse-gentle-delayed 4s ease-in-out infinite 2s;
        }

        .animate-twinkle {
          animation: twinkle 5s ease-in-out infinite;
        }

        .animate-twinkle-delayed {
          animation: twinkle-delayed 6s ease-in-out infinite 1.5s;
        }

        .animate-rotate-gentle {
          animation: rotate-gentle 25s linear infinite;
        }

        .animate-rotate-gentle-reverse {
          animation: rotate-gentle-reverse 30s linear infinite;
        }
      `}</style>
    </div>
  );
}
