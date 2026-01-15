import { describe, it, expect } from 'vitest';
import { render, screen } from '../../test/test-utils';
import SummaryDisplay from '../SummaryDisplay';
import type { CodebaseSummary } from '../../types';

const mockSummary: CodebaseSummary = {
  project_type: 'web_app',
  primary_purpose: 'A web application for visualizing codebase architecture and dependencies.',
  tech_stack: {
    languages: ['TypeScript', 'Python'],
    frameworks: ['React', 'FastAPI'],
    key_patterns: ['Component-based UI', 'REST API', 'Hooks'],
  },
  architecture_summary:
    'Frontend React application with Python backend API. Uses React Flow for visualization.',
  key_modules: [
    { name: 'Visualization', purpose: 'Renders interactive dependency graphs' },
    { name: 'Analysis', purpose: 'Parses codebases and extracts dependencies' },
    { name: 'Authentication', purpose: 'Handles user authentication via Supabase' },
  ],
  notable_aspects: [
    'Uses LLM for intelligent file categorization',
    'Supports both local and GitHub repository analysis',
    'Interactive graph visualization with React Flow',
  ],
  complexity_assessment: {
    level: 'moderate',
    reasoning: 'Medium-sized codebase with clear separation of concerns but multiple integrations.',
  },
};

