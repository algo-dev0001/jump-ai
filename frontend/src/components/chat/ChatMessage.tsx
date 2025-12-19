'use client';

import { memo } from 'react';

interface ChatMessageProps {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
}

function ChatMessageComponent({ role, content, isStreaming }: ChatMessageProps) {
  if (role === 'system') {
    return (
      <div className="flex justify-center my-4">
        <div className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-full">
          {content}
        </div>
      </div>
    );
  }

  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div
        className={`flex items-start gap-3 max-w-[80%] ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        {/* Avatar */}
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isUser ? 'bg-blue-600' : 'bg-emerald-600'
          }`}
        >
          {isUser ? (
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          )}
        </div>

        {/* Message */}
        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : 'bg-gray-100 text-gray-900 rounded-tl-sm'
          }`}
        >
          <div className="whitespace-pre-wrap break-words">{content}</div>
          {isStreaming && (
            <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}

export const ChatMessage = memo(ChatMessageComponent);

