"""
Tests for chat_tools.py - Tool definitions and executors for the chatbot.
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from app.services.chat_tools import (
    ToolResultSummarizer,
    ChatToolExecutor,
    get_tools_for_intent,
    CHAT_TOOLS_COMPRESSED,
)
from app.services.intent_classifier import QuestionIntent
from app.services.chat_constants import (
    DEFAULT_SUMMARIZATION_TOKEN_LIMIT,
    CHARS_PER_TOKEN,
    DEFAULT_MAX_CYCLES,
    DEFAULT_MAX_DEPTH,
)
from app.models.schemas import (
    ReactFlowGraph,
    ReactFlowNode,
    ReactFlowEdge,
    ReactFlowNodeData,
    ReactFlowEdgeData,
    ReactFlowPosition,
    AnalysisMetadata,
    Language,
    ArchitecturalRole,
    Category,
    ImportType,
    TierLevel,
)


# ==================== Fixtures ====================


@pytest.fixture
def sample_node_data():
    """Create sample node data."""
    return ReactFlowNodeData(
        label="Button.tsx",
        path="src/components/Button.tsx",
        folder="src/components",
        language=Language.TYPESCRIPT,
        role=ArchitecturalRole.REACT_COMPONENT,
        description="A reusable button component",
        category=Category.FRONTEND,
        imports=["react", "./styles"],
        size_bytes=2048,
        line_count=75,
    )


@pytest.fixture
def sample_node(sample_node_data):
    """Create a sample ReactFlowNode."""
    return ReactFlowNode(
        id="node-1",
        type="custom",
        position=ReactFlowPosition(x=0, y=0),
        data=sample_node_data,
    )


@pytest.fixture
def sample_edge_data():
    """Create sample edge data."""
    return ReactFlowEdgeData(
        imported_names=["Button", "ButtonProps"],
        module_path="./Button",
        import_type=ImportType.IMPORT,
        source_language=Language.TYPESCRIPT,
        target_language=Language.TYPESCRIPT,
        is_cross_language=False,
    )


@pytest.fixture
def sample_metadata():
    """Create sample analysis metadata."""
    return AnalysisMetadata(
        analysis_id="test-analysis-123",
        directory_path="/test/project",
        file_count=5,
        edge_count=4,
        analysis_time_seconds=2.5,
        started_at=datetime.now(timezone.utc),
        completed_at=datetime.now(timezone.utc),
        languages={"typescript": 5},
        errors=[],
    )


@pytest.fixture
def sample_graph(sample_metadata):
    """Create a sample ReactFlowGraph with multiple nodes and edges."""
    nodes = [
        ReactFlowNode(
            id="node-1",
            type="custom",
            position=ReactFlowPosition(x=0, y=0),
            data=ReactFlowNodeData(
                label="App.tsx",
                path="src/App.tsx",
                folder="src",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.REACT_COMPONENT,
                description="Main application component",
                category=Category.FRONTEND,
                imports=["./components/Button", "./utils/helpers"],
                size_bytes=3000,
                line_count=100,
            ),
        ),
        ReactFlowNode(
            id="node-2",
            type="custom",
            position=ReactFlowPosition(x=100, y=0),
            data=ReactFlowNodeData(
                label="Button.tsx",
                path="src/components/Button.tsx",
                folder="src/components",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.REACT_COMPONENT,
                description="A reusable button component",
                category=Category.FRONTEND,
                imports=["react", "./styles.css"],
                size_bytes=1500,
                line_count=50,
            ),
        ),
        ReactFlowNode(
            id="node-3",
            type="custom",
            position=ReactFlowPosition(x=200, y=0),
            data=ReactFlowNodeData(
                label="helpers.ts",
                path="src/utils/helpers.ts",
                folder="src/utils",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.UTILITY,
                description="Helper utility functions",
                category=Category.SHARED,
                imports=[],
                size_bytes=800,
                line_count=30,
            ),
        ),
        ReactFlowNode(
            id="node-4",
            type="custom",
            position=ReactFlowPosition(x=300, y=0),
            data=ReactFlowNodeData(
                label="api.ts",
                path="src/services/api.ts",
                folder="src/services",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.API_SERVICE,
                description="API client for backend communication",
                category=Category.FRONTEND,
                imports=["axios", "./helpers"],
                size_bytes=2000,
                line_count=80,
            ),
        ),
        ReactFlowNode(
            id="node-5",
            type="custom",
            position=ReactFlowPosition(x=400, y=0),
            data=ReactFlowNodeData(
                label="config.ts",
                path="src/config.ts",
                folder="src",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.CONFIG,
                description="Application configuration",
                category=Category.CONFIG,
                imports=[],
                size_bytes=500,
                line_count=20,
            ),
        ),
    ]

    edges = [
        ReactFlowEdge(
            id="edge-1",
            source="node-1",
            target="node-2",
            type="smoothstep",
            animated=False,
            data=ReactFlowEdgeData(
                imported_names=["Button"],
                module_path="./components/Button",
                import_type=ImportType.IMPORT,
            ),
        ),
        ReactFlowEdge(
            id="edge-2",
            source="node-1",
            target="node-3",
            type="smoothstep",
            animated=False,
            data=ReactFlowEdgeData(
                imported_names=["formatDate", "parseQuery"],
                module_path="./utils/helpers",
                import_type=ImportType.IMPORT,
            ),
        ),
        ReactFlowEdge(
            id="edge-3",
            source="node-4",
            target="node-3",
            type="smoothstep",
            animated=False,
            data=ReactFlowEdgeData(
                imported_names=["formatResponse"],
                module_path="./helpers",
                import_type=ImportType.IMPORT,
            ),
        ),
        ReactFlowEdge(
            id="edge-4",
            source="node-1",
            target="node-4",
            type="smoothstep",
            animated=False,
            data=ReactFlowEdgeData(
                imported_names=["fetchData"],
                module_path="./services/api",
                import_type=ImportType.IMPORT,
            ),
        ),
    ]

    return ReactFlowGraph(nodes=nodes, edges=edges, metadata=sample_metadata)


@pytest.fixture
def sample_graph_with_cycles(sample_metadata):
    """Create a graph containing circular dependencies."""
    nodes = [
        ReactFlowNode(
            id="a",
            type="custom",
            position=ReactFlowPosition(x=0, y=0),
            data=ReactFlowNodeData(
                label="a.ts",
                path="src/a.ts",
                folder="src",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.UTILITY,
                description="Module A",
                category=Category.SHARED,
                imports=["./b"],
                size_bytes=100,
                line_count=10,
            ),
        ),
        ReactFlowNode(
            id="b",
            type="custom",
            position=ReactFlowPosition(x=100, y=0),
            data=ReactFlowNodeData(
                label="b.ts",
                path="src/b.ts",
                folder="src",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.UTILITY,
                description="Module B",
                category=Category.SHARED,
                imports=["./c"],
                size_bytes=100,
                line_count=10,
            ),
        ),
        ReactFlowNode(
            id="c",
            type="custom",
            position=ReactFlowPosition(x=200, y=0),
            data=ReactFlowNodeData(
                label="c.ts",
                path="src/c.ts",
                folder="src",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.UTILITY,
                description="Module C",
                category=Category.SHARED,
                imports=["./a"],
                size_bytes=100,
                line_count=10,
            ),
        ),
    ]

    # Cycle: a -> b -> c -> a
    edges = [
        ReactFlowEdge(
            id="a-b",
            source="a",
            target="b",
            type="smoothstep",
            animated=False,
            data=ReactFlowEdgeData(
                imported_names=["funcB"],
                module_path="./b",
                import_type=ImportType.IMPORT,
            ),
        ),
        ReactFlowEdge(
            id="b-c",
            source="b",
            target="c",
            type="smoothstep",
            animated=False,
            data=ReactFlowEdgeData(
                imported_names=["funcC"],
                module_path="./c",
                import_type=ImportType.IMPORT,
            ),
        ),
        ReactFlowEdge(
            id="c-a",
            source="c",
            target="a",
            type="smoothstep",
            animated=False,
            data=ReactFlowEdgeData(
                imported_names=["funcA"],
                module_path="./a",
                import_type=ImportType.IMPORT,
            ),
        ),
    ]

    return ReactFlowGraph(nodes=nodes, edges=edges, metadata=sample_metadata)


@pytest.fixture
def sample_tier_list():
    """Create a sample tier list for function-related tests."""
    return [
        {
            "id": "func-1",
            "function_name": "handleClick",
            "qualified_name": "Button.handleClick",
            "file_path": "src/components/Button.tsx",
            "tier": "S",
            "internal_call_count": 15,
            "external_call_count": 5,
            "is_exported": True,
            "is_entry_point": True,
            "function_type": "function",
            "start_line": 10,
            "is_async": False,
        },
        {
            "id": "func-2",
            "function_name": "formatDate",
            "qualified_name": "helpers.formatDate",
            "file_path": "src/utils/helpers.ts",
            "tier": "A",
            "internal_call_count": 10,
            "external_call_count": 2,
            "is_exported": True,
            "is_entry_point": False,
            "function_type": "function",
            "start_line": 5,
            "is_async": False,
        },
        {
            "id": "func-3",
            "function_name": "fetchData",
            "qualified_name": "api.fetchData",
            "file_path": "src/services/api.ts",
            "tier": "A",
            "internal_call_count": 8,
            "external_call_count": 3,
            "is_exported": True,
            "is_entry_point": False,
            "function_type": "function",
            "start_line": 20,
            "is_async": True,
        },
        {
            "id": "func-4",
            "function_name": "validateInput",
            "qualified_name": "helpers.validateInput",
            "file_path": "src/utils/helpers.ts",
            "tier": "B",
            "internal_call_count": 3,
            "external_call_count": 1,
            "is_exported": True,
            "is_entry_point": False,
            "function_type": "function",
            "start_line": 30,
            "is_async": False,
        },
    ]


@pytest.fixture
def executor(sample_graph, sample_tier_list):
    """Create a ChatToolExecutor instance."""
    return ChatToolExecutor(sample_graph, sample_tier_list)


@pytest.fixture
def executor_no_tiers(sample_graph):
    """Create a ChatToolExecutor without tier list."""
    return ChatToolExecutor(sample_graph, None)


# ==================== ToolResultSummarizer Tests ====================


class TestToolResultSummarizer:
    """Tests for ToolResultSummarizer class."""

    def test_small_result_not_summarized(self):
        """Small results should pass through unchanged."""
        result = {"key": "value", "count": 5}
        summarized = ToolResultSummarizer.summarize(result)
        assert summarized == result
        assert "_summarized" not in summarized

    def test_large_result_truncates_strings(self):
        """Large string values should be truncated."""
        long_string = "x" * 500
        result = {"description": long_string}
        summarized = ToolResultSummarizer.summarize(result, token_limit=50)

        assert len(summarized["description"]) < len(long_string)
        assert summarized["description"].endswith("...")

    def test_large_result_limits_arrays(self):
        """Large arrays should be limited."""
        result = {"items": list(range(100))}
        summarized = ToolResultSummarizer.summarize(result, token_limit=50)

        # Array should be limited
        assert len(summarized["items"]) < 100

    def test_summarization_adds_metadata(self):
        """Summarized results should have metadata."""
        large_result = {"data": "x" * 10000}
        summarized = ToolResultSummarizer.summarize(large_result, token_limit=50)

        assert summarized.get("_summarized") is True
        assert "_original_tokens" in summarized

    def test_estimate_tokens(self):
        """Token estimation should be reasonable."""
        text = "a" * 100
        result = {"text": text}
        tokens = ToolResultSummarizer._estimate_tokens(result)

        # Should be roughly len/4 for chars per token
        expected_min = len(text) // (CHARS_PER_TOKEN + 1)
        expected_max = len(text) // (CHARS_PER_TOKEN - 1)
        assert expected_min <= tokens <= expected_max + 50  # Allow for JSON overhead

    def test_nested_truncation(self):
        """Should handle nested structures."""
        result = {
            "level1": {
                "level2": {
                    "long_text": "x" * 500,
                    "array": list(range(50)),
                }
            }
        }
        summarized = ToolResultSummarizer.summarize(result, token_limit=50)

        nested = summarized["level1"]["level2"]
        assert len(nested["long_text"]) < 500
        assert len(nested["array"]) < 50


# ==================== get_tools_for_intent Tests ====================


class TestGetToolsForIntent:
    """Tests for get_tools_for_intent function."""

    def test_highlighted_text_intent_returns_relevant_tools(self):
        """HIGHLIGHTED_TEXT should return explain_highlighted and related tools."""
        tools = get_tools_for_intent(QuestionIntent.HIGHLIGHTED_TEXT)

        tool_names = [t["name"] for t in tools]
        assert "explain_highlighted" in tool_names
        assert "get_file_info" in tool_names

    def test_highlighted_text_with_selection_context_excludes_explain(self):
        """With selection context, explain_highlighted should be excluded."""
        tools = get_tools_for_intent(
            QuestionIntent.HIGHLIGHTED_TEXT, has_selection_context=True
        )

        tool_names = [t["name"] for t in tools]
        assert "explain_highlighted" not in tool_names
        assert "get_file_info" in tool_names

    def test_codebase_specific_intent(self):
        """CODEBASE_SPECIFIC should return file/function tools."""
        tools = get_tools_for_intent(QuestionIntent.CODEBASE_SPECIFIC)

        tool_names = [t["name"] for t in tools]
        assert "get_file_info" in tool_names
        assert "search_files" in tool_names
        assert "get_dependencies" in tool_names

    def test_codebase_general_intent_returns_minimal_tools(self):
        """CODEBASE_GENERAL returns minimal tools for file verification."""
        tools = get_tools_for_intent(QuestionIntent.CODEBASE_GENERAL)
        tool_names = [t["name"] for t in tools]
        assert "search_files" in tool_names
        assert "get_file_info" in tool_names
        assert len(tool_names) == 2

    def test_dependency_analysis_intent(self):
        """DEPENDENCY_ANALYSIS should return dependency-related tools."""
        tools = get_tools_for_intent(QuestionIntent.DEPENDENCY_ANALYSIS)

        tool_names = [t["name"] for t in tools]
        assert "get_dependencies" in tool_names
        assert "detect_circular_dependencies" in tool_names
        assert "find_dependency_path" in tool_names

    def test_function_analysis_intent(self):
        """FUNCTION_ANALYSIS should return function-related tools."""
        tools = get_tools_for_intent(QuestionIntent.FUNCTION_ANALYSIS)

        tool_names = [t["name"] for t in tools]
        assert "get_function_info" in tool_names
        assert "list_functions" in tool_names

    def test_general_knowledge_intent_returns_empty(self):
        """GENERAL_KNOWLEDGE returns empty list."""
        tools = get_tools_for_intent(QuestionIntent.GENERAL_KNOWLEDGE)
        assert tools == []


# ==================== ChatToolExecutor Initialization Tests ====================


class TestChatToolExecutorInit:
    """Tests for ChatToolExecutor initialization."""

    def test_builds_node_indexes(self, sample_graph):
        """Should build lookup indexes during init."""
        executor = ChatToolExecutor(sample_graph)

        # Check node by id
        assert "node-1" in executor._node_by_id
        assert executor._node_by_id["node-1"].data.label == "App.tsx"

        # Check node by path
        assert "src/App.tsx" in executor._node_by_path

        # Check node by name
        assert "App.tsx" in executor._node_by_name
        assert len(executor._node_by_name["App.tsx"]) == 1

    def test_builds_edge_indexes(self, sample_graph):
        """Should build edge lookup indexes."""
        executor = ChatToolExecutor(sample_graph)

        # Check edges by source
        assert "node-1" in executor._edges_by_source
        assert len(executor._edges_by_source["node-1"]) == 3  # App imports 3 things

        # Check edges by target
        assert "node-2" in executor._edges_by_target  # Button is imported
        assert "node-3" in executor._edges_by_target  # helpers is imported

    def test_initializes_with_empty_tier_list(self, sample_graph):
        """Should handle None tier list."""
        executor = ChatToolExecutor(sample_graph, None)
        assert executor.tier_list == []


# ==================== _find_node Tests ====================


class TestFindNode:
    """Tests for the _find_node method."""

    def test_find_by_exact_path(self, executor):
        """Should find node by exact path."""
        node = executor._find_node("src/components/Button.tsx")
        assert node is not None
        assert node.data.label == "Button.tsx"

    def test_find_by_filename(self, executor):
        """Should find node by filename only."""
        node = executor._find_node("Button.tsx")
        assert node is not None
        assert node.data.label == "Button.tsx"

    def test_find_by_partial_path(self, executor):
        """Should find node by partial path match."""
        node = executor._find_node("components/Button")
        assert node is not None
        assert node.data.label == "Button.tsx"

    def test_find_case_insensitive(self, executor):
        """Should find node case-insensitively."""
        node = executor._find_node("BUTTON.TSX")
        assert node is not None
        assert node.data.label == "Button.tsx"

    def test_find_returns_none_for_nonexistent(self, executor):
        """Should return None for non-existent files."""
        node = executor._find_node("nonexistent.ts")
        assert node is None


# ==================== get_file_info Tests ====================


class TestGetFileInfo:
    """Tests for get_file_info tool."""

    def test_returns_file_details(self, executor):
        """Should return complete file information."""
        result = executor._get_file_info("Button.tsx")

        assert result["path"] == "src/components/Button.tsx"
        assert result["name"] == "Button.tsx"
        assert result["role"] == "react_component"
        assert result["language"] == "typescript"
        assert result["line_count"] == 50
        assert result["description"] == "A reusable button component"

    def test_returns_error_for_not_found(self, executor):
        """Should return error for non-existent file."""
        result = executor._get_file_info("nonexistent.ts")
        assert "error" in result

    def test_includes_imports(self, executor):
        """Should include imports list."""
        result = executor._get_file_info("Button.tsx")
        assert "imports" in result
        assert isinstance(result["imports"], list)


# ==================== search_files Tests ====================


class TestSearchFiles:
    """Tests for search_files tool."""

    def test_search_by_query(self, executor):
        """Should find files matching query."""
        result = executor._search_files(query="Button")

        assert result["count"] >= 1
        paths = [f["path"] for f in result["files"]]
        assert "src/components/Button.tsx" in paths

    def test_search_by_role(self, executor):
        """Should filter by architectural role."""
        result = executor._search_files(role="utility")

        assert result["count"] == 1
        assert result["files"][0]["role"] == "utility"

    def test_search_by_category(self, executor):
        """Should filter by category."""
        result = executor._search_files(category="config")

        assert result["count"] == 1
        assert result["files"][0]["category"] == "config"

    def test_search_combined_filters(self, executor):
        """Should combine query and role filters."""
        result = executor._search_files(query="helper", role="utility")

        assert result["count"] == 1
        assert "helpers.ts" in result["files"][0]["path"]

    def test_search_limits_results(self, executor):
        """Should limit results to 20."""
        # With only 5 nodes, can't test actual limiting
        result = executor._search_files()
        assert result["count"] <= 20

    def test_search_empty_result(self, executor):
        """Should return empty for no matches."""
        result = executor._search_files(query="zzzznonexistent")
        assert result["count"] == 0
        assert result["files"] == []


# ==================== get_dependencies Tests ====================


class TestGetDependencies:
    """Tests for get_dependencies tool."""

    def test_get_imports(self, executor):
        """Should return what a file imports."""
        result = executor._get_dependencies("App.tsx", direction="imports")

        assert "imports" in result
        assert result["import_count"] == 3  # Button, helpers, api
        import_paths = [i["path"] for i in result["imports"]]
        assert "src/components/Button.tsx" in import_paths

    def test_get_imported_by(self, executor):
        """Should return what imports a file."""
        result = executor._get_dependencies("helpers.ts", direction="imported_by")

        assert "imported_by" in result
        assert result["imported_by_count"] == 2  # App and api import it
        importer_paths = [i["path"] for i in result["imported_by"]]
        assert "src/App.tsx" in importer_paths

    def test_get_both_directions(self, executor):
        """Should return both directions."""
        result = executor._get_dependencies("api.ts", direction="both")

        assert "imports" in result
        assert "imported_by" in result

    def test_includes_imported_names(self, executor):
        """Should include specific imported names."""
        result = executor._get_dependencies("App.tsx", direction="imports")

        button_import = next(
            (i for i in result["imports"] if "Button" in i["path"]), None
        )
        assert button_import is not None
        assert "imported_names" in button_import

    def test_returns_error_for_not_found(self, executor):
        """Should return error for non-existent file."""
        result = executor._get_dependencies("nonexistent.ts")
        assert "error" in result


# ==================== detect_circular_dependencies Tests ====================


class TestDetectCircularDependencies:
    """Tests for detect_circular_dependencies tool."""

    def test_detects_cycle(self, sample_graph_with_cycles, sample_tier_list):
        """Should detect circular dependencies."""
        executor = ChatToolExecutor(sample_graph_with_cycles, sample_tier_list)
        result = executor._detect_circular_dependencies()

        assert result["has_cycles"] is True
        assert result["cycle_count"] >= 1

    def test_no_cycles_in_clean_graph(self, executor):
        """Should report no cycles for acyclic graph."""
        result = executor._detect_circular_dependencies()

        assert result["has_cycles"] is False
        assert result["cycle_count"] == 0

    def test_filter_by_involving_file(self, sample_graph_with_cycles, sample_tier_list):
        """Should filter cycles involving specific file."""
        executor = ChatToolExecutor(sample_graph_with_cycles, sample_tier_list)
        result = executor._detect_circular_dependencies(involving_file="a.ts")

        assert result["has_cycles"] is True
        # All returned cycles should involve a.ts
        for cycle in result["cycles"]:
            assert any("a.ts" in path for path in cycle["cycle"])

    def test_max_cycles_limit(self, sample_graph_with_cycles, sample_tier_list):
        """Should respect max_cycles limit."""
        executor = ChatToolExecutor(sample_graph_with_cycles, sample_tier_list)
        result = executor._detect_circular_dependencies(max_cycles=1)

        assert len(result["cycles"]) <= 1

    def test_returns_error_for_nonexistent_file_filter(
        self, sample_graph_with_cycles, sample_tier_list
    ):
        """Should return error for non-existent involving_file."""
        executor = ChatToolExecutor(sample_graph_with_cycles, sample_tier_list)
        result = executor._detect_circular_dependencies(involving_file="nonexistent.ts")
        assert "error" in result

    def test_cycle_normalization(self, sample_graph_with_cycles, sample_tier_list):
        """Cycles should be normalized for deduplication."""
        executor = ChatToolExecutor(sample_graph_with_cycles, sample_tier_list)
        result = executor._detect_circular_dependencies()

        # Check that cycles are properly formed (start == end)
        for cycle_info in result["cycles"]:
            cycle = cycle_info["cycle"]
            if len(cycle) > 1:
                assert cycle[0] == cycle[-1], "Cycle should start and end at same node"


# ==================== find_dependency_path Tests ====================


class TestFindDependencyPath:
    """Tests for find_dependency_path tool."""

    def test_finds_direct_path(self, executor):
        """Should find direct dependency path."""
        result = executor._find_dependency_path("App.tsx", "Button.tsx")

        assert result["connected"] is True
        assert result["length"] == 1
        assert len(result["path"]) == 2

    def test_finds_indirect_path(self, executor):
        """Should find indirect dependency path."""
        # App -> api -> helpers (App imports both directly, so 1 step)
        result = executor._find_dependency_path("App.tsx", "helpers.ts")

        assert result["connected"] is True
        # App imports helpers directly
        assert result["length"] >= 1

    def test_no_path_returns_not_connected(self, executor):
        """Should report not connected when no path exists."""
        # config.ts doesn't import or get imported by anything
        result = executor._find_dependency_path("config.ts", "Button.tsx")

        assert result["connected"] is False
        assert result["length"] == -1

    def test_same_file_path(self, executor):
        """Should handle source == target."""
        result = executor._find_dependency_path("App.tsx", "App.tsx")

        assert result["connected"] is True
        assert result["length"] == 0

    def test_bidirectional_search(self, executor):
        """Should search both directions when bidirectional=True."""
        # helpers.ts is imported by App.tsx
        result = executor._find_dependency_path(
            "helpers.ts", "App.tsx", bidirectional=True
        )

        assert result["connected"] is True

    def test_max_depth_limit(self, executor):
        """Should respect max_depth limit."""
        result = executor._find_dependency_path("App.tsx", "config.ts", max_depth=1)

        # No direct path exists
        assert result["connected"] is False

    def test_returns_error_for_missing_source(self, executor):
        """Should return error for non-existent source."""
        result = executor._find_dependency_path("nonexistent.ts", "Button.tsx")
        assert "error" in result

    def test_returns_error_for_missing_target(self, executor):
        """Should return error for non-existent target."""
        result = executor._find_dependency_path("App.tsx", "nonexistent.ts")
        assert "error" in result


# ==================== compare_files Tests ====================


class TestCompareFiles:
    """Tests for compare_files tool."""

    def test_compares_two_files(self, executor):
        """Should compare two files."""
        result = executor._compare_files("App.tsx", "Button.tsx")

        assert "file1" in result
        assert "file2" in result
        assert "comparison" in result
        assert result["file1"]["path"] == "src/App.tsx"
        assert result["file2"]["path"] == "src/components/Button.tsx"

    def test_identifies_same_role(self, executor):
        """Should identify when files have same role."""
        result = executor._compare_files("App.tsx", "Button.tsx")

        assert result["comparison"]["same_role"] is True  # Both react_component

    def test_identifies_different_role(self, executor):
        """Should identify when files have different roles."""
        result = executor._compare_files("App.tsx", "helpers.ts")

        assert result["comparison"]["same_role"] is False

    def test_finds_shared_imports(self, executor):
        """Should find shared imports."""
        # App imports helpers, api imports helpers
        result = executor._compare_files("App.tsx", "api.ts")

        assert "shared_imports" in result["comparison"]
        # Both import helpers.ts
        shared = result["comparison"]["shared_imports"]
        assert any("helpers" in path for path in shared)

    def test_detects_direct_relationship(self, executor):
        """Should detect direct import relationship."""
        result = executor._compare_files("App.tsx", "Button.tsx")

        assert result["comparison"]["direct_relationship"] is not None
        assert "imports" in result["comparison"]["direct_relationship"]

    def test_returns_error_for_missing_file(self, executor):
        """Should return error for non-existent file."""
        result = executor._compare_files("App.tsx", "nonexistent.ts")
        assert "error" in result


# ==================== get_metrics Tests ====================


class TestGetMetrics:
    """Tests for get_metrics tool."""

    def test_size_by_role_metric(self, executor):
        """Should calculate size by role."""
        result = executor._get_metrics("size_by_role")

        assert "size_by_role" in result
        assert "react_component" in result["size_by_role"]
        assert "avg_lines" in result["size_by_role"]["react_component"]

    def test_most_connected_metric(self, executor):
        """Should find most connected files."""
        result = executor._get_metrics("most_connected")

        assert "most_connected" in result
        assert len(result["most_connected"]) <= 10
        # Should be sorted by total connections
        connections = [f["total"] for f in result["most_connected"]]
        assert connections == sorted(connections, reverse=True)

    def test_dependency_stats_metric(self, executor):
        """Should calculate dependency statistics."""
        result = executor._get_metrics("dependency_stats")

        assert "dependency_stats" in result
        stats = result["dependency_stats"]
        assert "total_dependencies" in stats
        assert "avg_imports_per_file" in stats
        assert "max_imports" in stats

    def test_role_distribution_metric(self, executor):
        """Should calculate role distribution."""
        result = executor._get_metrics("role_distribution")

        assert "role_distribution" in result
        dist = result["role_distribution"]
        assert "react_component" in dist
        assert dist["react_component"] == 2  # App and Button

    def test_all_metrics(self, executor):
        """Should return all metrics."""
        result = executor._get_metrics("all")

        assert "size_by_role" in result
        assert "most_connected" in result
        assert "dependency_stats" in result
        assert "role_distribution" in result


# ==================== explain_highlighted Tests ====================


class TestExplainHighlighted:
    """Tests for explain_highlighted tool."""

    def test_exact_file_match(self, executor):
        """Should match exact file name."""
        result = executor._explain_highlighted("Button.tsx")

        assert result["type"] == "file"
        assert "Button" in result["match"]

    def test_role_match(self, executor):
        """Should match architectural role."""
        result = executor._explain_highlighted("react_component")

        assert result["type"] == "architectural_role"
        assert result["details"]["file_count"] >= 1

    def test_category_match(self, executor):
        """Should match category."""
        result = executor._explain_highlighted("config")

        # Could match either the category or the file config.ts
        assert result["type"] in ["category", "file"]

    def test_fuzzy_file_match(self, executor):
        """Should fuzzy match file names."""
        # Use partial name that should match "Button.tsx"
        result = executor._explain_highlighted("Button")

        # Should find Button.tsx via fuzzy match
        assert result["type"] in ["file", "file_candidates", "search_result"]

    def test_function_match_with_tier_list(self, executor):
        """Should match function names from tier list."""
        result = executor._explain_highlighted("handleClick")

        assert result["type"] == "function"
        assert result["details"]["function_name"] == "handleClick"

    def test_returns_unknown_for_no_match(self, executor):
        """Should return unknown for unrecognizable text."""
        result = executor._explain_highlighted("zzzzxyznonexistent123")

        assert result["type"] == "unknown"

    def test_import_path_reference(self, executor):
        """Should recognize import path patterns."""
        result = executor._explain_highlighted("./components/Button")

        assert result["type"] in ["file", "import_reference"]


# ==================== Function Tools Tests ====================


class TestFunctionTools:
    """Tests for function-related tools."""

    def test_get_function_info(self, executor):
        """Should get function details."""
        result = executor._get_function_info("handleClick")

        assert "error" not in result
        assert result["function_name"] == "handleClick"
        assert result["tier"] == "S"

    def test_get_function_info_with_file_path(self, executor):
        """Should disambiguate with file path."""
        result = executor._get_function_info("formatDate", file_path="helpers.ts")

        assert "error" not in result
        assert result["function_name"] == "formatDate"

    def test_get_function_info_not_found(self, executor):
        """Should return error for non-existent function."""
        result = executor._get_function_info("nonexistentFunc")
        assert "error" in result

    def test_get_function_info_no_tier_list(self, executor_no_tiers):
        """Should return error when tier list unavailable."""
        result = executor_no_tiers._get_function_info("handleClick")
        assert "error" in result
        assert "tier data not available" in result["error"]

    def test_list_functions_by_tier(self, executor):
        """Should filter functions by tier."""
        result = executor._list_functions(tier="S")

        assert result["count"] == 1
        assert all(f["tier"] == "S" for f in result["functions"])

    def test_list_functions_by_file(self, executor):
        """Should filter functions by file path."""
        result = executor._list_functions(file_path="helpers.ts")

        assert result["count"] == 2  # formatDate and validateInput
        assert all("helpers.ts" in f["file_path"] for f in result["functions"])

    def test_list_functions_by_min_calls(self, executor):
        """Should filter functions by minimum call count."""
        result = executor._list_functions(min_calls=10)

        # Only handleClick has 15+5=20 and formatDate has 10+2=12
        for func in result["functions"]:
            total = func["call_count"]
            assert total >= 10

    def test_list_functions_limit(self, executor):
        """Should respect limit parameter."""
        result = executor._list_functions(limit=2)

        assert len(result["functions"]) <= 2


# ==================== execute_tool Tests ====================


class TestExecuteTool:
    """Tests for the execute_tool method."""

    def test_dispatches_to_correct_tool(self, executor):
        """Should dispatch to correct tool based on name."""
        result = executor.execute_tool("get_file_info", {"filename": "Button.tsx"})

        assert "path" in result
        assert "Button" in result["path"]

    def test_handles_unknown_tool(self, executor):
        """Should return error for unknown tool."""
        result = executor.execute_tool("unknown_tool", {})

        assert "error" in result
        assert "Unknown tool" in result["error"]

    def test_applies_summarization(self, executor, sample_graph, sample_tier_list):
        """Should summarize large results."""
        # Create executor with more data to trigger summarization
        executor = ChatToolExecutor(sample_graph, sample_tier_list)
        result = executor.execute_tool("get_metrics", {"metric": "all"})

        # Result should be valid (summarization applied if needed)
        assert isinstance(result, dict)

    def test_handles_tool_errors_gracefully(self, executor):
        """Should catch and return errors gracefully."""
        # Empty filename should cause an issue
        result = executor.execute_tool("get_file_info", {"filename": ""})

        # Should not raise, should return error
        assert isinstance(result, dict)

    def test_default_parameters(self, executor):
        """Should use default parameters when not provided."""
        result = executor.execute_tool("get_dependencies", {"filename": "App.tsx"})

        # Should use default direction="both"
        assert "imports" in result
        assert "imported_by" in result

    def test_all_tools_executable(self, executor):
        """All defined tools should be executable."""
        tool_test_inputs = {
            "get_file_info": {"filename": "App.tsx"},
            "search_files": {"query": "test"},
            "get_dependencies": {"filename": "App.tsx"},
            "get_function_info": {"function_name": "handleClick"},
            "list_functions": {},
            "explain_highlighted": {"text": "Button"},
            "detect_circular_dependencies": {},
            "find_dependency_path": {"source": "App.tsx", "target": "Button.tsx"},
            "compare_files": {"file1": "App.tsx", "file2": "Button.tsx"},
            "get_metrics": {"metric": "all"},
        }

        for tool_name, tool_input in tool_test_inputs.items():
            result = executor.execute_tool(tool_name, tool_input)
            # Should return a dict without crashing
            assert isinstance(result, dict), f"Tool {tool_name} failed"


# ==================== Tool Schema Tests ====================


class TestToolSchemas:
    """Tests for tool definition schemas."""

    def test_all_tools_have_required_fields(self):
        """All tools should have name, description, and input_schema."""
        for tool in CHAT_TOOLS_COMPRESSED:
            assert "name" in tool
            assert "description" in tool
            assert "input_schema" in tool

    def test_input_schemas_are_valid(self):
        """Input schemas should have valid structure."""
        for tool in CHAT_TOOLS_COMPRESSED:
            schema = tool["input_schema"]
            assert schema["type"] == "object"
            assert "properties" in schema

    def test_required_parameters_defined(self):
        """Required parameters should be listed."""
        tools_with_required = [
            "get_file_info",
            "get_dependencies",
            "get_function_info",
            "explain_highlighted",
            "find_dependency_path",
            "compare_files",
            "get_metrics",
        ]

        for tool in CHAT_TOOLS_COMPRESSED:
            if tool["name"] in tools_with_required:
                assert "required" in tool["input_schema"], f"{tool['name']} missing required"
