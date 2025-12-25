import React, { useState, useEffect } from 'react';
import { GitBranch, AlertCircle } from 'lucide-react';
import { GitHubRepoInfo } from '../types';
import { User } from '@supabase/supabase-js';

interface GitHubRepoFormProps {
  onAnalyze: (repoData: GitHubRepoInfo & { include_node_modules?: boolean; max_depth?: number }) => Promise<void>;
  isLoading: boolean;
  user: User | null;
  onOpenAuthModal: (tab: number) => void;
  includeNodeModules: boolean;
  setIncludeNodeModules: (value: boolean) => void;
  maxDepth: number | null;
  setMaxDepth: (value: number | null) => void;
}

const GITHUB_URL_REGEX = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?(?:\/tree\/([^\/]+)(?:\/(.*))?)?$/;

function parseGitHubUrl(url: string): GitHubRepoInfo | null {
  const trimmedUrl = url.trim();

  // Try full URL pattern first
  const match = trimmedUrl.match(GITHUB_URL_REGEX);
  if (match) {
    return {
      owner: match[1],
      repo: match[2].replace(/\.git$/, ''),
      branch: match[3] || undefined,
      path: match[4] || undefined,
    };
  }

  // Try simple owner/repo format
  const simpleMatch = trimmedUrl.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (simpleMatch) {
    return {
      owner: simpleMatch[1],
      repo: simpleMatch[2],
    };
  }

  return null;
}

export default function GitHubRepoForm({
  onAnalyze,
  isLoading,
  user,
  onOpenAuthModal,
  includeNodeModules,
  setIncludeNodeModules,
  maxDepth,
  setMaxDepth,
}: GitHubRepoFormProps) {
  const [repoUrl, setRepoUrl] = useState('');
  const [parsedRepo, setParsedRepo] = useState<GitHubRepoInfo | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Parse URL when it changes
  useEffect(() => {
    if (!repoUrl.trim()) {
      setParsedRepo(null);
      setValidationError(null);
      return;
    }

    const parsed = parseGitHubUrl(repoUrl);
    if (parsed) {
      setParsedRepo(parsed);
      setValidationError(null);
    } else {
      setParsedRepo(null);
      setValidationError('Please enter a valid GitHub repository URL or owner/repo format');
    }
  }, [repoUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!parsedRepo) {
      setValidationError('Please enter a valid repository URL');
      return;
    }

    await onAnalyze({
      ...parsedRepo,
      include_node_modules: includeNodeModules,
      max_depth: maxDepth ?? undefined,
    });
  };

  // Show auth gate if user is not logged in
  if (!user) {
    return (
      <div className="text-center py-12">
        <GitBranch size={48} className="mx-auto text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">
          Sign in to analyze GitHub repositories
        </h3>
        <p className="text-gray-500 mb-6">
          Connect your account to analyze public and private repositories
        </p>
        <button
          onClick={() => onOpenAuthModal(0)}
          className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          Sign In to Continue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Repository URL Input */}
      <div>
        <label htmlFor="repo-url" className="block text-sm font-medium text-gray-700 mb-2">
          Repository URL
        </label>
        <input
          id="repo-url"
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="https://github.com/owner/repo or owner/repo"
          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-all ${
            validationError ? 'border-red-300' : 'border-gray-200'
          }`}
          disabled={isLoading}
        />
        {validationError && (
          <div className="mt-2 flex items-start gap-2 text-red-600 text-sm">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
        {parsedRepo && !validationError && (
          <div className="mt-2 text-sm text-gray-600">
            Will analyze: <span className="font-medium">{parsedRepo.owner}/{parsedRepo.repo}</span>
            {parsedRepo.branch && <span className="text-gray-500"> (branch: {parsedRepo.branch})</span>}
            {parsedRepo.path && <span className="text-gray-500"> (path: {parsedRepo.path})</span>}
          </div>
        )}
      </div>

      {/* Options Row */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeNodeModules}
            onChange={(e) => setIncludeNodeModules(e.target.checked)}
            disabled={isLoading}
            className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
          />
          <span className="text-sm text-gray-700">Include node_modules</span>
        </label>

        <div className="flex items-center gap-2">
          <label htmlFor="max-depth" className="text-sm text-gray-700">
            Max depth:
          </label>
          <input
            id="max-depth"
            type="number"
            min="1"
            value={maxDepth ?? ''}
            onChange={(e) => setMaxDepth(e.target.value ? parseInt(e.target.value, 10) : null)}
            placeholder="∞"
            disabled={isLoading}
            className="w-20 px-3 py-1.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !parsedRepo || !!validationError}
        className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-colors"
      >
        {isLoading ? 'Analyzing...' : 'Start Analysis'}
      </button>
    </form>
  );
}
