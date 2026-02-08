"""Tests for the rundown generator service."""
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.models.schemas import (
    FileNode,
    DependencyEdge,
    Language,
    ArchitecturalRole,
    Category,
    ImportType,
    CodebaseRundown,
)
from app.services.rundown_generator import RundownGenerator


# ==================== Fixtures ====================


def make_node(
    id: str,
    path: str,
    name: str,
    role: ArchitecturalRole = ArchitecturalRole.UNKNOWN,
    language: Language = Language.TYPESCRIPT,
    description: str = "",
) -> FileNode:
    """Create a minimal FileNode for testing."""
    return FileNode(
        id=id,
        path=path,
        name=name,
        folder="",
        language=language,
        role=role,
        description=description,
        category=Category.FRONTEND,
        imports=[],
        size_bytes=100,
        line_count=50,
    )


def make_edge(source: str, target: str, id: str = "") -> DependencyEdge:
    """Create a minimal DependencyEdge for testing."""
    return DependencyEdge(
        id=id or f"{source}->{target}",
        source=source,
        target=target,
        import_type=ImportType.IMPORT,
    )


@pytest.fixture
def sample_nodes():
    """Create a set of sample nodes with various roles."""
    return [
        make_node("n1", "src/App.tsx", "App.tsx", ArchitecturalRole.REACT_COMPONENT, description="Main app component"),
        make_node("n2", "src/components/Button.tsx", "Button.tsx", ArchitecturalRole.REACT_COMPONENT, description="Button component"),
        make_node("n3", "src/hooks/useAuth.ts", "useAuth.ts", ArchitecturalRole.HOOK, description="Auth hook"),
        make_node("n4", "src/api/client.ts", "client.ts", ArchitecturalRole.API_SERVICE, description="API client"),
        make_node("n5", "src/utils/helpers.ts", "helpers.ts", ArchitecturalRole.UTILITY, description="Helper functions"),
        make_node("n6", "src/config/supabase.ts", "supabase.ts", ArchitecturalRole.CONFIG, description="Supabase config"),
        make_node("n7", "src/types/index.ts", "index.ts", ArchitecturalRole.MODEL, description="Type definitions"),
        make_node("n8", "src/store/authStore.ts", "authStore.ts", ArchitecturalRole.STORE, description="Auth store"),
    ]


@pytest.fixture
def sample_edges():
    """Create sample edges between nodes."""
    return [
        make_edge("n1", "n2"),  # App -> Button
        make_edge("n1", "n3"),  # App -> useAuth
        make_edge("n3", "n4"),  # useAuth -> client
        make_edge("n4", "n6"),  # client -> supabase config
        make_edge("n2", "n5"),  # Button -> helpers
        make_edge("n3", "n8"),  # useAuth -> authStore
        make_edge("n1", "n7"),  # App -> types
    ]


@pytest.fixture
def generator():
    """Create a RundownGenerator with mocked settings."""
    with patch("app.services.rundown_generator.get_settings") as mock_settings:
        settings = MagicMock()
        settings.anthropic_api_key = "test-key"
        settings.llm_model = "claude-sonnet-4-20250514"
        settings.rundown_max_tokens = 4096
        settings.rundown_min_files = 5
        mock_settings.return_value = settings
        gen = RundownGenerator()
        gen.client = AsyncMock()
        return gen


# ==================== Data Preparation Tests ====================


class TestComputeRoleGroups:
    def test_basic_grouping(self, generator, sample_nodes, sample_edges):
        groups = generator._compute_role_groups(sample_nodes, sample_edges)
        assert "react_component" in groups
        assert groups["react_component"]["file_count"] == 2
        assert "hook" in groups
        assert groups["hook"]["file_count"] == 1

    def test_empty_nodes(self, generator):
        groups = generator._compute_role_groups([], [])
        assert groups == {}

    def test_key_files_capped(self, generator):
        """Verify key_files per role are capped at MAX_FILES_PER_ROLE."""
        nodes = [
            make_node(f"n{i}", f"src/comp{i}.tsx", f"comp{i}.tsx", ArchitecturalRole.REACT_COMPONENT)
            for i in range(10)
        ]
        groups = generator._compute_role_groups(nodes, [])
        assert len(groups["react_component"]["key_files"]) == 5  # MAX_FILES_PER_ROLE

    def test_edge_counts(self, generator, sample_nodes, sample_edges):
        groups = generator._compute_role_groups(sample_nodes, sample_edges)
        # App (n1) has 3 outgoing edges, Button (n2) has 1 outgoing + 1 incoming
        assert groups["react_component"]["total_outgoing_edges"] == 4  # n1:3 + n2:1
        assert groups["react_component"]["total_incoming_edges"] == 1  # n2 gets 1 from n1


