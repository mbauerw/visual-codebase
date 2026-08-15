import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from './useAuth';
import type { GitHubRepoListResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8100';

interface UseGitHubReposOptions {
  page?: number;
  perPage?: number;
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  type?: 'all' | 'owner' | 'public' | 'private' | 'member';
  enabled?: boolean;
}

export function useGitHubRepos(options: UseGitHubReposOptions = {}) {
  const { githubToken, user, session } = useAuth();
  const {
    page = 1,
    perPage = 30,
    sort = 'updated',
    direction = 'desc',
    type = 'all',
    enabled = true,
  } = options;

  return useQuery<GitHubRepoListResponse, Error>({
    queryKey: ['github-repos', page, perPage, sort, direction, type],
    queryFn: async () => {
      if (!githubToken) {
        throw new Error('GitHub token not available');
      }

      if (!session?.access_token) {
        throw new Error('Not authenticated with Supabase');
      }

      const response = await axios.get<GitHubRepoListResponse>(
        `${API_URL}/api/github/repos`,
        {
          params: {
            page,
            per_page: perPage,
            sort,
            direction,
            type,
          },
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'X-GitHub-Token': githubToken,
          },
        }
      );

      return response.data;
    },
    enabled: enabled && !!githubToken && !!user && !!session,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 1,
  });
}
