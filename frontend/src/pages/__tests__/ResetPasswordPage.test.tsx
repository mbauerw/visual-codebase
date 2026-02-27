import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import ResetPasswordPage from '../ResetPasswordPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGetSession = vi.fn();
const mockUpdateUser = vi.fn();
vi.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      updateUser: (params: any) => mockUpdateUser(params),
    },
  },
}));

vi.mock('../../components/PasswordStrengthIndicator', () => ({
  default: ({ password, onValidationChange }: { password: string; onValidationChange: (result: { valid: boolean } | null) => void }) => {
    // Simulate valid password when length >= 8
    const isValid = password.length >= 8;
    // Call onValidationChange on render
    setTimeout(() => onValidationChange(isValid ? { valid: true } : { valid: false }), 0);
    return <div data-testid="password-strength">{isValid ? 'Strong' : 'Weak'}</div>;
  },
}));

describe('ResetPasswordPage', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
      error: null,
    });
  });

  describe('loading state', () => {
    it('should show verifying message while checking session', () => {
      mockGetSession.mockReturnValue(new Promise(() => {})); // Never resolves

      render(<ResetPasswordPage />);

      expect(screen.getByText('Verifying reset link...')).toBeInTheDocument();
    });
  });

  describe('invalid session', () => {
    it('should show error when session is invalid', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByText('Link Expired')).toBeInTheDocument();
      });

      expect(
        screen.getByText('Invalid or expired reset link. Please request a new password reset.')
      ).toBeInTheDocument();
    });

    it('should show error when getSession returns error', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: new Error('Invalid token'),
      });

      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByText('Link Expired')).toBeInTheDocument();
      });
    });

    it('should navigate home when clicking Back to Home button', async () => {
      mockGetSession.mockResolvedValue({
        data: { session: null },
        error: null,
      });

      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByText('Link Expired')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /back to home/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('password form', () => {
    it('should render form when session is valid', async () => {
      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      });

      expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reset password/i })).toBeInTheDocument();
    });

    it('should show password mismatch message', async () => {
      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('New Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'different');

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument();
    });

    it('should show passwords match message', async () => {
      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('New Password'), 'password123');
      await user.type(screen.getByLabelText('Confirm Password'), 'password123');

      expect(screen.getByText('Passwords match')).toBeInTheDocument();
    });

    it('should submit and show success on successful reset', async () => {
      mockUpdateUser.mockResolvedValue({ error: null });

      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('New Password'), 'strongPass1!');
      await user.type(screen.getByLabelText('Confirm Password'), 'strongPass1!');

      // Wait for password validation to run
      await waitFor(() => {
        expect(screen.getByTestId('password-strength')).toHaveTextContent('Strong');
      });

      const submitButton = screen.getByRole('button', { name: /reset password/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password Updated!')).toBeInTheDocument();
      });

      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'strongPass1!' });
    });

    it('should show error on failed password update', async () => {
      mockUpdateUser.mockResolvedValue({
        error: { message: 'Password too weak' },
      });

      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('New Password')).toBeInTheDocument();
      });

      await user.type(screen.getByLabelText('New Password'), 'strongPass1!');
      await user.type(screen.getByLabelText('Confirm Password'), 'strongPass1!');

      await waitFor(() => {
        expect(screen.getByTestId('password-strength')).toHaveTextContent('Strong');
      });

      await user.click(screen.getByRole('button', { name: /reset password/i }));

      await waitFor(() => {
        expect(screen.getByText('Password too weak')).toBeInTheDocument();
      });
    });
  });

  describe('navigation', () => {
    it('should navigate home when clicking cancel', async () => {
      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByText('Cancel and return home')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Cancel and return home'));
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should navigate home when clicking sign in link', async () => {
      render(<ResetPasswordPage />);

      await waitFor(() => {
        expect(screen.getByText('Sign in')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Sign in'));
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
