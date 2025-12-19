'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ChatMessage, ChatInput, ChatHeader } from '@/components/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authLoading, isAuthenticated, router]);

  // Load chat history
  useEffect(() => {
    const loadHistory = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const data = await api.getChatHistory(token);
        setMessages(data.messages);
      } catch (error) {
        console.error('Failed to load chat history:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isAuthenticated) {
      loadHistory();
    }
  }, [isAuthenticated]);

  // Send message with streaming
  const handleSend = async (content: string) => {
    const token = localStorage.getItem('token');
    if (!token) return;

    // Add user message immediately
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsSending(true);
    setStreamingContent('');

    try {
      // Use streaming
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: content, stream: true }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }
                if (data.done) {
                  // Add assistant message
                  const assistantMessage: Message = {
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: fullContent,
                    createdAt: new Date().toISOString(),
                  };
                  setMessages((prev) => [...prev, assistantMessage]);
                  setStreamingContent('');
                }
              } catch {
                // Ignore parse errors for incomplete JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Failed to send message. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSending(false);
    }
  };

  // Clear history
  const handleClearHistory = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    setIsClearing(true);
    try {
      await api.clearChatHistory(token);
      setMessages([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    } finally {
      setIsClearing(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <ChatHeader
        onClearHistory={handleClearHistory}
        onBack={() => router.push('/dashboard')}
        isClearing={isClearing}
      />

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto py-6 px-4">
          {messages.length === 0 && !streamingContent ? (
            <div className="text-center py-20">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Start a conversation
              </h2>
              <p className="text-gray-600 max-w-md mx-auto">
                Ask me about your clients, schedule meetings, draft emails, or get help
                managing your financial advisory practice.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  'Help me draft an email to a client',
                  'What meetings do I have this week?',
                  'Summarize my recent client communications',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSend(suggestion)}
                    disabled={isSending}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                />
              ))}
              {streamingContent && (
                <ChatMessage
                  role="assistant"
                  content={streamingContent}
                  isStreaming={true}
                />
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <ChatInput
        onSend={handleSend}
        disabled={isSending}
        placeholder={isSending ? 'AI is thinking...' : 'Ask me anything...'}
      />
    </div>
  );
}

