import { useState } from 'react';
import { FolderOpen, Play, Loader2, AlertCircle, GitBranch } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import GitHubRepoForm from './GitHubRepoForm';
import { AnalysisProgressBar } from './progress';
import type { GitHubRepoInfo, AnalysisStatusResponse } from '../types';

export type AnalyzeMode = 'local' | 'github';

export interface LocalAnalyzeRequest {
  directory_path: string;
  include_node_modules: boolean;
  max_depth?: number;
}

export interface GitHubAnalyzeRequest extends GitHubRepoInfo {
  include_node_modules?: boolean;
  max_depth?: number;
}

export interface AnalyzeSectionProps {
  /** Whether an analysis is currently in progress */
  isLoading: boolean;
  /** Current analysis status for progress display */
  status: AnalysisStatusResponse | null;
  /** Error message if analysis failed */
  error: string | null;
  /** Current authenticated user (for GitHub features) */
  user: User | null;
  /** Callback when local directory analysis is requested */
  onAnalyzeLocal: (request: LocalAnalyzeRequest) => void | Promise<void>;
  /** Callback when GitHub repo analysis is requested */
  onAnalyzeGitHub: (request: GitHubAnalyzeRequest) => void | Promise<void>;
  /** Callback to open auth modal (tab: 0=SignIn, 1=SignUp) */
  onOpenAuthModal: (tab: number) => void;
  /** Optional: Custom background component */
  BackgroundComponent?: React.ComponentType;
}

/**
 * AnalyzeSection - Independent component for the codebase analysis form
 *
 * Features:
 * - Tab switching between Local Directory and GitHub Repository modes
 * - Local directory path input with options
 * - GitHub repository selection (via GitHubRepoForm)
 * - Progress display during analysis
 * - Error display on failure
 * - Customizable background
 */
export default function AnalyzeSection({
  isLoading,
  status,
  error,
  user,
  onAnalyzeLocal,
  onAnalyzeGitHub,
  onOpenAuthModal
}: AnalyzeSectionProps) {
  // Local form state
  const [analyzeMode, setAnalyzeMode] = useState<AnalyzeMode>('local');
  const [directoryPath, setDirectoryPath] = useState('');
  const [includeNodeModules, setIncludeNodeModules] = useState(false);
  const [maxDepth, setMaxDepth] = useState<number | null>(null);

  const handleLocalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directoryPath.trim()) return;

    onAnalyzeLocal({
      directory_path: directoryPath.trim(),
      include_node_modules: includeNodeModules,
      max_depth: maxDepth ?? undefined,
    });
  };

  const handleGitHubAnalyze = async (repoData: GitHubRepoInfo & { include_node_modules?: boolean; max_depth?: number }) => {
    await onAnalyzeGitHub(repoData);
  };

  return (
    <section id="analyze" className="relative py-20 md:py-32 px-4">
      {/* Animated background */}
      {/* <BackgroundComponent /> */}
      <div className="relative max-w-2xl mx-auto">
        <div className="bg-white rounded-[2rem] p-8 md:p-12 shadow-lg shadow-black border border-gray-400">
          {/* Header */}
          <div className="text-center mb-10">
            <span className="text-yellow-400 font-semibold text-md uppercase tracking-wider">
              Get Started
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mt-4 mb-4">
              Analyze Your Codebase
            </h2>
            <p className="text-gray-600">
              Enter your project path or connect a GitHub repository
            </p>
          </div>

          {/* Tab Selector */}
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => setAnalyzeMode('local')}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all ${
                analyzeMode === 'local'
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <FolderOpen size={18} className="inline mr-2" />
              Local Directory
            </button>
            <button
              onClick={() => setAnalyzeMode('github')}
              className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all ${
                analyzeMode === 'github'
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <GitBranch size={18} className="inline mr-2" />
              GitHub Repository
            </button>
          </div>

          {/* Conditional Form Rendering */}
          {analyzeMode === 'local' ? (
            <form onSubmit={handleLocalSubmit} className="space-y-6">
              {/* Directory Path Input */}
              <div>
                <label
                  htmlFor="directory"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Directory Path
                </label>
                <div className="relative">
                  <FolderOpen
                    size={20}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    id="directory"
                    value={directoryPath}
                    onChange={(e) => setDirectoryPath(e.target.value)}
                    placeholder="/path/to/your/project"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent transition-all"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Options */}
              <div className="flex flex-wrap gap-4 items-center">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeNodeModules}
                    onChange={(e) => setIncludeNodeModules(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-[#8FBCFA] focus:ring-[#8FBCFA]"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-gray-600">Include node_modules</span>
                </label>

                <div className="flex items-center gap-3">
                  <label htmlFor="maxDepth" className="text-sm text-gray-600">
                    Max depth:
                  </label>
                  <input
                    type="number"
                    id="maxDepth"
                    min="1"
                    max="20"
                    value={maxDepth ?? ''}
                    onChange={(e) =>
                      setMaxDepth(e.target.value ? parseInt(e.target.value, 10) : null)
                    }
                    placeholder="∞"
                    className="w-20 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#8FBCFA] focus:border-transparent"
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !directoryPath.trim()}
                className="w-full py-4 px-6 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-xl flex items-center justify-center gap-3 transition-all hover:scale-[1.01]"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Play size={20} />
                    Start Analysis
                  </>
                )}
              </button>
            </form>
          ) : (
            <GitHubRepoForm
              onAnalyze={handleGitHubAnalyze}
              isLoading={isLoading}
              user={user}
              onOpenAuthModal={onOpenAuthModal}
              includeNodeModules={includeNodeModules}
              setIncludeNodeModules={setIncludeNodeModules}
              maxDepth={maxDepth}
              setMaxDepth={setMaxDepth}
            />
          )}

          {/* Animated Progress Bar */}
          {isLoading && (
            <AnalysisProgressBar
              status={status?.status ?? 'pending'}
              currentStep={status?.current_step ?? 'Starting analysis...'}
              totalFiles={status?.total_files ?? 0}
              isGitHub={analyzeMode === 'github'}
            />
          )}

          {/* Error */}
          {error && (
            <div className="mt-8 p-6 bg-red-50 border border-red-100 rounded-xl flex items-start gap-4">
              <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Analysis Failed</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Supported Languages */}
          <div className="mt-8 pt-8 border-t border-gray-100">
            <p className="text-sm text-gray-500 text-center">
              <span className="font-medium text-gray-700">Supported:</span> JavaScript,
              TypeScript, Python, Java, C#, Go, Rust, Swift
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