class TestComputeInterRoleMatrix:
    def test_basic_matrix(self, generator, sample_nodes, sample_edges):
        matrix = generator._compute_inter_role_matrix(sample_nodes, sample_edges)
        # Find react_component -> hook pair
        rc_to_hook = [m for m in matrix if m["source_role"] == "react_component" and m["target_role"] == "hook"]
        assert len(rc_to_hook) == 1
        assert rc_to_hook[0]["count"] == 1

    def test_excludes_same_role(self, generator, sample_nodes):
        # Edge within same role
        edges = [make_edge("n1", "n2")]  # Both react_component
        matrix = generator._compute_inter_role_matrix(sample_nodes, edges)
        assert len(matrix) == 0

    def test_sorted_by_count_descending(self, generator, sample_nodes, sample_edges):
        matrix = generator._compute_inter_role_matrix(sample_nodes, sample_edges)
        counts = [m["count"] for m in matrix]
        assert counts == sorted(counts, reverse=True)


class TestIdentifyEntryPoints:
    def test_structural_entry_points(self, generator, sample_nodes, sample_edges):
        """Files with no incoming edges should be identified."""
        entry_points = generator._identify_entry_points(sample_nodes, sample_edges)
        paths = [ep["file_path"] for ep in entry_points]
        # n1 (App.tsx) has no incoming edges and matches heuristic
        assert "src/App.tsx" in paths

    def test_heuristic_patterns(self, generator):
        """Files matching entry point patterns should be identified."""
        nodes = [
            make_node("n1", "src/main.ts", "main.ts", ArchitecturalRole.CONFIG),
            make_node("n2", "src/utils.ts", "utils.ts", ArchitecturalRole.UTILITY),
        ]
        entry_points = generator._identify_entry_points(nodes, [])
        paths = [ep["file_path"] for ep in entry_points]
        assert "src/main.ts" in paths

    def test_deduplication(self, generator):
        """Entry points should be deduplicated."""
        nodes = [
            make_node("n1", "src/App.tsx", "App.tsx", ArchitecturalRole.REACT_COMPONENT),
        ]
        # n1 has no incoming edges (structural) AND matches App.* pattern (heuristic)
        entry_points = generator._identify_entry_points(nodes, [])
        paths = [ep["file_path"] for ep in entry_points]
        assert paths.count("src/App.tsx") == 1

    def test_capped_at_max(self, generator):
        """Should not exceed MAX_ENTRY_POINTS."""
        nodes = [
            make_node(f"n{i}", f"src/main{i}.ts", f"main{i}.ts", ArchitecturalRole.CONFIG)
            for i in range(10)
        ]
        entry_points = generator._identify_entry_points(nodes, [])
        assert len(entry_points) <= 5  # MAX_ENTRY_POINTS


class TestIdentifyLeafNodes:
    def test_leaf_nodes(self, generator, sample_nodes, sample_edges):
        """Files with no outgoing edges should be identified as leaves."""
        leaves = generator._identify_leaf_nodes(sample_nodes, sample_edges)
        paths = [l["file_path"] for l in leaves]
        # n5, n6, n7, n8 have no outgoing edges
        assert "src/utils/helpers.ts" in paths
        assert "src/config/supabase.ts" in paths

    def test_sorted_by_incoming_count(self, generator, sample_nodes, sample_edges):
        leaves = generator._identify_leaf_nodes(sample_nodes, sample_edges)
        counts = [l["incoming_count"] for l in leaves]
        assert counts == sorted(counts, reverse=True)


