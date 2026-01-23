/**
 * Throttled state updater using requestAnimationFrame for efficient batching.
 * Reduces state updates during streaming to prevent frame drops.
 */

export interface ThrottledUpdaterOptions<T = string> {
  /** Minimum interval between updates in milliseconds (default: 16ms = ~60fps) */
  minIntervalMs?: number;
  /** Function to merge buffered deltas together (default: string concatenation) */
  bufferMerge?: (buffered: T, newDelta: T) => T;
}

export interface ThrottledUpdater<T> {
  /** Queue an update with a delta value */
  update: (delta: T) => void;
  /** Force flush any pending updates immediately */
  forceFlush: () => void;
  /** Cancel any pending updates and clean up */
  cancel: () => void;
}

/**
 * Create a throttled updater that batches state updates using requestAnimationFrame.
 *
 * @param setState - React state setter function
 * @param merge - Function to merge delta into previous state
 * @param options - Configuration options
 * @returns Throttled updater interface
 *
 * @example
 * const updater = createThrottledUpdater(
 *   setContent,
 *   (prev, delta) => prev + delta,
 *   { minIntervalMs: 16 }
 * );
 *
 * // In stream handler:
 * updater.update(chunk); // Batched updates
 *
 * // On complete:
 * updater.forceFlush();
 *
 * // On cleanup:
 * updater.cancel();
 */
export function createThrottledUpdater<T, S = T>(
  setState: React.Dispatch<React.SetStateAction<S>>,
  merge: (prev: S, delta: T) => S,
  options: ThrottledUpdaterOptions<T> = {}
): ThrottledUpdater<T> {
  const { minIntervalMs = 16, bufferMerge } = options;

  // Default buffer merge for strings is concatenation
  const defaultBufferMerge = (a: T, b: T): T => {
    if (typeof a === 'string' && typeof b === 'string') {
      return (a + b) as T;
    }
    // For non-strings, just use the latest value (caller should provide bufferMerge)
    return b;
  };

  const mergeBuffer = bufferMerge || defaultBufferMerge;

  let buffer: T | null = null;
  let rafId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastUpdateTime = 0;
  let isCancelled = false;

  const flush = () => {
    // Don't flush if cancelled
    if (isCancelled) {
      rafId = null;
      return;
    }

    if (buffer !== null) {
      const currentBuffer = buffer;
      buffer = null;
      setState((prev) => merge(prev, currentBuffer));
      lastUpdateTime = performance.now();
    }
    rafId = null;
  };

  const scheduleUpdate = () => {
    // Don't schedule if already scheduled or cancelled
    if (rafId !== null || timeoutId !== null || isCancelled) return;

    const now = performance.now();
    const timeSinceLastUpdate = now - lastUpdateTime;

    if (timeSinceLastUpdate >= minIntervalMs) {
      // Enough time has passed, update immediately on next frame
      rafId = requestAnimationFrame(flush);
    } else {
      // Schedule update after remaining time
      const delay = minIntervalMs - timeSinceLastUpdate;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        // Check again if cancelled before scheduling RAF
        if (!isCancelled) {
          rafId = requestAnimationFrame(flush);
        }
      }, delay);
    }
  };

  return {
    update(delta: T) {
      // Ignore updates after cancel
      if (isCancelled) return;

      if (buffer === null) {
        buffer = delta;
      } else {
        // Merge buffered deltas together (NOT using state merge function)
        // For strings, this concatenates: "chunk1" + "chunk2" = "chunk1chunk2"
        buffer = mergeBuffer(buffer, delta);
      }
      scheduleUpdate();
    },

    forceFlush() {
      // Clear any pending scheduled updates
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // Flush immediately (but respect cancelled state)
      if (!isCancelled) {
        flush();
      }
    },

    cancel() {
      isCancelled = true;

      // Clear timeout if pending
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      // Clear RAF if pending
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      // Clear buffer
      buffer = null;
    },
  };
}

/**
 * String merge function for throttled text streaming.
 */
export const stringMerge = (prev: string, delta: string): string => prev + delta;

/**
 * Create a throttled string updater optimized for streaming text.
 */
export function createStreamingTextUpdater(
  setState: React.Dispatch<React.SetStateAction<string>>,
  options?: ThrottledUpdaterOptions
): ThrottledUpdater<string> {
  return createThrottledUpdater(setState, stringMerge, options);
}
