import { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Wrench } from 'lucide-react';
import type { ToolResultInline, ToolResultStatus } from '../../types/chat';

// Re-export types for convenience
export type { ToolResultInline, ToolResultStatus };

interface ToolResultBlockProps {
  result: ToolResultInline;
  variant?: 'widget' | 'panel';
  defaultExpanded?: boolean;
}

const STATUS_CONFIG = {
  running: {
    icon: Loader2,
    iconClass: 'animate-spin text-blue-400',
    bgClass: 'bg-blue-500/10 border-blue-500/30',
    textClass: 'text-blue-400',
    label: 'Running',
  },
  completed: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10 border-emerald-500/30',
    textClass: 'text-emerald-400',
    label: 'Completed',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-red-400',
    bgClass: 'bg-red-500/10 border-red-500/30',
    textClass: 'text-red-400',
    label: 'Error',
  },
} as const;

export function ToolResultBlock({
  result,
  variant = 'panel',
  defaultExpanded = false,
}: ToolResultBlockProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const config = STATUS_CONFIG[result.status];
  const StatusIcon = config.icon;
  const isPanel = variant === 'panel';

  const hasContent = result.inputPreview || result.outputPreview || result.error;

  const containerClasses = isPanel
    ? `border rounded-md ${config.bgClass} transition-colors`
    : `border rounded ${config.bgClass} transition-colors`;

  const headerClasses = isPanel
    ? 'flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-white/5'
    : 'flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-black/5';

  const toolNameClasses = isPanel
    ? 'text-xs font-mono text-slate-300'
    : 'text-xs font-mono text-slate-600';

  const durationClasses = isPanel
    ? 'text-[10px] text-slate-500 ml-auto'
    : 'text-[10px] text-slate-400 ml-auto';

  const previewContainerClasses = isPanel
    ? 'px-2.5 pb-2 space-y-2 border-t border-slate-700/50 pt-2'
    : 'px-2 pb-1.5 space-y-1.5 border-t border-slate-200 pt-1.5';

  const previewLabelClasses = isPanel
    ? 'text-[10px] font-medium text-slate-500 uppercase tracking-wider'
    : 'text-[10px] font-medium text-slate-400 uppercase tracking-wider';

  const previewTextClasses = isPanel
    ? 'text-xs text-slate-400 font-mono bg-slate-900/50 rounded px-2 py-1 overflow-x-auto max-h-24 overflow-y-auto'
    : 'text-xs text-slate-500 font-mono bg-slate-100 rounded px-1.5 py-1 overflow-x-auto max-h-20 overflow-y-auto';

  const errorTextClasses = isPanel
    ? 'text-xs text-red-400 font-mono bg-red-900/20 rounded px-2 py-1'
    : 'text-xs text-red-500 font-mono bg-red-50 rounded px-1.5 py-1';

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div
        className={headerClasses}
        onClick={() => hasContent && setExpanded(!expanded)}
        role={hasContent ? 'button' : undefined}
        tabIndex={hasContent ? 0 : undefined}
        onKeyDown={hasContent ? (e) => e.key === 'Enter' && setExpanded(!expanded) : undefined}
      >
        {/* Expand/Collapse indicator */}
        {hasContent && (
          expanded ? (
            <ChevronDown size={12} className={isPanel ? 'text-slate-500' : 'text-slate-400'} />
          ) : (
            <ChevronRight size={12} className={isPanel ? 'text-slate-500' : 'text-slate-400'} />
          )
        )}

        {/* Tool icon */}
        <Wrench size={12} className={isPanel ? 'text-slate-500' : 'text-slate-400'} />

        {/* Tool name */}
        <span className={toolNameClasses}>{result.name}</span>

        {/* Status indicator */}
        <StatusIcon size={12} className={config.iconClass} />
        <span className={`text-[10px] ${config.textClass}`}>
          {config.label}
        </span>

        {/* Duration */}
        {result.durationMs !== undefined && (
          <span className={durationClasses}>
            {result.durationMs}ms
          </span>
        )}
      </div>

      {/* Expanded content */}
      {expanded && hasContent && (
        <div className={previewContainerClasses}>
          {/* Input preview */}
          {result.inputPreview && (
            <div>
              <div className={previewLabelClasses}>Input</div>
              <pre className={previewTextClasses}>
                {result.inputPreview}
              </pre>
            </div>
          )}

          {/* Output preview */}
          {result.outputPreview && (
            <div>
              <div className={previewLabelClasses}>Output</div>
              <pre className={previewTextClasses}>
                {result.outputPreview}
              </pre>
            </div>
          )}

          {/* Error */}
          {result.error && (
            <div>
              <div className={previewLabelClasses}>Error</div>
              <pre className={errorTextClasses}>
                {result.error}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ToolResultsListProps {
  results: ToolResultInline[];
  variant?: 'widget' | 'panel';
}

/**
 * Render a list of tool results with progressive display.
 */
export function ToolResultsList({ results, variant = 'panel' }: ToolResultsListProps) {
  if (!results || results.length === 0) return null;

  return (
    <div className="space-y-1.5 mt-2">
      {results.map((result) => (
        <ToolResultBlock
          key={result.id}
          result={result}
          variant={variant}
        />
      ))}
    </div>
  );
}