class TestMinimumFileThreshold:
    @pytest.mark.asyncio
    async def test_returns_none_for_small_codebases(self, generator):
        """Should return None when fewer than min_files nodes."""
        nodes = [
            make_node(f"n{i}", f"src/file{i}.ts", f"file{i}.ts")
            for i in range(3)
        ]
        result = await generator.generate_rundown(nodes, [], {"typescript": 3})
        assert result is None
        # LLM should NOT have been called
        generator.client.messages.create.assert_not_called()


# ==================== Prompt Construction Tests ====================


class TestBuildPrompt:
    def test_includes_all_sections(self, generator, sample_nodes, sample_edges):
        prompt = generator._build_prompt(sample_nodes, sample_edges, {"typescript": 8})
        assert "Codebase Analysis" in prompt
        assert "File Roles" in prompt
        assert "Dependency Flow Between Roles" in prompt
        assert "Entry Point Candidates" in prompt
        assert "Leaf Files" in prompt
        assert "Key Files" in prompt

    def test_includes_language_info(self, generator, sample_nodes, sample_edges):
        prompt = generator._build_prompt(
            sample_nodes, sample_edges, {"typescript": 6, "python": 2}
        )
        assert "typescript" in prompt
        assert "python" in prompt

    def test_prompt_length_reasonable(self, generator, sample_nodes, sample_edges):
        """Prompt should stay under a reasonable character limit."""
        prompt = generator._build_prompt(sample_nodes, sample_edges, {"typescript": 8})
        assert len(prompt) < 40000  # ~10K tokens


# ==================== Response Parsing Tests ====================


VALID_RUNDOWN_JSON = {
    "layers": [
        {
            "id": "presentation",
            "label": "Presentation Layer",
            "description": "Handles UI rendering",
            "order": 0,
            "roles": ["react_component"],
            "key_files": ["src/App.tsx"],
        },
        {
            "id": "logic",
            "label": "Business Logic",
            "description": "Application logic",
            "order": 1,
            "roles": ["hook", "store"],
            "key_files": ["src/hooks/useAuth.ts"],
        },
    ],
    "entry_points": [
        {
            "file_path": "src/App.tsx",
            "description": "Main entry point",
            "starts_flow": "main_flow",
        },
    ],
    "flows": [
        {
            "id": "main_flow",
            "name": "Main Flow",
            "description": "Primary application flow",
            "steps": [
                {
                    "layer_id": "presentation",
                    "action": "Renders components",
                    "key_files": ["src/App.tsx"],
                },
                {
                    "layer_id": "logic",
                    "action": "Processes auth",
                    "key_files": ["src/hooks/useAuth.ts"],
                },
            ],
        },
    ],
    "cross_cutting": [
        {
            "name": "Configuration",
            "description": "App configuration",
            "files": ["src/config/supabase.ts"],
        },
    ],
    "narrative": "This is a test narrative that explains the codebase architecture in detail.",
}


class TestParseResponse:
    def test_valid_json(self, generator):
        response = json.dumps(VALID_RUNDOWN_JSON)
        rundown = generator._parse_response(response)
        assert isinstance(rundown, CodebaseRundown)
        assert len(rundown.layers) == 2
        assert len(rundown.flows) == 1
        assert rundown.layers[0].id == "presentation"

    def test_markdown_wrapped(self, generator):
        response = "```json\n" + json.dumps(VALID_RUNDOWN_JSON) + "\n```"
        rundown = generator._parse_response(response)
        assert isinstance(rundown, CodebaseRundown)
        assert len(rundown.layers) == 2

    def test_generic_code_fence(self, generator):
        response = "```\n" + json.dumps(VALID_RUNDOWN_JSON) + "\n```"
        rundown = generator._parse_response(response)
        assert isinstance(rundown, CodebaseRundown)

    def test_preamble_text(self, generator):
        """Strategy 4: extract first { to last }."""
        response = "Here is the analysis:\n" + json.dumps(VALID_RUNDOWN_JSON)
        rundown = generator._parse_response(response)
        assert isinstance(rundown, CodebaseRundown)

    def test_malformed_json(self, generator):
        with pytest.raises(ValueError, match="Failed to parse"):
            generator._parse_response("not json at all")

    def test_missing_layers(self, generator):
        """Must have at least one layer."""
        data = {**VALID_RUNDOWN_JSON, "layers": []}
        with pytest.raises(ValueError, match="at least one layer"):
            generator._parse_response(json.dumps(data))

    def test_missing_flows(self, generator):
        """Must have at least one flow."""
        data = {**VALID_RUNDOWN_JSON, "flows": []}
        with pytest.raises(ValueError, match="at least one flow"):
            generator._parse_response(json.dumps(data))

    def test_extra_fields_ignored(self, generator):
        """Unknown JSON fields should not cause errors."""
        data = {**VALID_RUNDOWN_JSON, "extra_field": "ignored"}
        rundown = generator._parse_response(json.dumps(data))
        assert isinstance(rundown, CodebaseRundown)


