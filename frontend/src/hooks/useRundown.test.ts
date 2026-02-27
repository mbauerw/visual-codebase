import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRundown } from './useRundown';

vi.mock('../api/client', () => ({
  generateRundown: vi.fn(),
  getRundownStatus: vi.fn(),
}));

import { generateRundown, getRundownStatus } from '../api/client';
const mockGenerateRundown = vi.mocked(generateRundown);
const mockGetRundownStatus = vi.mocked(getRundownStatus);

describe('useRundown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should start with not_started status when no existing rundown', async () => {
    mockGetRundownStatus.mockRejectedValue(new Error('not found'));

    const { result } = renderHook(() => useRundown('analysis-1'));

    // Wait for initial status check to settle
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe('not_started');
    expect(result.current.rundown).toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  it('should start with completed status when existing rundown provided', () => {
    const existingRundown = { narrative: 'test' } as any;

    const { result } = renderHook(() => useRundown('analysis-1', existingRundown));

    expect(result.current.status).toBe('completed');
    expect(result.current.rundown).toBe(existingRundown);
    expect(result.current.isGenerating).toBe(false);
  });

  it('should not fetch status when analysisId is null', () => {
    renderHook(() => useRundown(null));

    expect(mockGetRundownStatus).not.toHaveBeenCalled();
  });

  it('should not fetch status when existingRundown is provided', () => {
    const existingRundown = { narrative: 'test' } as any;

    renderHook(() => useRundown('analysis-1', existingRundown));

    expect(mockGetRundownStatus).not.toHaveBeenCalled();
  });

  it('should check initial status and set completed if already done', async () => {
    const rundownData = { narrative: 'complete rundown' };
    mockGetRundownStatus.mockResolvedValue({
      status: 'completed',
      rundown: rundownData,
    });

    const { result } = renderHook(() => useRundown('analysis-1'));

    // Flush the async effect with fake timers
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.rundown).toEqual(rundownData);
  });

  it('should check initial status and set failed if generation failed', async () => {
    mockGetRundownStatus.mockResolvedValue({
      status: 'failed',
    });

    const { result } = renderHook(() => useRundown('analysis-1'));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('Rundown generation failed. You can try again.');
  });

  it('should trigger generation and complete immediately if already generated', async () => {
    mockGetRundownStatus.mockRejectedValue(new Error('not found'));
    const rundownData = { narrative: 'done' };
    mockGenerateRundown.mockResolvedValue({
      status: 'completed',
      rundown: rundownData,
    });

    const { result } = renderHook(() => useRundown('analysis-1'));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      await result.current.triggerGeneration();
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.rundown).toEqual(rundownData);
  });

  it('should trigger generation and start polling when not immediately complete', async () => {
    mockGetRundownStatus
      .mockRejectedValueOnce(new Error('not found'))
      .mockResolvedValueOnce({ status: 'generating' })
      .mockResolvedValueOnce({
        status: 'completed',
        rundown: { narrative: 'polled' },
      });

    mockGenerateRundown.mockResolvedValue({ status: 'generating' });

    const { result } = renderHook(() => useRundown('analysis-1'));

    // Wait for initial status check
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Trigger generation
    await act(async () => {
      await result.current.triggerGeneration();
    });

    expect(result.current.status).toBe('generating');
    expect(result.current.isGenerating).toBe(true);

    // First poll - still generating
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    // Second poll - completed
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.status).toBe('completed');
    expect(result.current.rundown).toEqual({ narrative: 'polled' });
  });

  it('should handle generation trigger failure', async () => {
    mockGetRundownStatus.mockRejectedValue(new Error('not found'));
    mockGenerateRundown.mockRejectedValue(new Error('Server error'));

    const { result } = renderHook(() => useRundown('analysis-1'));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      await result.current.triggerGeneration();
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('Server error');
  });

  it('should handle polling failure', async () => {
    mockGetRundownStatus
      .mockRejectedValueOnce(new Error('not found'))
      .mockRejectedValueOnce(new Error('Network error'));

    mockGenerateRundown.mockResolvedValue({ status: 'generating' });

    const { result } = renderHook(() => useRundown('analysis-1'));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      await result.current.triggerGeneration();
    });

    // Poll fails
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.error).toBe('Failed to check rundown status.');
  });

  it('should not trigger generation when analysisId is null', async () => {
    const { result } = renderHook(() => useRundown(null));

    await act(async () => {
      await result.current.triggerGeneration();
    });

    expect(mockGenerateRundown).not.toHaveBeenCalled();
  });

  it('should cleanup polling on unmount', async () => {
    mockGetRundownStatus.mockRejectedValue(new Error('not found'));
    mockGenerateRundown.mockResolvedValue({ status: 'generating' });

    const { result, unmount } = renderHook(() => useRundown('analysis-1'));

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    await act(async () => {
      await result.current.triggerGeneration();
    });

    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