describe('SummaryDisplay', () => {
  describe('project type', () => {
    it('should display web app project type', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Web Application')).toBeInTheDocument();
    });

    it('should display API project type', () => {
      const apiSummary = { ...mockSummary, project_type: 'api' as const };
      render(<SummaryDisplay summary={apiSummary} />);

      expect(screen.getByText('API')).toBeInTheDocument();
    });

    it('should display Library project type', () => {
      const libSummary = { ...mockSummary, project_type: 'library' as const };
      render(<SummaryDisplay summary={libSummary} />);

      expect(screen.getByText('Library')).toBeInTheDocument();
    });

    it('should display CLI project type', () => {
      const cliSummary = { ...mockSummary, project_type: 'cli' as const };
      render(<SummaryDisplay summary={cliSummary} />);

      expect(screen.getByText('CLI Tool')).toBeInTheDocument();
    });

    it('should display Monorepo project type', () => {
      const monoSummary = { ...mockSummary, project_type: 'monorepo' as const };
      render(<SummaryDisplay summary={monoSummary} />);

      expect(screen.getByText('Monorepo')).toBeInTheDocument();
    });

    it('should display Mobile App project type', () => {
      const mobileSummary = { ...mockSummary, project_type: 'mobile_app' as const };
      render(<SummaryDisplay summary={mobileSummary} />);

      expect(screen.getByText('Mobile App')).toBeInTheDocument();
    });

    it('should handle unknown project type', () => {
      const unknownSummary = { ...mockSummary, project_type: 'unknown' as const };
      render(<SummaryDisplay summary={unknownSummary} />);

      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });
  });

  describe('primary purpose', () => {
    it('should display primary purpose', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(
        screen.getByText(/A web application for visualizing codebase architecture/i)
      ).toBeInTheDocument();
    });
  });

  describe('tech stack', () => {
    it('should display tech stack heading', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Tech Stack')).toBeInTheDocument();
    });

    it('should display languages', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('TypeScript')).toBeInTheDocument();
      expect(screen.getByText('Python')).toBeInTheDocument();
    });

    it('should display frameworks', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('React')).toBeInTheDocument();
      expect(screen.getByText('FastAPI')).toBeInTheDocument();
    });

    it('should display key patterns', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Component-based UI')).toBeInTheDocument();
      expect(screen.getByText('REST API')).toBeInTheDocument();
      expect(screen.getByText('Hooks')).toBeInTheDocument();
    });

    it('should not display languages section when empty', () => {
      const noLangSummary = {
        ...mockSummary,
        tech_stack: { ...mockSummary.tech_stack, languages: [] },
      };
      render(<SummaryDisplay summary={noLangSummary} />);

      expect(screen.queryByText('Languages:')).not.toBeInTheDocument();
    });

    it('should not display frameworks section when empty', () => {
      const noFrameworkSummary = {
        ...mockSummary,
        tech_stack: { ...mockSummary.tech_stack, frameworks: [] },
      };
      render(<SummaryDisplay summary={noFrameworkSummary} />);

      expect(screen.queryByText('Frameworks:')).not.toBeInTheDocument();
    });

    it('should not display patterns section when empty', () => {
      const noPatternSummary = {
        ...mockSummary,
        tech_stack: { ...mockSummary.tech_stack, key_patterns: [] },
      };
      render(<SummaryDisplay summary={noPatternSummary} />);

      expect(screen.queryByText('Patterns:')).not.toBeInTheDocument();
    });
  });

  describe('architecture', () => {
    it('should display architecture heading', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Architecture')).toBeInTheDocument();
    });

    it('should display architecture summary', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(
        screen.getByText(/Frontend React application with Python backend API/i)
      ).toBeInTheDocument();
    });
  });

  describe('complexity assessment', () => {
    it('should display simple complexity', () => {
      const simpleSummary = {
        ...mockSummary,
        complexity_assessment: {
          level: 'simple' as const,
          reasoning: 'Small, straightforward codebase',
        },
      };
      render(<SummaryDisplay summary={simpleSummary} />);

      expect(screen.getByText('Simple')).toBeInTheDocument();
    });

    it('should display moderate complexity', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Moderate')).toBeInTheDocument();
    });

    it('should display complex complexity', () => {
      const complexSummary = {
        ...mockSummary,
        complexity_assessment: {
          level: 'complex' as const,
          reasoning: 'Large, complex codebase with many integrations',
        },
      };
      render(<SummaryDisplay summary={complexSummary} />);

      expect(screen.getByText('Complex')).toBeInTheDocument();
    });

    it('should display complexity reasoning', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(
        screen.getByText(/Medium-sized codebase with clear separation of concerns/i)
      ).toBeInTheDocument();
    });

    it('should have green styling for simple complexity', () => {
      const simpleSummary = {
        ...mockSummary,
        complexity_assessment: {
          level: 'simple' as const,
          reasoning: 'Simple codebase',
        },
      };
      render(<SummaryDisplay summary={simpleSummary} />);

      const badge = screen.getByText('Simple').closest('span');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-700');
    });

    it('should have yellow styling for moderate complexity', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      const badge = screen.getByText('Moderate').closest('span');
      expect(badge).toHaveClass('bg-yellow-100');
      expect(badge).toHaveClass('text-yellow-700');
    });

    it('should have orange styling for complex complexity', () => {
      const complexSummary = {
        ...mockSummary,
        complexity_assessment: {
          level: 'complex' as const,
          reasoning: 'Complex codebase',
        },
      };
      render(<SummaryDisplay summary={complexSummary} />);

      const badge = screen.getByText('Complex').closest('span');
      expect(badge).toHaveClass('bg-orange-100');
      expect(badge).toHaveClass('text-orange-700');
    });
  });

  describe('key modules', () => {
    it('should display key modules heading', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Key Modules')).toBeInTheDocument();
    });

    it('should display all modules', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Visualization')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
      expect(screen.getByText('Authentication')).toBeInTheDocument();
    });

    it('should display module purposes', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Renders interactive dependency graphs')).toBeInTheDocument();
      expect(screen.getByText('Parses codebases and extracts dependencies')).toBeInTheDocument();
      expect(screen.getByText('Handles user authentication via Supabase')).toBeInTheDocument();
    });

    it('should not display key modules section when empty', () => {
      const noModulesSummary = { ...mockSummary, key_modules: [] };
      render(<SummaryDisplay summary={noModulesSummary} />);

      expect(screen.queryByText('Key Modules')).not.toBeInTheDocument();
    });
  });

  describe('notable aspects', () => {
    it('should display notable aspects heading', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Notable Aspects')).toBeInTheDocument();
    });

    it('should display all notable aspects', () => {
      render(<SummaryDisplay summary={mockSummary} />);

      expect(screen.getByText('Uses LLM for intelligent file categorization')).toBeInTheDocument();
      expect(
        screen.getByText('Supports both local and GitHub repository analysis')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Interactive graph visualization with React Flow')
      ).toBeInTheDocument();
    });

    it('should not display notable aspects section when empty', () => {
      const noAspectsSummary = { ...mockSummary, notable_aspects: [] };
      render(<SummaryDisplay summary={noAspectsSummary} />);

      expect(screen.queryByText('Notable Aspects')).not.toBeInTheDocument();
    });
  });
});
