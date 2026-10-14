/**
 * RundownLayerNode — one architecture layer of the rundown flow diagram
 * (port of the former React Flow `components/rundown/nodes/LayerNode.tsx`).
 *
 * A wide rounded box tinted with the layer colour when the layer takes part in
 * the active flow (label + step action on the left, key-file pills on the
 * right); inactive layers are greyed and faded. The slot height is estimated
 * by `components/rundown/layoutUtils.ts` (`estimateLayerHeight`) from the same
 * paddings/line heights used here, so the box fills its slot and edges anchor
 * to its top/bottom edges (no Handles).
 */

import type { NodeRenderProps } from '../../core/types';
import type { LayerNodeData } from '../../../components/rundown/layoutUtils';

const INACTIVE_BG = '#f8fafc';
const INACTIVE_BORDER = '#e2e8f0';
const INACTIVE_TEXT = '#94a3b8';

export function RundownLayerNode({ node }: NodeRenderProps<LayerNodeData>) {
  const data = node.data;
  return (
    <div
      data-testid="rundown-layer-node"
      data-active={data.isActive ? 'true' : 'false'}
      className="w-full h-full rounded-lg border-2 px-4 py-3 flex flex-col justify-center transition-opacity"
      style={{
        backgroundColor: data.isActive ? data.colorBg : INACTIVE_BG,
        borderColor: data.isActive ? data.colorBorder : INACTIVE_BORDER,
        opacity: data.isActive ? 1 : 0.4,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div
            className="text-sm font-semibold"
            style={{ color: data.isActive ? data.colorText : INACTIVE_TEXT }}
          >
            {data.label}
          </div>

          {data.isActive && data.action && (
            <p className="text-sm text-slate-600 mt-0.5 italic">
              {data.action}
            </p>
          )}
        </div>

        {data.isActive && data.keyFiles.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-end" style={{ maxWidth: '66%' }}>
            {data.keyFiles.map((file) => (
              <span
                key={file}
                className="font-mono text-xs text-slate-500 bg-white/60 px-1.5 py-0.5 rounded"
              >
                {file}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default RundownLayerNode;
