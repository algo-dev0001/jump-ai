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
};
