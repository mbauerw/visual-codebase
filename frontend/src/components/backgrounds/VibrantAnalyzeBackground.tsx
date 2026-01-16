/**
 * VibrantAnalyzeBackground
 *
 * A bold, dynamic, and visually stunning background component that creates
 * an energetic, modern atmosphere for the Analyze section.
 *
 * Features:
 * - Aurora borealis wave effect with animated gradients
 * - Floating 3D-like geometric crystals with depth and shadows
 * - Particle constellation system with connecting lines
 * - Morphing liquid blob animations
 * - Glowing orbs with pulse effects and light trails
 * - Interactive-feeling hover states on shapes
 * - Layered depth with parallax-like movement
 *
 * Colors: #8FBCFA (blue), #FF9A9D (coral), #F6D785 (yellow)
 *
 * Performance optimized with CSS transforms and will-change hints.
 */

import { memo } from 'react';

const keyframes = `
  /* Aurora wave animation - flowing northern lights effect */
  @keyframes auroraWave {
    0% {
      transform: translateX(-50%) translateY(0%) rotate(-5deg) scale(1);
      filter: hue-rotate(0deg);
    }
    25% {
      transform: translateX(-45%) translateY(-5%) rotate(-3deg) scale(1.05);
      filter: hue-rotate(15deg);
    }
    50% {
      transform: translateX(-55%) translateY(5%) rotate(-7deg) scale(0.95);
      filter: hue-rotate(-10deg);
    }
    75% {
      transform: translateX(-48%) translateY(-3%) rotate(-4deg) scale(1.02);
      filter: hue-rotate(5deg);
    }
    100% {
      transform: translateX(-50%) translateY(0%) rotate(-5deg) scale(1);
      filter: hue-rotate(0deg);
    }
  }

  @keyframes auroraWave2 {
    0% {
      transform: translateX(-50%) translateY(0%) rotate(3deg) scale(1);
      opacity: 0.6;
    }
    33% {
      transform: translateX(-55%) translateY(8%) rotate(5deg) scale(1.08);
      opacity: 0.75;
    }
    66% {
      transform: translateX(-45%) translateY(-5%) rotate(1deg) scale(0.92);
      opacity: 0.55;
    }
    100% {
      transform: translateX(-50%) translateY(0%) rotate(3deg) scale(1);
      opacity: 0.6;
    }
  }

  /* Morphing blob animation - organic liquid movement */
  @keyframes morphBlob {
    0%, 100% {
      border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
      transform: rotate(0deg) scale(1);
    }
    25% {
      border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%;
      transform: rotate(90deg) scale(1.05);
    }
    50% {
      border-radius: 50% 60% 30% 60% / 40% 30% 60% 50%;
      transform: rotate(180deg) scale(0.95);
    }
    75% {
      border-radius: 40% 30% 60% 50% / 60% 50% 40% 30%;
      transform: rotate(270deg) scale(1.02);
    }
  }

  @keyframes morphBlob2 {
    0%, 100% {
      border-radius: 40% 60% 60% 40% / 40% 60% 40% 60%;
      transform: rotate(0deg) translateY(0px);
    }
    50% {
      border-radius: 60% 40% 40% 60% / 60% 40% 60% 40%;
      transform: rotate(-180deg) translateY(-20px);
    }
  }

  /* 3D Crystal float with depth */
  @keyframes crystalFloat {
    0%, 100% {
      transform: translateY(0px) rotateX(10deg) rotateY(0deg) rotateZ(0deg);
      filter: drop-shadow(0 20px 30px rgba(143, 188, 250, 0.3));
    }
    25% {
      transform: translateY(-15px) rotateX(15deg) rotateY(10deg) rotateZ(5deg);
      filter: drop-shadow(0 35px 40px rgba(143, 188, 250, 0.4));
    }
    50% {
      transform: translateY(-25px) rotateX(5deg) rotateY(-5deg) rotateZ(-3deg);
      filter: drop-shadow(0 45px 50px rgba(143, 188, 250, 0.35));
    }
    75% {
      transform: translateY(-10px) rotateX(12deg) rotateY(-10deg) rotateZ(2deg);
      filter: drop-shadow(0 30px 35px rgba(143, 188, 250, 0.3));
    }
  }

  @keyframes crystalFloat2 {
    0%, 100% {
      transform: translateY(0px) rotateX(-5deg) rotateY(0deg) scale(1);
    }
    33% {
      transform: translateY(-20px) rotateX(0deg) rotateY(15deg) scale(1.05);
    }
    66% {
      transform: translateY(-30px) rotateX(-10deg) rotateY(-10deg) scale(0.98);
    }
  }

  /* Glowing pulse effect */
  @keyframes glowPulse {
    0%, 100% {
      opacity: 0.6;
      transform: scale(1);
      box-shadow:
        0 0 40px rgba(143, 188, 250, 0.5),
        0 0 80px rgba(143, 188, 250, 0.3),
        0 0 120px rgba(143, 188, 250, 0.2);
    }
    50% {
      opacity: 0.9;
      transform: scale(1.1);
      box-shadow:
        0 0 60px rgba(143, 188, 250, 0.7),
        0 0 100px rgba(143, 188, 250, 0.5),
        0 0 150px rgba(143, 188, 250, 0.3);
    }
  }

  @keyframes glowPulse2 {
    0%, 100% {
      opacity: 0.5;
      transform: scale(1) translateX(0px);
      box-shadow:
        0 0 30px rgba(255, 154, 157, 0.5),
        0 0 60px rgba(255, 154, 157, 0.3);
    }
    50% {
      opacity: 0.85;
      transform: scale(1.15) translateX(10px);
      box-shadow:
        0 0 50px rgba(255, 154, 157, 0.7),
        0 0 90px rgba(255, 154, 157, 0.4);
    }
  }

  /* Particle drift animation */
  @keyframes particleDrift {
    0% {
      transform: translateY(0px) translateX(0px);
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      transform: translateY(-100px) translateX(30px);
      opacity: 0;
    }
  }

  @keyframes particleDrift2 {
    0% {
      transform: translateY(0px) translateX(0px) scale(1);
      opacity: 0;
    }
    15% {
      opacity: 0.8;
    }
    85% {
      opacity: 0.8;
    }
    100% {
      transform: translateY(-80px) translateX(-20px) scale(0.5);
      opacity: 0;
    }
  }

  /* Sparkle effect */
  @keyframes sparkle {
    0%, 100% {
      transform: scale(0) rotate(0deg);
      opacity: 0;
    }
    50% {
      transform: scale(1) rotate(180deg);
      opacity: 1;
    }
  }

  /* Ring expansion */
  @keyframes ringExpand {
    0% {
      transform: scale(0.8);
      opacity: 0.8;
      stroke-width: 3;
    }
    100% {
      transform: scale(1.5);
      opacity: 0;
      stroke-width: 1;
    }
  }

  /* Floating geometric shapes */
  @keyframes floatRotate {
    0% {
      transform: translateY(0px) rotate(0deg);
    }
    50% {
      transform: translateY(-20px) rotate(180deg);
    }
    100% {
      transform: translateY(0px) rotate(360deg);
    }
  }

  @keyframes floatSway {
    0%, 100% {
      transform: translateX(0px) translateY(0px) rotate(0deg);
    }
    25% {
      transform: translateX(15px) translateY(-10px) rotate(5deg);
    }
    50% {
      transform: translateX(-10px) translateY(-20px) rotate(-5deg);
    }
    75% {
      transform: translateX(5px) translateY(-15px) rotate(3deg);
    }
  }

  /* Light trail sweep */
  @keyframes lightTrail {
    0% {
      transform: translateX(-100%) rotate(-45deg);
      opacity: 0;
    }
    50% {
      opacity: 0.6;
    }
    100% {
      transform: translateX(200%) rotate(-45deg);
      opacity: 0;
    }
  }

  /* Constellation line pulse */
  @keyframes linePulse {
    0%, 100% {
      opacity: 0.2;
      stroke-dashoffset: 0;
    }
    50% {
      opacity: 0.5;
      stroke-dashoffset: 20;
    }
  }

  /* Depth parallax movement */
  @keyframes parallaxSlow {
    0%, 100% {
      transform: translateY(0px) translateX(0px);
    }
    50% {
      transform: translateY(-30px) translateX(15px);
    }
  }

  @keyframes parallaxMedium {
    0%, 100% {
      transform: translateY(0px) translateX(0px);
    }
    50% {
      transform: translateY(-50px) translateX(-20px);
    }
  }

  /* Vibrant gradient shift */
  @keyframes gradientShift {
    0% {
      background-position: 0% 50%;
    }
    50% {
      background-position: 100% 50%;
    }
    100% {
      background-position: 0% 50%;
    }
  }
`;

