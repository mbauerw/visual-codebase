import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import GitHubRepoForm from '../GitHubRepoForm';

// Mock GitHubRepoSelector
vi.mock('../github/GitHubRepoSelector', () => ({
  default: ({ onSelect, selectedRepo }: any) => (
    <div data-testid="repo-selector">
      <button
        onClick={() =>
          onSelect({ owner: 'testuser', repo: 'testrepo', branch: 'main', size_kb: 1000 })
        }
      >
        Select Test Repo
      </button>
      {selectedRepo && <span data-testid="selected-repo">Selected: {selectedRepo.owner}/{selectedRepo.repo}</span>}
    </div>
  ),
}));

describe('GitHubRepoForm', () => {
  const defaultProps = {
    onAnalyze: vi.fn(),
    isLoading: false,
    user: { id: 'test-user', email: 'test@example.com' } as any,
    onOpenAuthModal: vi.fn(),
    includeNodeModules: false,
    setIncludeNodeModules: vi.fn(),
    maxDepth: null,
    setMaxDepth: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unauthenticated state', () => {
    it('should show sign in gate when user is not logged in', () => {
      render(<GitHubRepoForm {...defaultProps} user={null} />);

      expect(screen.getByText(/Sign in to analyze GitHub repositories/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sign In to Continue/i })).toBeInTheDocument();
    });

    it('should call onOpenAuthModal when sign in button is clicked', async () => {
      const user = userEvent.setup();
      const onOpenAuthModal = vi.fn();

      render(<GitHubRepoForm {...defaultProps} user={null} onOpenAuthModal={onOpenAuthModal} />);

      await user.click(screen.getByRole('button', { name: /Sign In to Continue/i }));

      expect(onOpenAuthModal).toHaveBeenCalledWith(0);
    });
  });

  describe('mode switching', () => {
    it('should default to browse mode', () => {
      render(<GitHubRepoForm {...defaultProps} />);

      const browseButton = screen.getByRole('button', { name: /Browse Repositories/i });
      expect(browseButton).toHaveClass('bg-white');
    });

    it('should switch to URL mode when Enter URL is clicked', async () => {
      const user = userEvent.setup();
      render(<GitHubRepoForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Enter URL/i }));

      expect(screen.getByLabelText(/Repository URL/i)).toBeInTheDocument();
    });
  });

  describe('browse mode', () => {
    it('should render repository selector', () => {
      render(<GitHubRepoForm {...defaultProps} />);

      expect(screen.getByTestId('repo-selector')).toBeInTheDocument();
    });

    it('should disable submit button when no repo is selected', () => {
      render(<GitHubRepoForm {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Start Analysis/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when repo is selected', async () => {
      const user = userEvent.setup();
      render(<GitHubRepoForm {...defaultProps} />);

      await user.click(screen.getByText('Select Test Repo'));

      await waitFor(() => {
        expect(screen.getByTestId('selected-repo')).toHaveTextContent('Selected: testuser/testrepo');
      });

      const submitButton = screen.getByRole('button', { name: /Start Analysis/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('URL mode', () => {
    it('should render URL input', async () => {
      const user = userEvent.setup();
      render(<GitHubRepoForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Enter URL/i }));

      expect(screen.getByPlaceholderText(/github\.com\/owner\/repo/i)).toBeInTheDocument();
    });

    it('should parse owner/repo format', async () => {
      const user = userEvent.setup();
      render(<GitHubRepoForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Enter URL/i }));

      const input = screen.getByLabelText(/Repository URL/i);
      await user.type(input, 'facebook/react');

      await waitFor(() => {
        expect(screen.getByText(/Will analyze:/i)).toBeInTheDocument();
      });
    });

    it('should show validation error for invalid URL', async () => {
      const user = userEvent.setup();
      render(<GitHubRepoForm {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Enter URL/i }));

      const input = screen.getByLabelText(/Repository URL/i);
      await user.type(input, 'invalid-url');

      await waitFor(() => {
        expect(screen.getByText(/Please enter a valid GitHub repository URL/i)).toBeInTheDocument();
      });
    });
  });

  describe('options', () => {
    it('should render include_node_modules checkbox', () => {
      render(<GitHubRepoForm {...defaultProps} />);

      expect(screen.getByLabelText(/Include node_modules/i)).toBeInTheDocument();
    });

    it('should render max depth input', () => {
      render(<GitHubRepoForm {...defaultProps} />);

      expect(screen.getByLabelText(/Max depth:/i)).toBeInTheDocument();
    });

    it('should call setIncludeNodeModules when checkbox is toggled', async () => {
      const user = userEvent.setup();
      const setIncludeNodeModules = vi.fn();

      render(<GitHubRepoForm {...defaultProps} setIncludeNodeModules={setIncludeNodeModules} />);

      await user.click(screen.getByLabelText(/Include node_modules/i));

      expect(setIncludeNodeModules).toHaveBeenCalledWith(true);
    });
  });

  describe('form submission', () => {
    it('should call onAnalyze with correct data from browse mode', async () => {
      const user = userEvent.setup();
      const onAnalyze = vi.fn();

      render(<GitHubRepoForm {...defaultProps} onAnalyze={onAnalyze} />);

      // Select a repo
      await user.click(screen.getByText('Select Test Repo'));

      // Submit the form
      const submitButton = screen.getByRole('button', { name: /Start Analysis/i });
      await user.click(submitButton);

      expect(onAnalyze).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'testrepo',
        branch: 'main',
        size_kb: 1000,
        include_node_modules: false,
        max_depth: undefined,
      });
    });

    it('should show Analyzing... when loading', () => {
      render(<GitHubRepoForm {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('button', { name: /Analyzing.../i })).toBeInTheDocument();
    });
  });
});
