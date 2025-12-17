import { useEffect, useState, useRef } from 'react';
import { useReactFlow } from '@xyflow/react';

interface MagnifierProps {
  size?: number;
  zoom?: number;
  enabled?: boolean;
}

export default function Magnifier({ size = 150, zoom = 2, enabled = true }: MagnifierProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const magnifierRef = useRef<HTMLDivElement>(null);
  const { getViewport, getNodes, getEdges } = useReactFlow();

  useEffect(() => {
    if (!enabled) {
      setIsVisible(false);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const reactFlowPane = document.querySelector('.react-flow__pane');
      if (!reactFlowPane) return;

      const rect = reactFlowPane.getBoundingClientRect();
      const isInside =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

      setIsVisible(isInside);

      if (isInside) {
        setPosition({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [enabled]);

  if (!isVisible || !enabled) return null;

  const viewport = getViewport();
  const halfSize = size / 2;

  // Calculate the flow coordinates at the mouse position
  const flowX = (position.x - viewport.x) / viewport.zoom;
  const flowY = (position.y - viewport.y) / viewport.zoom;

  // Calculate the offset for the magnified content
  const magnifiedZoom = viewport.zoom * zoom;
  const contentX = flowX * magnifiedZoom - halfSize;
  const contentY = flowY * magnifiedZoom - halfSize;

  return (
    <div
      ref={magnifierRef}
      className="pointer-events-none fixed z-[9999]"
      style={{
        left: position.x - halfSize,
        top: position.y - halfSize,
        width: size,
        height: size,
        borderRadius: '50%',
        border: '3px solid rgba(100, 150, 255, 0.6)',
        boxShadow: '0 0 20px rgba(100, 150, 255, 0.4), inset 0 0 30px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
        background: 'rgba(15, 23, 42, 0.95)',
      }}
    >
      {/* Magnified viewport content */}
      <div
        className="absolute"
        style={{
          transform: `translate(${-contentX}px, ${-contentY}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '100vw',
          height: '100vh',
        }}
      >
        {/* Clone of the React Flow viewport */}
        <div
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {/* Render simplified node representations */}
          {getNodes().map((node) => (
            <div
              key={node.id}
              className="absolute rounded-lg"
              style={{
                left: node.position.x,
                top: node.position.y,
                width: node.measured?.width || (node.type === 'category' ? 400 : 200),
                height: node.measured?.height || (node.type === 'category' ? 300 : 80),
                backgroundColor: node.type === 'category'
                  ? 'rgba(100, 200, 255, 0.1)'
                  : '#1e293b',
                border: node.type === 'category'
                  ? '2px dashed rgba(100, 200, 255, 0.5)'
                  : '3px solid #3b82f6',
                borderRadius: node.type === 'category' ? '40px' : '8px',
              }}
            >
              {node.type !== 'category' && (
                <div className="p-2 text-white text-xs font-medium truncate">
                  {String(node.data?.label || '')}
                </div>
              )}
            </div>
          ))}

          {/* Render edges */}
          <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
            {getEdges().map((edge) => {
              const sourceNode = getNodes().find(n => n.id === edge.source);
              const targetNode = getNodes().find(n => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              const sourceX = sourceNode.position.x + (sourceNode.measured?.width || 200) / 2;
              const sourceY = sourceNode.position.y + (sourceNode.measured?.height || 80);
              const targetX = targetNode.position.x + (targetNode.measured?.width || 200) / 2;
              const targetY = targetNode.position.y;

              return (
                <path
                  key={edge.id}
                  d={`M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + 50}, ${targetX} ${targetY - 50}, ${targetX} ${targetY}`}
                  fill="none"
                  stroke="#64a5ff"
                  strokeWidth={2}
                />
              );
            })}
          </svg>
        </div>
      </div>

      {/* Crosshair in center */}
      <div
        className="absolute"
        style={{
          left: halfSize - 1,
          top: halfSize - 10,
          width: 2,
          height: 20,
          backgroundColor: 'rgba(100, 150, 255, 0.6)',
        }}
      />
      <div
        className="absolute"
        style={{
          left: halfSize - 10,
          top: halfSize - 1,
          width: 20,
          height: 2,
          backgroundColor: 'rgba(100, 150, 255, 0.6)',
        }}
      />

      {/* Zoom indicator */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-blue-300 font-mono bg-slate-900/80 px-2 py-0.5 rounded"
      >
        {zoom}x
      </div>
    </div>
  );
}
