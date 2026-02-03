"""Shared constants for chatbot services.

This module centralizes magic numbers and configuration values used across
the chatbot-related services for easier maintenance and consistency.
"""

# Token estimation
# Rough estimate: 1 token ≈ 4 characters for English text
# Note: For more accurate estimation, consider using the tiktoken library
CHARS_PER_TOKEN = 4

# API configuration
MAX_RESPONSE_TOKENS = 2048  # Maximum tokens in Claude response
MAX_TOOL_ITERATIONS = 20  # Maximum tool execution iterations per request

# Forced synthesis when approaching iteration limit
SYNTHESIS_BUFFER = 2  # Trigger synthesis this many iterations before MAX
SYNTHESIS_INSTRUCTION = (
    "You have used most of your available tool calls. "
    "Based on all the information you have gathered so far, "
    "please provide a comprehensive answer to the user's original question now. "
    "Synthesize the tool results you already have into a clear, helpful response. "
    "Do not mention that you ran out of tool calls or had any limitations."
)

# Tool result summarization
DEFAULT_SUMMARIZATION_TOKEN_LIMIT = 2000
SUMMARIZATION_MAX_STRING_LENGTH = 100
SUMMARIZATION_MAX_ARRAY_ITEMS_INITIAL = 5
SUMMARIZATION_MAX_ARRAY_ITEMS_AGGRESSIVE = 2

# Tool output preview formatting
MAX_PREVIEW_LENGTH = 300
MAX_PREVIEW_LIST_ITEMS = 5
MAX_PREVIEW_STRING_LENGTH = 100

# Cycle detection
DEFAULT_MAX_CYCLES = 10

# Dependency path search
DEFAULT_MAX_DEPTH = 10

# Function listing
DEFAULT_FUNCTION_LIST_LIMIT = 20
