import { User, Bot, Wrench } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types/chat';
import { ToolResultsList } from './ToolResultBlock';

interface ChatMessageProps {
  message: ChatMessageType;
  variant?: 'widget' | 'panel';
  showToolResults?: boolean;
}

export function ChatMessage({ message, variant = 'widget', showToolResults = true }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isPanel = variant === 'panel';

  // Panel variant uses dark theme, widget variant uses light theme
  const avatarClasses = isPanel
    ? isUser
      ? 'bg-slate-700 border-slate-600'
      : 'bg-slate-800 border-slate-700'
    : isUser
      ? 'bg-[#e8e6e3] border-[#d4d0cb]'
      : 'bg-[#fafaf9] border-[#e8e6e3]';

  const iconClasses = isPanel ? 'text-amber-400' : 'text-[#8b7355]';

  const labelClasses = isPanel
    ? 'text-[10px] text-slate-500 font-medium tracking-wider uppercase mb-1.5 px-1'
    : 'text-[10px] text-[#a0aec0] font-light tracking-wider uppercase mb-1.5 px-1';

  const messageClasses = isPanel
    ? isUser
      ? 'bg-slate-700 text-slate-200 border border-slate-600 rounded-lg'
      : 'bg-slate-800/50 text-slate-300 border border-slate-700/50 rounded-lg'
    : isUser
      ? 'bg-[#e8e6e3] text-[#4a5568] border border-[#d4d0cb] rounded-md'
      : 'bg-[#fafaf9] text-[#4a5568] border border-[#e8e6e3] rounded-md';

  const toolsClasses = isPanel
    ? 'text-slate-600'
    : 'text-[#cbd5e0]';

  const toolsTextClasses = isPanel
    ? 'text-[10px] text-slate-500 font-medium'
    : 'text-[10px] text-[#a0aec0] font-light';

  const hasToolResults = showToolResults && !isUser && message.tool_results && message.tool_results.length > 0;
  const hasToolsUsed = !isUser && message.tools_used && message.tools_used.length > 0;

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center border ${avatarClasses}`}
      >
        {isUser ? (
          <User size={14} className={iconClasses} />
        ) : (
          <Bot size={14} className={iconClasses} />
        )}
      </div>

      {/* Message content */}
      <div
        className={`flex flex-col max-w-[85%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Role label */}
        <span className={labelClasses}>
          {isUser ? 'You' : 'Assistant'}
        </span>

        {/* Tool results (shown before text content for progressive display) */}
        {hasToolResults && (
          <div className="w-full mb-2">
            <ToolResultsList
              results={message.tool_results!}
              variant={variant}
            />
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div className={`px-3 py-2.5 text-sm leading-relaxed ${messageClasses}`}>
            <p className="whitespace-pre-wrap break-words">
              {message.content}
            </p>
          </div>
        )}

        {/* Tools used indicator (only shown when no inline tool_results) */}
        {hasToolsUsed && !hasToolResults && (
          <div className="flex items-center gap-2 mt-1.5 px-1">
            <Wrench size={10} className={toolsClasses} />
            <span
              className={toolsTextClasses}
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
            >
              {message.tools_used!.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
