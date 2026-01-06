import React, { useState, useEffect } from 'react';
import { GitBranch, AlertCircle, Link2, List, Users, Search, X, HardDrive, Check } from 'lucide-react';
import { GitHubRepoInfo } from '../types';
import { User } from '@supabase/supabase-js';
import GitHubRepoSelector from './github/GitHubRepoSelector';

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

// Regex patterns for URL mode (repo URLs only)
const GITHUB_REPO_URL_REGEX = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\.git)?(?:\/tree\/([^\/]+)(?:\/(.*))?)?$/;
const SIMPLE_OWNER_REPO_REGEX = /^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/;

// Username validation for browse mode
const SIMPLE_OWNER_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/;

function isValidGitHubUsername(username: string): boolean {
  if (!username || username.length > 39) return false;
  if (username.includes('--')) return false;
  return SIMPLE_OWNER_REGEX.test(username);
}

// Format repository size from KB to human-readable format
function formatRepoSize(sizeKB: number): string {
  if (sizeKB === 0) return '< 1 KB';
  if (sizeKB < 1024) return `${sizeKB} KB`;
  const sizeMB = sizeKB / 1024;
  if (sizeMB < 1024) return `${sizeMB.toFixed(1)} MB`;
  const sizeGB = sizeMB / 1024;
  return `${sizeGB.toFixed(2)} GB`;
}

// Parse repo URL only (for URL mode)
function parseRepoUrl(url: string): GitHubRepoInfo | null {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  // Try full URL pattern (github.com/owner/repo)
  const repoUrlMatch = trimmedUrl.match(GITHUB_REPO_URL_REGEX);
  if (repoUrlMatch) {
    return {
      owner: repoUrlMatch[1],
      repo: repoUrlMatch[2].replace(/\.git$/, ''),
      branch: repoUrlMatch[3] || undefined,
      path: repoUrlMatch[4] || undefined,
    };
  }

  // Try simple owner/repo format
  const simpleRepoMatch = trimmedUrl.match(SIMPLE_OWNER_REPO_REGEX);
  if (simpleRepoMatch) {
    return {
      owner: simpleRepoMatch[1],
      repo: simpleRepoMatch[2],
    };
  }

  return null;
}

