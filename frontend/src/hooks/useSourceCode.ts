import { useQuery } from '@tanstack/react-query';
import { getFileContent, type FileContentResponse } from '../api/client';

interface UseSourceCodeOptions {
  analysisId: string | null;
  nodeId: string | null;
  enabled?: boolean;
}

interface UseSourceCodeReturn {
  sourceCode: string | null;
  isLoading: boolean;
  error: string | null;
  source: 'database' | 'filesystem' | null;
  refetch: () => void;
}

/**
 * Hook for fetching source code content for a file node.
 *
 * Uses React Query for caching - subsequent requests for the same file
 * will be served from cache (stale time: 5 minutes).
 *
 * @param options.analysisId - The analysis ID
 * @param options.nodeId - The node ID (file path)
 * @param options.enabled - Whether to enable the query (default: true when both IDs are provided)
 */
export function useSourceCode({
  analysisId,
  nodeId,
  enabled = true,
}: UseSourceCodeOptions): UseSourceCodeReturn {
  const queryEnabled = enabled && !!analysisId && !!nodeId;

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<FileContentResponse, Error>({
    queryKey: ['sourceCode', analysisId, nodeId],
    queryFn: async () => {
      if (!analysisId || !nodeId) {
        throw new Error('Missing analysisId or nodeId');
      }
      return getFileContent(analysisId, nodeId);
    },
    enabled: queryEnabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    retry: 1, // Only retry once on failure
  });

  // Extract error message from various error formats
  const getErrorMessage = (): string | null => {
    if (!error && !data?.error) return null;

    if (error) {
      // Handle Axios errors
      const axiosError = error as any;
      if (axiosError.response?.data?.detail) {
        return axiosError.response.data.detail;
      }
      return error.message || 'Failed to load source code';
    }

    return data?.error || null;
  };

  return {
    sourceCode: data?.available ? data.content : null,
    isLoading,
    error: getErrorMessage(),
    source: data?.source || null,
    refetch: () => refetch(),
  };
}

export default useSourceCode;
