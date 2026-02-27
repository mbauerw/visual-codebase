import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSourceCode } from './useSourceCode';

vi.mock('../api/client', () => ({
  getFileContent: vi.fn(),
}));

import { getFileContent } from '../api/client';
const mockGetFileContent = vi.mocked(getFileContent);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useSourceCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not fetch when analysisId is null', () => {
    renderHook(() => useSourceCode({ analysisId: null, nodeId: 'file.ts' }), {
      wrapper: createWrapper(),
    });

    expect(mockGetFileContent).not.toHaveBeenCalled();
  });

  it('should not fetch when nodeId is null', () => {
    renderHook(() => useSourceCode({ analysisId: 'analysis-1', nodeId: null }), {
      wrapper: createWrapper(),
    });

    expect(mockGetFileContent).not.toHaveBeenCalled();
  });

  it('should not fetch when enabled is false', () => {
    renderHook(
      () => useSourceCode({ analysisId: 'analysis-1', nodeId: 'file.ts', enabled: false }),
      { wrapper: createWrapper() },
    );

    expect(mockGetFileContent).not.toHaveBeenCalled();
  });

  it('should return initial loading state', () => {
    mockGetFileContent.mockReturnValue(new Promise(() => {})); // Never resolves

    const { result } = renderHook(
      () => useSourceCode({ analysisId: 'analysis-1', nodeId: 'file.ts' }),
      { wrapper: createWrapper() },
    );

    expect(result.current.isLoading).toBe(true);
    expect(result.current.sourceCode).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.source).toBeNull();
  });

  it('should fetch and return source code on success', async () => {
    mockGetFileContent.mockResolvedValue({
      content: 'const x = 1;',
      source: 'database',
      available: true,
    });

    const { result } = renderHook(
      () => useSourceCode({ analysisId: 'analysis-1', nodeId: 'file.ts' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sourceCode).toBe('const x = 1;');
    expect(result.current.source).toBe('database');
    expect(result.current.error).toBeNull();
    expect(mockGetFileContent).toHaveBeenCalledWith('analysis-1', 'file.ts');
  });

  it('should return null sourceCode when not available', async () => {
    mockGetFileContent.mockResolvedValue({
      content: null,
      source: 'filesystem',
      available: false,
      error: 'File not found',
    });

    const { result } = renderHook(
      () => useSourceCode({ analysisId: 'analysis-1', nodeId: 'missing.ts' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sourceCode).toBeNull();
    expect(result.current.error).toBe('File not found');
  });

  it('should handle fetch errors', async () => {
    mockGetFileContent.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(
      () => useSourceCode({ analysisId: 'analysis-1', nodeId: 'file.ts' }),
      { wrapper: createWrapper() },
    );

    // Hook has retry: 1, so wait for both attempts to complete
    await waitFor(
      () => {
        expect(result.current.error).toBe('Network error');
      },
      { timeout: 5000 },
    );

    expect(result.current.sourceCode).toBeNull();
  });

  it('should handle Axios errors with detail', async () => {
    const axiosError = new Error('Request failed') as any;
    axiosError.response = { data: { detail: 'Forbidden: access denied' } };
    mockGetFileContent.mockRejectedValue(axiosError);

    const { result } = renderHook(
      () => useSourceCode({ analysisId: 'analysis-1', nodeId: 'file.ts' }),
      { wrapper: createWrapper() },
    );

    // Hook has retry: 1, so wait for both attempts to complete
    await waitFor(
      () => {
        expect(result.current.error).toBe('Forbidden: access denied');
      },
      { timeout: 5000 },
    );
  });

  it('should provide a refetch function', async () => {
    mockGetFileContent.mockResolvedValue({
      content: 'original',
      source: 'database',
      available: true,
    });

    const { result } = renderHook(
      () => useSourceCode({ analysisId: 'analysis-1', nodeId: 'file.ts' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.sourceCode).toBe('original');
    });

    expect(typeof result.current.refetch).toBe('function');
  });
});
