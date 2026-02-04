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

{structural_digest}

Tool strategy:
- Overview/architecture: answer from context above. Use tools only for details absent from context.
- Specific files: use get_file_info with exact filename. Avoid vague search_files.
- "What imports/uses X": use get_dependencies with direction parameter.
- Aggregate stats: use get_metrics.
- Avoid repeated search_files with different keywords; fall back to get_metrics.

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

    # Format structural digest from graph data
    structural_digest = _format_structural_digest(graph)

    return BASE_CONTEXT_TEMPLATE.format(
        project_name=project_name,
        file_count=metadata.file_count,
        languages=languages,
        edge_count=metadata.edge_count,
        summary=summary,
        function_stats=function_stats,
        structural_digest=structural_digest
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


def _format_structural_digest(graph: ReactFlowGraph) -> str:
    """Build a structural digest of the codebase from graph data.

    Includes role distribution, directory structure, and most-connected files
    so the model can answer broad overview questions without tool calls.
    """
    if not graph.nodes:
        return ""

    parts = []

    # 1. Role distribution (top 10)
    role_counts: dict[str, int] = {}
    for node in graph.nodes:
        role = node.data.role.value
        role_counts[role] = role_counts.get(role, 0) + 1
    sorted_roles = sorted(role_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    role_str = ", ".join(f"{role} ({count})" for role, count in sorted_roles)
    parts.append(f"**Role distribution:** {role_str}")

    # 2. Directory structure (top-level folders, top 10)
    dir_counts: dict[str, int] = {}
    for node in graph.nodes:
        path = node.data.path.replace("\\", "/")
        folder = path.split("/")[0] if "/" in path else "(root)"
        dir_counts[folder] = dir_counts.get(folder, 0) + 1
    sorted_dirs = sorted(dir_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    dir_str = ", ".join(f"{d}/ ({c} files)" for d, c in sorted_dirs)
    parts.append(f"**Directory structure:** {dir_str}")

    # 3. Most-connected files (top 5 hub files)
    import_counts: dict[str, int] = {}
    imported_by_counts: dict[str, int] = {}
    for edge in graph.edges:
        import_counts[edge.source] = import_counts.get(edge.source, 0) + 1
        imported_by_counts[edge.target] = imported_by_counts.get(edge.target, 0) + 1

    connection_scores = []
    for node in graph.nodes:
        total = import_counts.get(node.id, 0) + imported_by_counts.get(node.id, 0)
        if total > 0:
            connection_scores.append((node.data.path, node.data.role.value, total))
    connection_scores.sort(key=lambda x: x[2], reverse=True)
    top_hubs = connection_scores[:5]
    if top_hubs:
        hub_lines = [f"  - {path} ({role}, {total} connections)" for path, role, total in top_hubs]
        parts.append("**Hub files (most connected):**\n" + "\n".join(hub_lines))

    # 4. Entry points (files with no importers that import others)
    entry_points = []
    for node in graph.nodes:
        imports = import_counts.get(node.id, 0)
        imported_by = imported_by_counts.get(node.id, 0)
        if imported_by == 0 and imports > 0:
            entry_points.append((node.data.path, node.data.role.value, imports))
    entry_points.sort(key=lambda x: x[2], reverse=True)
    top_entries = entry_points[:3]
    if top_entries:
        entry_lines = [f"  - {path} ({role})" for path, role, _ in top_entries]
        parts.append("**Entry points:**\n" + "\n".join(entry_lines))

    return "\n".join(parts) if parts else ""


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
