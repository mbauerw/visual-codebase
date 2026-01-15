import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from './useAuth';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock user and session data
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  email_confirmed_at: '2024-01-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  app_metadata: {},
  user_metadata: { full_name: 'Test User' },
};

const mockSession = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockUser,
  provider_token: 'github-provider-token',
};

// Store for auth state change callback
let authStateCallback: ((event: string, session: typeof mockSession | null) => void) | null = null;

// Create mock supabase client
const createMockSupabase = (options?: {
  authenticated?: boolean;
  hasProviderToken?: boolean;
  signUpError?: Error;
  signInError?: Error;
  signOutError?: Error;
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
      signUp: vi.fn().mockResolvedValue(
        options?.signUpError
          ? { data: null, error: options.signUpError }
          : { data: { user: mockUser, session }, error: null }
      ),
      signInWithPassword: vi.fn().mockResolvedValue(
        options?.signInError
          ? { data: null, error: options.signInError }
          : { data: { user: mockUser, session }, error: null }
      ),
      signInWithOAuth: vi.fn().mockResolvedValue({
        data: { provider: 'github', url: 'https://github.com/login/oauth/authorize' },
        error: null,
      }),
      signOut: vi.fn().mockResolvedValue(
        options?.signOutError
          ? { error: options.signOutError }
          : { error: null }
      ),
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

let mockSupabase = createMockSupabase();

// Mock the supabase module
vi.mock('../config/supabase', () => ({
  get supabase() {
    return mockSupabase;
  },
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
    authStateCallback = null;
    mockSupabase = createMockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initial auth state', () => {
    it('should start with loading true', () => {
      const { result } = renderHook(() => useAuth());
      // Before the async getSession completes
      expect(result.current.loading).toBe(true);
    });

    it('should set loading to false after getting session', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should set user and session when authenticated', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeDefined();
      expect(result.current.user?.email).toBe('test@example.com');
      expect(result.current.session).toBeDefined();
    });

    it('should set githubToken from provider_token', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.githubToken).toBe('github-provider-token');
    });

    it('should fallback to localStorage for GitHub token', async () => {
      mockSupabase = createMockSupabase({ hasProviderToken: false });
      localStorageMock.setItem('github_provider_token', 'stored-github-token');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(localStorageMock.getItem).toHaveBeenCalledWith('github_provider_token');
      expect(result.current.githubToken).toBe('stored-github-token');
    });

    it('should return null user when not authenticated', async () => {
      mockSupabase = createMockSupabase({ authenticated: false });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });
  });

  describe('signUp', () => {
    it('should call supabase.auth.signUp with correct params', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signUp('new@example.com', 'password123', 'New User');
      });

      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'new@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'New User',
          },
        },
      });
    });

    it('should return data on successful signup', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signUpResult;
      await act(async () => {
        signUpResult = await result.current.signUp('new@example.com', 'password123');
      });

      expect(signUpResult).toHaveProperty('data');
      expect(signUpResult).toHaveProperty('error');
      expect((signUpResult as { error: null }).error).toBeNull();
    });

    it('should return error on failed signup', async () => {
      mockSupabase = createMockSupabase({
        signUpError: new Error('Email already exists'),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signUpResult;
      await act(async () => {
        signUpResult = await result.current.signUp('existing@example.com', 'password123');
      });

      expect((signUpResult as { error: Error }).error).toBeDefined();
      expect((signUpResult as { error: Error }).error.message).toBe('Email already exists');
    });
  });

  describe('signIn', () => {
    it('should call supabase.auth.signInWithPassword', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signIn('test@example.com', 'password123');
      });

      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should return data on successful sign in', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult;
      await act(async () => {
        signInResult = await result.current.signIn('test@example.com', 'password123');
      });

      expect(signInResult).toHaveProperty('data');
      expect((signInResult as { error: null }).error).toBeNull();
    });

    it('should return error on failed sign in', async () => {
      mockSupabase = createMockSupabase({
        signInError: new Error('Invalid credentials'),
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let signInResult;
      await act(async () => {
        signInResult = await result.current.signIn('wrong@example.com', 'wrongpassword');
      });

      expect((signInResult as { error: Error }).error.message).toBe('Invalid credentials');
    });
  });

  describe('signOut', () => {
    it('should call supabase.auth.signOut', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should clear GitHub token from localStorage', async () => {
      localStorageMock.setItem('github_provider_token', 'test-token');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('github_provider_token');
    });
  });

  describe('resetPassword', () => {
    it('should call supabase.auth.resetPasswordForEmail', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.resetPassword('test@example.com');
      });

      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('signInWithGitHub', () => {
    it('should call supabase.auth.signInWithOAuth with GitHub provider', async () => {
      // Mock window.location.origin
      Object.defineProperty(window, 'location', {
        value: { origin: 'http://localhost:3000' },
        writable: true,
      });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.signInWithGitHub();
      });

      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'github',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
          scopes: 'repo read:user user:email',
        },
      });
    });
  });

  describe('auth state changes', () => {
    it('should update state on SIGNED_IN event', async () => {
      mockSupabase = createMockSupabase({ authenticated: false });

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();

      // Simulate auth state change
      await act(async () => {
        if (authStateCallback) {
          authStateCallback('SIGNED_IN', mockSession);
        }
      });

      expect(result.current.user).toBeDefined();
      expect(result.current.user?.email).toBe('test@example.com');
    });

    it('should clear state on SIGNED_OUT event', async () => {
      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeDefined();

      // Simulate sign out
      await act(async () => {
        if (authStateCallback) {
          authStateCallback('SIGNED_OUT', null);
        }
      });

      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
      expect(result.current.githubToken).toBeNull();
    });

    it('should clear localStorage on SIGNED_OUT event', async () => {
      localStorageMock.setItem('github_provider_token', 'test-token');

      const { result } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Simulate sign out
      await act(async () => {
        if (authStateCallback) {
          authStateCallback('SIGNED_OUT', null);
        }
      });

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('github_provider_token');
    });
  });

  describe('cleanup', () => {
    it('should unsubscribe from auth state changes on unmount', async () => {
      const unsubscribeMock = vi.fn();
      mockSupabase.auth.onAuthStateChange = vi.fn().mockImplementation((callback) => {
        authStateCallback = callback;
        setTimeout(() => callback('INITIAL_SESSION', mockSession), 0);
        return {
          data: {
            subscription: {
              unsubscribe: unsubscribeMock,
            },
          },
        };
      });

      const { unmount } = renderHook(() => useAuth());

      await waitFor(() => {
        expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribeMock).toHaveBeenCalled();
    });
  });
});
