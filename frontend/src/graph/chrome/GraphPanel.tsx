/**
 * GraphPanel — a screen-space slot inside the canvas overlay (search box,
 * controls, minimap…). Marks itself so the gesture layer ignores pans and
 * wheel events that start on it, and so clicks on it don't count as
 * background clicks.
 */

import type { CSSProperties, ReactNode } from 'react';

export type GraphPanelPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface GraphPanelProps {
  position?: GraphPanelPosition;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const POSITION_CLASSES: Record<GraphPanelPosition, string> = {
  'top-left': 'top-0 left-0',
  'top-right': 'top-0 right-0',
  'bottom-left': 'bottom-0 left-0',
  'bottom-right': 'bottom-0 right-0',
};

export function GraphPanel({ position = 'top-left', className = '', style, children }: GraphPanelProps) {
  return (
    <div
      data-graph-panel={position}
      data-graph-overlay=""
      data-graph-nopan=""
      data-graph-nowheel=""
      className={`absolute pointer-events-auto z-10 ${POSITION_CLASSES[position]} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
