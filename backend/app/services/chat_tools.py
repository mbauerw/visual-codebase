"""Tool definitions and executors for the chatbot."""
import json
import logging
from collections import deque
from typing import Any, Optional

from ..models.schemas import (
    ReactFlowGraph,
    ReactFlowNode,
    DependencyEdge,
    ArchitecturalRole,
    Category,
    TierLevel,
)
from .chat_constants import (
    CHARS_PER_TOKEN,
    DEFAULT_SUMMARIZATION_TOKEN_LIMIT,
    DEFAULT_MAX_CYCLES,
    DEFAULT_MAX_DEPTH,
    DEFAULT_FUNCTION_LIST_LIMIT,
)
from .intent_classifier import QuestionIntent

logger = logging.getLogger(__name__)


class ToolResultSummarizer:
    """Summarizes large tool results to fit within token budgets.

    Attributes:
        CHARS_PER_TOKEN: Estimated characters per token for rough token counting.
        DEFAULT_TOKEN_LIMIT: Default maximum tokens for summarized output.
    """

    CHARS_PER_TOKEN = CHARS_PER_TOKEN
    DEFAULT_TOKEN_LIMIT = DEFAULT_SUMMARIZATION_TOKEN_LIMIT

    @classmethod
    def summarize(
        cls,
        result: dict[str, Any],
        token_limit: int = DEFAULT_TOKEN_LIMIT
    ) -> dict[str, Any]:
        """Summarize a tool result to fit within token limit."""
        result_str = json.dumps(result, default=str)
        estimated_tokens = len(result_str) // cls.CHARS_PER_TOKEN

        if estimated_tokens <= token_limit:
            return result

        # Need to summarize
        summarized = cls._apply_summarization(result.copy(), token_limit)

        # Add metadata about summarization
        summarized["_summarized"] = True
        summarized["_original_tokens"] = estimated_tokens

        return summarized

    @classmethod
    def _apply_summarization(
        cls,
        data: dict[str, Any],
        token_limit: int
    ) -> dict[str, Any]:
        """Apply progressive summarization strategies."""
        result = data

        # Strategy 1: Truncate string fields
        result = cls._truncate_strings(result, max_length=100)
        if cls._estimate_tokens(result) <= token_limit:
            return result

        # Strategy 2: Limit array items
        result = cls._limit_arrays(result, max_items=5)
        if cls._estimate_tokens(result) <= token_limit:
            return result

        # Strategy 3: Further limit arrays
        result = cls._limit_arrays(result, max_items=3)
        if cls._estimate_tokens(result) <= token_limit:
            return result

        # Strategy 4: Aggressive truncation
        result = cls._truncate_strings(result, max_length=50)
        result = cls._limit_arrays(result, max_items=2)

        return result

    @classmethod
    def _truncate_strings(cls, obj: Any, max_length: int) -> Any:
        """Recursively truncate string values."""
        if isinstance(obj, str):
            if len(obj) > max_length:
                return obj[:max_length - 3] + "..."
            return obj
        elif isinstance(obj, dict):
            return {k: cls._truncate_strings(v, max_length) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [cls._truncate_strings(item, max_length) for item in obj]
        return obj

    @classmethod
    def _limit_arrays(cls, obj: Any, max_items: int) -> Any:
        """Recursively limit array lengths."""
        if isinstance(obj, list):
            if len(obj) > max_items:
                truncated = obj[:max_items]
                truncated.append({"_truncated": len(obj) - max_items})
                return [cls._limit_arrays(item, max_items) for item in truncated]
            return [cls._limit_arrays(item, max_items) for item in obj]
        elif isinstance(obj, dict):
            return {k: cls._limit_arrays(v, max_items) for k, v in obj.items()}
        return obj

    @classmethod
    def _estimate_tokens(cls, obj: Any) -> int:
        """Estimate token count for an object."""
        return len(json.dumps(obj, default=str)) // cls.CHARS_PER_TOKEN


# Tool definitions for Claude's tool use feature
CHAT_TOOLS = [
    {
        "name": "get_file_info",
        "description": """Get comprehensive analysis of a specific file in the codebase.

Returns: path, name, folder, language, architectural role (e.g., react_component, utility),
AI-generated description, line count, size in bytes, and list of imports.

When to use:
- User asks about a specific file's purpose or functionality
- User wants to know what a file does or its role in the architecture
- User asks about imports/dependencies of a specific file

Examples:
- "What does auth.ts do?" -> get_file_info(filename="auth.ts")
- "What does src/services/api.ts import?" -> get_file_info(filename="src/services/api.ts")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "File path (e.g., 'src/utils/auth.ts') or just filename (e.g., 'auth.ts'). Partial paths work."
                }
            },
            "required": ["filename"]
        }
    },
    {
        "name": "search_files",
        "description": """Search for files by name pattern, architectural role, category, or keyword in description.

Returns: List of matching files with path, name, role, category, and truncated description. Limited to 20 results.

When to use:
- User asks about multiple files (e.g., "all components", "utility files")
- User wants to find files by pattern or role
- User asks about a category of files

Examples:
- "Show me all React components" -> search_files(role="react_component")
- "Find files related to authentication" -> search_files(query="auth")
- "What utility files are there?" -> search_files(role="utility")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search term to match against file names, paths, or descriptions"
                },
                "role": {
                    "type": "string",
                    "enum": [r.value for r in ArchitecturalRole],
                    "description": "Filter by architectural role: react_component, utility, api_service, model, config, test, hook, context, store, middleware, controller, router, schema"
                },
                "category": {
                    "type": "string",
                    "enum": [c.value for c in Category],
                    "description": "Filter by category: frontend, backend, shared, infrastructure, test, config"
                }
            }
        }
    },
    {
        "name": "get_dependencies",
        "description": """Get the import/export relationships for a specific file.

Returns: List of files this file imports from, and/or list of files that import from this file.
Each entry includes path, name, and the specific symbols imported.

When to use:
- User asks what a file imports or uses
- User asks what depends on a file
- User wants to understand file relationships

Examples:
- "What does App.tsx import?" -> get_dependencies(filename="App.tsx", direction="imports")
- "What files use the auth service?" -> get_dependencies(filename="auth.ts", direction="imported_by")
- "Show all dependencies for utils.ts" -> get_dependencies(filename="utils.ts", direction="both")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "File path or name to analyze"
                },
                "direction": {
                    "type": "string",
                    "enum": ["imports", "imported_by", "both"],
                    "description": "'imports' = what this file uses, 'imported_by' = what uses this file, 'both' = bidirectional"
                }
            },
            "required": ["filename"]
        }
    },
    {
        "name": "get_function_info",
        "description": """Get detailed information about a specific function including tier, call metrics, and relationships.

Returns: function name, qualified name, file path, tier (S/A/B/C/D/F), internal/external call counts,
whether exported, whether entry point, function type, line number, and async status.

Note: Requires function tier data to be available for this analysis.

When to use:
- User asks about a specific function's importance or usage
- User wants to know what calls a function or what it calls
- User asks about function tier/ranking

Examples:
- "Tell me about the handleSubmit function" -> get_function_info(function_name="handleSubmit")
- "What tier is fetchData?" -> get_function_info(function_name="fetchData")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "function_name": {
                    "type": "string",
                    "description": "Name of the function to look up"
                },
                "file_path": {
                    "type": "string",
                    "description": "Optional file path to disambiguate when multiple functions have the same name"
                }
            },
            "required": ["function_name"]
        }
    },
    {
        "name": "list_functions",
        "description": """List functions filtered by tier, file, or minimum call count.

Returns: List of functions with name, qualified name, file path, tier, and total call count.

Note: Requires function tier data to be available for this analysis.

When to use:
- User asks about top/important functions
- User wants to see functions in a specific file
- User asks about functions by tier

Examples:
- "What are the most important functions?" -> list_functions(tier="S")
- "Show me all functions in App.tsx" -> list_functions(file_path="App.tsx")
- "Which functions are called more than 10 times?" -> list_functions(min_calls=10)""",
        "input_schema": {
            "type": "object",
            "properties": {
                "tier": {
                    "type": "string",
                    "enum": [t.value for t in TierLevel],
                    "description": "Filter by importance tier: S (most important), A, B, C, D, F (least important)"
                },
                "file_path": {
                    "type": "string",
                    "description": "Filter to functions in a specific file"
                },
                "min_calls": {
                    "type": "integer",
                    "description": "Only include functions called at least this many times"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum results to return (default 20, max 50)"
                }
            }
        }
    },
    {
        "name": "get_codebase_summary",
        "description": """Get the high-level codebase summary including project type, purpose, tech stack, and key modules.

Returns: analysis ID, file count, edge count, languages used, project type, primary purpose,
architecture summary, tech stack (languages, frameworks, patterns), key modules, and complexity assessment.

When to use:
- User asks about the overall codebase or architecture
- User wants an overview or summary
- User asks what the project is or does
- First message in conversation (to provide context)

Examples:
- "What is this codebase?" -> get_codebase_summary()
- "Give me an overview" -> get_codebase_summary()
- "What technologies are used?" -> get_codebase_summary()""",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "explain_highlighted",
        "description": """Identify and explain what highlighted/selected text from the visualization refers to.

Handles: file names, function names, architectural roles, categories, import paths, and partial matches.
Uses fuzzy matching to find the best match even with incomplete text.

When to use:
- User has highlighted text in the visualization (indicated by [Highlighted: ...] prefix)
- User pastes or references code elements like file names or function names
- User asks "what is this?" about selected text

Examples:
- User highlights "auth.ts" -> explain_highlighted(text="auth.ts")
- User highlights "react_component" -> explain_highlighted(text="react_component")
- User highlights "@/utils/helpers" -> explain_highlighted(text="@/utils/helpers")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The highlighted or selected text to explain"
                }
            },
            "required": ["text"]
        }
    },
    {
        "name": "detect_circular_dependencies",
        "description": """Detect circular dependencies (import cycles) in the codebase.

Returns: List of circular dependency chains found, with each chain showing the cycle of files.
Also returns total cycle count and whether the codebase has any cycles.

When to use:
- User asks about circular dependencies
- User wants to find import cycles
- User asks about architectural problems or code smells

Examples:
- "Are there any circular dependencies?" -> detect_circular_dependencies()
- "Find import cycles" -> detect_circular_dependencies()
- "Check for circular imports involving auth.ts" -> detect_circular_dependencies(involving_file="auth.ts")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "involving_file": {
                    "type": "string",
                    "description": "Optional: only return cycles involving this file"
                },
                "max_cycles": {
                    "type": "integer",
                    "description": "Maximum number of cycles to return (default 10)"
                }
            }
        }
    },
    {
        "name": "find_dependency_path",
        "description": """Find how two files are connected through the dependency graph.

Returns: The shortest chain of imports connecting file A to file B, or indicates if no path exists.
Shows the direction of imports at each step.

When to use:
- User asks how two files are related
- User wants to know the dependency chain between files
- User asks "how does X connect to Y"

Examples:
- "How does App.tsx connect to utils.ts?" -> find_dependency_path(source="App.tsx", target="utils.ts")
- "What's the relationship between api.ts and types.ts?" -> find_dependency_path(source="api.ts", target="types.ts")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "Starting file path or name"
                },
                "target": {
                    "type": "string",
                    "description": "Target file path or name"
                },
                "max_depth": {
                    "type": "integer",
                    "description": "Maximum path length to search (default 10)"
                },
                "bidirectional": {
                    "type": "boolean",
                    "description": "If true, search in both import directions (default false)"
                }
            },
            "required": ["source", "target"]
        }
    },
    {
        "name": "compare_files",
        "description": """Compare two files to understand their similarities, differences, and relationships.

Returns: Side-by-side comparison of roles, categories, languages, sizes, shared dependencies,
and whether they have a direct import relationship.

When to use:
- User wants to compare two files
- User asks about differences between files
- User asks which file is more important/central

Examples:
- "Compare api.ts and service.ts" -> compare_files(file1="api.ts", file2="service.ts")
- "What's the difference between App.tsx and Main.tsx?" -> compare_files(file1="App.tsx", file2="Main.tsx")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "file1": {
                    "type": "string",
                    "description": "First file path or name"
                },
                "file2": {
                    "type": "string",
                    "description": "Second file path or name"
                }
            },
            "required": ["file1", "file2"]
        }
    },
    {
        "name": "get_metrics",
        "description": """Get aggregate metrics and statistics about the codebase.

Returns: Various aggregate statistics like average file size by role, dependency counts,
most connected files, language distribution details, and more.

When to use:
- User asks for statistics or metrics
- User wants aggregate data like "average", "most", "total"
- User asks about codebase health or complexity

Examples:
- "What's the average file size by role?" -> get_metrics(metric="size_by_role")
- "Which files have the most dependencies?" -> get_metrics(metric="most_connected")
- "Show me the dependency statistics" -> get_metrics(metric="dependency_stats")""",
        "input_schema": {
            "type": "object",
            "properties": {
                "metric": {
                    "type": "string",
                    "enum": ["size_by_role", "most_connected", "dependency_stats", "role_distribution", "all"],
                    "description": "Which metric to calculate: size_by_role, most_connected, dependency_stats, role_distribution, or all"
                }
            },
            "required": ["metric"]
        }
    }
]


