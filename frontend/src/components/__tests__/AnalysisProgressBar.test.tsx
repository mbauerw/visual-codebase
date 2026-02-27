import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '../../test/test-utils';
import { AnalysisProgressBar } from '../progress/AnalysisProgressBar';

vi.mock('../../hooks/useProgressAnimation', () => ({
  useProgressAnimation: vi.fn((status: string | null) => {
    const progressMap: Record<string, number> = {
      pending: 5,
      cloning: 10,
      parsing: 25,
      analyzing: 60,
      building_graph: 85,
      generating_summary: 95,
      completed: 100,
    };
    return {
      progress: status ? progressMap[status] ?? 0 : 0,
      isAnimating: false,
      reset: vi.fn(),
    };
  }),
}));

describe('AnalysisProgressBar', () => {
  describe('rendering', () => {
    it('should display current step text', () => {
      render(
        <AnalysisProgressBar
          status="parsing"
          currentStep="Parsing files..."
          totalFiles={42}
          isGitHub={false}
        />
      );

      expect(screen.getByText('Parsing files...')).toBeInTheDocument();
    });

    it('should show default text when no current step', () => {
      render(
        <AnalysisProgressBar
          status="pending"
          currentStep=""
          totalFiles={0}
          isGitHub={false}
        />
      );

      expect(screen.getByText('Starting Analysis...')).toBeInTheDocument();
    });

    it('should display file count when available', () => {
      render(
        <AnalysisProgressBar
          status="analyzing"
          currentStep="Analyzing..."
          totalFiles={100}
          isGitHub={false}
        />
      );

      expect(screen.getByText('100 files found')).toBeInTheDocument();
    });

    it('should not display file count when zero', () => {
      render(
        <AnalysisProgressBar
          status="pending"
          currentStep="Starting..."
          totalFiles={0}
          isGitHub={false}
        />
      );

      expect(screen.queryByText(/files found/)).not.toBeInTheDocument();
    });

    it('should display progress percentage', () => {
      render(
        <AnalysisProgressBar
          status="parsing"
          currentStep="Parsing..."
          totalFiles={10}
          isGitHub={false}
        />
      );

      expect(screen.getByText('25%')).toBeInTheDocument();
    });
  });

  describe('stage filtering for local analysis', () => {
    it('should show Parse, Analyze, Build, Summary stages', () => {
      render(
        <AnalysisProgressBar
          status="parsing"
          currentStep="Parsing..."
          totalFiles={10}
          isGitHub={false}
        />
      );

      expect(screen.getByText('Load')).toBeInTheDocument();
      expect(screen.getByText('Parse')).toBeInTheDocument();
      expect(screen.getByText('Analyze')).toBeInTheDocument();
      expect(screen.getByText('Build')).toBeInTheDocument();
      expect(screen.getByText('Summary')).toBeInTheDocument();
    });

    it('should not show Clone stage for local analysis', () => {
      render(
        <AnalysisProgressBar
          status="parsing"
          currentStep="Parsing..."
          totalFiles={10}
          isGitHub={false}
        />
      );

      expect(screen.queryByText('Clone')).not.toBeInTheDocument();
    });
  });

  describe('stage filtering for GitHub analysis', () => {
    it('should show Clone stage for GitHub analysis', () => {
      render(
        <AnalysisProgressBar
          status="cloning"
          currentStep="Cloning repository..."
          totalFiles={0}
          isGitHub={true}
        />
      );

      expect(screen.getByText('Clone')).toBeInTheDocument();
    });

    it('should not show Load stage for GitHub analysis', () => {
      render(
        <AnalysisProgressBar
          status="cloning"
          currentStep="Cloning..."
          totalFiles={0}
          isGitHub={true}
        />
      );

      expect(screen.queryByText('Load')).not.toBeInTheDocument();
    });
  });
});
