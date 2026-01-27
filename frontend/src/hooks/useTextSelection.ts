import { useState, useEffect, useCallback } from 'react';
import type { SelectionType } from '../types/chat';

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
  /** Detected type of the selected text */
  selectionType: SelectionType;
  /** Clear the selected text */
  clearSelection: () => void;
  /** Whether there is currently selected text */
  hasSelection: boolean;
}

/**
 * Detect the type of selected text based on patterns.
 * Exported for reuse in useChat to enrich selection context.
 */
export function detectSelectionType(text: string): SelectionType {
  const trimmed = text.trim();

  // File name: contains a dot extension (e.g., "auth.ts", "index.js")
  if (/^\S+\.\w{1,5}$/.test(trimmed)) {
    return 'file_name';
  }

  // Import statement: starts with import/from/require
  if (/^(?:import|from|require|export)\s/.test(trimmed)) {
    return 'import';
  }

  // Code block: multiline or contains braces/semicolons
  if (trimmed.includes('\n') || /[{};]/.test(trimmed)) {
    return 'code_block';
  }

  // Function name: camelCase/PascalCase identifier, or ends with ()
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(?/.test(trimmed) && !trimmed.includes(' ')) {
    return 'function_name';
  }

  // Variable: single identifier that looks like a variable (lowercase start, no spaces)
  if (/^[a-z_$][a-zA-Z0-9_$]*$/.test(trimmed)) {
    return 'variable';
  }

  return 'unknown';
}

export function useTextSelection({
  enabled = true,
  minLength = 1,
  maxLength = 500,
  onSelect,
}: UseTextSelectionOptions = {}): UseTextSelectionReturn {
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectionType, setSelectionType] = useState<SelectionType>('unknown');

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
    setSelectionType(detectSelectionType(text));
    onSelect?.(text);
  }, [enabled, minLength, maxLength, onSelect]);

  const clearSelection = useCallback(() => {
    setSelectedText(null);
    setSelectionType('unknown');
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
    selectionType,
    clearSelection,
    hasSelection: selectedText !== null && selectedText.length > 0,
  };
}
