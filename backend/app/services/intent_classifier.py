"""Intent classification for chatbot messages.

Classifies user messages to determine which tools are needed,
enabling intent-based tool loading to reduce token usage.
"""
import re
from enum import Enum
from typing import Optional


class QuestionIntent(str, Enum):
    """Classification of user question intent."""

    CODEBASE_SPECIFIC = "codebase_specific"   # About specific files/functions
    CODEBASE_GENERAL = "codebase_general"     # About architecture/patterns/overview
    HIGHLIGHTED_TEXT = "highlighted_text"      # User highlighted something
    DEPENDENCY_ANALYSIS = "dependency_analysis"  # About dependencies/imports/cycles
    FUNCTION_ANALYSIS = "function_analysis"    # About functions/tiers/call counts
    GENERAL_KNOWLEDGE = "general_knowledge"   # General programming questions


# Pre-compiled regex patterns for each intent category.
# Compiling at module load catches syntax errors at import time.
_SPECIFIC_FILE_PATTERNS = [
    re.compile(r'\b\w+\.\w{1,4}\b'),       # file.ext pattern
    re.compile(r'src/'),                     # path pattern
    re.compile(r'what does .+ do'),          # "what does X do"
    re.compile(r'tell me about'),            # "tell me about X"
    re.compile(r'explain .+ file'),          # "explain the X file"
    re.compile(r'show me .+ code'),          # "show me the code"
]

_DEPENDENCY_KEYWORDS = frozenset({
    "dependency", "dependencies", "import", "imports", "imported",
    "circular", "cycle", "cycles", "depends", "relationship",
    "connect", "connected", "path", "chain",
    "imported_by", "uses", "used by",
})

_FUNCTION_KEYWORDS = frozenset({
    "function", "functions", "tier", "tiers",
    "s-tier", "a-tier", "b-tier", "c-tier",
    "call count", "calls", "called",
    "entry point", "exported", "async",
    "most important", "top functions",
})

_CODEBASE_GENERAL_KEYWORDS = frozenset({
    "architecture", "overview", "summary", "structure",
    "codebase", "project", "tech stack", "framework",
    "pattern", "patterns", "module", "modules",
    "complexity", "metrics", "statistics", "stats",
    "role", "roles", "category", "categories",
    "how many files", "file count",
    "most connected", "distribution",
    # Broad overview question keywords
    "application", "app", "rundown", "walkthrough",
    "organized", "high-level", "big picture", "purpose",
})

_CODEBASE_OVERVIEW_PATTERNS = [
    re.compile(r'give me .*(rundown|overview|summary|walkthrough)'),
    re.compile(r'what (is|does) this (app|application|code|project|codebase)'),
    re.compile(r'how does (this|the) .* work'),
    re.compile(r'how is .*(organized|structured|laid out|set up)'),
    re.compile(r'tell me about (this|the) (code|project|app|application|codebase)'),
    re.compile(r'walk me through'),
    re.compile(r'(describe|explain) (this|the) (project|codebase|application|app|code)'),
    re.compile(r'(high.level|big picture|general) (view|overview|summary|understanding)'),
]

_GENERAL_KNOWLEDGE_PATTERNS = [
    re.compile(r'^what is '),
    re.compile(r'^what are '),
    re.compile(r'^how (?:do|does|to|can) '),
    re.compile(r'^explain (?:the concept|how|what)'),
    re.compile(r'^difference between'),
    re.compile(r'^best practice'),
    re.compile(r'^when (?:should|to) '),
    re.compile(r'^why (?:should|do|does|is) '),
    re.compile(r'^compare .+ (?:and|vs|versus) '),
]


class IntentClassifier:
    """Classifies user messages to determine required tool subsets."""

    @classmethod
    def classify(
        cls,
        message: str,
        highlighted_text: Optional[str] = None,
        has_selection_context: bool = False,
    ) -> QuestionIntent:
        """Classify a user message to determine which tools are needed.

        Args:
            message: The user's message text
            highlighted_text: Optional highlighted text from visualization
            has_selection_context: Whether selection context is provided

        Returns:
            QuestionIntent classification
        """
        # Highlighted text always gets the highlighted_text intent
        if highlighted_text:
            return QuestionIntent.HIGHLIGHTED_TEXT

        message_lower = message.lower().strip()
        # Strip punctuation from words for keyword matching
        words = set(
            re.sub(r'[^\w\s-]', '', word)
            for word in message_lower.split()
        )
        words.discard('')

        # Check for dependency-related questions
        if words & _DEPENDENCY_KEYWORDS:
            return QuestionIntent.DEPENDENCY_ANALYSIS

        # Check for function-related questions
        if words & _FUNCTION_KEYWORDS:
            return QuestionIntent.FUNCTION_ANALYSIS

        # Check for codebase-general questions (architecture, overview, etc.)
        if words & _CODEBASE_GENERAL_KEYWORDS:
            return QuestionIntent.CODEBASE_GENERAL

        # Check for broad overview question patterns before specific-file patterns,
        # since broad questions like "what does this app do?" can accidentally match
        # specific-file regexes (e.g., "app." matching the file.ext pattern).
        for pattern in _CODEBASE_OVERVIEW_PATTERNS:
            if pattern.search(message_lower):
                return QuestionIntent.CODEBASE_GENERAL

        # Check for specific file patterns (e.g., "auth.ts", "src/utils")
        for pattern in _SPECIFIC_FILE_PATTERNS:
            if pattern.search(message_lower):
                return QuestionIntent.CODEBASE_SPECIFIC

        # Check for general knowledge patterns
        for pattern in _GENERAL_KNOWLEDGE_PATTERNS:
            if pattern.search(message_lower):
                return QuestionIntent.GENERAL_KNOWLEDGE

        # Default: assume codebase-specific (safer to include tools)
        return QuestionIntent.CODEBASE_SPECIFIC
