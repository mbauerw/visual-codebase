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
import {
  logAnalysisStart,
  logStatusPoll,
  logAnalysisComplete,
  logAnalysisError,
} from '../utils/networkLogger';

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

        // Log the status poll
        logStatusPoll(
          statusResponse.status,
          statusResponse.progress ?? 0,
          statusResponse.current_step ?? '',
          statusResponse.total_files ?? 0
        );

        if (statusResponse.status === 'completed') {
          stopPolling();
          logAnalysisComplete();
          try {
            const resultData = await getAnalysisResult(analysisId);
            setResult(resultData);
          } catch (err) {
            setError('Failed to fetch analysis result');
          }
          setIsLoading(false);
        } else if (statusResponse.status === 'failed') {
          stopPolling();
          logAnalysisError(statusResponse.error || 'Analysis failed');
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

      const isGitHub = !!request.github_repo;

      // Log analysis start
      logAnalysisStart('pending', isGitHub);

      // Set initial pending status immediately so progress bar starts animating
      setStatus({
        analysis_id: '', // Provide a default or placeholder value
        status: 'pending',
        current_step: 'Starting analysis...',
        total_files: 0,
        progress: 0,
      });

      try {
        const response = await startAnalysis(request);
        const analysisId = response.analysis_id;

        // Log with actual analysis ID
        logAnalysisStart(analysisId, isGitHub);

        // Start polling for status (every 1 second for more responsive updates)
        pollingRef.current = window.setInterval(() => {
          pollStatus(analysisId);
        }, 1000);

        // Initial status check
        pollStatus(analysisId);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to start analysis';
        logAnalysisError(errorMsg);
        setError(errorMsg);
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
