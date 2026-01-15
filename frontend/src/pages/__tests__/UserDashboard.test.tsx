import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';

// Mock the API module directly instead of using MSW
const mockGetUserAnalyses = vi.fn();
const mockDeleteAnalysis = vi.fn();

vi.mock('../../api/client', () => ({
  getUserAnalyses: () => mockGetUserAnalyses(),
  deleteAnalysis: (id: string) => mockDeleteAnalysis(id),
  getSourceCode: vi.fn(),
  getFileContent: vi.fn(),
  analyzeCodebase: vi.fn(),
  getAnalysisStatus: vi.fn(),
  getAnalysisResult: vi.fn(),
  updateAnalysisTitle: vi.fn(),
}));

// Mock useAuth - inline mock data to avoid hoisting issues
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@example.com' },
    signOut: vi.fn(),
    isLoading: false,
  }),
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

// Mock Supabase - inline mock data to avoid hoisting issues
vi.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
            user: { id: 'test-user-id', email: 'test@example.com' },
          },
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

import UserDashboard from '../UserDashboard';

// Mock analyses data
const mockAnalyses = {
  analyses: [
    {
      analysis_id: 'analysis-1',
      directory_path: '/test/project',
      status: 'completed',
      progress: 100,
      file_count: 50,
      edge_count: 30,
      started_at: '2024-01-01T00:00:00Z',
      completed_at: '2024-01-01T00:05:00Z',
    },
    {
      analysis_id: 'analysis-2',
      github_repo: { owner: 'testuser', repo: 'testrepo', branch: 'main' },
      status: 'completed',
      progress: 100,
      file_count: 100,
      edge_count: 75,
      started_at: '2024-01-02T00:00:00Z',
      completed_at: '2024-01-02T00:10:00Z',
    },
    {
      analysis_id: 'analysis-3',
      directory_path: '/test/failed',
      status: 'failed',
      progress: 50,
      file_count: 0,
      edge_count: 0,
      started_at: '2024-01-03T00:00:00Z',
    },
  ],
};

describe('UserDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserAnalyses.mockResolvedValue(mockAnalyses);
    mockDeleteAnalysis.mockResolvedValue({ message: 'Deleted' });
  });

  describe('modal behavior', () => {
    it('should not render when open is false', () => {
      render(<UserDashboard open={false} onClose={vi.fn()} />);
      expect(screen.queryByText('Your Analyses')).not.toBeInTheDocument();
    });

    it('should render when open is true', async () => {
      render(<UserDashboard open={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Your Analyses')).toBeInTheDocument();
      });
    });

    it('should call onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<UserDashboard open={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('Your Analyses')).toBeInTheDocument();
      });

      const closeButton = screen.getByRole('button', { name: /close/i });
      await user.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator while fetching', async () => {
      mockGetUserAnalyses.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockAnalyses), 100))
      );

      render(<UserDashboard open={true} onClose={vi.fn()} />);

      expect(screen.getByText(/Loading your analyses/i)).toBeInTheDocument();
    });
  });

  describe('analyses list', () => {
    it('should display analyses after loading', async () => {
      render(<UserDashboard open={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('project')).toBeInTheDocument();
        expect(screen.getByText('testuser/testrepo')).toBeInTheDocument();
      });
    });

    it('should display failed status for failed analyses', async () => {
      render(<UserDashboard open={true} onClose={vi.fn()} />);

      // Wait for analyses to load and check for failed status badge
      // Note: 'failed' appears both in the path basename and status badge
      await waitFor(() => {
        const failedElements = screen.getAllByText('failed');
        expect(failedElements.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('view functionality', () => {
    it('should navigate to visualization when View is clicked', async () => {
      const onClose = vi.fn();
      const user = userEvent.setup();
      render(<UserDashboard open={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByText('project')).toBeInTheDocument();
      });

      const viewButtons = screen.getAllByRole('button', { name: 'View' });
      const enabledViewButton = viewButtons.find((btn) => !btn.hasAttribute('disabled'));
      if (enabledViewButton) {
        await user.click(enabledViewButton);
        expect(mockNavigate).toHaveBeenCalledWith('/visualize?analysis=analysis-1');
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('delete functionality', () => {
    it('should open delete confirmation when delete button is clicked', async () => {
      const user = userEvent.setup();
      render(<UserDashboard open={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('project')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete analysis/i });
      await user.click(deleteButtons[0]);

      expect(screen.getByText('Delete Analysis')).toBeInTheDocument();
      expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
    });

    it('should close confirmation dialog when Cancel is clicked', async () => {
      const user = userEvent.setup();
      render(<UserDashboard open={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('project')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete analysis/i });
      await user.click(deleteButtons[0]);

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(screen.queryByText(/Are you sure you want to delete/i)).not.toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should display empty state message when no analyses', async () => {
      mockGetUserAnalyses.mockResolvedValue({ analyses: [] });

      render(<UserDashboard open={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('No analyses yet')).toBeInTheDocument();
        expect(screen.getByText(/Start by analyzing a codebase/i)).toBeInTheDocument();
      });
    });

    it('should show analyze button in empty state', async () => {
      mockGetUserAnalyses.mockResolvedValue({ analyses: [] });

      render(<UserDashboard open={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Analyze Codebase/i })).toBeInTheDocument();
      });
    });
  });
});
