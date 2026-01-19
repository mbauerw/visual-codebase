import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import { AuthModal } from '../AuthModal';

// Mock useAuth
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockResetPassword = vi.fn();
const mockSignInWithGitHub = vi.fn();
const mockSignInWithGoogle = vi.fn();

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    signIn: mockSignIn,
    signUp: mockSignUp,
    resetPassword: mockResetPassword,
    signInWithGitHub: mockSignInWithGitHub,
    signInWithGoogle: mockSignInWithGoogle,
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
    mockSignInWithGoogle.mockResolvedValue({ error: null });
  });

  describe('modal visibility', () => {
    it('should render when open is true', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    });

    it('should not render when open is false', () => {
      render(<AuthModal {...defaultProps} open={false} />);

      expect(screen.queryByText('Welcome Back')).not.toBeInTheDocument();
    });
  });

  describe('tabs', () => {
    it('should render Sign In tab', () => {
      render(<AuthModal {...defaultProps} />);

      // Both tab and submit button have "Sign In" text
      const signInButtons = screen.getAllByRole('button', { name: /Sign In/i });
      expect(signInButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('should render Sign Up tab', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Sign Up/i })).toBeInTheDocument();
    });

    it('should render Reset Password tab', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Reset Password/i })).toBeInTheDocument();
    });

    it('should start on Sign In tab by default', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByText('Welcome Back')).toBeInTheDocument();
      expect(screen.getByText('Sign in to access your analyses')).toBeInTheDocument();
    });

    it('should start on Sign Up tab when initialTab is 1', () => {
      render(<AuthModal {...defaultProps} initialTab={1} />);

      // Check for subtitle which is unique to the Sign Up tab
      expect(screen.getByText('Join to save and manage your analyses')).toBeInTheDocument();
    });

    it('should switch to Sign Up tab when clicked', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      // Click the Sign Up tab button
      await user.click(screen.getByRole('button', { name: /Sign Up/i }));

      // Check for subtitle which is unique to the Sign Up tab
      expect(screen.getByText('Join to save and manage your analyses')).toBeInTheDocument();
    });
  });

  describe('Sign In form', () => {
    // Helper to get the submit button (type="submit")
    const getSubmitButton = () => {
      const buttons = screen.getAllByRole('button');
      return buttons.find(btn => btn.getAttribute('type') === 'submit');
    };

    it('should render email input', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    });

    it('should render password input', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    });

    it('should render Sign In submit button', () => {
      render(<AuthModal {...defaultProps} />);

      const submitButton = getSubmitButton();
      expect(submitButton).toBeInTheDocument();
      expect(submitButton).toHaveTextContent('Sign In');
    });

    it('should call signIn when form is submitted', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');

      const submitButton = getSubmitButton();
      await user.click(submitButton!);

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should close modal on successful sign in', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} onClose={onClose} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');

      const submitButton = getSubmitButton();
      await user.click(submitButton!);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('should show error message on sign in failure', async () => {
      mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpassword');

      const submitButton = getSubmitButton();
      await user.click(submitButton!);

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });
    });
  });

  describe('Sign Up form', () => {
    it('should render Full Name input on Sign Up tab', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      const tabs = screen.getAllByRole('button', { name: /Sign Up/i });
      await user.click(tabs[0]);

      expect(screen.getByPlaceholderText('John Doe')).toBeInTheDocument();
    });

    it('should call signUp when Sign Up form is submitted', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} initialTab={1} />);

      await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
      await user.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(mockSignUp).toHaveBeenCalledWith('test@example.com', 'password123', 'Test User');
      });
    });

    it('should show success message on successful sign up', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} initialTab={1} />);

      await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
      await user.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(screen.getByText(/Check your email for confirmation/i)).toBeInTheDocument();
      });
    });

    it('should show error message on sign up failure', async () => {
      mockSignUp.mockResolvedValue({ error: { message: 'Email already exists' } });

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} initialTab={1} />);

      await user.type(screen.getByPlaceholderText('John Doe'), 'Test User');
      await user.type(screen.getByPlaceholderText('you@example.com'), 'existing@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');
      await user.click(screen.getByRole('button', { name: /Create Account/i }));

      await waitFor(() => {
        expect(screen.getByText('Email already exists')).toBeInTheDocument();
      });
    });
  });

  describe('Reset Password form', () => {
    it('should only render email input on Reset Password tab', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Reset Password/i }));

      expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
      expect(screen.queryByPlaceholderText('••••••••')).not.toBeInTheDocument();
    });

    it('should call resetPassword when form is submitted', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} initialTab={2} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /Send Reset Link/i }));

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
      });
    });

    it('should show success message on successful reset', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} initialTab={2} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: /Send Reset Link/i }));

      await waitFor(() => {
        expect(screen.getByText(/Password reset email sent/i)).toBeInTheDocument();
      });
    });
  });

  describe('GitHub Sign In', () => {
    it('should render GitHub sign in button on Sign In tab', () => {
      render(<AuthModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /GitHub/i })).toBeInTheDocument();
    });

    it('should render GitHub sign in button on Sign Up tab', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      const tabs = screen.getAllByRole('button', { name: /Sign Up/i });
      await user.click(tabs[0]);

      expect(screen.getByRole('button', { name: /GitHub/i })).toBeInTheDocument();
    });

    it('should not render GitHub sign in button on Reset Password tab', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Reset Password/i }));

      expect(screen.queryByRole('button', { name: /GitHub/i })).not.toBeInTheDocument();
    });

    it('should call signInWithGitHub when GitHub button is clicked', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /GitHub/i }));

      await waitFor(() => {
        expect(mockSignInWithGitHub).toHaveBeenCalled();
      });
    });

    it('should show error message on GitHub sign in failure', async () => {
      mockSignInWithGitHub.mockResolvedValue({ error: { message: 'OAuth error' } });

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /GitHub/i }));

      await waitFor(() => {
        expect(screen.getByText('OAuth error')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    // Helper to get the submit button (type="submit")
    const getSubmitButton = () => {
      const buttons = screen.getAllByRole('button');
      return buttons.find(btn => btn.getAttribute('type') === 'submit');
    };

    it('should show loading indicator when signing in', async () => {
      mockSignIn.mockImplementation(() => new Promise(() => {})); // Never resolves

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');

      const submitButton = getSubmitButton();
      await user.click(submitButton!);

      // The button should show loading state with "Please wait..."
      await waitFor(() => {
        expect(screen.getByText('Please wait...')).toBeInTheDocument();
      });
    });

    it('should disable submit button when loading', async () => {
      mockSignIn.mockImplementation(() => new Promise(() => {}));

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');

      const submitButton = getSubmitButton();
      await user.click(submitButton!);

      await waitFor(() => {
        const loadingButton = screen.getByRole('button', { name: /Please wait/i });
        expect(loadingButton).toBeDisabled();
      });
    });
  });

  describe('form reset on tab change', () => {
    // Helper to get the submit button (type="submit")
    const getSubmitButton = () => {
      const buttons = screen.getAllByRole('button');
      return buttons.find(btn => btn.getAttribute('type') === 'submit');
    };

    it('should clear form fields when switching tabs', async () => {
      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');

      await user.click(screen.getByRole('button', { name: /Sign Up/i }));

      expect(screen.getByPlaceholderText('you@example.com')).toHaveValue('');
    });

    it('should clear error messages when switching tabs', async () => {
      mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } });

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'wrongpassword');

      const submitButton = getSubmitButton();
      await user.click(submitButton!);

      await waitFor(() => {
        expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /Sign Up/i }));

      expect(screen.queryByText('Invalid credentials')).not.toBeInTheDocument();
    });
  });

  describe('exception handling', () => {
    // Helper to get the submit button (type="submit")
    const getSubmitButton = () => {
      const buttons = screen.getAllByRole('button');
      return buttons.find(btn => btn.getAttribute('type') === 'submit');
    };

    it('should show generic error message on exception', async () => {
      mockSignIn.mockRejectedValue(new Error('Network error'));

      const user = userEvent.setup();
      render(<AuthModal {...defaultProps} />);

      await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
      await user.type(screen.getByPlaceholderText('••••••••'), 'password123');

      const submitButton = getSubmitButton();
      await user.click(submitButton!);

      await waitFor(() => {
        expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
      });
    });
  });
});
