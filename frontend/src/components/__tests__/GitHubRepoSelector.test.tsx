import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';
import GitHubRepoSelector from '../github/GitHubRepoSelector';
import { mockGitHubRepos } from '../../test/mocks/handlers';

// Mock useGitHubRepos hook
vi.mock('../../hooks/useGitHubRepos', () => ({
  useGitHubRepos: () => ({
    data: mockGitHubRepos,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

// Mock useOwnerRepos hook
vi.mock('../../hooks/useOwnerRepos', () => ({
  useOwnerRepos: () => ({
    data: mockGitHubRepos,
    isLoading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn(),
  }),
  OwnerRepoError: class OwnerRepoError extends Error {
    type: string;
    constructor(message: string, type: string) {
      super(message);
      this.type = type;
    }
  },
}));

describe('GitHubRepoSelector', () => {
  const defaultProps = {
    onSelect: vi.fn(),
    selectedRepo: undefined,
    externalOwner: undefined,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial rendering', () => {
    it('should render search input', () => {
      render(<GitHubRepoSelector {...defaultProps} />);

      expect(screen.getByPlaceholderText(/Search repositories/i)).toBeInTheDocument();
    });

    it('should render sort filter', () => {
      render(<GitHubRepoSelector {...defaultProps} />);

      expect(screen.getByDisplayValue(/Recently updated/i)).toBeInTheDocument();
    });

    it('should render repository list', async () => {
      render(<GitHubRepoSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('testuser/test-repo')).toBeInTheDocument();
        expect(screen.getByText('testuser/private-repo')).toBeInTheDocument();
      });
    });
  });

  describe('repository display', () => {
    it('should display repository description', async () => {
      render(<GitHubRepoSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('A test repository')).toBeInTheDocument();
      });
    });

    it('should display repository language', async () => {
      render(<GitHubRepoSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('TypeScript')).toBeInTheDocument();
      });
    });
  });

  describe('selection', () => {
    it('should call onSelect when repository is clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(<GitHubRepoSelector {...defaultProps} onSelect={onSelect} />);

      await waitFor(() => {
        expect(screen.getByText('testuser/test-repo')).toBeInTheDocument();
      });

      await user.click(screen.getByText('testuser/test-repo'));

      expect(onSelect).toHaveBeenCalledWith({
        owner: 'testuser',
        repo: 'test-repo',
        branch: 'main',
        size_kb: 1000,
      });
    });

    it('should highlight selected repository', async () => {
      render(
        <GitHubRepoSelector
          {...defaultProps}
          selectedRepo={{ owner: 'testuser', repo: 'test-repo' }}
        />
      );

      await waitFor(() => {
        const selectedRepo = screen.getByText('testuser/test-repo').closest('button');
        expect(selectedRepo).toHaveClass('border-gray-900');
      });
    });
  });

  describe('search functionality', () => {
    it('should filter repositories by search query', async () => {
      const user = userEvent.setup();
      render(<GitHubRepoSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/Search repositories/i);
      await user.type(searchInput, 'private');

      await waitFor(() => {
        expect(screen.getByText('testuser/private-repo')).toBeInTheDocument();
        expect(screen.queryByText('testuser/test-repo')).not.toBeInTheDocument();
      });
    });

    it('should show empty message when no results match', async () => {
      const user = userEvent.setup();
      render(<GitHubRepoSelector {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/Search repositories/i);
      await user.type(searchInput, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText(/No repositories match your search/i)).toBeInTheDocument();
      });
    });
  });

  describe('filters', () => {
    it('should update when sort filter changes', async () => {
      const user = userEvent.setup();
      render(<GitHubRepoSelector {...defaultProps} />);

      const sortSelect = screen.getByDisplayValue(/Recently updated/i);
      await user.selectOptions(sortSelect, 'created');

      expect(sortSelect).toHaveValue('created');
    });
  });

  describe('pagination', () => {
    it('should render pagination controls', async () => {
      render(<GitHubRepoSelector {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Page 1')).toBeInTheDocument();
      });
    });
  });
});
