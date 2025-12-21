'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { ChatMessage, ChatInput, ChatHeader, ToolCallDisplay } from '@/components/chat';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

interface ActiveToolCall {
  name: string;
  status: 'calling' | 'complete' | 'error';
  args?: Record<string, unknown>;
  result?: {
    success?: boolean;
    data?: unknown;
    error?: string;
  };
}

export default function ChatPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [activeToolCalls, setActiveToolCalls] = useState<ActiveToolCall[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, activeToolCalls, scrollToBottom]);

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

  // Send message with streaming and tool call support
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
    setActiveToolCalls([]);

    try {
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
                
                switch (data.type) {
                  case 'thinking':
                    // Agent is thinking/processing
                    break;
                    
                  case 'tool_call':
                    // Tool is being called
                    setActiveToolCalls((prev) => [
                      ...prev,
                      { name: data.name, status: 'calling', args: data.args },
                    ]);
                    break;
                    
                  case 'tool_result':
                    // Tool finished
                    setActiveToolCalls((prev) =>
                      prev.map((tc) =>
                        tc.name === data.name
                          ? { 
                              ...tc, 
                              status: data.result?.success ? 'complete' : 'error',
                              result: data.result,
                            }
                          : tc
                      )
                    );
                    break;
                    
                  case 'content':
                    // Final response content
                    fullContent = data.content;
                    setStreamingContent(fullContent);
                    break;
                    
                  case 'done':
                    // Finished - add assistant message
                    if (fullContent) {
                      const assistantMessage: Message = {
                        id: `msg-${Date.now()}`,
                        role: 'assistant',
                        content: fullContent,
                        createdAt: new Date().toISOString(),
                      };
                      setMessages((prev) => [...prev, assistantMessage]);
                    }
                    setStreamingContent('');
                    setActiveToolCalls([]);
                    break;
                    
                  case 'error':
                    throw new Error(data.error);
                }
              } catch (parseError) {
                // Ignore parse errors for incomplete JSON
                if (parseError instanceof SyntaxError) continue;
                throw parseError;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'system',
        content: 'Failed to send message. Please try again.',
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setActiveToolCalls([]);
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
          {messages.length === 0 && !streamingContent && activeToolCalls.length === 0 ? (
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
                I can help you send emails, schedule meetings, search your CRM, and manage
                tasks. Just ask!
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center">
                {[
                  'Send an email to John about our meeting',
                  'Find available time slots for next week',
                  'Search for client information',
                  'Create a follow-up task',
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
              
              {/* Active tool calls */}
              {activeToolCalls.length > 0 && (
                <div className="mb-4">
                  {activeToolCalls.map((tc, idx) => (
                    <ToolCallDisplay
                      key={`${tc.name}-${idx}`}
                      name={tc.name}
                      status={tc.status}
                      args={tc.args}
                      result={tc.result}
                    />
                  ))}
                </div>
              )}
              
              {/* Streaming content */}
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
        placeholder={isSending ? 'AI is working...' : 'Ask me anything...'}
      />
    </div>
  );
}
