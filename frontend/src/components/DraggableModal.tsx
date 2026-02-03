import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { X, GripHorizontal } from 'lucide-react';

interface DraggableModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  height?: number;
}

export function DraggableModal({
  title,
  isOpen,
  onClose,
  children,
  width = 420,
  height = 600,
}: DraggableModalProps) {
  const [position, setPosition] = useState(() => ({
    x: Math.max(0, window.innerWidth - width - 60),
    y: 70,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      };
    },
    [position]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - width, e.clientX - dragOffset.current.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.current.y)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, width]);

  return (
    <div
      className="fixed z-40 rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col bg-slate-900"
      style={{
        left: position.x,
        top: position.y,
        width,
        height,
        display: isOpen ? undefined : 'none',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={16} className="text-slate-500" />
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-white transition-colors"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
