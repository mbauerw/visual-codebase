/**
 * GraphControls — zoom in / zoom out / fit-view buttons (replaces React Flow's <Controls />).
 */

import { Maximize, Minus, Plus } from 'lucide-react';
import { useGraphActions, useGraphTheme } from '../core/GraphContext';
import { GraphPanel, type GraphPanelPosition } from './GraphPanel';

export interface GraphControlsProps {
  position?: GraphPanelPosition;
  className?: string;
  /** Extra classes for each button (appended to theme.chrome.buttonClassName). */
  buttonClassName?: string;
  showFitView?: boolean;
}

export function GraphControls({
  position = 'bottom-left',
  className = '',
  buttonClassName = '',
  showFitView = true,
}: GraphControlsProps) {
  const actions = useGraphActions();
  const theme = useGraphTheme();
  const btn = `flex items-center justify-center w-7 h-7 transition-colors ${theme.chrome.buttonClassName} ${buttonClassName}`;

  return (
    <GraphPanel position={position} className={`m-4 ${className}`}>
      <div data-testid="graph-controls" className={`flex flex-col overflow-hidden rounded shadow ${theme.chrome.panelClassName}`}>
        <button type="button" className={btn} onClick={() => actions.zoomIn()} title="Zoom in" aria-label="Zoom in">
          <Plus size={14} />
        </button>
        <button type="button" className={btn} onClick={() => actions.zoomOut()} title="Zoom out" aria-label="Zoom out">
          <Minus size={14} />
        </button>
        {showFitView && (
          <button
            type="button"
            className={btn}
            onClick={() => actions.fitView({ padding: 0.1, duration: 200 })}
            title="Fit view"
            aria-label="Fit view"
          >
            <Maximize size={14} />
          </button>
        )}
      </div>
    </GraphPanel>
  );
}
