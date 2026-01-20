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
        """Explain what highlighted text refers to with improved fuzzy matching."""
        text_clean = text.strip()
        text_lower = text_clean.lower()

        # Extract potential tokens for matching (handles camelCase, paths, etc.)
        tokens = self._extract_tokens(text_clean)

        # 1. Try exact file match first
        node = self._find_node(text_clean)
        if node:
            return self._file_match_result(node)

        # 2. Try exact function match
        func_match = self._find_function_exact(text_lower)
        if func_match:
            return func_match

        # 3. Try architectural role match (including partial matches)
        role_match = self._find_role_match(text_lower)
        if role_match:
            return role_match

        # 4. Try category match
        cat_match = self._find_category_match(text_lower)
        if cat_match:
            return cat_match

        # 5. Try fuzzy file matching with scoring
        file_matches = self._fuzzy_find_files(text_clean, tokens)
        if file_matches:
            if len(file_matches) == 1:
                return self._file_match_result(file_matches[0]["node"])
            return {
                "type": "file_candidates",
                "match": text_clean,
                "details": {
                    "possible_files": [
                        {
                            "path": m["node"].data.path,
                            "name": m["node"].data.label,
                            "score": m["score"],
                            "role": m["node"].data.role.value
                        }
                        for m in file_matches[:5]
                    ],
                    "message": f"Found {len(file_matches)} files that might match '{text_clean}'."
                }
            }

        # 6. Try fuzzy function matching
        func_matches = self._fuzzy_find_functions(text_lower, tokens)
        if func_matches:
            if len(func_matches) == 1:
                return self._function_match_result(func_matches[0]["func"])
            return {
                "type": "function_candidates",
                "match": text_clean,
                "details": {
                    "possible_functions": [
                        {
                            "name": m["func"].get("function_name"),
                            "file": m["func"].get("file_path"),
                            "tier": m["func"].get("tier"),
                            "score": m["score"]
                        }
                        for m in func_matches[:5]
                    ],
                    "message": f"Found {len(func_matches)} functions that might match '{text_clean}'."
                }
            }

        # 7. Check if it looks like an import path
        if "/" in text_clean or text_clean.startswith("@") or text_clean.startswith("~"):
            import_match = self._find_import_reference(text_clean)
            if import_match:
                return import_match

        # 8. Final fallback - general search
        search_result = self._search_files(query=text_clean)
        if search_result.get("count", 0) > 0:
            return {
                "type": "search_result",
                "match": text_clean,
                "details": {
                    "possible_matches": search_result["files"][:5],
                    "message": f"No exact match found. Found {search_result['count']} files containing '{text_clean}'."
                }
            }

        return {
            "type": "unknown",
            "match": text_clean,
            "details": {
                "message": f"Could not find any reference to '{text_clean}' in the analyzed codebase.",
                "suggestions": [
                    "Try selecting the full file name with extension",
                    "Check if this is a node_modules dependency (not included in analysis)",
                    "Try searching for a specific function or class name"
                ]
            }
        }

    def _extract_tokens(self, text: str) -> list[str]:
        """Extract meaningful tokens from text for fuzzy matching."""
        import re
        tokens = set()

        # Add the full text
        tokens.add(text.lower())

        # Split by common delimiters
        parts = re.split(r'[/\\._\-\s]+', text)
        for part in parts:
            if part:
                tokens.add(part.lower())

        # Handle camelCase and PascalCase
        camel_parts = re.findall(r'[A-Z]?[a-z]+|[A-Z]+(?=[A-Z][a-z]|\d|\W|$)|\d+', text)
        for part in camel_parts:
            if part:
                tokens.add(part.lower())

        # Remove very short tokens (less than 2 chars)
        tokens = {t for t in tokens if len(t) >= 2}

        return list(tokens)

    def _file_match_result(self, node) -> dict[str, Any]:
        """Create a file match result."""
        return {
            "type": "file",
            "match": node.data.path,
            "details": {
                "name": node.data.label,
                "role": node.data.role.value,
                "category": node.data.category.value,
                "description": node.data.description,
                "language": node.data.language.value,
                "line_count": node.data.line_count
            }
        }

    def _function_match_result(self, func: dict) -> dict[str, Any]:
        """Create a function match result."""
        return {
            "type": "function",
            "match": func.get("qualified_name"),
            "details": {
                "function_name": func.get("function_name"),
                "file_path": func.get("file_path"),
                "tier": func.get("tier"),
                "call_count": func.get("internal_call_count", 0) + func.get("external_call_count", 0),
                "is_exported": func.get("is_exported", False),
                "is_async": func.get("is_async", False),
                "function_type": func.get("function_type")
            }
        }

    def _find_function_exact(self, text_lower: str) -> Optional[dict[str, Any]]:
        """Find an exact function match."""
        if not self.tier_list:
            return None

        for func in self.tier_list:
            func_name = func.get("function_name", "").lower()
            qualified_name = func.get("qualified_name", "").lower()
            if text_lower == func_name or text_lower == qualified_name:
                return self._function_match_result(func)

        return None

    def _find_role_match(self, text_lower: str) -> Optional[dict[str, Any]]:
        """Find a role match, including partial matches."""
        for role in ArchitecturalRole:
            role_value = role.value.lower()
            role_readable = role.value.replace("_", " ").lower()

            if text_lower == role_value or text_lower == role_readable:
                return self._role_match_result(role)

            # Partial match (e.g., "component" matches "react_component")
            if text_lower in role_readable or role_readable in text_lower:
                return self._role_match_result(role)

        return None

    def _role_match_result(self, role: ArchitecturalRole) -> dict[str, Any]:
        """Create a role match result."""
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
                "description": self._get_role_description(role),
                "file_count": len([n for n in self.graph.nodes if n.data.role == role]),
                "sample_files": matching_files
            }
        }

    def _get_role_description(self, role: ArchitecturalRole) -> str:
        """Get a human-readable description of a role."""
        descriptions = {
            ArchitecturalRole.REACT_COMPONENT: "React UI components that render user interfaces",
            ArchitecturalRole.UTILITY: "Helper functions and utility code",
            ArchitecturalRole.API_SERVICE: "API clients and service integrations",
            ArchitecturalRole.MODEL: "Data models and type definitions",
            ArchitecturalRole.CONFIG: "Configuration files and settings",
            ArchitecturalRole.TEST: "Test files and test utilities",
            ArchitecturalRole.HOOK: "React hooks for state and side effects",
            ArchitecturalRole.CONTEXT: "React context providers for state sharing",
            ArchitecturalRole.STORE: "State management stores (Redux, Zustand, etc.)",
            ArchitecturalRole.MIDDLEWARE: "Middleware functions for request processing",
            ArchitecturalRole.CONTROLLER: "Controller logic for handling requests",
            ArchitecturalRole.ROUTER: "Routing definitions and route handlers",
            ArchitecturalRole.SCHEMA: "Schema definitions for data validation",
            ArchitecturalRole.UNKNOWN: "Files with unclassified roles"
        }
        return descriptions.get(role, "")

    def _find_category_match(self, text_lower: str) -> Optional[dict[str, Any]]:
        """Find a category match."""
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
        return None

    def _fuzzy_find_files(self, text: str, tokens: list[str]) -> list[dict]:
        """Find files using fuzzy matching with scoring."""
        matches = []
        text_lower = text.lower()

        for node in self.graph.nodes:
            score = 0
            name_lower = node.data.label.lower()
            path_lower = node.data.path.lower()

            # Exact name match (highest score)
            if text_lower == name_lower:
                score = 100
            # Name without extension match
            elif text_lower == name_lower.rsplit(".", 1)[0]:
                score = 90
            # Name contains text
            elif text_lower in name_lower:
                score = 70
            # Path contains text
            elif text_lower in path_lower:
                score = 50
            # Token matching
            else:
                token_matches = sum(1 for t in tokens if t in name_lower or t in path_lower)
                if token_matches > 0:
                    score = 30 + (token_matches * 10)

            if score > 0:
                matches.append({"node": node, "score": score})

        # Sort by score descending
        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches[:10]

    def _fuzzy_find_functions(self, text_lower: str, tokens: list[str]) -> list[dict]:
        """Find functions using fuzzy matching with scoring."""
        if not self.tier_list:
            return []

        matches = []

        for func in self.tier_list:
            score = 0
            func_name = func.get("function_name", "").lower()
            qualified_name = func.get("qualified_name", "").lower()

            # Exact match
            if text_lower == func_name:
                score = 100
            # Qualified name match
            elif text_lower in qualified_name:
                score = 80
            # Function name contains text
            elif text_lower in func_name:
                score = 60
            # Token matching
            else:
                token_matches = sum(1 for t in tokens if t in func_name)
                if token_matches > 0:
                    score = 30 + (token_matches * 10)

            if score > 0:
                matches.append({"func": func, "score": score})

        # Sort by score descending
        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches[:10]

    def _find_import_reference(self, text: str) -> Optional[dict[str, Any]]:
        """Find files that might be referenced by an import path."""
        text_lower = text.lower()

        # Remove common prefixes
        clean_path = text_lower
        for prefix in ["@/", "~/", "../", "./"]:
            if clean_path.startswith(prefix):
                clean_path = clean_path[len(prefix):]
                break

        # Find files with matching path segments
        matches = []
        for node in self.graph.nodes:
            path_lower = node.data.path.lower()
            if clean_path in path_lower or path_lower.endswith(clean_path):
                matches.append(node)

        if len(matches) == 1:
            return self._file_match_result(matches[0])
        elif len(matches) > 1:
            return {
                "type": "import_reference",
                "match": text,
                "details": {
                    "possible_files": [
                        {"path": n.data.path, "name": n.data.label}
                        for n in matches[:5]
                    ],
                    "message": f"Import path '{text}' could refer to {len(matches)} files."
                }
            }

        return None
