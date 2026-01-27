"""Context building utilities for the chatbot."""
from typing import Optional

from ..models.schemas import ReactFlowGraph, CodebaseSummary, FunctionStats
from ..models.chat_schemas import SelectionContext


GENERAL_CONTEXT_TEMPLATE = """You are a helpful programming assistant.

Answer programming questions directly and clearly. You have broad knowledge of programming languages, frameworks, design patterns, and software engineering best practices.

If the user asks about specific files or functions in their codebase, let them know they can switch to "Codebase" mode for detailed analysis with tools.

Guidelines:
- Be concise but thorough
- Provide code examples when helpful
- Reference official documentation when relevant
"""


BASE_CONTEXT_TEMPLATE = """You are a code analysis assistant for "{project_name}".

Files: {file_count} | Languages: {languages} | Dependencies: {edge_count}

{summary}

{function_stats}

Use tools to look up files, functions, and dependencies as needed.

When [Context: File: ...] is in the message, use that file path directly with get_file_info or get_function_info instead of searching broadly.

Be concise. Reference specific file/function names. Suggest alternatives if not found.
"""


def build_general_context() -> str:
    """Build the general-purpose context string (no codebase info, no tools).

    Returns:
        Minimal system context string for general programming questions
    """
    return GENERAL_CONTEXT_TEMPLATE


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


def format_user_message(
    message: str,
    highlighted_text: Optional[str] = None,
    selection_context: Optional[SelectionContext] = None
) -> str:
    """Format a user message with optional highlighted text and selection context.

    When selection context is provided, it gives the model direct knowledge of
    which file/function is being referenced, eliminating the need for broad searches.

    Args:
        message: The user's message
        highlighted_text: Optional highlighted text from the visualization
        selection_context: Optional rich context about the selection source

    Returns:
        Formatted message string with context prefix
    """
    if not highlighted_text:
        return message

    # Build context parts from selection context
    context_parts = []

    if selection_context:
        # Add file context if available
        if selection_context.current_file:
            file_info = selection_context.current_file
            context_parts.append(f"File: {file_info.file_path}")
            if file_info.role:
                context_parts.append(f"Role: {file_info.role}")

        # Add selected node context if different from current file
        elif selection_context.selected_node:
            node_info = selection_context.selected_node
            context_parts.append(f"File: {node_info.file_path}")
            if node_info.role:
                context_parts.append(f"Role: {node_info.role}")

        # Add line range if available
        if selection_context.line_range:
            lr = selection_context.line_range
            context_parts.append(f"Lines: {lr.start}-{lr.end}")

        # Add selection type if detected
        if selection_context.selection_type:
            context_parts.append(f"Type: {selection_context.selection_type.value}")

        # Add source information
        if selection_context.source:
            context_parts.append(f"Source: {selection_context.source.value}")

    # Format the message with context
    if context_parts:
        context_str = " | ".join(context_parts)
        return f"[Context: {context_str}]\n[Highlighted: {highlighted_text}]\n\n{message}"

    # Fallback to simple format if no context
    return f"[Highlighted: {highlighted_text}]\n\n{message}"
