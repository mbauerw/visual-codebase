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
            "detect_circular_dependencies": cls._format_circular_deps,
            "find_dependency_path": cls._format_dependency_path,
            "compare_files": cls._format_compare_files,
            "get_metrics": cls._format_metrics,
            "get_function_info": cls._format_function_info,
            "list_functions": cls._format_list_functions,
            "explain_highlighted": cls._format_explain_highlighted,
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
    def _format_list_functions(cls, result: dict) -> str:
        """Format list_functions result."""
        functions = result.get("functions", [])
        total = result.get("count", len(functions))
        tier = result.get("tier_filter")
        file_filter = result.get("file_filter")

        if not functions:
            filter_desc = []
            if tier:
                filter_desc.append(f"tier {tier}")
            if file_filter:
                filter_desc.append(f"in {file_filter}")
            filter_str = " ".join(filter_desc) if filter_desc else ""
            return f"No functions found{' ' + filter_str if filter_str else ''}"

        # Show function names with their tiers
        func_strs = []
        for f in functions[:cls.MAX_LIST_ITEMS]:
            name = f.get("function_name", "?")
            tier_val = f.get("tier", "")
            func_strs.append(f"{name} ({tier_val})" if tier_val else name)

        preview = ", ".join(func_strs)
        if total > cls.MAX_LIST_ITEMS:
            preview += f" (+{total - cls.MAX_LIST_ITEMS} more)"

        return f"Found {total} functions: {preview}"

    @classmethod
    def _format_explain_highlighted(cls, result: dict) -> str:
        """Format explain_highlighted result."""
        match_type = result.get("match_type", "unknown")
        text = result.get("text", "")

        if match_type == "file":
            file_info = result.get("file", {})
            name = file_info.get("name", text)
            role = file_info.get("role", "")
            return f"File: {name}" + (f" ({role})" if role else "")

        elif match_type == "function":
            func_info = result.get("function", {})
            name = func_info.get("function_name", text)
            tier = func_info.get("tier", "")
            file_path = func_info.get("file_path", "")
            parts = [f"Function: {name}"]
            if tier:
                parts.append(f"Tier: {tier}")
            if file_path:
                parts.append(f"In: {file_path}")
            return "\n".join(parts)

        elif match_type == "role":
            role = result.get("role", text)
            count = result.get("file_count", 0)
            return f"Architectural role: {role} ({count} files)"

        elif match_type == "category":
            category = result.get("category", text)
            count = result.get("file_count", 0)
            return f"Category: {category} ({count} files)"

        elif match_type == "no_match":
            return f"No match found for: {text}"

        # Default
        return f"Matched: {text} ({match_type})"

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
