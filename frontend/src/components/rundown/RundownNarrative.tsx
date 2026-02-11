import { useMemo, memo } from 'react';

interface RundownNarrativeProps {
  narrative: string;
  validFilePaths?: string[];
  keywords?: string[];
  onFileClick?: (filePath: string) => void;
}

// Regex for file references with known extensions
const FILE_REGEX_SOURCE =
  '(?<![.\\w@\\/])(?:(?:[\\w.-]+\\/)+)?[\\w.-]+\\.(?:tsx?|jsx?|py|java|cs|go|rs|swift)(?!\\w)';

type TokenType = 'text' | 'file' | 'keyword';

interface Token {
  type: TokenType;
  text: string;
  filePath?: string;
}

function tokenizeNarrative(
  narrative: string,
  validFilePaths: string[],
  keywords: string[],
): Token[] {
  if (!narrative) return [];

  // Build lookup structures for file path validation
  const fullPathSet = new Set(validFilePaths);
  const basenameToFullPath = new Map<string, string>();
  for (const fp of validFilePaths) {
    const basename = fp.split('/').pop() || fp;
    if (!basenameToFullPath.has(basename)) {
      basenameToFullPath.set(basename, fp);
    } else {
      // Ambiguous — mark with empty string so we don't guess
      basenameToFullPath.set(basename, '');
    }
  }

  const matches: {
    start: number;
    end: number;
    type: TokenType;
    text: string;
    filePath?: string;
  }[] = [];

  // 1. File matches
  const fileRegex = new RegExp(FILE_REGEX_SOURCE, 'g');
  let m;
  while ((m = fileRegex.exec(narrative)) !== null) {
    const text = m[0];
    let resolvedPath: string | undefined;

    if (fullPathSet.has(text)) {
      resolvedPath = text;
    } else {
      const basename = text.split('/').pop() || text;
      const full = basenameToFullPath.get(basename);
      if (full && full !== '') {
        resolvedPath = full;
      }
    }

    matches.push({
      start: m.index,
      end: m.index + text.length,
      type: 'file',
      text,
      filePath: resolvedPath,
    });
  }

  // 2. Keyword matches — longer keywords first to avoid partial matches
  const sortedKeywords = [...keywords]
    .filter((kw) => kw.length >= 3)
    .sort((a, b) => b.length - a.length);

  for (const kw of sortedKeywords) {
    let searchStart = 0;
    while (searchStart < narrative.length) {
      const idx = narrative.indexOf(kw, searchStart);
      if (idx === -1) break;

      const end = idx + kw.length;

      // Check word boundaries
      const before = idx > 0 ? narrative[idx - 1] : ' ';
      const after = end < narrative.length ? narrative[end] : ' ';
      const boundaryChars = /[\s,.:;!?'"()\[\]{}\-\/\n]/;
      const validBefore = idx === 0 || boundaryChars.test(before);
      const validAfter = end === narrative.length || boundaryChars.test(after);

      if (validBefore && validAfter) {
        // Check overlap with existing matches
        const overlaps = matches.some(
          (existing) => idx < existing.end && end > existing.start,
        );

        if (!overlaps) {
          matches.push({ start: idx, end, type: 'keyword', text: kw });
        }
      }

      searchStart = idx + 1;
    }
  }

  // Sort by position, then by length descending for ties
  matches.sort((a, b) => a.start - b.start || b.end - a.end);

  // Remove overlapping matches (greedy left-to-right)
  const filtered: typeof matches = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      filtered.push(match);
      lastEnd = match.end;
    }
  }

  // Build token array
  const tokens: Token[] = [];
  let cursor = 0;
  for (const match of filtered) {
    if (match.start > cursor) {
      tokens.push({ type: 'text', text: narrative.slice(cursor, match.start) });
    }
    tokens.push({
      type: match.type,
      text: match.text,
      filePath: match.filePath,
    });
    cursor = match.end;
  }
  if (cursor < narrative.length) {
    tokens.push({ type: 'text', text: narrative.slice(cursor) });
  }

  return tokens;
}

export default memo(function RundownNarrative({
  narrative,
  validFilePaths = [],
  keywords = [],
  onFileClick,
}: RundownNarrativeProps) {
  const tokens = useMemo(
    () => tokenizeNarrative(narrative, validFilePaths, keywords),
    [narrative, validFilePaths, keywords],
  );

  // Fast path: no keywords or file paths → render plain text
  if (validFilePaths.length === 0 && keywords.length === 0) {
    return (
      <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">
        {narrative}
      </p>
    );
  }

  return (
    <p className="text-base text-slate-700 leading-relaxed whitespace-pre-line">
      {tokens.map((token, i) => {
        if (token.type === 'file') {
          if (token.filePath && onFileClick) {
            return (
              <button
                key={i}
                onClick={() => onFileClick(token.filePath!)}
                className="font-mono text-xs bg-amber-50 text-amber-700 hover:text-amber-900 hover:bg-amber-100 hover:underline px-1.5 py-0.5 rounded cursor-pointer transition-colors"
              >
                {token.text}
              </button>
            );
          }
          // File reference but no matching analysis node — styled but not clickable
          return (
            <span
              key={i}
              className="font-mono text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded"
            >
              {token.text}
            </span>
          );
        }

        if (token.type === 'keyword') {
          return (
            <span
              key={i}
              className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium"
            >
              {token.text}
            </span>
          );
        }

        return token.text;
      })}
    </p>
  );
});
