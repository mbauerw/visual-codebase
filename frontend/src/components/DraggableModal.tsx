import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { X, GripHorizontal, GripVertical } from 'lucide-react';

const MIN_WIDTH = 320;
const MAX_WIDTH = 900;
const MIN_HEIGHT = 400;
const MAX_HEIGHT = 900;
const STORAGE_KEY = 'draggable-modal-size';

interface DraggableModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  height?: number;
}

function loadSavedSize(defaultWidth: number, defaultHeight: number): { width: number; height: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { width, height } = JSON.parse(saved);
      return {
        width: Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)),
        height: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height)),
      };
    }
  } catch {
    // Ignore parse errors
  }
  return { width: defaultWidth, height: defaultHeight };
}

function saveSizeToStorage(width: number, height: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ width, height }));
  } catch {
    // Ignore storage errors
  }
}

export function DraggableModal({
  title,
  isOpen,
  onClose,
  children,
  width: defaultWidth = 420,
  height: defaultHeight = 600,
}: DraggableModalProps) {
  // Size state with localStorage persistence
  const [size, setSize] = useState(() => loadSavedSize(defaultWidth, defaultHeight));

  const [position, setPosition] = useState(() => ({
    x: Math.max(0, window.innerWidth - size.width - 60),
    y: 70,
  }));
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | null>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; posX: number; posY: number } | null>(null);

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

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, direction: 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(direction);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y,
    };
  }, [size, position.x, position.y]);

  // Handle reset size on double-click
  const handleResetSize = useCallback(() => {
    setSize({ width: defaultWidth, height: defaultHeight });
    saveSizeToStorage(defaultWidth, defaultHeight);
  }, [defaultWidth, defaultHeight]);

  // Dragging effect
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.current.x)),
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
  }, [isDragging, size.width]);

  // Resizing effect
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStartRef.current) return;

      const { x, y, width, height, posX, posY } = resizeStartRef.current;
      let newWidth = width;
      let newHeight = height;
      let newPosX = posX;
      let newPosY = posY;

      const resizesLeft = isResizing === 'left' || isResizing === 'top-left' || isResizing === 'bottom-left';
      const resizesRight = isResizing === 'right' || isResizing === 'top-right' || isResizing === 'bottom-right';
      const resizesTop = isResizing === 'top' || isResizing === 'top-left' || isResizing === 'top-right';
      const resizesBottom = isResizing === 'bottom' || isResizing === 'bottom-left' || isResizing === 'bottom-right';

      // Left edge resize: increase width by moving left, adjust position
      if (resizesLeft) {
        const deltaX = x - e.clientX;
        newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width + deltaX));
        // Adjust position so right edge stays fixed
        newPosX = posX - (newWidth - width);
        // Don't let it go off-screen
        if (newPosX < 0) {
          newWidth = width + posX;
          newPosX = 0;
        }
      }

      // Right edge resize: increase width by moving right
      if (resizesRight) {
        const deltaX = e.clientX - x;
        newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width + deltaX));
        // Don't let it go off-screen
        const maxWidth = window.innerWidth - posX - 20;
        newWidth = Math.min(newWidth, maxWidth);
      }

      // Top edge resize: increase height by moving up, adjust position
      if (resizesTop) {
        const deltaY = y - e.clientY;
        newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height + deltaY));
        // Adjust position so bottom edge stays fixed
        newPosY = posY - (newHeight - height);
        // Don't let it go off-screen
        if (newPosY < 0) {
          newHeight = height + posY;
          newPosY = 0;
        }
      }

      // Bottom edge resize
      if (resizesBottom) {
        const deltaY = e.clientY - y;
        newHeight = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, height + deltaY));
        // Don't let it go off-screen
        const maxHeight = window.innerHeight - posY - 20;
        newHeight = Math.min(newHeight, maxHeight);
      }

      setSize({ width: newWidth, height: newHeight });
      if (resizesLeft || resizesTop) {
        setPosition({ x: newPosX, y: newPosY });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(null);
      resizeStartRef.current = null;
      saveSizeToStorage(size.width, size.height);
    };

    // Determine cursor based on resize direction
    let cursor = 'default';
    if (isResizing === 'left' || isResizing === 'right') cursor = 'ew-resize';
    else if (isResizing === 'top' || isResizing === 'bottom') cursor = 'ns-resize';
    else if (isResizing === 'top-left' || isResizing === 'bottom-right') cursor = 'nwse-resize';
    else if (isResizing === 'top-right' || isResizing === 'bottom-left') cursor = 'nesw-resize';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, size.width, size.height]);

  return (
    <div
      className={`fixed z-40 rounded-xl overflow-hidden shadow-2xl flex flex-col bg-slate-900 ${
        isResizing ? 'border-2 border-amber-500/50' : 'border border-slate-700'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        display: isOpen ? undefined : 'none',
      }}
    >
      {/* Resize overlay during drag */}
      {isResizing && (
        <div className="absolute inset-0 bg-amber-500/5 rounded-xl pointer-events-none z-30">
          <div className="absolute bottom-2 left-2 px-2 py-1 bg-slate-800 text-amber-400 text-[10px] font-mono rounded border border-slate-700">
            {size.width} × {size.height}
          </div>
        </div>
      )}

      {/* Top resize handle */}
      <div
        className="absolute top-0 left-4 right-4 h-2 cursor-ns-resize hover:bg-amber-500/20 transition-colors z-10"
        onMouseDown={(e) => handleResizeStart(e, 'top')}
      />

      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-4 right-4 h-2 cursor-ns-resize hover:bg-amber-500/20 transition-colors z-10"
        onMouseDown={(e) => handleResizeStart(e, 'bottom')}
      />

      {/* Left resize handle */}
      <div
        className="absolute left-0 top-4 bottom-4 w-2 cursor-ew-resize hover:bg-amber-500/20 transition-colors z-10 group"
        onMouseDown={(e) => handleResizeStart(e, 'left')}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={12} className="text-slate-500" />
        </div>
      </div>

      {/* Right resize handle */}
      <div
        className="absolute right-0 top-4 bottom-4 w-2 cursor-ew-resize hover:bg-amber-500/20 transition-colors z-10 group"
        onMouseDown={(e) => handleResizeStart(e, 'right')}
      >
        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical size={12} className="text-slate-500" />
        </div>
      </div>

      {/* Corner resize handles (all support double-click to reset) */}
      <div
        className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize hover:bg-amber-500/30 transition-colors z-20 rounded-tl-xl"
        onMouseDown={(e) => handleResizeStart(e, 'top-left')}
        onDoubleClick={handleResetSize}
        title="Drag to resize, double-click to reset"
      />
      <div
        className="absolute top-0 right-0 w-4 h-4 cursor-nesw-resize hover:bg-amber-500/30 transition-colors z-20 rounded-tr-xl"
        onMouseDown={(e) => handleResizeStart(e, 'top-right')}
        onDoubleClick={handleResetSize}
        title="Drag to resize, double-click to reset"
      />
      <div
        className="absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize hover:bg-amber-500/30 transition-colors z-20 rounded-bl-xl"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
        onDoubleClick={handleResetSize}
        title="Drag to resize, double-click to reset"
      />
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize hover:bg-amber-500/30 transition-colors z-20 rounded-br-xl"
        onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
        onDoubleClick={handleResetSize}
        title="Drag to resize, double-click to reset"
      />

      {/* Header / Drag handle */}
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

      {/* Content area - flex-1 ensures chat log gets all extra space */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
