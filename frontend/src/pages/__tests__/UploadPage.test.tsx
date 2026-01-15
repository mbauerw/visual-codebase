import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import userEvent from '@testing-library/user-event';

// Mock motion/react BEFORE importing UploadPage to prevent useInView hook issues
// The component imports from "motion/react" (motion v11+ pattern)
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <section {...props}>{children}</section>,
    span: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <span {...props}>{children}</span>,
    nav: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <nav {...props}>{children}</nav>,
    button: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <button {...props}>{children}</button>,
    p: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <p {...props}>{children}</p>,
    h1: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <h1 {...props}>{children}</h1>,
    h2: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <h2 {...props}>{children}</h2>,
    h3: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <h3 {...props}>{children}</h3>,
    ul: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <ul {...props}>{children}</ul>,
    li: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <li {...props}>{children}</li>,
    a: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <a {...props}>{children}</a>,
    header: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <header {...props}>{children}</header>,
    footer: ({ children, ...props }: { children?: React.ReactNode;[key: string]: unknown }) => <footer {...props}>{children}</footer>,
    img: ({ ...props }: { [key: string]: unknown }) => <img {...props} />,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useInView: () => true,
  useAnimation: () => ({
    start: vi.fn(),
    set: vi.fn(),
  }),
  useScroll: () => ({
    scrollY: { get: () => 0 },
    scrollYProgress: { get: () => 0 },
  }),
  useTransform: () => 0,
  useMotionValue: () => ({ get: () => 0, set: vi.fn() }),
  useSpring: () => ({ get: () => 0 }),
}));

import UploadPage from '../UploadPage';

// Mock the hooks at module level
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    signOut: vi.fn(),
    isLoading: false,
  })),
}));

vi.mock('../../hooks/useAnalysis', () => ({
  useAnalysis: vi.fn(() => ({
    isLoading: false,
    status: null,
    result: null,
    error: null,
    analyze: vi.fn(),
    reset: vi.fn(),
  })),
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Supabase
vi.mock('../../config/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      signInWithOAuth: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}));

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial rendering', () => {
    it('should render the main heading', () => {
      render(<UploadPage />);
      // The heading appears in both header logo and hero section
      expect(screen.getAllByText('codebase-remap').length).toBeGreaterThan(0);
    });

    it('should render the hero section with description', () => {
      render(<UploadPage />);
      expect(screen.getByText(/Visualize your codebase architecture/i)).toBeInTheDocument();
    });

    it('should render navigation links', () => {
      render(<UploadPage />);
      // Navigation links appear in both desktop and mobile menus, so use getAllByText
      expect(screen.getAllByText('Features').length).toBeGreaterThan(0);
      expect(screen.getAllByText('How it Works').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Analyze').length).toBeGreaterThan(0);
    });

    it('should render the analyze section with tab buttons', () => {
      render(<UploadPage />);
      expect(screen.getByText('Local Directory')).toBeInTheDocument();
      expect(screen.getByText('GitHub Repository')).toBeInTheDocument();
    });

    it('should render auth buttons when not logged in', () => {
      render(<UploadPage />);
      expect(screen.getByText('Log In')).toBeInTheDocument();
      expect(screen.getByText('Sign Up')).toBeInTheDocument();
    });
  });

  describe('mode switching', () => {
    it('should default to local mode', () => {
      render(<UploadPage />);
      const localButton = screen.getByRole('button', { name: /Local Directory/i });
      expect(localButton).toHaveClass('bg-gray-900');
    });

    it('should switch to GitHub mode when GitHub tab is clicked', async () => {
      const user = userEvent.setup();
      render(<UploadPage />);

      const githubButton = screen.getByRole('button', { name: /GitHub Repository/i });
      await user.click(githubButton);

      expect(githubButton).toHaveClass('bg-gray-900');
    });

    it('should switch back to local mode when Local tab is clicked', async () => {
      const user = userEvent.setup();
      render(<UploadPage />);

      // First switch to GitHub
      await user.click(screen.getByRole('button', { name: /GitHub Repository/i }));

      // Then switch back to local
      const localButton = screen.getByRole('button', { name: /Local Directory/i });
      await user.click(localButton);

      expect(localButton).toHaveClass('bg-gray-900');
    });
  });

  describe('local directory form', () => {
    it('should render directory path input', () => {
      render(<UploadPage />);
      expect(screen.getByPlaceholderText('/path/to/your/project')).toBeInTheDocument();
    });

    it('should render include node_modules checkbox', () => {
      render(<UploadPage />);
      expect(screen.getByLabelText(/Include node_modules/i)).toBeInTheDocument();
    });

    it('should render max depth input', () => {
      render(<UploadPage />);
      expect(screen.getByLabelText(/Max depth:/i)).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<UploadPage />);
      expect(screen.getByRole('button', { name: /Start Analysis/i })).toBeInTheDocument();
    });

    it('should disable submit button when input is empty', () => {
      render(<UploadPage />);
      const submitButton = screen.getByRole('button', { name: /Start Analysis/i });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when input has value', async () => {
      const user = userEvent.setup();
      render(<UploadPage />);

      const input = screen.getByPlaceholderText('/path/to/your/project');
      await user.type(input, '/test/path');

      const submitButton = screen.getByRole('button', { name: /Start Analysis/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should allow toggling include_node_modules checkbox', async () => {
      const user = userEvent.setup();
      render(<UploadPage />);

      const checkbox = screen.getByLabelText(/Include node_modules/i);
      expect(checkbox).not.toBeChecked();

      await user.click(checkbox);
      expect(checkbox).toBeChecked();
    });

    it('should allow setting max depth', async () => {
      const user = userEvent.setup();
      render(<UploadPage />);

      const maxDepthInput = screen.getByLabelText(/Max depth:/i);
      await user.type(maxDepthInput, '5');

      expect(maxDepthInput).toHaveValue(5);
    });
  });

  describe('supported languages info', () => {
    it('should display supported languages', () => {
      render(<UploadPage />);
      expect(screen.getByText(/JavaScript \(\.js, \.jsx\), TypeScript \(\.ts, \.tsx\), Python \(\.py\)/i)).toBeInTheDocument();
    });
  });

  describe('navigation scroll', () => {
    it('should scroll to analyze section when CTA is clicked', async () => {
      const user = userEvent.setup();
      const mockScrollIntoView = vi.fn();

      // Mock scrollIntoView
      Element.prototype.scrollIntoView = mockScrollIntoView;

      render(<UploadPage />);

      const ctaButton = screen.getByRole('button', { name: /Analyze Your Codebase/i });
      await user.click(ctaButton);

      expect(mockScrollIntoView).toHaveBeenCalled();
    });
  });
});

describe('UploadPage form submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call analyze when form is submitted', async () => {
    const mockAnalyze = vi.fn();

    // Override the mock for this test
    const useAnalysis = await import('../../hooks/useAnalysis');
    vi.mocked(useAnalysis.useAnalysis).mockReturnValue({
      isLoading: false,
      status: null,
      result: null,
      error: null,
      analyze: mockAnalyze,
      reset: vi.fn(),
    });

    const user = userEvent.setup();
    render(<UploadPage />);

    const input = screen.getByPlaceholderText('/path/to/your/project');
    await user.type(input, '/test/project');

    const submitButton = screen.getByRole('button', { name: /Start Analysis/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalled();
    });
  });
});
