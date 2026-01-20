"""Tool definitions and executors for the chatbot."""
import logging
from typing import Any, Optional

from ..models.schemas import (
    ReactFlowGraph,
    ReactFlowNode,
    DependencyEdge,
    ArchitecturalRole,
    Category,
    TierLevel,
)

logger = logging.getLogger(__name__)


# Tool definitions for Claude's tool use feature
CHAT_TOOLS = [
    {
        "name": "get_file_info",
        "description": "Get detailed analysis of a specific file including its role, category, description, and metrics",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "File path or name (e.g., 'src/utils/auth.ts' or 'auth.ts')"
                }
            },
            "required": ["filename"]
        }
    },
    {
        "name": "search_files",
        "description": "Search for files by name pattern, architectural role, category, or keyword in description",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search term to match against file names or descriptions"
                },
                "role": {
                    "type": "string",
                    "enum": [r.value for r in ArchitecturalRole],
                    "description": "Filter by architectural role"
                },
                "category": {
                    "type": "string",
                    "enum": [c.value for c in Category],
                    "description": "Filter by category"
                }
            }
        }
    },
    {
        "name": "get_dependencies",
        "description": "Get files that a specific file imports from, or files that import from it",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "File path or name"
                },
                "direction": {
                    "type": "string",
                    "enum": ["imports", "imported_by", "both"],
                    "description": "Direction of dependencies to retrieve"
                }
            },
            "required": ["filename"]
        }
    },
    {
        "name": "get_function_info",
        "description": "Get detailed information about a function including its tier, call count, and callers/callees",
        "input_schema": {
            "type": "object",
            "properties": {
                "function_name": {
                    "type": "string",
                    "description": "Name of the function"
                },
                "file_path": {
                    "type": "string",
                    "description": "Optional file path to disambiguate functions with the same name"
                }
            },
            "required": ["function_name"]
        }
    },
    {
        "name": "list_functions",
        "description": "List functions filtered by tier, file, or minimum call count",
        "input_schema": {
            "type": "object",
            "properties": {
                "tier": {
                    "type": "string",
                    "enum": [t.value for t in TierLevel],
                    "description": "Filter by function tier"
                },
                "file_path": {
                    "type": "string",
                    "description": "Filter to functions in a specific file"
                },
                "min_calls": {
                    "type": "integer",
                    "description": "Minimum number of calls to include"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results to return (default 20)"
                }
            }
        }
    },
    {
        "name": "get_codebase_summary",
        "description": "Get the high-level codebase summary, statistics, and language distribution",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "explain_highlighted",
        "description": "Find and explain what highlighted text refers to in the codebase (file name, function name, import, etc.)",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The highlighted text to explain"
                }
            },
            "required": ["text"]
        }
    }
]