// Extract owner from various input formats (for browse mode)
function parseOwnerInput(input: string): string | null {
  const trimmedInput = input.trim();
  if (!trimmedInput) return null;

  // Try github.com/owner or github.com/owner/ URL format
  const ownerUrlRegex = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?)\/?$/;
  const ownerUrlMatch = trimmedInput.match(ownerUrlRegex);
  if (ownerUrlMatch) {
    return ownerUrlMatch[1];
  }

  // Try github.com/owner/repo format - extract just the owner
  const repoUrlMatch = trimmedInput.match(GITHUB_REPO_URL_REGEX);
  if (repoUrlMatch) {
    return repoUrlMatch[1];
  }

  // Try owner/repo format - extract just the owner
  const simpleRepoMatch = trimmedInput.match(SIMPLE_OWNER_REPO_REGEX);
  if (simpleRepoMatch) {
    return simpleRepoMatch[1];
  }

  // Try simple username
  if (isValidGitHubUsername(trimmedInput)) {
    return trimmedInput;
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
  const [inputMode, setInputMode] = useState<'url' | 'browse'>('browse');
  const [repoUrl, setRepoUrl] = useState('');
  const [parsedRepo, setParsedRepo] = useState<GitHubRepoInfo | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepoInfo | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Browse mode state
  const [ownerSearchInput, setOwnerSearchInput] = useState('');
  const [browseOwner, setBrowseOwner] = useState<string | null>(null);
  const [ownerSearchError, setOwnerSearchError] = useState<string | null>(null);

  // Parse repo URL when it changes (URL mode only)
  useEffect(() => {
    if (!repoUrl.trim()) {
      setParsedRepo(null);
      setValidationError(null);
      return;
    }

    const parsed = parseRepoUrl(repoUrl);
    if (parsed) {
      setParsedRepo(parsed);
      setValidationError(null);
    } else {
      setParsedRepo(null);
      setValidationError('Please enter a valid GitHub repository URL or owner/repo format');
    }
  }, [repoUrl]);

  // Handle owner search in browse mode
  const handleOwnerSearch = () => {
    const owner = parseOwnerInput(ownerSearchInput);
    if (owner) {
      setBrowseOwner(owner);
      setOwnerSearchError(null);
      setSelectedRepo(null);
    } else if (ownerSearchInput.trim()) {
      setOwnerSearchError('Please enter a valid GitHub username or URL');
    }
  };

  // Handle Enter key in owner search
  const handleOwnerSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleOwnerSearch();
    }
  };

  // Clear owner search and return to own repos
  const handleClearOwnerSearch = () => {
    setBrowseOwner(null);
    setOwnerSearchInput('');
    setOwnerSearchError(null);
    setSelectedRepo(null);
  };

  // Handle mode change
  const handleModeChange = (mode: 'url' | 'browse') => {
    setInputMode(mode);
    setSelectedRepo(null);
    setValidationError(null);
    // Don't clear browse owner when switching modes - preserve state
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const repoToAnalyze = inputMode === 'url' ? parsedRepo : selectedRepo;

    if (!repoToAnalyze) {
      setValidationError(
        inputMode === 'url'
          ? 'Please enter a valid repository URL'
          : 'Please select a repository'
      );
      return;
    }

    await onAnalyze({
      ...repoToAnalyze,
      include_node_modules: includeNodeModules,
      max_depth: maxDepth ?? undefined,
    });
  };

  const handleRepoSelect = (repo: GitHubRepoInfo) => {
    setSelectedRepo(repo);
    setValidationError(null);
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
      {/* Input Mode Selector */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => handleModeChange('browse')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
            inputMode === 'browse'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <List size={18} />
          Browse Repositories
        </button>
        <button
          type="button"
          onClick={() => handleModeChange('url')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md font-medium transition-all ${
            inputMode === 'url'
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Link2 size={18} />
          Enter URL
        </button>
      </div>

      {/* Browse Mode - Repository Selector */}
      {inputMode === 'browse' && (
        <div className="space-y-4">
          {/* Owner Search Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Browse repositories by owner
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Users size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={ownerSearchInput}
                  onChange={(e) => {
                    setOwnerSearchInput(e.target.value);
                    setOwnerSearchError(null);
                  }}
                  onKeyDown={handleOwnerSearchKeyDown}
                  placeholder="Enter username or GitHub URL (leave empty for your repos)"
                  className={`w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent ${
                    ownerSearchError ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
              </div>
              <button
                type="button"
                onClick={handleOwnerSearch}
                disabled={!ownerSearchInput.trim()}
                className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Search size={18} />
              </button>
            </div>
            {ownerSearchError && (
              <div className="mt-2 flex items-start gap-2 text-red-600 text-sm">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <span>{ownerSearchError}</span>
              </div>
            )}
          </div>

          {/* Current browsing context indicator */}
          {browseOwner ? (
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <Users size={18} />
                <span>
                  Browsing <span className="font-semibold">{browseOwner}</span>'s public repositories
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearOwnerSearch}
                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                <X size={16} />
                Back to my repos
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
              <Users size={18} />
              <span>Showing your repositories</span>
            </div>
          )}

          {/* Repository Selector */}
          <GitHubRepoSelector
            onSelect={handleRepoSelect}
            selectedRepo={selectedRepo ?? undefined}
            externalOwner={browseOwner ?? undefined}
          />

          {/* Selection Summary */}
          {selectedRepo && (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <Check size={18} />
                <span>
                  Selected: <span className="font-semibold">{selectedRepo.owner}/{selectedRepo.repo}</span>
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-green-700">
                {selectedRepo.branch && (
                  <span className="flex items-center gap-1">
                    <GitBranch size={14} />
                    {selectedRepo.branch}
                  </span>
                )}
                {selectedRepo.size_kb !== undefined && (
                  <span className="flex items-center gap-1">
                    <HardDrive size={14} />
                    {formatRepoSize(selectedRepo.size_kb)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL Mode - Repository URL Input */}
      {inputMode === 'url' && (
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
      )}

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
        disabled={
          isLoading ||
          (inputMode === 'url' && (!parsedRepo || !!validationError)) ||
          (inputMode === 'browse' && !selectedRepo)
        }
        className="w-full bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-xl transition-colors"
      >
        {isLoading ? 'Analyzing...' : 'Start Analysis'}
      </button>
    </form>
  );
}
