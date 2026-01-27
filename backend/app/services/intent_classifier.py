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


# Keywords that indicate codebase-specific questions
_SPECIFIC_FILE_PATTERNS = [
    r'\b\w+\.\w{1,4}\b',       # file.ext pattern
    r'src/',                     # path pattern
    r'what does .+ do',          # "what does X do"
    r'tell me about',            # "tell me about X"
    r'explain .+ file',          # "explain the X file"
    r'show me .+ code',          # "show me the code"
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
})

_GENERAL_KNOWLEDGE_PATTERNS = [
    r'^what is ',
    r'^what are ',
    r'^how (?:do|does|to|can) ',
    r'^explain (?:the concept|how|what)',
    r'^difference between',
    r'^best practice',
    r'^when (?:should|to) ',
    r'^why (?:should|do|does|is) ',
    r'^compare .+ (?:and|vs|versus) ',
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

        # Check for specific file patterns (e.g., "auth.ts", "src/utils")
        for pattern in _SPECIFIC_FILE_PATTERNS:
            if re.search(pattern, message_lower):
                return QuestionIntent.CODEBASE_SPECIFIC

        # Check for general knowledge patterns
        for pattern in _GENERAL_KNOWLEDGE_PATTERNS:
            if re.search(pattern, message_lower):
                return QuestionIntent.GENERAL_KNOWLEDGE

        # Default: assume codebase-specific (safer to include tools)
        return QuestionIntent.CODEBASE_SPECIFIC
