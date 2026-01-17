/**
 * VideoAnalyzeBackground
 *
 * A full-screen video background featuring the ripple effect video.
 * The video loops seamlessly and is muted for autoplay compatibility.
 * Includes overlay gradients for better content readability.
 */

export default function VideoAnalyzeBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Video element */}
      <video
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
        <source src="/ripple-background.mp4" type="video/mp4" />
      </video>

      {/* Gradient overlay for better content contrast */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at center, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.7) 50%, rgba(255,255,255,0.5) 100%)
          `,
        }}
      />

      {/* Subtle color tint using project colors */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          background: `
            linear-gradient(135deg,
              rgba(143, 188, 250, 0.3) 0%,
              rgba(255, 154, 157, 0.2) 50%,
              rgba(246, 215, 133, 0.3) 100%
            )
          `,
        }}
      />

      {/* Vignette effect for depth */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(248, 250, 252, 0.6) 100%)',
        }}
      />
    </div>
  );
}
