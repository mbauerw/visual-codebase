import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios, { AxiosError } from 'axios';
import { useAuth } from './useAuth';
import type { GitHubOwnerRepoListResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface OwnerRepoError {
  type: 'not_found' | 'rate_limited' | 'invalid_username' | 'network' | 'unknown';
  message: string;
  retryAfter?: number;
}

interface UseOwnerReposOptions {
  owner: string;
  page?: number;
  perPage?: number;
  sort?: 'created' | 'updated' | 'pushed' | 'full_name';
  direction?: 'asc' | 'desc';
  enabled?: boolean;
}

function parseError(error: unknown): OwnerRepoError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail: string }>;
    const status = axiosError.response?.status;
    const detail = axiosError.response?.data?.detail || axiosError.message;

    if (status === 404) {
      return {
        type: 'not_found',
        message: detail || 'GitHub user not found',
      };
    }

    if (status === 400) {
      return {
        type: 'invalid_username',
        message: detail || 'Invalid GitHub username format',
      };
    }

    if (status === 403 || status === 429) {
      const retryAfter = axiosError.response?.headers?.['retry-after'];
      return {
        type: 'rate_limited',
        message: 'GitHub API rate limit reached. Please try again later.',
        retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
      };
    }

    if (!axiosError.response) {
      return {
        type: 'network',
        message: 'Network error. Please check your connection.',
      };
    }

    return {
      type: 'unknown',
      message: detail || 'Failed to fetch repositories',
    };
  }

  return {
    type: 'unknown',
    message: error instanceof Error ? error.message : 'An unknown error occurred',
  };
}

export function useOwnerRepos(options: UseOwnerReposOptions) {
  const { githubToken, session } = useAuth();
  const {
    owner,
    page = 1,
    perPage = 30,
    sort = 'updated',
    direction = 'desc',
    enabled = true,
  } = options;

  const query = useQuery<GitHubOwnerRepoListResponse, OwnerRepoError>({
    queryKey: ['github-owner-repos', owner, page, perPage, sort, direction],
    queryFn: async () => {
      if (!session?.access_token) {
        throw {
          type: 'unknown',
          message: 'Not authenticated with Supabase',
        } as OwnerRepoError;
      }

      if (!owner.trim()) {
        throw {
          type: 'invalid_username',
          message: 'Please enter a GitHub username',
        } as OwnerRepoError;
      }

      try {
        const response = await axios.get<GitHubOwnerRepoListResponse>(
          `${API_URL}/api/github/users/${encodeURIComponent(owner)}/repos`,
          {
            params: {
              page,
              per_page: perPage,
              sort,
              direction,
            },
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
              // Include GitHub token if available (for better rate limits)
              ...(githubToken && { 'X-GitHub-Token': githubToken }),
            },
          }
        );

        return response.data;
      } catch (error) {
        throw parseError(error);
      }
    },
    enabled: enabled && !!owner.trim() && !!session,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error) => {
      // Don't retry on 404 (user not found) or 400 (invalid username)
      if (error.type === 'not_found' || error.type === 'invalid_username') {
        return false;
      }
      // Retry once for other errors
      return failureCount < 1;
    },
  });

  return {
    ...query,
    // Convenience method to check error types
    errorType: query.error?.type,
  };
}

// Utility hook for debounced owner input
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