# ==================== File Path Sanitization Tests ====================


class TestSanitizeFilePaths:
    def test_removes_invalid_paths(self, generator):
        rundown = CodebaseRundown(
            layers=[
                RundownLayer(
                    id="l1",
                    label="Layer",
                    description="Test",
                    order=0,
                    roles=[],
                    key_files=["valid.ts", "hallucinated.ts"],
                )
            ],
            entry_points=[],
            flows=[
                RundownFlow(
                    id="f1",
                    name="Flow",
                    description="Test",
                    steps=[],
                )
            ],
            cross_cutting=[],
            narrative="test",
        )
        valid_paths = {"valid.ts"}
        result = generator._sanitize_file_paths(rundown, valid_paths)
        assert result.layers[0].key_files == ["valid.ts"]

    def test_preserves_valid_paths(self, generator):
        from app.models.schemas import RundownCrossCutting as RCC

        rundown = CodebaseRundown(
            layers=[
                RundownLayer(
                    id="l1", label="L", description="D", order=0,
                    roles=[], key_files=["a.ts", "b.ts"],
                )
            ],
            entry_points=[],
            flows=[
                RundownFlow(id="f1", name="F", description="D", steps=[])
            ],
            cross_cutting=[
                RCC(name="CC", description="D", files=["a.ts", "c.ts"]),
            ],
            narrative="test",
        )
        valid_paths = {"a.ts", "b.ts"}
        result = generator._sanitize_file_paths(rundown, valid_paths)
        assert result.layers[0].key_files == ["a.ts", "b.ts"]
        assert result.cross_cutting[0].files == ["a.ts"]


# ==================== LLM Integration Tests (mocked) ====================


# Need these imports for the sanitize tests
from app.models.schemas import (
    RundownLayer,
    RundownFlow,
)


class TestGenerateRundownIntegration:
    @pytest.mark.asyncio
    async def test_success(self, generator, sample_nodes, sample_edges):
        """Mock LLM returns valid JSON -> CodebaseRundown returned."""
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text=json.dumps(VALID_RUNDOWN_JSON))]
        generator.client.messages.create = AsyncMock(return_value=mock_message)

        result = await generator.generate_rundown(
            sample_nodes, sample_edges, {"typescript": 8}
        )
        assert isinstance(result, CodebaseRundown)
        assert len(result.layers) == 2

    @pytest.mark.asyncio
    async def test_llm_failure_returns_none(self, generator, sample_nodes, sample_edges):
        """LLM raising exception -> None returned."""
        generator.client.messages.create = AsyncMock(
            side_effect=Exception("API Error")
        )
        result = await generator.generate_rundown(
            sample_nodes, sample_edges, {"typescript": 8}
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_invalid_response_returns_none(self, generator, sample_nodes, sample_edges):
        """LLM returning garbage -> None returned."""
        mock_message = MagicMock()
        mock_message.content = [MagicMock(text="not valid json")]
        generator.client.messages.create = AsyncMock(return_value=mock_message)

        result = await generator.generate_rundown(
            sample_nodes, sample_edges, {"typescript": 8}
        )
        assert result is None
