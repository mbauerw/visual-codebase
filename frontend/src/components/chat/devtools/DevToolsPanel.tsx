import { useState } from 'react';
import { ChevronDown, ChevronRight, Terminal, Wrench, BarChart3 } from 'lucide-react';
import { TokenUsageDisplay } from './TokenUsageDisplay';
import { ToolCallTimeline } from './ToolCallTimeline';
import { MetricsBar } from './MetricsBar';
import type { ContextInfo, ToolCallLog, ModelInfo } from '../../../types/devtools';
import type { TokenUsage } from '../../../types/chat';

interface DevToolsPanelProps {
  isExpanded: boolean;
  onToggle: () => void;
  tokenUsage: TokenUsage;
  contextInfo: ContextInfo | null;
  toolCallLogs: ToolCallLog[];
  modelInfo: ModelInfo;
  messageCount: number;
  isLoading: boolean;
}

type Section = 'tokens' | 'tools' | 'metrics';

export function DevToolsPanel({
  isExpanded,
  onToggle,
  tokenUsage,
  contextInfo,
  toolCallLogs,
  modelInfo,
  messageCount,
  isLoading,
}: DevToolsPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<Section>>(
    new Set(['tokens', 'tools'])
  );

  const toggleSection = (section: Section) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  if (!isExpanded) {
    return null;
  }

  return (
    <div className="border-b border-slate-800 bg-slate-900/50">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-slate-800/30 transition-colors"
      >
        <Terminal size={12} className="text-amber-500" />
        <span className="text-xs font-medium text-slate-300 flex-1">Developer Tools</span>
        <span className="text-[10px] text-slate-500 font-mono">Cmd+Shift+D</span>
        <ChevronDown size={12} className="text-slate-500" />
      </button>

      {/* Content */}
      <div className="px-4 pb-3 space-y-3">
        {/* Quick metrics bar */}
        <MetricsBar
          modelInfo={modelInfo}
          toolCalls={toolCallLogs}
          messageCount={messageCount}
        />

        {/* Token Usage Section */}
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('tokens')}
            className="w-full flex items-center gap-2 px-3 py-2 text-left bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
          >
            {expandedSections.has('tokens') ? (
              <ChevronDown size={10} className="text-slate-500" />
            ) : (
              <ChevronRight size={10} className="text-slate-500" />
            )}
            <BarChart3 size={12} className="text-slate-500" />
            <span className="text-[11px] font-medium text-slate-400">Context Window</span>
            {contextInfo && (
              <span className="ml-auto text-[10px] font-mono text-slate-500">
                {contextInfo.utilization_percent.toFixed(1)}%
              </span>
            )}
          </button>
          {expandedSections.has('tokens') && (
            <div className="px-3 py-2">
              <TokenUsageDisplay
                contextInfo={contextInfo}
                tokenUsage={tokenUsage}
              />
            </div>
          )}
        </div>

        {/* Tool Calls Section */}
        <div className="border border-slate-700/50 rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('tools')}
            className="w-full flex items-center gap-2 px-3 py-2 text-left bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
          >
            {expandedSections.has('tools') ? (
              <ChevronDown size={10} className="text-slate-500" />
            ) : (
              <ChevronRight size={10} className="text-slate-500" />
            )}
            <Wrench size={12} className="text-slate-500" />
            <span className="text-[11px] font-medium text-slate-400">Tool Calls</span>
            {toolCallLogs.length > 0 && (
              <span className="ml-auto text-[10px] font-mono text-slate-500">
                {toolCallLogs.length}
              </span>
            )}
          </button>
          {expandedSections.has('tools') && (
            <div className="px-3 py-2 max-h-64 overflow-y-auto">
              <ToolCallTimeline
                toolCalls={toolCallLogs}
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