# Compressed tool definitions (~60-70% fewer tokens than verbose versions)
# Same input_schema, shorter descriptions without examples and "when to use" sections
CHAT_TOOLS_COMPRESSED = [
    {
        "name": "get_file_info",
        "description": "Get file details: path, role, description, language, imports, line count. Use for questions about specific files.",
        "input_schema": {
            "type": "object",
            "properties": {
                "filename": {
                    "type": "string",
                    "description": "File path or name (partial paths work)"
                }
            },
            "required": ["filename"]
        }
    },
    {
        "name": "search_files",
        "description": "Search files by name pattern, role, or category. Returns up to 20 matches with path, role, and description.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Search term for file names, paths, or descriptions"
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
        "description": "Get import/export relationships for a file: what it imports and/or what imports it.",
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
                    "description": "'imports' = what this file uses, 'imported_by' = what uses this file, 'both' = bidirectional"
                }
            },
            "required": ["filename"]
        }
    },
    {
        "name": "get_function_info",
        "description": "Get function details: tier, call counts, file path, type, export/async status. Requires tier data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "function_name": {
                    "type": "string",
                    "description": "Name of the function"
                },
                "file_path": {
                    "type": "string",
                    "description": "Optional file path to disambiguate"
                }
            },
            "required": ["function_name"]
        }
    },
    {
        "name": "list_functions",
        "description": "List functions filtered by tier, file, or minimum call count. Requires tier data.",
        "input_schema": {
            "type": "object",
            "properties": {
                "tier": {
                    "type": "string",
                    "enum": [t.value for t in TierLevel],
                    "description": "Filter by importance tier: S (most important) through F (least)"
                },
                "file_path": {
                    "type": "string",
                    "description": "Filter to functions in a specific file"
                },
                "min_calls": {
                    "type": "integer",
                    "description": "Minimum call count threshold"
                },
                "limit": {
                    "type": "integer",
                    "description": "Max results (default 20, max 50)"
                }
            }
        }
    },
    {
        "name": "get_codebase_summary",
        "description": "Get high-level codebase overview: project type, purpose, tech stack, key modules, complexity.",
        "input_schema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "explain_highlighted",
        "description": "Identify and explain highlighted/selected text from the visualization. Handles files, functions, roles, imports with fuzzy matching.",
        "input_schema": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "The highlighted or selected text"
                }
            },
            "required": ["text"]
        }
    },
    {
        "name": "detect_circular_dependencies",
        "description": "Detect circular dependency chains (import cycles) in the codebase.",
        "input_schema": {
            "type": "object",
            "properties": {
                "involving_file": {
                    "type": "string",
                    "description": "Only return cycles involving this file"
                },
                "max_cycles": {
                    "type": "integer",
                    "description": "Max cycles to return (default 10)"
                }
            }
        }
    },
    {
        "name": "find_dependency_path",
        "description": "Find the shortest import chain connecting two files in the dependency graph.",
        "input_schema": {
            "type": "object",
            "properties": {
                "source": {
                    "type": "string",
                    "description": "Starting file"
                },
                "target": {
                    "type": "string",
                    "description": "Target file"
                },
                "max_depth": {
                    "type": "integer",
                    "description": "Max path length (default 10)"
                },
                "bidirectional": {
                    "type": "boolean",
                    "description": "Search both import directions (default false)"
                }
            },
            "required": ["source", "target"]
        }
    },
    {
        "name": "compare_files",
        "description": "Compare two files: roles, categories, sizes, shared dependencies, and direct relationships.",
        "input_schema": {
            "type": "object",
            "properties": {
                "file1": {
                    "type": "string",
                    "description": "First file"
                },
                "file2": {
                    "type": "string",
                    "description": "Second file"
                }
            },
            "required": ["file1", "file2"]
        }
    },
    {
        "name": "get_metrics",
        "description": "Get aggregate codebase statistics: size by role, most connected files, dependency stats, role distribution.",
        "input_schema": {
            "type": "object",
            "properties": {
                "metric": {
                    "type": "string",
                    "enum": ["size_by_role", "most_connected", "dependency_stats", "role_distribution", "all"],
                    "description": "Which metric to calculate"
                }
            },
            "required": ["metric"]
        }
    }
]

