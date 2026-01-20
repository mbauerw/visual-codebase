import { User, Bot, Wrench } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-600' : 'bg-slate-600'
        }`}
      >
        {isUser ? (
          <User size={16} className="text-white" />
        ) : (
          <Bot size={16} className="text-white" />
        )}
      </div>

      {/* Message content */}
      <div
        className={`flex flex-col max-w-[80%] ${
          isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`px-4 py-2 rounded-2xl ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-slate-700 text-slate-100 rounded-tl-sm'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* Tools used indicator */}
        {!isUser && message.tools_used && message.tools_used.length > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
            <Wrench size={10} />
            <span>
              Used: {message.tools_used.join(', ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