function VibrantAnalyzeBackground() {
  return (
    <>
      <style>{keyframes}</style>

      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        aria-hidden="true"
        style={{ perspective: '1000px' }}
      >
        {/* Base gradient - rich and vibrant */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, #f0f7ff 0%, #fff5f5 30%, #fffbf0 60%, #f0f7ff 100%)',
            backgroundSize: '400% 400%',
            animation: 'gradientShift 15s ease infinite',
          }}
        />

        {/* Aurora Layer 1 - Primary wave */}
        <div
          className="absolute left-1/2 top-0 w-[200%] h-[60%]"
          style={{
            background: `
              linear-gradient(
                180deg,
                transparent 0%,
                rgba(143, 188, 250, 0.4) 20%,
                rgba(143, 188, 250, 0.6) 35%,
                rgba(255, 154, 157, 0.5) 50%,
                rgba(246, 215, 133, 0.4) 65%,
                transparent 100%
              )
            `,
            filter: 'blur(60px)',
            animation: 'auroraWave 12s ease-in-out infinite',
            willChange: 'transform, filter',
          }}
        />

        {/* Aurora Layer 2 - Secondary wave */}
        <div
          className="absolute left-1/2 bottom-0 w-[180%] h-[50%]"
          style={{
            background: `
              linear-gradient(
                0deg,
                transparent 0%,
                rgba(255, 154, 157, 0.3) 25%,
                rgba(246, 215, 133, 0.5) 45%,
                rgba(143, 188, 250, 0.4) 65%,
                transparent 100%
              )
            `,
            filter: 'blur(50px)',
            animation: 'auroraWave2 10s ease-in-out infinite',
            willChange: 'transform',
          }}
        />

        {/* Morphing Blob 1 - Blue */}
        <div
          className="absolute top-[10%] left-[5%] w-64 h-64"
          style={{
            background: 'linear-gradient(135deg, rgba(143, 188, 250, 0.7) 0%, rgba(143, 188, 250, 0.3) 100%)',
            filter: 'blur(30px)',
            animation: 'morphBlob 15s ease-in-out infinite',
            willChange: 'border-radius, transform',
          }}
        />

        {/* Morphing Blob 2 - Coral */}
        <div
          className="absolute bottom-[15%] right-[8%] w-56 h-56"
          style={{
            background: 'linear-gradient(225deg, rgba(255, 154, 157, 0.65) 0%, rgba(255, 154, 157, 0.25) 100%)',
            filter: 'blur(25px)',
            animation: 'morphBlob2 12s ease-in-out infinite',
            willChange: 'border-radius, transform',
          }}
        />

        {/* Morphing Blob 3 - Yellow */}
        <div
          className="absolute top-[40%] right-[20%] w-48 h-48"
          style={{
            background: 'linear-gradient(180deg, rgba(246, 215, 133, 0.6) 0%, rgba(246, 215, 133, 0.2) 100%)',
            filter: 'blur(20px)',
            animation: 'morphBlob 18s ease-in-out infinite reverse',
            willChange: 'border-radius, transform',
          }}
        />

        {/* 3D Crystal Shapes */}
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          preserveAspectRatio="xMidYMid slice"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <defs>
            {/* Gradient definitions for 3D crystals */}
            <linearGradient id="vibrantCrystalBlue" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#8FBCFA" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#5a9cf5" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#8FBCFA" stopOpacity="0.4" />
            </linearGradient>
            <linearGradient id="vibrantCrystalCoral" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF9A9D" stopOpacity="0.85" />
              <stop offset="50%" stopColor="#ff6b6f" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FF9A9D" stopOpacity="0.35" />
            </linearGradient>
            <linearGradient id="vibrantCrystalYellow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F6D785" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#f0c44a" stopOpacity="0.65" />
              <stop offset="100%" stopColor="#F6D785" stopOpacity="0.35" />
            </linearGradient>

            {/* Glow filter */}
            <filter id="vibrantGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Enhanced glow */}
            <filter id="strongGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="blur1" />
              <feGaussianBlur stdDeviation="12" result="blur2" />
              <feMerge>
                <feMergeNode in="blur2" />
                <feMergeNode in="blur1" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 3D Crystal 1 - Diamond shape (top right) */}
          <g
            style={{
              animation: 'crystalFloat 8s ease-in-out infinite',
              transformOrigin: '80% 20%',
            }}
          >
            <polygon
              points="80,8 88,20 80,32 72,20"
              fill="url(#vibrantCrystalBlue)"
              filter="url(#vibrantGlow)"
              transform="scale(3)"
            />
            {/* Crystal highlight */}
            <polygon
              points="80,10 84,18 80,26"
              fill="white"
              fillOpacity="0.3"
              transform="scale(3)"
            />
          </g>

          {/* 3D Crystal 2 - Hexagon (left side) */}
          <g
            style={{
              animation: 'crystalFloat2 10s ease-in-out infinite',
              transformOrigin: '12% 55%',
            }}
          >
            <polygon
              points="12,50 17,47 22,50 22,56 17,59 12,56"
              fill="url(#vibrantCrystalCoral)"
              filter="url(#vibrantGlow)"
              transform="scale(4)"
            />
            <polygon
              points="12,50 17,47 17,53 12,56"
              fill="white"
              fillOpacity="0.25"
              transform="scale(4)"
            />
          </g>

          {/* 3D Crystal 3 - Triangle (bottom center) */}
          <g
            style={{
              animation: 'crystalFloat 12s ease-in-out infinite 2s',
              transformOrigin: '45% 80%',
            }}
          >
            <polygon
              points="45,72 52,85 38,85"
              fill="url(#vibrantCrystalYellow)"
              filter="url(#vibrantGlow)"
              transform="scale(2.5)"
            />
            <polygon
              points="45,74 48,82 42,82"
              fill="white"
              fillOpacity="0.35"
              transform="scale(2.5)"
            />
          </g>

          {/* Constellation particles and lines */}
          <g className="constellation">
            {/* Particle nodes */}
            <circle cx="15%" cy="25%" r="4" fill="#8FBCFA" filter="url(#strongGlow)" opacity="0.8" />
            <circle cx="25%" cy="35%" r="3" fill="#FF9A9D" filter="url(#strongGlow)" opacity="0.7" />
            <circle cx="20%" cy="15%" r="2.5" fill="#F6D785" filter="url(#strongGlow)" opacity="0.75" />
            <circle cx="35%" cy="22%" r="3.5" fill="#8FBCFA" filter="url(#strongGlow)" opacity="0.7" />

            <circle cx="75%" cy="65%" r="3" fill="#FF9A9D" filter="url(#strongGlow)" opacity="0.75" />
            <circle cx="85%" cy="55%" r="4" fill="#F6D785" filter="url(#strongGlow)" opacity="0.8" />
            <circle cx="80%" cy="75%" r="2.5" fill="#8FBCFA" filter="url(#strongGlow)" opacity="0.7" />
            <circle cx="90%" cy="68%" r="3" fill="#FF9A9D" filter="url(#strongGlow)" opacity="0.65" />

            {/* Connecting lines */}
            <line
              x1="15%" y1="25%" x2="25%" y2="35%"
              stroke="#8FBCFA"
              strokeWidth="1.5"
              strokeDasharray="5,5"
              opacity="0.4"
              style={{ animation: 'linePulse 3s ease-in-out infinite' }}
            />
            <line
              x1="25%" y1="35%" x2="20%" y2="15%"
              stroke="#FF9A9D"
              strokeWidth="1.5"
              strokeDasharray="5,5"
              opacity="0.35"
              style={{ animation: 'linePulse 3s ease-in-out infinite 0.5s' }}
            />
            <line
              x1="20%" y1="15%" x2="35%" y2="22%"
              stroke="#F6D785"
              strokeWidth="1.5"
              strokeDasharray="5,5"
              opacity="0.4"
              style={{ animation: 'linePulse 3s ease-in-out infinite 1s' }}
            />
            <line
              x1="35%" y1="22%" x2="15%" y2="25%"
              stroke="#8FBCFA"
              strokeWidth="1"
              strokeDasharray="5,5"
              opacity="0.3"
              style={{ animation: 'linePulse 3s ease-in-out infinite 1.5s' }}
            />

            <line
              x1="75%" y1="65%" x2="85%" y2="55%"
              stroke="#FF9A9D"
              strokeWidth="1.5"
              strokeDasharray="5,5"
              opacity="0.4"
              style={{ animation: 'linePulse 3s ease-in-out infinite 0.3s' }}
            />
            <line
              x1="85%" y1="55%" x2="90%" y2="68%"
              stroke="#F6D785"
              strokeWidth="1.5"
              strokeDasharray="5,5"
              opacity="0.35"
              style={{ animation: 'linePulse 3s ease-in-out infinite 0.8s' }}
            />
            <line
              x1="90%" y1="68%" x2="80%" y2="75%"
              stroke="#8FBCFA"
              strokeWidth="1.5"
              strokeDasharray="5,5"
              opacity="0.4"
              style={{ animation: 'linePulse 3s ease-in-out infinite 1.3s' }}
            />
            <line
              x1="80%" y1="75%" x2="75%" y2="65%"
              stroke="#FF9A9D"
              strokeWidth="1"
              strokeDasharray="5,5"
              opacity="0.3"
              style={{ animation: 'linePulse 3s ease-in-out infinite 1.8s' }}
            />
          </g>

          {/* Expanding rings */}
          <circle
            cx="50%" cy="50%"
            r="60"
            fill="none"
            stroke="#8FBCFA"
            strokeWidth="2"
            opacity="0.4"
            style={{
              animation: 'ringExpand 4s ease-out infinite',
              transformOrigin: '50% 50%',
            }}
          />
          <circle
            cx="50%" cy="50%"
            r="60"
            fill="none"
            stroke="#FF9A9D"
            strokeWidth="2"
            opacity="0.35"
            style={{
              animation: 'ringExpand 4s ease-out infinite 1.3s',
              transformOrigin: '50% 50%',
            }}
          />
          <circle
            cx="50%" cy="50%"
            r="60"
            fill="none"
            stroke="#F6D785"
            strokeWidth="2"
            opacity="0.4"
            style={{
              animation: 'ringExpand 4s ease-out infinite 2.6s',
              transformOrigin: '50% 50%',
            }}
          />

          {/* Sparkle stars */}
          <g>
            <polygon
              points="30,70 31,73 34,73 31.5,75 32.5,78 30,76 27.5,78 28.5,75 26,73 29,73"
              fill="#F6D785"
              filter="url(#vibrantGlow)"
              style={{ animation: 'sparkle 2s ease-in-out infinite' }}
            />
            <polygon
              points="70,30 71,33 74,33 71.5,35 72.5,38 70,36 67.5,38 68.5,35 66,33 69,33"
              fill="#8FBCFA"
              filter="url(#vibrantGlow)"
              style={{ animation: 'sparkle 2s ease-in-out infinite 0.7s' }}
            />
            <polygon
              points="85,85 86,88 89,88 86.5,90 87.5,93 85,91 82.5,93 83.5,90 81,88 84,88"
              fill="#FF9A9D"
              filter="url(#vibrantGlow)"
              style={{ animation: 'sparkle 2s ease-in-out infinite 1.4s' }}
            />
          </g>
        </svg>

        {/* Glowing Orbs Layer */}
        <div
          className="absolute top-[15%] left-[25%] w-16 h-16 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(143, 188, 250, 0.8) 0%, rgba(143, 188, 250, 0.4) 50%, transparent 70%)',
            animation: 'glowPulse 3s ease-in-out infinite',
            willChange: 'transform, opacity, box-shadow',
          }}
        />
        <div
          className="absolute bottom-[25%] left-[15%] w-12 h-12 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255, 154, 157, 0.75) 0%, rgba(255, 154, 157, 0.35) 50%, transparent 70%)',
            animation: 'glowPulse2 4s ease-in-out infinite 1s',
            willChange: 'transform, opacity, box-shadow',
          }}
        />
        <div
          className="absolute top-[60%] right-[12%] w-14 h-14 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(246, 215, 133, 0.8) 0%, rgba(246, 215, 133, 0.4) 50%, transparent 70%)',
            animation: 'glowPulse 3.5s ease-in-out infinite 0.5s',
            willChange: 'transform, opacity, box-shadow',
          }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0">
          {/* Particle group 1 */}
          <div
            className="absolute bottom-[20%] left-[30%] w-2 h-2 rounded-full bg-[#8FBCFA]"
            style={{
              animation: 'particleDrift 6s ease-in-out infinite',
              boxShadow: '0 0 10px rgba(143, 188, 250, 0.6)',
            }}
          />
          <div
            className="absolute bottom-[30%] left-[35%] w-1.5 h-1.5 rounded-full bg-[#FF9A9D]"
            style={{
              animation: 'particleDrift2 5s ease-in-out infinite 1s',
              boxShadow: '0 0 8px rgba(255, 154, 157, 0.6)',
            }}
          />
          <div
            className="absolute bottom-[25%] left-[40%] w-2.5 h-2.5 rounded-full bg-[#F6D785]"
            style={{
              animation: 'particleDrift 7s ease-in-out infinite 2s',
              boxShadow: '0 0 12px rgba(246, 215, 133, 0.6)',
            }}
          />

          {/* Particle group 2 */}
          <div
            className="absolute bottom-[35%] right-[25%] w-2 h-2 rounded-full bg-[#FF9A9D]"
            style={{
              animation: 'particleDrift 5.5s ease-in-out infinite 0.5s',
              boxShadow: '0 0 10px rgba(255, 154, 157, 0.6)',
            }}
          />
          <div
            className="absolute bottom-[40%] right-[30%] w-1.5 h-1.5 rounded-full bg-[#8FBCFA]"
            style={{
              animation: 'particleDrift2 6.5s ease-in-out infinite 1.5s',
              boxShadow: '0 0 8px rgba(143, 188, 250, 0.6)',
            }}
          />
          <div
            className="absolute bottom-[32%] right-[35%] w-2 h-2 rounded-full bg-[#F6D785]"
            style={{
              animation: 'particleDrift 5s ease-in-out infinite 2.5s',
              boxShadow: '0 0 10px rgba(246, 215, 133, 0.6)',
            }}
          />
        </div>

        {/* Floating geometric accents with parallax */}
        <div
          className="absolute top-[20%] right-[30%] w-8 h-8"
          style={{
            animation: 'floatRotate 15s linear infinite',
            willChange: 'transform',
          }}
        >
          <div
            className="w-full h-full border-2 border-[#8FBCFA]/50 rounded-lg"
            style={{
              boxShadow: '0 0 15px rgba(143, 188, 250, 0.3)',
            }}
          />
        </div>

        <div
          className="absolute bottom-[30%] left-[20%] w-6 h-6"
          style={{
            animation: 'floatSway 10s ease-in-out infinite',
            willChange: 'transform',
          }}
        >
          <div
            className="w-full h-full bg-[#FF9A9D]/30 rounded-full"
            style={{
              boxShadow: '0 0 20px rgba(255, 154, 157, 0.4)',
            }}
          />
        </div>

        <div
          className="absolute top-[45%] left-[10%] w-10 h-10"
          style={{
            animation: 'floatRotate 20s linear infinite reverse',
            willChange: 'transform',
          }}
        >
          <svg viewBox="0 0 40 40" className="w-full h-full">
            <polygon
              points="20,5 35,35 5,35"
              fill="none"
              stroke="#F6D785"
              strokeWidth="2"
              opacity="0.5"
              style={{ filter: 'drop-shadow(0 0 8px rgba(246, 215, 133, 0.5))' }}
            />
          </svg>
        </div>

        {/* Light trail sweep effect */}
        <div
          className="absolute top-0 left-0 w-full h-full overflow-hidden"
          style={{ opacity: 0.3 }}
        >
          <div
            className="absolute top-1/2 left-0 w-[150%] h-1"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(143, 188, 250, 0.8) 50%, transparent 100%)',
              filter: 'blur(2px)',
              animation: 'lightTrail 8s ease-in-out infinite',
            }}
          />
          <div
            className="absolute top-1/3 left-0 w-[150%] h-0.5"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255, 154, 157, 0.7) 50%, transparent 100%)',
              filter: 'blur(1px)',
              animation: 'lightTrail 8s ease-in-out infinite 2.5s',
            }}
          />
          <div
            className="absolute top-2/3 left-0 w-[150%] h-0.5"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(246, 215, 133, 0.7) 50%, transparent 100%)',
              filter: 'blur(1px)',
              animation: 'lightTrail 8s ease-in-out infinite 5s',
            }}
          />
        </div>

        {/* Depth vignette for focus */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(255, 255, 255, 0.4) 70%, rgba(255, 255, 255, 0.7) 100%)',
          }}
        />
      </div>
    </>
  );
}

export default memo(VibrantAnalyzeBackground);
