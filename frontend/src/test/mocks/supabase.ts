import { vi } from 'vitest';

// Mock Supabase client
export const mockSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    aud: 'authenticated',
    role: 'authenticated',
    email_confirmed_at: '2024-01-01T00:00:00Z',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    app_metadata: {},
    user_metadata: { full_name: 'Test User' },
  },
  provider_token: 'github-provider-token',
};

export const mockUser = mockSession.user;

// Create a mock auth state change subscription
let authStateCallback: ((event: string, session: typeof mockSession | null) => void) | null = null;

export const createMockSupabaseClient = (options?: {
  authenticated?: boolean;
  hasProviderToken?: boolean;
}) => {
  const isAuthenticated = options?.authenticated ?? true;
  const hasProviderToken = options?.hasProviderToken ?? true;

  const session = isAuthenticated
    ? {
        ...mockSession,
        provider_token: hasProviderToken ? mockSession.provider_token : null,
      }
    : null;

  return {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: mockUser, session },
        error: null,
      }),
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { user: mockUser, session },
        error: null,
      }),
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { provider: 'github', url: 'https://github.com/login/oauth/authorize' },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        authStateCallback = callback;
        // Immediately call with current session
        setTimeout(() => callback('INITIAL_SESSION', session), 0);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    },
  };
};

// Helper to simulate auth state changes in tests
export const simulateAuthStateChange = (event: string, session: typeof mockSession | null) => {
  if (authStateCallback) {
    authStateCallback(event, session);
  }
};

// Reset auth state callback between tests
export const resetAuthCallback = () => {
  authStateCallback = null;
};
