/**
 * RundownFlowDiagram — read-only flow diagram (entry points → architecture
 * layers) rendered on the in-house graph engine.
 *
 *   calculateRundownLayout → GraphScene → <GraphCanvas theme={rundownTheme} renderers={rundownRenderers}>
 *
 * Pan (drag) and wheel zoom only: no selection, no chrome, no callbacks; the
 * scene is re-fitted (padding 0.3) whenever the flow/layers/entry points change.
 * The container is `h-[540px]`, matching the tab panel height in Rundown.tsx.
 */

import { useMemo } from 'react';
import type {
  RundownFlow,
  RundownLayer,
  RundownEntryPoint,
} from '../../types';
import { GraphCanvas } from '../../graph/core/GraphCanvas';
import { rundownTheme } from '../../graph/theme/rundownTheme';
import { rundownRenderers } from '../../graph/renderers/rundown';
import { calculateRundownLayout } from './layoutUtils';

const FIT_VIEW_OPTIONS = { padding: 0.3 } as const;

interface RundownFlowDiagramProps {
  flow: RundownFlow;
  layers: RundownLayer[];
  entryPoints: RundownEntryPoint[];
  onFileClick?: (filePath: string) => void;
}

export default function RundownFlowDiagram({
  flow,
  layers,
  entryPoints,
}: RundownFlowDiagramProps) {
  const scene = useMemo(
    () => calculateRundownLayout(flow, layers, entryPoints),
    [flow, layers, entryPoints]
  );

  return (
    <div
      className="h-[540px] w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-50"
      aria-hidden="true"
    >
      <GraphCanvas
        scene={scene}
        theme={rundownTheme}
        renderers={rundownRenderers}
        fitViewOnSceneChange={FIT_VIEW_OPTIONS}
        zoomOnDoubleClick={false}
        className="rundown-flow-canvas w-full h-full"
      />
    </div>
  );
}
