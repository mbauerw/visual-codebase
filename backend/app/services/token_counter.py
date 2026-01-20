"""Token counting utility for context window tracking.

Uses tiktoken with cl100k_base encoding (GPT-4 tokenizer) which provides
~95% accuracy for Claude's tokenizer. This is used for pre-request estimates
while actual post-request counts come from the Claude API response.
"""
import json
from functools import lru_cache
from typing import Any

import tiktoken


@lru_cache()
def get_encoder() -> tiktoken.Encoding:
    """Get cached tokenizer encoder.

    Uses cl100k_base encoding which is similar to Claude's tokenizer.
    """
    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    """Count tokens in a text string.

    Args:
        text: The text to count tokens for

    Returns:
        Number of tokens
    """
    if not text:
        return 0
    return len(get_encoder().encode(text))


def count_message_tokens(messages: list[dict[str, Any]]) -> int:
    """Count tokens in a list of Claude-format messages.

    Handles various content formats including text, tool_use, and tool_result blocks.

    Args:
        messages: List of message dicts in Claude API format

    Returns:
        Total token count estimate
    """
    total = 0

    for msg in messages:
        # Count role tokens (approximate overhead)
        total += 4  # Approximate overhead per message

        content = msg.get("content", "")

        if isinstance(content, str):
            total += count_tokens(content)
        elif isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    block_type = block.get("type", "")

                    if block_type == "text":
                        total += count_tokens(block.get("text", ""))
                    elif block_type == "tool_use":
                        # Tool use includes name and JSON input
                        total += count_tokens(block.get("name", ""))
                        input_data = block.get("input", {})
                        total += count_tokens(json.dumps(input_data, default=str))
                    elif block_type == "tool_result":
                        result_content = block.get("content", "")
                        if isinstance(result_content, str):
                            total += count_tokens(result_content)
                        else:
                            total += count_tokens(json.dumps(result_content, default=str))

    return total


def count_system_prompt_tokens(system_prompt: str) -> int:
    """Count tokens in a system prompt.

    Args:
        system_prompt: The system prompt text

    Returns:
        Token count
    """
    # Add overhead for system prompt framing
    return count_tokens(system_prompt) + 10


def count_tools_tokens(tools: list[dict[str, Any]]) -> int:
    """Count tokens in tool definitions.

    Args:
        tools: List of tool definition dicts

    Returns:
        Estimated token count for tools
    """
    if not tools:
        return 0

    # Tools are serialized as JSON in the context
    return count_tokens(json.dumps(tools, default=str))


# Claude Sonnet 4's context window size
CLAUDE_SONNET_CONTEXT_WINDOW = 200000
