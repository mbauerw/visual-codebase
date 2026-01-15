import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import AuthCallback from '../AuthCallback';

// Mock supabase
const mockGetSession = vi.fn();
vi.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
    },
  },
}));

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AuthCallback', () => {
  const originalLocation = window.location;
  let mockSessionStorage: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage = {};

    // Mock sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockSessionStorage[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete mockSessionStorage[key];
        }),
      },
      writable: true,
    });

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true,
    });

    // Mock window.location
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      hash: '',
      href: 'http://localhost:5173/auth/callback',
    } as Location;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  describe('processing state', () => {
    it('should show processing state initially', () => {
      mockGetSession.mockImplementation(() => new Promise(() => {})); // Never resolves

      render(<AuthCallback />);

      expect(screen.getByText('Completing sign in...')).toBeInTheDocument();
      expect(screen.getByText(/Please wait while we authenticate/i)).toBeInTheDocument();
    });

    it('should show loading spinner', () => {
      mockGetSession.mockImplementation(() => new Promise(() => {}));

      render(<AuthCallback />);

      // Check for the Loader2 icon (it has animate-spin class)
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('success state', () => {
    it('should show success state when session is found', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            user: { id: 'test-user', email: 'test@example.com' },
            provider_token: 'github-token',
          },
        },
        error: null,
      });

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Successfully signed in!')).toBeInTheDocument();
        expect(screen.getByText('Redirecting you now...')).toBeInTheDocument();
      });
    });

    it('should store provider token in localStorage', async () => {
      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            user: { id: 'test-user', email: 'test@example.com' },
            provider_token: 'github-token',
          },
        },
        error: null,
      });

      render(<AuthCallback />);

      await waitFor(() => {
        expect(window.localStorage.setItem).toHaveBeenCalledWith(
          'github_provider_token',
          'github-token'
        );
      });
    });

    it('should redirect to home after success', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            user: { id: 'test-user', email: 'test@example.com' },
          },
        },
        error: null,
      });

      render(<AuthCallback />);

      // Wait for success state to appear
      await vi.waitFor(() => {
        expect(screen.getByText('Successfully signed in!')).toBeInTheDocument();
      });

      // Fast-forward the timer for redirect
      await vi.advanceTimersByTimeAsync(1100);

      expect(mockNavigate).toHaveBeenCalledWith('/');

      vi.useRealTimers();
    });

    it('should redirect to stored redirect URL if available', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      mockSessionStorage['auth_redirect'] = '/visualize?analysis=123';

      mockGetSession.mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            user: { id: 'test-user', email: 'test@example.com' },
          },
        },
        error: null,
      });

      render(<AuthCallback />);

      // Wait for success state to appear
      await vi.waitFor(() => {
        expect(screen.getByText('Successfully signed in!')).toBeInTheDocument();
      });

      // Fast-forward the timer for redirect
      await vi.advanceTimersByTimeAsync(1100);

      expect(mockNavigate).toHaveBeenCalledWith('/visualize?analysis=123');

      vi.useRealTimers();
    });
  });

  describe('error state', () => {
    it('should show error state when session fetch fails', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Invalid token' },
      });

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
        expect(screen.getByText('Invalid token')).toBeInTheDocument();
      });
    });

    it('should show error state when no session is found', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
        expect(screen.getByText(/No session found/i)).toBeInTheDocument();
      });
    });

    it('should show Return to Home button on error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth error' },
      });

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Return to Home/i })).toBeInTheDocument();
      });
    });

    it('should navigate to home when retry button is clicked', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Auth error' },
      });

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Return to Home/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /Return to Home/i });
      retryButton.click();

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('URL error handling', () => {
    it('should handle error in URL hash params', async () => {
      window.location.hash = '#error=access_denied&error_description=User%20cancelled';

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
        expect(screen.getByText('User cancelled')).toBeInTheDocument();
      });
    });

    it('should show error code if no description', async () => {
      window.location.hash = '#error=server_error';

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
        expect(screen.getByText('server_error')).toBeInTheDocument();
      });
    });
  });

  describe('exception handling', () => {
    it('should handle thrown exceptions', async () => {
      mockGetSession.mockRejectedValue(new Error('Network error'));

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockGetSession.mockRejectedValue('Unknown error');

      render(<AuthCallback />);

      await waitFor(() => {
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
        expect(screen.getByText(/unknown error/i)).toBeInTheDocument();
      });
    });
  });
});