class ChatToolExecutor:
    """Executes chat tools against analysis data."""

    def __init__(self, graph: ReactFlowGraph, tier_list: Optional[list] = None):
        """Initialize with analysis data.

        Args:
            graph: The ReactFlowGraph containing nodes, edges, and metadata
            tier_list: Optional list of function tier items
        """
        self.graph = graph
        self.tier_list = tier_list or []

        # Build lookup indexes for efficient queries
        self._node_by_id: dict[str, ReactFlowNode] = {n.id: n for n in graph.nodes}
        self._node_by_path: dict[str, ReactFlowNode] = {}
        self._node_by_name: dict[str, list[ReactFlowNode]] = {}

        for node in graph.nodes:
            # Index by full path
            self._node_by_path[node.data.path] = node
            # Index by filename (may have multiple)
            name = node.data.label
            if name not in self._node_by_name:
                self._node_by_name[name] = []
            self._node_by_name[name].append(node)

    def execute_tool(self, tool_name: str, tool_input: dict[str, Any]) -> dict[str, Any]:
        """Execute a tool and return the result.

        Args:
            tool_name: Name of the tool to execute
            tool_input: Input parameters for the tool

        Returns:
            Dictionary containing the tool result
        """
        try:
            if tool_name == "get_file_info":
                return self._get_file_info(tool_input.get("filename", ""))
            elif tool_name == "search_files":
                return self._search_files(
                    query=tool_input.get("query"),
                    role=tool_input.get("role"),
                    category=tool_input.get("category")
                )
            elif tool_name == "get_dependencies":
                return self._get_dependencies(
                    filename=tool_input.get("filename", ""),
                    direction=tool_input.get("direction", "both")
                )
            elif tool_name == "get_function_info":
                return self._get_function_info(
                    function_name=tool_input.get("function_name", ""),
                    file_path=tool_input.get("file_path")
                )
            elif tool_name == "list_functions":
                return self._list_functions(
                    tier=tool_input.get("tier"),
                    file_path=tool_input.get("file_path"),
                    min_calls=tool_input.get("min_calls"),
                    limit=tool_input.get("limit", 20)
                )
            elif tool_name == "get_codebase_summary":
                return self._get_codebase_summary()
            elif tool_name == "explain_highlighted":
                return self._explain_highlighted(tool_input.get("text", ""))
            else:
                return {"error": f"Unknown tool: {tool_name}"}
        except Exception as e:
            logger.error(f"Tool execution error for {tool_name}: {e}")
            return {"error": str(e)}

    def _find_node(self, filename: str) -> Optional[ReactFlowNode]:
        """Find a node by filename, path, or partial match."""
        # Try exact path match
        if filename in self._node_by_path:
            return self._node_by_path[filename]

        # Try exact name match
        if filename in self._node_by_name:
            nodes = self._node_by_name[filename]
            if len(nodes) == 1:
                return nodes[0]
            # Multiple matches - return first, let caller handle disambiguation
            return nodes[0]

        # Try partial path match (e.g., "auth.ts" matching "src/utils/auth.ts")
        filename_lower = filename.lower()
        for path, node in self._node_by_path.items():
            if path.lower().endswith(filename_lower) or filename_lower in path.lower():
                return node

        return None

    def _get_file_info(self, filename: str) -> dict[str, Any]:
        """Get detailed information about a file."""
        node = self._find_node(filename)
        if not node:
            return {"error": f"File not found: {filename}"}

        return {
            "path": node.data.path,
            "name": node.data.label,
            "folder": node.data.folder,
            "language": node.data.language.value,
            "role": node.data.role.value,
            "category": node.data.category.value,
            "description": node.data.description,
            "line_count": node.data.line_count,
            "size_bytes": node.data.size_bytes,
            "imports": node.data.imports
        }

    def _search_files(
        self,
        query: Optional[str] = None,
        role: Optional[str] = None,
        category: Optional[str] = None
    ) -> dict[str, Any]:
        """Search for files matching criteria."""
        results = []
        query_lower = query.lower() if query else None

        for node in self.graph.nodes:
            # Filter by role
            if role and node.data.role.value != role:
                continue

            # Filter by category
            if category and node.data.category.value != category:
                continue

            # Filter by query (match name, path, or description)
            if query_lower:
                name_match = query_lower in node.data.label.lower()
                path_match = query_lower in node.data.path.lower()
                desc_match = query_lower in node.data.description.lower()
                if not (name_match or path_match or desc_match):
                    continue

            results.append({
                "path": node.data.path,
                "name": node.data.label,
                "role": node.data.role.value,
                "category": node.data.category.value,
                "description": node.data.description[:100] + "..." if len(node.data.description) > 100 else node.data.description
            })

            # Limit results
            if len(results) >= 20:
                break

        return {
            "count": len(results),
            "files": results,
            "truncated": len(results) >= 20
        }

    def _get_dependencies(self, filename: str, direction: str = "both") -> dict[str, Any]:
        """Get dependencies for a file."""
        node = self._find_node(filename)
        if not node:
            return {"error": f"File not found: {filename}"}

        imports = []
        imported_by = []

        for edge in self.graph.edges:
            if direction in ("imports", "both") and edge.source == node.id:
                target_node = self._node_by_id.get(edge.target)
                if target_node:
                    imports.append({
                        "path": target_node.data.path,
                        "name": target_node.data.label,
                        "imported_names": edge.data.imported_names if edge.data else []
                    })

            if direction in ("imported_by", "both") and edge.target == node.id:
                source_node = self._node_by_id.get(edge.source)
                if source_node:
                    imported_by.append({
                        "path": source_node.data.path,
                        "name": source_node.data.label,
                        "imported_names": edge.data.imported_names if edge.data else []
                    })

        result = {"file": node.data.path}
        if direction in ("imports", "both"):
            result["imports"] = imports
            result["import_count"] = len(imports)
        if direction in ("imported_by", "both"):
            result["imported_by"] = imported_by
            result["imported_by_count"] = len(imported_by)

        return result

    def _get_function_info(self, function_name: str, file_path: Optional[str] = None) -> dict[str, Any]:
        """Get information about a function."""
        if not self.tier_list:
            return {"error": "Function tier data not available for this analysis"}

        matches = []
        for func in self.tier_list:
            name_match = (
                func.get("function_name", "").lower() == function_name.lower() or
                func.get("qualified_name", "").lower().endswith(function_name.lower())
            )
            if name_match:
                if file_path:
                    if file_path.lower() in func.get("file_path", "").lower():
                        matches.append(func)
                else:
                    matches.append(func)

        if not matches:
            return {"error": f"Function not found: {function_name}"}

        if len(matches) == 1:
            func = matches[0]
            return {
                "function_name": func.get("function_name"),
                "qualified_name": func.get("qualified_name"),
                "file_path": func.get("file_path"),
                "tier": func.get("tier"),
                "internal_call_count": func.get("internal_call_count", 0),
                "external_call_count": func.get("external_call_count", 0),
                "is_exported": func.get("is_exported", False),
                "is_entry_point": func.get("is_entry_point", False),
                "function_type": func.get("function_type"),
                "start_line": func.get("start_line"),
                "is_async": func.get("is_async", False)
            }

        # Multiple matches - return summary
        return {
            "multiple_matches": True,
            "count": len(matches),
            "functions": [
                {
                    "function_name": f.get("function_name"),
                    "file_path": f.get("file_path"),
                    "tier": f.get("tier")
                }
                for f in matches[:10]
            ],
            "message": "Multiple functions found. Specify file_path to disambiguate."
        }

    def _list_functions(
        self,
        tier: Optional[str] = None,
        file_path: Optional[str] = None,
        min_calls: Optional[int] = None,
        limit: int = 20
    ) -> dict[str, Any]:
        """List functions matching criteria."""
        if not self.tier_list:
            return {"error": "Function tier data not available for this analysis"}

        results = []
        for func in self.tier_list:
            # Filter by tier
            if tier and func.get("tier") != tier:
                continue

            # Filter by file path
            if file_path and file_path.lower() not in func.get("file_path", "").lower():
                continue

            # Filter by minimum calls
            total_calls = func.get("internal_call_count", 0) + func.get("external_call_count", 0)
            if min_calls and total_calls < min_calls:
                continue

            results.append({
                "function_name": func.get("function_name"),
                "qualified_name": func.get("qualified_name"),
                "file_path": func.get("file_path"),
                "tier": func.get("tier"),
                "call_count": total_calls
            })

            if len(results) >= limit:
                break

        return {
            "count": len(results),
            "functions": results,
            "truncated": len(results) >= limit
        }

    def _get_codebase_summary(self) -> dict[str, Any]:
        """Get codebase summary from metadata."""
        metadata = self.graph.metadata

        result = {
            "analysis_id": metadata.analysis_id,
            "file_count": metadata.file_count,
            "edge_count": metadata.edge_count,
            "languages": metadata.languages,
            "analysis_time_seconds": metadata.analysis_time_seconds
        }

        if metadata.summary:
            result["project_type"] = metadata.summary.project_type
            result["primary_purpose"] = metadata.summary.primary_purpose
            result["architecture_summary"] = metadata.summary.architecture_summary
            result["tech_stack"] = {
                "languages": metadata.summary.tech_stack.languages,
                "frameworks": metadata.summary.tech_stack.frameworks,
                "key_patterns": metadata.summary.tech_stack.key_patterns
            }
            result["key_modules"] = [
                {"name": m.name, "purpose": m.purpose}
                for m in metadata.summary.key_modules
            ]
            result["complexity"] = {
                "level": metadata.summary.complexity_assessment.level,
                "reasoning": metadata.summary.complexity_assessment.reasoning
            }

        if metadata.function_stats:
            result["function_stats"] = {
                "total_functions": metadata.function_stats.total_functions,
                "total_calls": metadata.function_stats.total_calls,
                "tier_counts": metadata.function_stats.tier_counts,
                "top_functions": metadata.function_stats.top_functions
            }

        return result

    def _explain_highlighted(self, text: str) -> dict[str, Any]:
        """Explain what highlighted text refers to."""
        text_lower = text.lower().strip()

        # Try to match as file
        node = self._find_node(text)
        if node:
            return {
                "type": "file",
                "match": node.data.path,
                "details": {
                    "name": node.data.label,
                    "role": node.data.role.value,
                    "category": node.data.category.value,
                    "description": node.data.description,
                    "language": node.data.language.value
                }
            }

        # Try to match as function
        if self.tier_list:
            for func in self.tier_list:
                if (text_lower == func.get("function_name", "").lower() or
                    text_lower in func.get("qualified_name", "").lower()):
                    return {
                        "type": "function",
                        "match": func.get("qualified_name"),
                        "details": {
                            "function_name": func.get("function_name"),
                            "file_path": func.get("file_path"),
                            "tier": func.get("tier"),
                            "call_count": func.get("internal_call_count", 0) + func.get("external_call_count", 0),
                            "is_exported": func.get("is_exported", False)
                        }
                    }

        # Try to match as architectural role
        for role in ArchitecturalRole:
            if text_lower == role.value.replace("_", " ") or text_lower == role.value:
                matching_files = [
                    {"path": n.data.path, "name": n.data.label}
                    for n in self.graph.nodes
                    if n.data.role == role
                ][:10]
                return {
                    "type": "architectural_role",
                    "match": role.value,
                    "details": {
                        "role": role.value,
                        "file_count": len([n for n in self.graph.nodes if n.data.role == role]),
                        "sample_files": matching_files
                    }
                }

        # Try to match as category
        for cat in Category:
            if text_lower == cat.value:
                matching_files = [
                    {"path": n.data.path, "name": n.data.label}
                    for n in self.graph.nodes
                    if n.data.category == cat
                ][:10]
                return {
                    "type": "category",
                    "match": cat.value,
                    "details": {
                        "category": cat.value,
                        "file_count": len([n for n in self.graph.nodes if n.data.category == cat]),
                        "sample_files": matching_files
                    }
                }

        # No match found - try fuzzy search
        search_result = self._search_files(query=text)
        if search_result.get("count", 0) > 0:
            return {
                "type": "search_result",
                "match": text,
                "details": {
                    "possible_matches": search_result["files"][:5],
                    "message": f"No exact match found. Found {search_result['count']} files containing '{text}'."
                }
            }

        return {
            "type": "unknown",
            "match": text,
            "details": {
                "message": f"Could not find any reference to '{text}' in the analyzed codebase."
            }
        }
