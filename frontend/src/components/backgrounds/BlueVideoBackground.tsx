import { useRef, useEffect } from 'react';

/**
 * BlueVideoBackground
 *
 * A full-screen video background featuring the blue animation video.
 * The video is slowed down to 1/3 speed (takes 3x longer to complete).
 * Loops seamlessly and is muted for autoplay compatibility.
 */

export default function BlueVideoBackground() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      // Slow down to 1/3 speed (3x longer duration)
      videoRef.current.playbackRate = .5;
    }
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Video element with slowed playback */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          minWidth: '100%',
          minHeight: '100%',
        }}
      >
        <source src="/blue-animation.mp4" type="video/mp4" />
      </video>

      {/* Soft white overlay for better content readability */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at center, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.4) 100%)
          `,
        }}
      />

      {/* Subtle vignette effect */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(248, 250, 252, 0.5) 100%)',
        }}
      />
    </div>
  );
}
