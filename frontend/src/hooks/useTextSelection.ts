import { useState, useEffect, useCallback } from 'react';

interface UseTextSelectionOptions {
  /** Whether to track text selection */
  enabled?: boolean;
  /** Minimum length of selected text to capture */
  minLength?: number;
  /** Maximum length of selected text to capture */
  maxLength?: number;
  /** Callback when text is selected */
  onSelect?: (text: string) => void;
}

interface UseTextSelectionReturn {
  /** Currently selected text */
  selectedText: string | null;
  /** Clear the selected text */
  clearSelection: () => void;
  /** Whether there is currently selected text */
  hasSelection: boolean;
}

export function useTextSelection({
  enabled = true,
  minLength = 1,
  maxLength = 500,
  onSelect,
}: UseTextSelectionOptions = {}): UseTextSelectionReturn {
  const [selectedText, setSelectedText] = useState<string | null>(null);

  const handleMouseUp = useCallback(() => {
    if (!enabled) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const text = selection.toString().trim();

    // Validate length
    if (text.length < minLength || text.length > maxLength) {
      return;
    }

    // Don't capture selection if it's inside an input or textarea
    const anchorNode = selection.anchorNode;
    if (anchorNode) {
      const parentElement = anchorNode.parentElement;
      if (parentElement) {
        const tagName = parentElement.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') {
          return;
        }
        // Also check if inside the chat widget or panel (don't capture chat messages)
        if (parentElement.closest('[data-chat-widget]') || parentElement.closest('[data-chat-panel]')) {
          return;
        }
      }
    }

    setSelectedText(text);
    onSelect?.(text);
  }, [enabled, minLength, maxLength, onSelect]);

  const clearSelection = useCallback(() => {
    setSelectedText(null);
    // Also clear the browser selection
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enabled, handleMouseUp]);

  return {
    selectedText,
    clearSelection,
    hasSelection: selectedText !== null && selectedText.length > 0,
  };
}
