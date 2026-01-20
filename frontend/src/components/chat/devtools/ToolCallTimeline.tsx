import { useState } from 'react';
import { ChevronDown, ChevronRight, Clock, CheckCircle, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import type { ToolCallLog } from '../../../types/devtools';

interface ToolCallTimelineProps {
  toolCalls: ToolCallLog[];
  isLoading: boolean;
}

interface ToolCallItemProps {
  call: ToolCallLog;
}

function ToolCallItem({ call }: ToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedField, setCopiedField] = useState<'input' | 'output' | null>(null);

  const handleCopy = async (text: string, field: 'input' | 'output') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // Ignore copy errors
    }
  };

  const getStatusIcon = () => {
    switch (call.status) {
      case 'running':
        return <Loader2 size={10} className="text-amber-500 animate-spin" />;
      case 'completed':
        return <CheckCircle size={10} className="text-emerald-500" />;
      case 'error':
        return <AlertCircle size={10} className="text-red-500" />;
      default:
        return <Clock size={10} className="text-slate-500" />;
    }
  };

  const formatDuration = (ms: number | undefined) => {
    if (ms === undefined) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="border border-slate-700/50 rounded bg-slate-800/30">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-800/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown size={10} className="text-slate-500 shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-slate-500 shrink-0" />
        )}
        {getStatusIcon()}
        <span className="flex-1 text-[11px] font-mono text-slate-300 truncate">
          {call.name}
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {formatDuration(call.durationMs)}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-2 pb-2 space-y-2 border-t border-slate-700/50">
          {/* Input */}
          {call.input && (
            <div className="mt-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Input</span>
                <button
                  onClick={() => handleCopy(JSON.stringify(call.input, null, 2), 'input')}
                  className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Copy input"
                >
                  {copiedField === 'input' ? (
                    <Check size={10} className="text-emerald-500" />
                  ) : (
                    <Copy size={10} />
                  )}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-400 bg-slate-900/50 rounded p-1.5 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                {JSON.stringify(call.input, null, 2)}
              </pre>
            </div>
          )}

          {/* Output */}
          {call.output && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">Output</span>
                <button
                  onClick={() => handleCopy(call.output!, 'output')}
                  className="p-0.5 text-slate-500 hover:text-slate-300 transition-colors"
                  title="Copy output"
                >
                  {copiedField === 'output' ? (
                    <Check size={10} className="text-emerald-500" />
                  ) : (
                    <Copy size={10} />
                  )}
                </button>
              </div>
              <pre className="text-[10px] font-mono text-slate-400 bg-slate-900/50 rounded p-1.5 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(call.output), null, 2);
                  } catch {
                    return call.output;
                  }
                })()}
              </pre>
            </div>
          )}

          {/* Error */}
          {call.error && (
            <div className="text-[10px] text-red-400 bg-red-500/10 rounded p-1.5">
              {call.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ToolCallTimeline({ toolCalls, isLoading }: ToolCallTimelineProps) {
  if (toolCalls.length === 0 && !isLoading) {
    return (
      <div className="text-xs text-slate-500 italic">
        No tool calls yet
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {toolCalls.map(call => (
        <ToolCallItem key={call.id} call={call} />
      ))}
      {isLoading && toolCalls.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={12} className="animate-spin text-amber-500" />
          <span>Processing...</span>
        </div>
      )}
    </div>
  );
}
