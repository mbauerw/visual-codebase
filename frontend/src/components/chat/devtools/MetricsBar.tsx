import { Cpu, Zap, Hash } from 'lucide-react';
import type { ModelInfo, ToolCallLog } from '../../../types/devtools';

interface MetricsBarProps {
  modelInfo: ModelInfo;
  toolCalls: ToolCallLog[];
  messageCount: number;
}

export function MetricsBar({ modelInfo, toolCalls, messageCount }: MetricsBarProps) {
  // Calculate average latency from completed tool calls
  const completedCalls = toolCalls.filter(c => c.status === 'completed' && c.durationMs);
  const avgLatency = completedCalls.length > 0
    ? Math.round(completedCalls.reduce((sum, c) => sum + (c.durationMs || 0), 0) / completedCalls.length)
    : 0;

  // Format model name for display
  const formatModelName = (modelId: string) => {
    if (modelId.includes('sonnet')) return 'Sonnet 4';
    if (modelId.includes('opus')) return 'Opus';
    if (modelId.includes('haiku')) return 'Haiku';
    return modelId.split('-').slice(0, 2).join(' ');
  };

  return (
    <div className="flex flex-wrap gap-3 text-[10px]">
      {/* Model */}
      <div className="flex items-center gap-1.5 text-slate-400">
        <Cpu size={10} className="text-slate-500" />
        <span className="font-mono">{formatModelName(modelInfo.modelId)}</span>
      </div>

      {/* Tool calls */}
      <div className="flex items-center gap-1.5 text-slate-400">
        <Hash size={10} className="text-slate-500" />
        <span className="font-mono">{toolCalls.length} tools</span>
      </div>

      {/* Average latency */}
      {avgLatency > 0 && (
        <div className="flex items-center gap-1.5 text-slate-400">
          <Zap size={10} className="text-slate-500" />
          <span className="font-mono">
            {avgLatency < 1000 ? `${avgLatency}ms` : `${(avgLatency / 1000).toFixed(1)}s`} avg
          </span>
        </div>
      )}

      {/* Messages */}
      {messageCount > 0 && (
        <div className="flex items-center gap-1.5 text-slate-400">
          <span className="font-mono">{messageCount} msgs</span>
        </div>
      )}
    </div>
  );
}
