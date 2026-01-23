"""Smart formatting for tool output previews in chat messages."""
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ToolOutputFormatter:
    """
    Formats tool outputs into human-readable previews for display in chat messages.

    Each tool type has a custom formatter that extracts the most relevant information
    for quick viewing without showing the full JSON output.
    """

    MAX_PREVIEW_LENGTH = 300
    MAX_LIST_ITEMS = 5
    MAX_STRING_LENGTH = 100

    @classmethod
    def format_preview(cls, tool_name: str, result: Any) -> str:
        """
        Format a tool result into a human-readable preview.

        Args:
            tool_name: Name of the tool that was executed
            result: The raw result from the tool

        Returns:
            A formatted preview string
        """
        if isinstance(result, str):
            try:
                result = json.loads(result)
            except json.JSONDecodeError:
                return cls._truncate(result)

        if not isinstance(result, dict):
            return cls._truncate(str(result))

        # Check for error in result
        if result.get("error"):
            return f"Error: {result['error']}"

        # Use tool-specific formatter if available
        formatter = cls._get_formatter(tool_name)
        if formatter:
            try:
                return formatter(result)
            except Exception as e:
                logger.debug(f"Custom formatter failed for {tool_name}: {e}")

        # Default: summarize the dict
        return cls._format_default(result)

    @classmethod
    def _get_formatter(cls, tool_name: str):
        """Get the formatter function for a specific tool."""
        formatters = {
            "get_file_info": cls._format_file_info,
            "search_files": cls._format_search_files,
            "get_dependencies": cls._format_dependencies,
            "get_dependents": cls._format_dependents,
            "analyze_imports": cls._format_imports,
            "get_files_by_role": cls._format_files_by_role,
            "get_codebase_summary": cls._format_codebase_summary,
            "detect_circular_dependencies": cls._format_circular_deps,
            "find_dependency_path": cls._format_dependency_path,
            "compare_files": cls._format_compare_files,
            "get_metrics": cls._format_metrics,
            "get_function_info": cls._format_function_info,
            "search_functions": cls._format_search_functions,
            "get_callers": cls._format_callers,
            "get_callees": cls._format_callees,
        }
        return formatters.get(tool_name)

    @classmethod
    def _format_file_info(cls, result: dict) -> str:
        """Format get_file_info result."""
        lines = []
        if result.get("name"):
            lines.append(f"File: {result['name']}")
        if result.get("role"):
            lines.append(f"Role: {result['role']}")
        if result.get("description"):
            desc = cls._truncate(result["description"], 80)
            lines.append(f"Description: {desc}")
        if result.get("line_count"):
            lines.append(f"Lines: {result['line_count']}")
        if result.get("imports"):
            import_count = len(result["imports"])
            lines.append(f"Imports: {import_count} files")
        return "\n".join(lines) if lines else cls._format_default(result)

    @classmethod
    def _format_search_files(cls, result: dict) -> str:
        """Format search_files result."""
        files = result.get("files", [])
        total = result.get("total_matches", len(files))

        if not files:
            return "No files found"

        file_names = [f.get("name", "?") for f in files[:cls.MAX_LIST_ITEMS]]
        preview = ", ".join(file_names)

        if total > cls.MAX_LIST_ITEMS:
            preview += f" (+{total - cls.MAX_LIST_ITEMS} more)"

        return f"Found {total} files: {preview}"

    @classmethod
    def _format_dependencies(cls, result: dict) -> str:
        """Format get_dependencies result."""
        deps = result.get("dependencies", [])
        total = len(deps)

        if not deps:
            return "No dependencies found"

        names = [d.get("name", "?") for d in deps[:cls.MAX_LIST_ITEMS]]
        preview = ", ".join(names)

        if total > cls.MAX_LIST_ITEMS:
            preview += f" (+{total - cls.MAX_LIST_ITEMS} more)"

        return f"{total} dependencies: {preview}"

    @classmethod
    def _format_dependents(cls, result: dict) -> str:
        """Format get_dependents result."""
        deps = result.get("dependents", [])
        total = len(deps)

        if not deps:
            return "No dependents found (no files import this)"

        names = [d.get("name", "?") for d in deps[:cls.MAX_LIST_ITEMS]]
        preview = ", ".join(names)

        if total > cls.MAX_LIST_ITEMS:
            preview += f" (+{total - cls.MAX_LIST_ITEMS} more)"

        return f"{total} files depend on this: {preview}"

    @classmethod
    def _format_imports(cls, result: dict) -> str:
        """Format analyze_imports result."""
        imports = result.get("imports", [])
        external = result.get("external_modules", [])

        lines = []
        if imports:
            lines.append(f"Internal imports: {len(imports)}")
        if external:
            lines.append(f"External modules: {', '.join(external[:5])}")
            if len(external) > 5:
                lines[-1] += f" (+{len(external) - 5} more)"

        return "\n".join(lines) if lines else "No imports found"

    @classmethod
    def _format_files_by_role(cls, result: dict) -> str:
        """Format get_files_by_role result."""
        files = result.get("files", [])
        role = result.get("role", "?")
        total = len(files)

        if not files:
            return f"No files with role '{role}' found"

        names = [f.get("name", "?") for f in files[:cls.MAX_LIST_ITEMS]]
        preview = ", ".join(names)

        if total > cls.MAX_LIST_ITEMS:
            preview += f" (+{total - cls.MAX_LIST_ITEMS} more)"

        return f"{total} {role} files: {preview}"

    @classmethod
    def _format_codebase_summary(cls, result: dict) -> str:
        """Format get_codebase_summary result."""
        lines = []
        if result.get("file_count"):
            lines.append(f"Files: {result['file_count']}")
        if result.get("total_lines"):
            lines.append(f"Total lines: {result['total_lines']:,}")

        role_counts = result.get("role_distribution", {})
        if role_counts:
            top_roles = sorted(role_counts.items(), key=lambda x: x[1], reverse=True)[:3]
            role_str = ", ".join(f"{r}: {c}" for r, c in top_roles)
            lines.append(f"Top roles: {role_str}")

        return "\n".join(lines) if lines else cls._format_default(result)

    @classmethod
    def _format_circular_deps(cls, result: dict) -> str:
        """Format detect_circular_dependencies result."""
        cycles = result.get("cycles", [])
        has_cycles = result.get("has_cycles", False)

        if not has_cycles:
            return "No circular dependencies detected"

        cycle_count = len(cycles)
        if cycles:
            first_cycle = " -> ".join(cycles[0][:4])
            if len(cycles[0]) > 4:
                first_cycle += " -> ..."
            return f"Found {cycle_count} circular dependency chains\nExample: {first_cycle}"

        return f"Found {cycle_count} circular dependency chains"

    @classmethod
    def _format_dependency_path(cls, result: dict) -> str:
        """Format find_dependency_path result."""
        path = result.get("path", [])
        connected = result.get("connected", False)

        if not connected:
            return "No dependency path found between these files"

        path_str = " -> ".join(path[:6])
        if len(path) > 6:
            path_str += f" -> ... ({len(path)} total steps)"

        return f"Path found: {path_str}"

    @classmethod
    def _format_compare_files(cls, result: dict) -> str:
        """Format compare_files result."""
        lines = []

        file_a = result.get("file_a", {})
        file_b = result.get("file_b", {})

        if file_a.get("name") and file_b.get("name"):
            lines.append(f"Comparing: {file_a['name']} vs {file_b['name']}")

        if file_a.get("role") or file_b.get("role"):
            lines.append(f"Roles: {file_a.get('role', '?')} vs {file_b.get('role', '?')}")

        shared = result.get("shared_dependencies", [])
        if shared:
            lines.append(f"Shared dependencies: {len(shared)}")

        return "\n".join(lines) if lines else cls._format_default(result)

    @classmethod
    def _format_metrics(cls, result: dict) -> str:
        """Format get_metrics result."""
        lines = []

        if "most_connected" in result:
            top = result["most_connected"][:3]
            names = [f"{f.get('name', '?')} ({f.get('total_connections', 0)})" for f in top]
            lines.append(f"Most connected: {', '.join(names)}")

        if "dependency_stats" in result:
            stats = result["dependency_stats"]
            lines.append(f"Avg dependencies: {stats.get('average', 0):.1f}")

        if "role_distribution" in result:
            dist = result["role_distribution"]
            lines.append(f"Role distribution: {len(dist)} roles")

        return "\n".join(lines) if lines else cls._format_default(result)

    @classmethod
    def _format_function_info(cls, result: dict) -> str:
        """Format get_function_info result."""
        lines = []

        if result.get("function_name"):
            lines.append(f"Function: {result['function_name']}")
        if result.get("file_path"):
            lines.append(f"File: {result['file_path']}")
        if result.get("tier"):
            lines.append(f"Tier: {result['tier']}")
        if result.get("function_type"):
            lines.append(f"Type: {result['function_type']}")

        call_info = []
        if result.get("internal_call_count"):
            call_info.append(f"{result['internal_call_count']} internal calls")
        if result.get("external_call_count"):
            call_info.append(f"{result['external_call_count']} external calls")
        if call_info:
            lines.append(f"Calls: {', '.join(call_info)}")

        return "\n".join(lines) if lines else cls._format_default(result)

    @classmethod
    def _format_search_functions(cls, result: dict) -> str:
        """Format search_functions result."""
        functions = result.get("functions", [])
        total = result.get("total_matches", len(functions))

        if not functions:
            return "No functions found"

        names = [f.get("function_name", "?") for f in functions[:cls.MAX_LIST_ITEMS]]
        preview = ", ".join(names)

        if total > cls.MAX_LIST_ITEMS:
            preview += f" (+{total - cls.MAX_LIST_ITEMS} more)"

        return f"Found {total} functions: {preview}"

    @classmethod
    def _format_callers(cls, result: dict) -> str:
        """Format get_callers result."""
        callers = result.get("callers", [])
        total = len(callers)

        if not callers:
            return "No callers found"

        names = [c.get("function_name", "?") for c in callers[:cls.MAX_LIST_ITEMS]]
        preview = ", ".join(names)

        if total > cls.MAX_LIST_ITEMS:
            preview += f" (+{total - cls.MAX_LIST_ITEMS} more)"

        return f"{total} functions call this: {preview}"

    @classmethod
    def _format_callees(cls, result: dict) -> str:
        """Format get_callees result."""
        callees = result.get("callees", [])
        total = len(callees)

        if not callees:
            return "No callees found"

        names = [c.get("function_name", "?") for c in callees[:cls.MAX_LIST_ITEMS]]
        preview = ", ".join(names)

        if total > cls.MAX_LIST_ITEMS:
            preview += f" (+{total - cls.MAX_LIST_ITEMS} more)"

        return f"Calls {total} functions: {preview}"

    @classmethod
    def _format_default(cls, result: dict) -> str:
        """Default formatter for unknown tool results."""
        # Extract key information from dict
        summary_parts = []

        for key in ["name", "file", "path", "count", "total", "found"]:
            if key in result:
                value = result[key]
                if isinstance(value, (str, int, float)):
                    summary_parts.append(f"{key}: {value}")

        if summary_parts:
            return ", ".join(summary_parts[:4])

        # Fallback to truncated JSON
        return cls._truncate(json.dumps(result, indent=None))

    @classmethod
    def _truncate(cls, text: str, max_length: Optional[int] = None) -> str:
        """Truncate text to max length with ellipsis."""
        max_len = max_length or cls.MAX_PREVIEW_LENGTH
        if len(text) <= max_len:
            return text
        return text[:max_len - 3] + "..."
