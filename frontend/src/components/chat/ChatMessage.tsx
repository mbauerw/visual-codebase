import { User, Bot, Wrench } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-4 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 flex items-center justify-center border ${
          isUser
            ? 'bg-[#2d3748] border-[#2d3748]'
            : 'bg-[#fafaf9] border-[#e8e6e3]'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-white" />
        ) : (
          <Bot size={14} className="text-[#8b7355]" />
        )}
      </div>

      {/* Message content */}
      <div
        className={`flex flex-col max-w-[85%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        {/* Role label */}
        <span className="text-[10px] text-[#a0aec0] font-light tracking-wider uppercase mb-1.5 px-1">
          {isUser ? 'You' : 'Assistant'}
        </span>

        <div
          className={`px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? 'bg-[#2d3748] text-white'
              : 'bg-[#fafaf9] text-[#4a5568] border border-[#e8e6e3]'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* Tools used indicator */}
        {!isUser && message.tools_used && message.tools_used.length > 0 && (
          <div className="flex items-center gap-2 mt-2 px-1">
            <Wrench size={10} className="text-[#cbd5e0]" />
            <span
              className="text-[10px] text-[#a0aec0] font-light"
              style={{ fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace' }}
            >
              {message.tools_used.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
