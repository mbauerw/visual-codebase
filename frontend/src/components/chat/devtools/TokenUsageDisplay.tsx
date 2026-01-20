import type { ContextInfo } from '../../../types/devtools';
import type { TokenUsage } from '../../../types/chat';

interface TokenUsageDisplayProps {
  contextInfo: ContextInfo | null;
  tokenUsage: TokenUsage;
}

export function TokenUsageDisplay({ contextInfo, tokenUsage }: TokenUsageDisplayProps) {
  if (!contextInfo && tokenUsage.total_tokens === 0) {
    return (
      <div className="text-xs text-slate-500 italic">
        No token data yet
      </div>
    );
  }

  const utilizationPercent = contextInfo?.utilization_percent ?? 0;
  const contextLimit = contextInfo?.context_window_limit ?? 200000;
  const postRequestTokens = contextInfo?.post_request_tokens ?? 0;

  // Color based on utilization
  const getUtilizationColor = (percent: number) => {
    if (percent < 50) return 'bg-emerald-500';
    if (percent < 80) return 'bg-amber-500';
    return 'bg-red-500';
  };

  const utilizationColor = getUtilizationColor(utilizationPercent);

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>Context Window</span>
          <span>{utilizationPercent.toFixed(1)}% used</span>
        </div>
        <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full ${utilizationColor} transition-all duration-300`}
            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] font-mono">
        {contextInfo && (
          <>
            <div className="flex justify-between text-slate-500">
              <span>System:</span>
              <span className="text-slate-400">
                {contextInfo.system_prompt_tokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tools:</span>
              <span className="text-slate-400">
                {contextInfo.tools_tokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Conversation:</span>
              <span className="text-slate-400">
                {contextInfo.conversation_tokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Total:</span>
              <span className="text-slate-300">
                {postRequestTokens.toLocaleString()} / {(contextLimit / 1000).toFixed(0)}k
              </span>
            </div>
          </>
        )}
      </div>

      {/* Session totals */}
      {tokenUsage.total_tokens > 0 && (
        <div className="pt-1 border-t border-slate-700/50">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>Session tokens:</span>
            <span className="text-slate-400 font-mono">
              {tokenUsage.input_tokens.toLocaleString()} in / {tokenUsage.output_tokens.toLocaleString()} out
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
