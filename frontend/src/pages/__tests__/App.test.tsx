import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../test/test-utils';
import App from '../../App';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(),
}));

// Mock page components using paths relative to App.tsx's imports
vi.mock('../../pages/UploadPage', () => ({
  default: () => <div data-testid="upload-page">Upload Page</div>,
}));
vi.mock('../../pages/VisualizationPage', () => ({
  default: () => <div data-testid="visualization-page">Visualization Page</div>,
}));
vi.mock('../../pages/AuthCallback', () => ({
  default: () => <div data-testid="auth-callback">Auth Callback</div>,
}));
vi.mock('../../pages/ResetPasswordPage', () => ({
  default: () => <div data-testid="reset-password">Reset Password</div>,
}));
vi.mock('../../pages/TermsOfServicePage', () => ({
  default: () => <div data-testid="terms-page">Terms</div>,
}));
vi.mock('../../pages/PrivacyPolicyPage', () => ({
  default: () => <div data-testid="privacy-page">Privacy</div>,
}));

import { useAuth } from '../../hooks/useAuth';
const mockUseAuth = vi.mocked(useAuth);

const mockAuthReturn = {
  loading: false,
  user: null,
  session: null,
  githubToken: null,
  authProvider: null as 'email' | 'github' | 'google' | null,
  signUp: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  resetPassword: vi.fn(),
  signInWithGitHub: vi.fn(),
  signInWithGoogle: vi.fn(),
};

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
  });

  it('should show loading spinner when auth is loading', () => {
    mockUseAuth.mockReturnValue({ ...mockAuthReturn, loading: true });

    render(<App />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should render upload page on root route', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn);

    render(<App />);

    expect(screen.getByTestId('upload-page')).toBeInTheDocument();
  });

  it('should render terms page on /terms route', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn);

    window.history.pushState({}, '', '/terms');
    render(<App />);

    expect(screen.getByTestId('terms-page')).toBeInTheDocument();
  });

  it('should render privacy page on /privacy route', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn);

    window.history.pushState({}, '', '/privacy');
    render(<App />);

    expect(screen.getByTestId('privacy-page')).toBeInTheDocument();
  });

  it('should redirect unknown routes to home', () => {
    mockUseAuth.mockReturnValue(mockAuthReturn);

    window.history.pushState({}, '', '/nonexistent-route');
    render(<App />);

    expect(screen.getByTestId('upload-page')).toBeInTheDocument();
  });
});
