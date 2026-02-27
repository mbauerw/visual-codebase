import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTextSelection, detectSelectionType } from './useTextSelection';

describe('detectSelectionType', () => {
  it('should detect file names', () => {
    expect(detectSelectionType('auth.ts')).toBe('file_name');
    expect(detectSelectionType('index.js')).toBe('file_name');
    expect(detectSelectionType('App.tsx')).toBe('file_name');
    expect(detectSelectionType('style.css')).toBe('file_name');
  });

  it('should detect import statements', () => {
    expect(detectSelectionType('import React from "react"')).toBe('import');
    expect(detectSelectionType('from "./utils" import helper')).toBe('import');
    expect(detectSelectionType('export default App')).toBe('import');
  });

  it('should classify require() as function_name (no trailing space)', () => {
    // require("express") lacks whitespace after keyword, so it matches function_name pattern
    expect(detectSelectionType('require("express")')).toBe('function_name');
  });

  it('should detect code blocks', () => {
    expect(detectSelectionType('const x = { a: 1 }')).toBe('code_block');
    expect(detectSelectionType('console.log("hi");')).toBe('code_block');
    expect(detectSelectionType('line1\nline2')).toBe('code_block');
  });

  it('should detect function names', () => {
    expect(detectSelectionType('handleClick')).toBe('function_name');
    expect(detectSelectionType('useState(')).toBe('function_name');
    expect(detectSelectionType('MyComponent')).toBe('function_name');
  });

  it('should classify single identifiers as function_name (pattern priority)', () => {
    // Single identifiers match the function_name regex before reaching the variable check
    expect(detectSelectionType('count')).toBe('function_name');
    expect(detectSelectionType('isLoading')).toBe('function_name');
    expect(detectSelectionType('_private')).toBe('function_name');
  });

  it('should return unknown for unclassifiable text', () => {
    expect(detectSelectionType('hello world')).toBe('unknown');
    expect(detectSelectionType('some random sentence here')).toBe('unknown');
  });
});

describe('useTextSelection', () => {
  let mockGetSelection: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetSelection = vi.fn();
    vi.spyOn(window, 'getSelection').mockImplementation(mockGetSelection);
  });

  it('should start with no selection', () => {
    const { result } = renderHook(() => useTextSelection());
    expect(result.current.selectedText).toBeNull();
    expect(result.current.selectionType).toBe('unknown');
    expect(result.current.hasSelection).toBe(false);
  });

  it('should capture text selection on mouseup', () => {
    const parentElement = document.createElement('div');
    document.body.appendChild(parentElement);

    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => 'handleClick',
      anchorNode: { parentElement },
      removeAllRanges: vi.fn(),
    });

    const { result } = renderHook(() => useTextSelection());

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.selectedText).toBe('handleClick');
    expect(result.current.selectionType).toBe('function_name');
    expect(result.current.hasSelection).toBe(true);

    document.body.removeChild(parentElement);
  });

  it('should ignore collapsed selections', () => {
    mockGetSelection.mockReturnValue({
      isCollapsed: true,
      toString: () => '',
    });

    const { result } = renderHook(() => useTextSelection());

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.selectedText).toBeNull();
  });

  it('should ignore selections in input elements', () => {
    const inputElement = document.createElement('input');
    document.body.appendChild(inputElement);

    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => 'some text',
      anchorNode: { parentElement: inputElement },
    });

    const { result } = renderHook(() => useTextSelection());

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.selectedText).toBeNull();
    document.body.removeChild(inputElement);
  });

  it('should ignore selections in textarea elements', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);

    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => 'some text',
      anchorNode: { parentElement: textarea },
    });

    const { result } = renderHook(() => useTextSelection());

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.selectedText).toBeNull();
    document.body.removeChild(textarea);
  });

  it('should ignore selections inside chat widget', () => {
    const chatWidget = document.createElement('div');
    chatWidget.setAttribute('data-chat-widget', 'true');
    const child = document.createElement('span');
    chatWidget.appendChild(child);
    document.body.appendChild(chatWidget);

    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => 'chat text',
      anchorNode: { parentElement: child },
    });

    const { result } = renderHook(() => useTextSelection());

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.selectedText).toBeNull();
    document.body.removeChild(chatWidget);
  });

  it('should respect minLength option', () => {
    const parentElement = document.createElement('div');
    document.body.appendChild(parentElement);

    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => 'ab',
      anchorNode: { parentElement },
    });

    const { result } = renderHook(() => useTextSelection({ minLength: 5 }));

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.selectedText).toBeNull();
    document.body.removeChild(parentElement);
  });

  it('should respect maxLength option', () => {
    const parentElement = document.createElement('div');
    document.body.appendChild(parentElement);

    const longText = 'a'.repeat(600);
    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => longText,
      anchorNode: { parentElement },
    });

    const { result } = renderHook(() => useTextSelection({ maxLength: 500 }));

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.selectedText).toBeNull();
    document.body.removeChild(parentElement);
  });

  it('should call onSelect callback when text is selected', () => {
    const parentElement = document.createElement('div');
    document.body.appendChild(parentElement);
    const onSelect = vi.fn();

    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => 'myVar',
      anchorNode: { parentElement },
    });

    renderHook(() => useTextSelection({ onSelect }));

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(onSelect).toHaveBeenCalledWith('myVar');
    document.body.removeChild(parentElement);
  });

  it('should clear selection', () => {
    const parentElement = document.createElement('div');
    document.body.appendChild(parentElement);
    const removeAllRanges = vi.fn();

    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => 'someText',
      anchorNode: { parentElement },
      removeAllRanges,
    });

    const { result } = renderHook(() => useTextSelection());

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.hasSelection).toBe(true);

    act(() => {
      result.current.clearSelection();
    });

    expect(result.current.selectedText).toBeNull();
    expect(result.current.hasSelection).toBe(false);
    document.body.removeChild(parentElement);
  });

  it('should not track when disabled', () => {
    const parentElement = document.createElement('div');
    document.body.appendChild(parentElement);

    mockGetSelection.mockReturnValue({
      isCollapsed: false,
      toString: () => 'text',
      anchorNode: { parentElement },
    });

    const { result } = renderHook(() => useTextSelection({ enabled: false }));

    act(() => {
      document.dispatchEvent(new Event('mouseup'));
    });

    expect(result.current.selectedText).toBeNull();
    document.body.removeChild(parentElement);
  });
});
