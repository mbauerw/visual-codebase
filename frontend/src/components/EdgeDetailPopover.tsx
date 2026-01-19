import { useEffect, useRef, useCallback, useState } from 'react';
import { X, Package, ArrowRight, Copy, Check, GripHorizontal } from 'lucide-react';
import type { Edge } from '@xyflow/react';
import type { ReactFlowEdgeData, ReactFlowNode } from '../types';

interface EdgeDetailPopoverProps {
  edge: Edge | null;
  position: { x: number; y: number } | null;
  onClose: () => void;
  nodes: ReactFlowNode[];
}

export default function EdgeDetailPopover({
  edge,
  position,
  onClose,
  nodes,
}: EdgeDetailPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [draggedPosition, setDraggedPosition] = useState<{ x: number; y: number } | null>(null);

  // Reset dragged position when edge changes
  useEffect(() => {
    setDraggedPosition(null);
  }, [edge?.id]);

  // Get node labels for source and target
  const sourceNode = nodes.find(n => n.id === edge?.source);
  const targetNode = nodes.find(n => n.id === edge?.target);
  const sourceLabel = sourceNode?.data?.label || edge?.source || 'Unknown';
  const targetLabel = targetNode?.data?.label || edge?.target || 'Unknown';

  // Get edge data
  const edgeData = edge?.data as ReactFlowEdgeData | undefined;
  const importedNames = edgeData?.imported_names || [];
  const modulePath = edgeData?.module_path || '';
  const importType = edgeData?.import_type || 'import';

  // Handle click outside to close (only if not dragging)
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (isDragging) return;
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose, isDragging]
  );

  // Handle escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);

      const popover = popoverRef.current;
      if (popover) {
        const rect = popover.getBoundingClientRect();
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    },
    []
  );

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep within viewport bounds
      const popoverWidth = 320;
      const popoverHeight = popoverRef.current?.offsetHeight || 400;
      const maxX = window.innerWidth - popoverWidth - 8;
      const maxY = window.innerHeight - popoverHeight - 8;

      setDraggedPosition({
        x: Math.max(8, Math.min(maxX, newX)),
        y: Math.max(8, Math.min(maxY, newY)),
      });
    },
    [isDragging, dragOffset]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Set up event listeners
  useEffect(() => {
    if (!edge || !position) return;

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [edge, position, handleClickOutside, handleKeyDown]);

  // Set up drag event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  // Copy import name to clipboard
  const handleCopy = async (name: string, index: number) => {
    try {
      await navigator.clipboard.writeText(name);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      console.error('Failed to copy');
    }
  };

  // Copy all imports
  const handleCopyAll = async () => {
    try {
      const text = importedNames.join(', ');
      await navigator.clipboard.writeText(text);
      setCopiedIndex(-1);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      console.error('Failed to copy');
    }
  };

  if (!edge || !position) return null;

  // Calculate position to keep popover in viewport
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const popoverWidth = 320;
  const popoverMaxHeight = 400;

  // Use dragged position if available, otherwise calculate from click position
  let left: number;
  let top: number;

  if (draggedPosition) {
    left = draggedPosition.x;
    top = draggedPosition.y;
  } else {
    left = position.x;
    top = position.y + 10; // Offset below click point

    // Adjust horizontal position if it would overflow
    if (left + popoverWidth > viewportWidth - 16) {
      left = viewportWidth - popoverWidth - 16;
    }
    if (left < 16) {
      left = 16;
    }

    // Adjust vertical position if it would overflow
    if (top + popoverMaxHeight > viewportHeight - 16) {
      top = position.y - popoverMaxHeight - 10; // Show above click point
    }
    if (top < 16) {
      top = 16;
    }
  }

  return (
    <div
      ref={popoverRef}
      className={`fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl ${
        isDragging ? 'shadow-blue-500/20' : ''
      }`}
      style={{
        left,
        top,
        width: popoverWidth,
        maxHeight: popoverMaxHeight,
      }}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleDragStart}
        className={`flex items-center justify-between p-3 border-b border-slate-700 cursor-grab ${
          isDragging ? 'cursor-grabbing bg-slate-700/50' : 'hover:bg-slate-700/30'
        } transition-colors rounded-t-lg`}
      >
        <div className="flex items-center gap-2 text-sm text-slate-300 min-w-0 flex-1">
          <GripHorizontal size={14} className="text-slate-500 flex-shrink-0" />
          <span className="font-medium text-white truncate" title={sourceLabel}>
            {sourceLabel}
          </span>
          <ArrowRight size={14} className="text-slate-500 flex-shrink-0" />
          <span className="font-medium text-white truncate" title={targetLabel}>
            {targetLabel}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors flex-shrink-0 ml-2"
        >
          <X size={16} />
        </button>
      </div>

      {/* Module Path */}
      <div className="px-3 py-2 border-b border-slate-700 bg-slate-900/50">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Package size={12} />
          <span className="font-mono truncate" title={modulePath}>
            {modulePath || 'Unknown module'}
          </span>
          <span className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 text-[10px] uppercase flex-shrink-0">
            {importType.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Imported Symbols */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 uppercase tracking-wide">
            Imported Symbols ({importedNames.length})
          </span>
          {importedNames.length > 1 && (
            <button
              onClick={handleCopyAll}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              {copiedIndex === -1 ? (
                <>
                  <Check size={12} className="text-green-400" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={12} />
                  Copy all
                </>
              )}
            </button>
          )}
        </div>

        {importedNames.length > 0 ? (
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {importedNames.map((name, index) => (
              <div
                key={index}
                className="flex items-center justify-between px-2 py-1.5 bg-slate-900/50 rounded group hover:bg-slate-700 transition-colors"
              >
                <code className="text-sm text-blue-300 font-mono truncate" title={name}>
                  {name}
                </code>
                <button
                  onClick={() => handleCopy(name, index)}
                  className="p-1 text-slate-500 hover:text-white opacity-0 group-hover:opacity-100 transition-all"
                  title="Copy to clipboard"
                >
                  {copiedIndex === index ? (
                    <Check size={14} className="text-green-400" />
                  ) : (
                    <Copy size={14} />
                  )}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500 italic py-2">
            No named imports (side effect or namespace import)
          </div>
        )}
      </div>
    </div>
  );
}
