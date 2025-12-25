import { useState, useMemo } from 'react';
import { Search, Star, GitFork, Lock, Globe, Loader2, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGitHubRepos } from '../../hooks/useGitHubRepos';
import type { GitHubRepository, GitHubRepoInfo } from '../../types';

interface GitHubRepoSelectorProps {
  onSelect: (repo: GitHubRepoInfo) => void;
  selectedRepo?: GitHubRepoInfo;
}

export default function GitHubRepoSelector({ onSelect, selectedRepo }: GitHubRepoSelectorProps) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'public' | 'private'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'pushed' | 'full_name'>('updated');

  const { data, isLoading, error, isFetching } = useGitHubRepos({
    page,
    perPage: 10,
    sort: sortBy,
    direction: 'desc',
    type: typeFilter,
  });

  // Filter repositories based on search query
  const filteredRepos = useMemo(() => {
    if (!data?.repositories) return [];

    if (!searchQuery.trim()) return data.repositories;

    const query = searchQuery.toLowerCase();
    return data.repositories.filter(
      (repo) =>
        repo.name.toLowerCase().includes(query) ||
        repo.full_name.toLowerCase().includes(query) ||
        repo.description?.toLowerCase().includes(query)
    );
  }, [data?.repositories, searchQuery]);

  const handleSelectRepo = (repo: GitHubRepository) => {
    const repoInfo: GitHubRepoInfo = {
      owner: repo.owner.login,
      repo: repo.name,
      branch: repo.default_branch,
    };
    onSelect(repoInfo);
  };

  const isSelected = (repo: GitHubRepository) => {
    return (
      selectedRepo?.owner === repo.owner.login &&
      selectedRepo?.repo === repo.name
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertCircle size={48} className="mx-auto text-red-500 mb-3" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Failed to load repositories</h3>
        <p className="text-red-700 text-sm">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as 'all' | 'public' | 'private');
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          >
            <option value="all">All repositories</option>
            <option value="public">Public only</option>
            <option value="private">Private only</option>
          </select>

          {/* Sort Filter */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as 'updated' | 'created' | 'pushed' | 'full_name');
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
          >
            <option value="updated">Recently updated</option>
            <option value="created">Recently created</option>
            <option value="pushed">Recently pushed</option>
            <option value="full_name">Name</option>
          </select>
        </div>
      </div>

      {/* Repository List */}
      <div className="space-y-2 min-h-[400px]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 size={48} className="text-gray-400 animate-spin mb-3" />
            <p className="text-gray-600">Loading repositories...</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No repositories found</p>
          </div>
        ) : (
          <>
            {filteredRepos.map((repo) => (
              <button
                key={repo.id}
                onClick={() => handleSelectRepo(repo)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                  isSelected(repo)
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-400 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {repo.private ? (
                        <Lock size={14} className="text-gray-500 flex-shrink-0" />
                      ) : (
                        <Globe size={14} className="text-gray-500 flex-shrink-0" />
                      )}
                      <h3 className="font-semibold text-gray-900 truncate">
                        {repo.full_name}
                      </h3>
                    </div>

                    {repo.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                        {repo.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: getLanguageColor(repo.language) }}
                          />
                          {repo.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Star size={12} />
                        {repo.stargazers_count}
                      </span>
                      <span className="flex items-center gap-1">
                        <GitFork size={12} />
                        {repo.forks_count}
                      </span>
                      <span>Updated {formatDate(repo.updated_at)}</span>
                    </div>
                  </div>

                  {isSelected(repo) && (
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </>
        )}
      </div>

      {/* Pagination */}
      {data && data.repositories.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="text-sm text-gray-600">
            {isFetching && <span className="text-gray-400">Loading...</span>}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isFetching}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>

            <span className="text-sm text-gray-600 px-3">
              Page {page}
            </span>

            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!data?.has_next_page || isFetching}
              className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper function for language colors
function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    JavaScript: '#f7df1e',
    TypeScript: '#3178c6',
    Python: '#3776ab',
    Java: '#b07219',
    Go: '#00ADD8',
    Ruby: '#CC342D',
    PHP: '#777BB4',
    C: '#555555',
    'C++': '#f34b7d',
    'C#': '#178600',
    Rust: '#dea584',
    Swift: '#ffac45',
    Kotlin: '#F18E33',
    Dart: '#00B4AB',
    HTML: '#e34c26',
    CSS: '#563d7c',
    Vue: '#42b883',
    React: '#61dafb',
  };
  return colors[language] || '#6b7280';
}
