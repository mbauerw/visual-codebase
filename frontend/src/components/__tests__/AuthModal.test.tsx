import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { AuthModal } from '../AuthModal';

// Mock useAuth
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockResetPassword = vi.fn();
const mockSignInWithGitHub = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    resetPassword: mockResetPassword,
    signInWithGitHub: mockSignInWithGitHub,
    user: null,
    isLoading: false,
  }),
}));

describe('AuthModal', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    initialTab: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockResolvedValue({ error: null });
    mockSignUp.mockResolvedValue({ error: null });
    mockResetPassword.mockResolvedValue({ error: null });
    mockSignInWithGitHub.mockResolvedValue({ error: null });
  });

  describe('modal visibility', () => {
    it('should render when open is true', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByText('Authentication')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(<AuthModal {...defaultProps} open={false} />);

      expect(screen.queryByText('Authentication')).not.toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('should render Sign In tab', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('should render Sign Up tab', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /Sign Up/i })).toBeInTheDocument();
    });

    it('should render Reset Password tab', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /Reset Password/i })).toBeInTheDocument();
    });

    it('should start on Sign In tab by default', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('tab', { name: /Sign In/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('should start on Sign Up tab when initialTab is 1', () => {
      render(<AuthModal {...defaultProps} initialTab={1} />);

      expect(screen.getByRole('tab', { name: /Sign Up/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    it('should switch to Sign Up tab when clicked', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Sign Up/i }));

      expect(screen.getByRole('tab', { name: /Sign Up/i })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });
  });

  describe('Sign In form', () => {
    it('should render email input', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    });

    it('should render password input', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    });

    it('should render Sign In button', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Sign In/i })).toBeInTheDocument();
    });

    it('should call signIn when form is submitted', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should close modal on successful sign in', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} onClose={onClose} />);

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show error message on sign in failure', async () => {
      mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });
  });

  describe('Sign Up form', () => {
    it('should render Full Name input on Sign Up tab', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Sign Up/i }));

      expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    });

    it('should call signUp when Sign Up form is submitted', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Sign Up/i }));

      await user.type(screen.getByLabelText(/Full Name/i), 'Test User');
      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign Up/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
      });
    });

    it('should show success message on successful sign up', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Sign Up/i }));

      await user.type(screen.getByLabelText(/Full Name/i), 'Test User');
      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign Up/i }));

      await waitFor(() => {
        expect(screen.getByText(/Check your email for confirmation/i)).toBeInTheDocument();
      });
    });

    it('should show error message on sign up failure', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Email already exists' } });

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Sign Up/i }));

      await user.type(screen.getByLabelText(/Full Name/i), 'Test User');
      await user.type(screen.getByLabelText(/Email/i), 'existing@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign Up/i }));

      await waitFor(() => {
        expect(screen.getByText('Email already exists')).toBeInTheDocument();
      });
    });
  });

  describe('Reset Password form', () => {
    it('should only render email input on Reset Password tab', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Reset Password/i }));

      expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Password/i)).not.toBeInTheDocument();
    });

    it('should call resetPassword when form is submitted', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Reset Password/i }));

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /Reset Password/i }));

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('should show success message on successful reset', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Reset Password/i }));

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /Reset Password/i }));

      await waitFor(() => {
        expect(screen.getByText(/Password reset email sent/i)).toBeInTheDocument();
      });
    });
  });

  describe('GitHub Sign In', () => {
    it('should render GitHub sign in button on Sign In tab', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Continue with GitHub/i })).toBeInTheDocument();
    });

    it('should not render GitHub sign in button on Sign Up tab', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('tab', { name: /Sign Up/i }));

      expect(
        screen.queryByRole('button', { name: /Continue with GitHub/i })
      ).not.toBeInTheDocument();
    });

    it('should call signInWithGitHub when GitHub button is clicked', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Continue with GitHub/i }));

      await waitFor(() => {
        expect(mockSignInWithGitHub).toHaveBeenCalled();
      });
    });

    it('should show error message on GitHub sign in failure', async () => {
      mockSignInWithGitHub.mockResolvedValue({ error: { message: 'OAuth error' } });

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Continue with GitHub/i }));

      await waitFor(() => {
        expect(screen.getByText('OAuth error')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when signing in', async () => {
      mockSignIn.mockImplementation(() => new Promise(() => {})); // Never resolves

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      // The button should show loading state
      const submitButton = screen.getByRole('button', { name: '' });
      expect(submitButton.querySelector('.MuiCircularProgress-root')).toBeTruthy();
    });

    it('should disable submit button when loading', async () => {
      mockSignIn.mockImplementation(() => new Promise(() => {}));

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      const submitButton = screen.getByRole('button', { name: '' });
      expect(submitButton).toBeDisabled();
    });
  });

  describe('form reset on tab change', () => {
    it('should clear form fields when switching tabs', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');

      await user.click(screen.getByRole('tab', { name: /Sign Up/i }));

      expect(screen.getByLabelText(/Email/i)).toHaveValue('');
    });

    it('should clear error messages when switching tabs', async () => {
      mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('tab', { name: /Sign Up/i }));

      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });
  });

  describe('exception handling', () => {
    it('should show generic error message on exception', async () => {
      mockSignIn.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByLabelText(/Email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/Password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /Sign In/i }));

      await waitFor(() => {
        expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
      });
    });
  });
});
