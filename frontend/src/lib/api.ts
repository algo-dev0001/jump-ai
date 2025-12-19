const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions extends RequestInit {
  token?: string;
}

async function apiRequest<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOptions,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

export const api = {
  // Health check
  health: () => apiRequest<{ status: string; timestamp: string }>('/health'),

  // Auth
  getMe: (token: string) =>
    apiRequest<{
      user: {
        id: string;
        email: string;
        name: string | null;
        createdAt: string;
      };
      connections: {
        google: { connected: boolean; needsReauth: boolean };
        hubspot: { connected: boolean; needsReauth: boolean };
      };
    }>('/auth/me', { token }),

  logout: (token: string) =>
    apiRequest<{ success: boolean }>('/auth/logout', {
      method: 'POST',
      token,
    }),

  refreshGoogleToken: (token: string) =>
    apiRequest<{ success: boolean }>('/auth/google/refresh', {
      method: 'POST',
      token,
    }),

  // Chat
  getChatHistory: (token: string) =>
    apiRequest<{
      messages: Array<{
        id: string;
        role: 'user' | 'assistant' | 'system';
        content: string;
        createdAt: string;
      }>;
    }>('/chat/history', { token }),

  clearChatHistory: (token: string) =>
    apiRequest<{ success: boolean }>('/chat/history', {
      method: 'DELETE',
      token,
    }),

  sendMessage: (token: string, message: string) =>
    apiRequest<{
      message: {
        id: string;
        role: 'assistant';
        content: string;
        createdAt: string;
      };
    }>('/chat', {
      method: 'POST',
      token,
      body: JSON.stringify({ message, stream: false }),
    }),

  // Streaming chat - returns EventSource URL
  getStreamUrl: () => `${API_URL}/chat`,
};
