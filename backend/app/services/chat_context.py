"""Context building utilities for the chatbot."""
from typing import Optional

from ..models.schemas import ReactFlowGraph, CodebaseSummary, FunctionStats


BASE_CONTEXT_TEMPLATE = """You are a code analysis assistant for the "{project_name}" codebase.

## Codebase Overview
- Total files: {file_count}
- Languages: {languages}
- Total dependencies: {edge_count}

## Summary
{summary}

## Function Statistics
{function_stats}

You have tools to look up specific files, functions, and dependencies. Use them when the user asks about specific parts of the codebase.

When the user highlights text from the visualization, use the explain_highlighted tool to provide context about what that text refers to.

Guidelines:
- Be concise but thorough
- Reference specific file names and function names when relevant
- If a file or function isn't found, suggest similar alternatives
- Explain architectural patterns and relationships between files when helpful
"""


def build_base_context(graph: ReactFlowGraph) -> str:
    """Build the base context string for the chatbot system prompt.

    Args:
        graph: The ReactFlowGraph containing analysis data

    Returns:
        Formatted system context string
    """
    metadata = graph.metadata

    # Determine project name
    project_name = _get_project_name(metadata)

    # Format languages
    languages = _format_languages(metadata.languages)

    # Format summary
    summary = _format_summary(metadata.summary)

    # Format function stats
    function_stats = _format_function_stats(metadata.function_stats)

    return BASE_CONTEXT_TEMPLATE.format(
        project_name=project_name,
        file_count=metadata.file_count,
        languages=languages,
        edge_count=metadata.edge_count,
        summary=summary,
        function_stats=function_stats
    )


def _get_project_name(metadata) -> str:
    """Extract project name from metadata."""
    if metadata.user_title:
        return metadata.user_title

    if metadata.github_repo:
        return f"{metadata.github_repo.owner}/{metadata.github_repo.repo}"

    if metadata.directory_path:
        # Extract last part of path as project name
        path = metadata.directory_path.rstrip("/\\")
        return path.split("/")[-1].split("\\")[-1]

    return "Analyzed Codebase"


def _format_languages(languages: dict[str, int]) -> str:
    """Format language distribution for display."""
    if not languages:
        return "Not detected"

    sorted_langs = sorted(languages.items(), key=lambda x: x[1], reverse=True)
    return ", ".join(f"{lang} ({count} files)" for lang, count in sorted_langs)


def _format_summary(summary: Optional[CodebaseSummary]) -> str:
    """Format codebase summary for display."""
    if not summary:
        return "No summary available."

    parts = []

    if summary.primary_purpose:
        parts.append(f"**Purpose:** {summary.primary_purpose}")

    if summary.project_type:
        parts.append(f"**Type:** {summary.project_type}")

    if summary.architecture_summary:
        parts.append(f"**Architecture:** {summary.architecture_summary}")

    if summary.tech_stack:
        tech_parts = []
        if summary.tech_stack.frameworks:
            tech_parts.append(f"Frameworks: {', '.join(summary.tech_stack.frameworks)}")
        if summary.tech_stack.key_patterns:
            tech_parts.append(f"Patterns: {', '.join(summary.tech_stack.key_patterns)}")
        if tech_parts:
            parts.append(f"**Tech Stack:** {'; '.join(tech_parts)}")

    if summary.key_modules:
        modules = [f"{m.name}: {m.purpose}" for m in summary.key_modules[:5]]
        parts.append(f"**Key Modules:**\n" + "\n".join(f"  - {m}" for m in modules))

    if summary.complexity_assessment:
        parts.append(
            f"**Complexity:** {summary.complexity_assessment.level} - "
            f"{summary.complexity_assessment.reasoning}"
        )

    return "\n".join(parts) if parts else "No summary available."


def _format_function_stats(stats: Optional[FunctionStats]) -> str:
    """Format function statistics for display."""
    if not stats:
        return "Function analysis not available."

    parts = [
        f"- Total functions: {stats.total_functions}",
        f"- Total call sites: {stats.total_calls}",
    ]

    if stats.tier_counts:
        tier_summary = ", ".join(
            f"{tier}: {count}" for tier, count in sorted(stats.tier_counts.items())
        )
        parts.append(f"- Tier distribution: {tier_summary}")

    if stats.top_functions:
        parts.append(f"- Top functions: {', '.join(stats.top_functions[:5])}")

    return "\n".join(parts)


def format_user_message(message: str, highlighted_text: Optional[str] = None) -> str:
    """Format a user message with optional highlighted text context.

    Args:
        message: The user's message
        highlighted_text: Optional highlighted text from the visualization

    Returns:
        Formatted message string
    """
    if highlighted_text:
        return f"[Highlighted: {highlighted_text}]\n\n{message}"
    return message
