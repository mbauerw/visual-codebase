import { useState, useCallback, useRef, useEffect } from 'react';
import {
  startAnalysis,
  getAnalysisStatus,
  getAnalysisResult,
} from '../api/client';
import type {
  AnalyzeRequest,
  AnalysisStatusResponse,
  ReactFlowGraph,
} from '../types';

interface UseAnalysisReturn {
  isLoading: boolean;
  status: AnalysisStatusResponse | null;
  result: ReactFlowGraph | null;
  error: string | null;
  analyze: (request: AnalyzeRequest) => Promise<void>;
  reset: () => void;
}

export function useAnalysis(): UseAnalysisReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<AnalysisStatusResponse | null>(null);
  const [result, setResult] = useState<ReactFlowGraph | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setIsLoading(false);
    setStatus(null);
    setResult(null);
    setError(null);
  }, [stopPolling]);

  const pollStatus = useCallback(
    async (analysisId: string) => {
      try {
        const statusResponse = await getAnalysisStatus(analysisId);
        setStatus(statusResponse);

        if (statusResponse.status === 'completed') {
          stopPolling();
          try {
            const resultData = await getAnalysisResult(analysisId);
            setResult(resultData);
          } catch (err) {
            setError('Failed to fetch analysis result');
          }
          setIsLoading(false);
        } else if (statusResponse.status === 'failed') {
          stopPolling();
          setError(statusResponse.error || 'Analysis failed');
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error polling status:', err);
      }
    },
    [stopPolling]
  );

  const analyze = useCallback(
    async (request: AnalyzeRequest) => {
      reset();
      setIsLoading(true);
      // Set initial pending status immediately so progress bar starts animating
      setStatus({
        status: 'pending',
        current_step: 'Starting analysis...',
        total_files: 0,
      });

      try {
        const response = await startAnalysis(request);
        const analysisId = response.analysis_id;

        // Start polling for status (every 3 seconds)
        pollingRef.current = window.setInterval(() => {
          pollStatus(analysisId);
        }, 3000);

        // Initial status check
        pollStatus(analysisId);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to start analysis'
        );
        setIsLoading(false);
      }
    },
    [reset, pollStatus]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    isLoading,
    status,
    result,
    error,
    analyze,
    reset,
  };
}