# Tool name index for quick lookup
_COMPRESSED_TOOLS_BY_NAME = {t["name"]: t for t in CHAT_TOOLS_COMPRESSED}

# Tool subsets by intent
_TOOL_NAMES_BY_INTENT: dict[QuestionIntent, list[str]] = {
    QuestionIntent.HIGHLIGHTED_TEXT: [
        "explain_highlighted", "get_file_info", "get_function_info",
    ],
    QuestionIntent.CODEBASE_SPECIFIC: [
        "get_file_info", "search_files", "get_dependencies",
        "get_function_info", "list_functions", "compare_files",
    ],
    QuestionIntent.CODEBASE_GENERAL: [
        "get_codebase_summary", "get_metrics", "search_files",
    ],
    QuestionIntent.DEPENDENCY_ANALYSIS: [
        "get_dependencies", "detect_circular_dependencies",
        "find_dependency_path", "get_file_info", "search_files",
    ],
    QuestionIntent.FUNCTION_ANALYSIS: [
        "get_function_info", "list_functions", "get_file_info",
    ],
    QuestionIntent.GENERAL_KNOWLEDGE: [],  # No tools needed
}


def get_tools_for_intent(
    intent: QuestionIntent,
    has_selection_context: bool = False,
) -> list[dict]:
    """Get the compressed tool definitions for a given question intent.

    Args:
        intent: The classified question intent
        has_selection_context: Whether rich selection context is provided.
            When True and intent is HIGHLIGHTED_TEXT, skips explain_highlighted
            since the model already knows the file/function from the context.

    Returns:
        List of compressed tool definitions appropriate for the intent.
        Returns empty list for GENERAL_KNOWLEDGE intent.
    """
    tool_names = _TOOL_NAMES_BY_INTENT.get(intent, [])
    if not tool_names:
        return []

    # Context-aware tool skipping: when selection context provides file/function
    # info, exclude explain_highlighted to avoid redundant broad searches
    if has_selection_context and intent == QuestionIntent.HIGHLIGHTED_TEXT:
        tool_names = [n for n in tool_names if n != "explain_highlighted"]

    return [_COMPRESSED_TOOLS_BY_NAME[name] for name in tool_names if name in _COMPRESSED_TOOLS_BY_NAME]


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
                result = self._get_file_info(tool_input.get("filename", ""))
            elif tool_name == "search_files":
                result = self._search_files(
                    query=tool_input.get("query"),
                    role=tool_input.get("role"),
                    category=tool_input.get("category")
                )
            elif tool_name == "get_dependencies":
                result = self._get_dependencies(
                    filename=tool_input.get("filename", ""),
                    direction=tool_input.get("direction", "both")
                )
            elif tool_name == "get_function_info":
                result = self._get_function_info(
                    function_name=tool_input.get("function_name", ""),
                    file_path=tool_input.get("file_path")
                )
            elif tool_name == "list_functions":
                result = self._list_functions(
                    tier=tool_input.get("tier"),
                    file_path=tool_input.get("file_path"),
                    min_calls=tool_input.get("min_calls"),
                    limit=tool_input.get("limit", DEFAULT_FUNCTION_LIST_LIMIT)
                )
            elif tool_name == "get_codebase_summary":
                result = self._get_codebase_summary()
            elif tool_name == "explain_highlighted":
                result = self._explain_highlighted(tool_input.get("text", ""))
            elif tool_name == "detect_circular_dependencies":
                result = self._detect_circular_dependencies(
                    involving_file=tool_input.get("involving_file"),
                    max_cycles=tool_input.get("max_cycles", DEFAULT_MAX_CYCLES)
                )
            elif tool_name == "find_dependency_path":
                result = self._find_dependency_path(
                    source=tool_input.get("source", ""),
                    target=tool_input.get("target", ""),
                    max_depth=tool_input.get("max_depth", DEFAULT_MAX_DEPTH),
                    bidirectional=tool_input.get("bidirectional", False)
                )
            elif tool_name == "compare_files":
                result = self._compare_files(
                    file1=tool_input.get("file1", ""),
                    file2=tool_input.get("file2", "")
                )
            elif tool_name == "get_metrics":
                result = self._get_metrics(tool_input.get("metric", "all"))
            else:
                return {"error": f"Unknown tool: {tool_name}"}

            # Apply result summarization for large results
            return ToolResultSummarizer.summarize(result)
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
        limit: int = DEFAULT_FUNCTION_LIST_LIMIT
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

    def _detect_circular_dependencies(
        self,
        involving_file: Optional[str] = None,
        max_cycles: int = DEFAULT_MAX_CYCLES
    ) -> dict[str, Any]:
        """Detect circular dependencies using optimized DFS cycle detection.

        Uses a color-based DFS (white/gray/black) for O(V+E) complexity:
        - WHITE (0): unvisited
        - GRAY (1): in current path (on recursion stack)
        - BLACK (2): finished processing
        """
        # Build adjacency list from edges
        adjacency: dict[str, set[str]] = {}
        for edge in self.graph.edges:
            if edge.source not in adjacency:
                adjacency[edge.source] = set()
            adjacency[edge.source].add(edge.target)

        # Color states: 0=white, 1=gray, 2=black
        color: dict[str, int] = {node: 0 for node in adjacency}
        # Track parent in current path for efficient cycle extraction
        parent: dict[str, Optional[str]] = {}

        cycles: list[dict] = []
        seen_cycles: set[tuple] = set()  # For efficient deduplication

        # Find target node if involving_file is specified
        target_node = None
        if involving_file:
            target_node = self._find_node(involving_file)
            if not target_node:
                return {"error": f"File not found: {involving_file}"}

        def extract_cycle(start: str, end: str) -> list[str]:
            """Extract cycle path from end back to start using parent pointers."""
            cycle = [end]
            current = end
            while parent.get(current) != start and parent.get(current) is not None:
                current = parent[current]
                cycle.append(current)
            cycle.append(start)
            cycle.reverse()
            cycle.append(start)  # Complete the cycle
            return cycle

        def normalize_cycle(cycle_ids: list[str]) -> tuple:
            """Normalize cycle for deduplication - start from min element."""
            if len(cycle_ids) <= 2:
                return tuple(cycle_ids)
            # Remove the duplicate end element for rotation
            core = cycle_ids[:-1]
            # Find minimum element and rotate to start from it
            min_idx = core.index(min(core))
            rotated = core[min_idx:] + core[:min_idx]
            rotated.append(rotated[0])  # Add back closing element
            return tuple(rotated)

        def dfs(node: str) -> None:
            if len(cycles) >= max_cycles:
                return

            color[node] = 1  # Gray - currently processing

            for neighbor in adjacency.get(node, []):
                if len(cycles) >= max_cycles:
                    return

                if color.get(neighbor, 0) == 0:  # White - unvisited
                    parent[neighbor] = node
                    dfs(neighbor)
                elif color.get(neighbor, 0) == 1:  # Gray - back edge = cycle
                    # Extract the cycle
                    cycle_ids = extract_cycle(neighbor, node)

                    # Filter by involving_file if specified
                    if target_node and target_node.id not in cycle_ids:
                        continue

                    # Normalize for deduplication
                    normalized_tuple = normalize_cycle(cycle_ids)
                    if normalized_tuple in seen_cycles:
                        continue
                    seen_cycles.add(normalized_tuple)

                    # Convert node IDs to paths for readability
                    cycle_paths = [
                        self._node_by_id[n].data.path if n in self._node_by_id else n
                        for n in normalized_tuple
                    ]

                    cycles.append({
                        "cycle": list(cycle_paths),
                        "length": len(cycle_paths) - 1
                    })

            color[node] = 2  # Black - finished

        # Run DFS from each unvisited node
        for node_id in adjacency:
            if color.get(node_id, 0) == 0 and len(cycles) < max_cycles:
                parent[node_id] = None
                dfs(node_id)

        return {
            "has_cycles": len(cycles) > 0,
            "cycle_count": len(cycles),
            "cycles": cycles[:max_cycles],
            "truncated": len(cycles) > max_cycles,
            "message": f"Found {len(cycles)} circular dependency chain(s)" if cycles else "No circular dependencies detected"
        }

    def _find_dependency_path(
        self,
        source: str,
        target: str,
        max_depth: int = DEFAULT_MAX_DEPTH,
        bidirectional: bool = False
    ) -> dict[str, Any]:
        """Find shortest dependency path between two files using BFS.

        Args:
            source: Path or name of the source file.
            target: Path or name of the target file.
            max_depth: Maximum search depth (default from chat_constants).
            bidirectional: If True, also search reverse dependency direction.

        Returns:
            Path information including connected status, path list, and length.
        """
        # Validate inputs
        if not source or not source.strip():
            return {"error": "source parameter is required"}
        if not target or not target.strip():
            return {"error": "target parameter is required"}

        source_node = self._find_node(source)
        target_node = self._find_node(target)

        if not source_node:
            return {"error": f"Source file not found: {source}"}
        if not target_node:
            return {"error": f"Target file not found: {target}"}
        if source_node.id == target_node.id:
            return {
                "connected": True,
                "path": [source_node.data.path],
                "length": 0,
                "message": "Source and target are the same file"
            }

        # Build adjacency list
        forward: dict[str, list[tuple[str, str]]] = {}  # node_id -> [(neighbor_id, edge_label)]
        backward: dict[str, list[tuple[str, str]]] = {}

        for edge in self.graph.edges:
            if edge.source not in forward:
                forward[edge.source] = []
            label = ", ".join(edge.data.imported_names[:3]) if edge.data and edge.data.imported_names else "imports"
            forward[edge.source].append((edge.target, label))

            if bidirectional:
                if edge.target not in backward:
                    backward[edge.target] = []
                backward[edge.target].append((edge.source, "imported by"))

        # BFS
        queue = deque([(source_node.id, [(source_node.data.path, "start")])])
        visited = {source_node.id}

        while queue:
            current_id, path = queue.popleft()

            if len(path) > max_depth:
                continue

            # Get neighbors
            neighbors = forward.get(current_id, [])
            if bidirectional:
                neighbors = neighbors + backward.get(current_id, [])

            for neighbor_id, label in neighbors:
                if neighbor_id == target_node.id:
                    neighbor_path = self._node_by_id[neighbor_id].data.path
                    final_path = path + [(neighbor_path, label)]
                    return {
                        "connected": True,
                        "path": [p[0] for p in final_path],
                        "steps": [
                            {"from": final_path[i][0], "to": final_path[i+1][0], "via": final_path[i+1][1]}
                            for i in range(len(final_path) - 1)
                        ],
                        "length": len(final_path) - 1,
                        "message": f"Found path with {len(final_path) - 1} step(s)"
                    }

                if neighbor_id not in visited:
                    visited.add(neighbor_id)
                    neighbor_node = self._node_by_id.get(neighbor_id)
                    if neighbor_node:
                        queue.append((neighbor_id, path + [(neighbor_node.data.path, label)]))

        return {
            "connected": False,
            "path": [],
            "length": -1,
            "message": f"No dependency path found between {source_node.data.path} and {target_node.data.path} within {max_depth} steps"
        }

    def _compare_files(self, file1: str, file2: str) -> dict[str, Any]:
        """Compare two files for similarities and relationships.

        Args:
            file1: Path or name of the first file to compare.
            file2: Path or name of the second file to compare.

        Returns:
            Comparison results including shared dependencies and relationships.
        """
        # Validate inputs
        if not file1 or not file1.strip():
            return {"error": "file1 parameter is required"}
        if not file2 or not file2.strip():
            return {"error": "file2 parameter is required"}

        node1 = self._find_node(file1)
        node2 = self._find_node(file2)

        if not node1:
            return {"error": f"File not found: {file1}"}
        if not node2:
            return {"error": f"File not found: {file2}"}

        # Get dependencies for both files
        deps1 = self._get_dependencies(node1.data.path, "both")
        deps2 = self._get_dependencies(node2.data.path, "both")

        # Find shared dependencies
        imports1 = set(d["path"] for d in deps1.get("imports", []))
        imports2 = set(d["path"] for d in deps2.get("imports", []))
        shared_imports = imports1 & imports2

        imported_by1 = set(d["path"] for d in deps1.get("imported_by", []))
        imported_by2 = set(d["path"] for d in deps2.get("imported_by", []))
        shared_importers = imported_by1 & imported_by2

        # Check direct relationship
        direct_relationship = None
        if node1.data.path in imports2:
            direct_relationship = f"{node2.data.path} imports {node1.data.path}"
        elif node2.data.path in imports1:
            direct_relationship = f"{node1.data.path} imports {node2.data.path}"

        return {
            "file1": {
                "path": node1.data.path,
                "name": node1.data.label,
                "role": node1.data.role.value,
                "category": node1.data.category.value,
                "language": node1.data.language.value,
                "line_count": node1.data.line_count,
                "import_count": len(imports1),
                "imported_by_count": len(imported_by1)
            },
            "file2": {
                "path": node2.data.path,
                "name": node2.data.label,
                "role": node2.data.role.value,
                "category": node2.data.category.value,
                "language": node2.data.language.value,
                "line_count": node2.data.line_count,
                "import_count": len(imports2),
                "imported_by_count": len(imported_by2)
            },
            "comparison": {
                "same_role": node1.data.role == node2.data.role,
                "same_category": node1.data.category == node2.data.category,
                "same_language": node1.data.language == node2.data.language,
                "size_difference_lines": abs(node1.data.line_count - node2.data.line_count),
                "shared_imports": list(shared_imports)[:10],
                "shared_imports_count": len(shared_imports),
                "shared_importers": list(shared_importers)[:10],
                "shared_importers_count": len(shared_importers),
                "direct_relationship": direct_relationship
            }
        }

    def _get_metrics(self, metric: str) -> dict[str, Any]:
        """Calculate aggregate metrics for the codebase."""
        result: dict[str, Any] = {"metric_type": metric}

        # Calculate size_by_role
        if metric in ("size_by_role", "all"):
            role_stats: dict[str, dict] = {}
            for node in self.graph.nodes:
                role = node.data.role.value
                if role not in role_stats:
                    role_stats[role] = {"total_lines": 0, "count": 0, "total_bytes": 0}
                role_stats[role]["total_lines"] += node.data.line_count
                role_stats[role]["total_bytes"] += node.data.size_bytes
                role_stats[role]["count"] += 1

            size_by_role = {
                role: {
                    "avg_lines": round(stats["total_lines"] / stats["count"], 1),
                    "avg_bytes": round(stats["total_bytes"] / stats["count"], 1),
                    "file_count": stats["count"]
                }
                for role, stats in role_stats.items()
            }
            if metric == "size_by_role":
                result["size_by_role"] = size_by_role
                return result

        # Calculate most_connected and dependency_stats together (shared computation)
        if metric in ("most_connected", "dependency_stats", "all"):
            import_counts: dict[str, int] = {}
            imported_by_counts: dict[str, int] = {}

            for edge in self.graph.edges:
                import_counts[edge.source] = import_counts.get(edge.source, 0) + 1
                imported_by_counts[edge.target] = imported_by_counts.get(edge.target, 0) + 1

            if metric in ("most_connected", "all"):
                # Combine and find most connected
                connection_scores = []
                for node in self.graph.nodes:
                    imports = import_counts.get(node.id, 0)
                    imported_by = imported_by_counts.get(node.id, 0)
                    connection_scores.append({
                        "path": node.data.path,
                        "imports": imports,
                        "imported_by": imported_by,
                        "total": imports + imported_by
                    })

                most_connected = sorted(
                    connection_scores,
                    key=lambda x: x["total"],
                    reverse=True
                )[:10]

                if metric == "most_connected":
                    result["most_connected"] = most_connected
                    return result

            if metric in ("dependency_stats", "all"):
                import_counts_list = list(import_counts.values()) if import_counts else [0]
                dependency_stats = {
                    "total_dependencies": len(self.graph.edges),
                    "avg_imports_per_file": round(sum(import_counts_list) / len(self.graph.nodes), 2) if self.graph.nodes else 0,
                    "max_imports": max(import_counts_list) if import_counts_list else 0,
                    "files_with_no_imports": len(self.graph.nodes) - len(import_counts),
                    "files_with_no_importers": len(self.graph.nodes) - len(imported_by_counts)
                }

                if metric == "dependency_stats":
                    result["dependency_stats"] = dependency_stats
                    return result

        # Calculate role_distribution
        if metric in ("role_distribution", "all"):
            role_distribution: dict[str, int] = {}
            for node in self.graph.nodes:
                role = node.data.role.value
                role_distribution[role] = role_distribution.get(role, 0) + 1
            role_distribution = dict(sorted(role_distribution.items(), key=lambda x: x[1], reverse=True))

            if metric == "role_distribution":
                result["role_distribution"] = role_distribution
                return result

        # Return all metrics
        if metric == "all":
            result["size_by_role"] = size_by_role
            result["most_connected"] = most_connected
            result["dependency_stats"] = dependency_stats
            result["role_distribution"] = role_distribution

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
