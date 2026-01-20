import { User, Bot, Wrench } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center border ${
          isUser
            ? 'bg-slate-700 border-slate-600'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}
      >
        {isUser ? (
          <User size={14} className="text-slate-300" />
        ) : (
          <Bot size={14} className="text-amber-400" />
        )}
      </div>

      {/* Message content */}
      <div
        className={`flex flex-col max-w-[85%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`px-3 py-2 rounded-lg text-sm ${
            isUser
              ? 'bg-slate-700 text-slate-100 border border-slate-600'
              : 'bg-slate-800 text-slate-200 border border-slate-700'
          }`}
        >
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </p>
        </div>

        {/* Tools used indicator */}
        {!isUser && message.tools_used && message.tools_used.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1.5 px-1">
            <Wrench size={10} className="text-slate-600" />
            <span className="text-[10px] text-slate-600">
              {message.tools_used.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
