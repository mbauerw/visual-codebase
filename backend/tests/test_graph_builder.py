"""
Tests for the GraphBuilder service.
Covers import path resolution, alias resolution, node_modules exclusion,
circular dependency handling, React Flow format conversion, and layout positioning.
"""

import pytest
from datetime import datetime
from unittest.mock import MagicMock

from app.services.graph_builder import GraphBuilder, get_graph_builder
from app.models.schemas import (
    ArchitecturalRole,
    Category,
    DependencyEdge,
    FileNode,
    ImportInfo,
    ImportType,
    Language,
    LLMFileAnalysis,
    ParsedFile,
    ReactFlowGraph,
    ReactFlowNode,
    ReactFlowEdge,
    AnalysisMetadata,
)


# ==================== Fixtures ====================

@pytest.fixture
def builder():
    """Create a fresh GraphBuilder instance for each test."""
    return GraphBuilder()


@pytest.fixture
def sample_metadata():
    """Create sample analysis metadata."""
    return AnalysisMetadata(
        analysis_id="test-id",
        directory_path="/test/project",
        file_count=5,
        edge_count=3,
        analysis_time_seconds=1.5,
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        languages={"typescript": 3, "javascript": 2},
        errors=[],
    )


def create_parsed_file(
    relative_path: str,
    imports: list[ImportInfo] = None,
    exports: list[str] = None,
    language: Language = Language.TYPESCRIPT,
) -> ParsedFile:
    """Helper to create a ParsedFile for testing."""
    return ParsedFile(
        path=f"/project/{relative_path}",
        relative_path=relative_path,
        name=relative_path.split("/")[-1],
        folder="/".join(relative_path.split("/")[:-1]),
        language=language,
        imports=imports or [],
        exports=exports or [],
        functions=[],
        classes=[],
        size_bytes=1000,
        line_count=50,
        content=None,
    )


def create_import(module: str, is_relative: bool = True, import_type: ImportType = ImportType.IMPORT) -> ImportInfo:
    """Helper to create an ImportInfo."""
    return ImportInfo(
        module=module,
        import_type=import_type,
        is_relative=is_relative,
        imported_names=[],
    )


def create_llm_analysis(
    filename: str,
    role: ArchitecturalRole = ArchitecturalRole.UTILITY,
    category: Category = Category.SHARED,
) -> LLMFileAnalysis:
    """Helper to create LLMFileAnalysis."""
    return LLMFileAnalysis(
        filename=filename,
        architectural_role=role,
        description=f"Description for {filename}",
        category=category,
    )


# ==================== Node ID Generation Tests ====================

class TestNodeIdGeneration:
    """Tests for stable node ID generation."""

    def test_consistent_node_id(self, builder):
        """Test that same path always generates same ID."""
        path = "src/components/Button.tsx"
        id1 = builder._generate_node_id(path)
        id2 = builder._generate_node_id(path)

        assert id1 == id2

    def test_different_paths_different_ids(self, builder):
        """Test that different paths generate different IDs."""
        id1 = builder._generate_node_id("src/Button.tsx")
        id2 = builder._generate_node_id("src/Input.tsx")

        assert id1 != id2

    def test_node_id_cached(self, builder):
        """Test that node IDs are cached."""
        path = "src/utils.ts"
        id1 = builder._generate_node_id(path)

        # Should be in cache
        assert path in builder._path_to_id
        assert builder._path_to_id[path] == id1


# ==================== Import Path Resolution Tests ====================

class TestImportPathResolution:
    """Tests for resolving import paths to actual files."""

    def test_resolve_relative_same_directory(self, builder):
        """Test resolving relative import in same directory."""
        files = {
            "src/utils.ts": create_parsed_file("src/utils.ts"),
            "src/helpers.ts": create_parsed_file("src/helpers.ts"),
        }

        result = builder._resolve_import_path(
            "./helpers",
            "src/utils.ts",
            files,
            "/project"
        )

        assert result == "src/helpers.ts"

    def test_resolve_relative_parent_directory(self, builder):
        """Test resolving relative import from parent directory."""
        files = {
            "src/utils.ts": create_parsed_file("src/utils.ts"),
            "src/components/Button.tsx": create_parsed_file("src/components/Button.tsx"),
        }

        result = builder._resolve_import_path(
            "../utils",
            "src/components/Button.tsx",
            files,
            "/project"
        )

        assert result == "src/utils.ts"

    def test_resolve_relative_nested(self, builder):
        """Test resolving relative import to nested path."""
        files = {
            "src/App.tsx": create_parsed_file("src/App.tsx"),
            "src/components/Button.tsx": create_parsed_file("src/components/Button.tsx"),
        }

        result = builder._resolve_import_path(
            "./components/Button",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result == "src/components/Button.tsx"

    def test_resolve_with_extension(self, builder):
        """Test resolving when extension is included."""
        files = {
            "src/utils.ts": create_parsed_file("src/utils.ts"),
        }

        # Without explicit extension, should find .ts
        result = builder._resolve_import_path(
            "./utils",
            "src/index.ts",
            files,
            "/project"
        )

        assert result == "src/utils.ts"

    def test_resolve_index_file(self, builder):
        """Test resolving to index file in directory."""
        files = {
            "src/components/index.ts": create_parsed_file("src/components/index.ts"),
        }

        result = builder._resolve_import_path(
            "./components",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result == "src/components/index.ts"


# ==================== Alias Resolution Tests ====================

class TestAliasResolution:
    """Tests for path alias resolution (@/, ~/)."""

    def test_resolve_at_alias(self, builder):
        """Test resolving @/ alias to src/."""
        files = {
            "src/components/Button.tsx": create_parsed_file("src/components/Button.tsx"),
        }

        result = builder._resolve_import_path(
            "@/components/Button",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result == "src/components/Button.tsx"

    def test_resolve_tilde_alias(self, builder):
        """Test resolving ~/ alias to src/."""
        files = {
            "src/utils/helpers.ts": create_parsed_file("src/utils/helpers.ts"),
        }

        result = builder._resolve_import_path(
            "~/utils/helpers",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result == "src/utils/helpers.ts"

    def test_alias_with_index(self, builder):
        """Test alias resolution with index file."""
        files = {
            "src/components/index.tsx": create_parsed_file("src/components/index.tsx"),
        }

        result = builder._resolve_import_path(
            "@/components",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result == "src/components/index.tsx"


# ==================== Node Modules Exclusion Tests ====================

class TestNodeModulesExclusion:
    """Tests for excluding external package imports."""

    def test_external_package_returns_none(self, builder):
        """Test that external package imports return None."""
        files = {
            "src/App.tsx": create_parsed_file("src/App.tsx"),
        }

        # External package (no ./ or @/ or ~/)
        result = builder._resolve_import_path(
            "react",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result is None

    def test_lodash_returns_none(self, builder):
        """Test that lodash import returns None."""
        files = {
            "src/utils.ts": create_parsed_file("src/utils.ts"),
        }

        result = builder._resolve_import_path(
            "lodash/debounce",
            "src/utils.ts",
            files,
            "/project"
        )

        assert result is None

    def test_scoped_package_returns_none(self, builder):
        """Test that scoped packages (not aliases) return None."""
        files = {
            "src/App.tsx": create_parsed_file("src/App.tsx"),
        }

        # This is @mui/material, not @/components
        result = builder._resolve_import_path(
            "@mui/material",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result is None


# ==================== Build Nodes Tests ====================

class TestBuildNodes:
    """Tests for building graph nodes from parsed files."""

    def test_build_nodes_basic(self, builder):
        """Test basic node building."""
        parsed_files = [
            create_parsed_file("src/App.tsx"),
            create_parsed_file("src/utils.ts"),
        ]

        llm_analysis = {
            "src/App.tsx": create_llm_analysis(
                "App.tsx",
                ArchitecturalRole.REACT_COMPONENT,
                Category.FRONTEND
            ),
            "src/utils.ts": create_llm_analysis(
                "utils.ts",
                ArchitecturalRole.UTILITY,
                Category.SHARED
            ),
        }

        nodes = builder.build_nodes(parsed_files, llm_analysis)

        assert len(nodes) == 2
        assert all(isinstance(n, FileNode) for n in nodes)

        app_node = next(n for n in nodes if n.name == "App.tsx")
        assert app_node.role == ArchitecturalRole.REACT_COMPONENT
        assert app_node.category == Category.FRONTEND

    def test_build_nodes_with_llm_analysis_by_basename(self, builder):
        """Test node building when LLM returns basename only."""
        parsed_files = [
            create_parsed_file("src/components/Button.tsx"),
        ]

        # LLM returns just the basename
        llm_analysis = {
            "Button.tsx": create_llm_analysis(
                "Button.tsx",
                ArchitecturalRole.REACT_COMPONENT,
                Category.FRONTEND
            ),
        }

        nodes = builder.build_nodes(parsed_files, llm_analysis)

        assert len(nodes) == 1
        assert nodes[0].role == ArchitecturalRole.REACT_COMPONENT

    def test_build_nodes_missing_analysis(self, builder):
        """Test node building when LLM analysis is missing."""
        parsed_files = [
            create_parsed_file("src/unknown.ts"),
        ]

        llm_analysis = {}  # No analysis

        nodes = builder.build_nodes(parsed_files, llm_analysis)

        assert len(nodes) == 1
        assert nodes[0].role == ArchitecturalRole.UNKNOWN
        assert nodes[0].category == Category.UNKNOWN

    def test_node_imports_list(self, builder):
        """Test that node imports list is populated."""
        parsed_files = [
            create_parsed_file(
                "src/App.tsx",
                imports=[
                    create_import("./utils"),
                    create_import("react", is_relative=False),
                ]
            ),
        ]

        nodes = builder.build_nodes(parsed_files, {})

        assert len(nodes) == 1
        assert "./utils" in nodes[0].imports
        assert "react" in nodes[0].imports


# ==================== Build Edges Tests ====================

class TestBuildEdges:
    """Tests for building dependency edges."""

    def test_build_edges_basic(self, builder):
        """Test basic edge building between files."""
        # App imports utils
        parsed_files = [
            create_parsed_file("src/App.tsx", imports=[create_import("./utils")]),
            create_parsed_file("src/utils.ts"),
        ]

        # Need to build nodes first to populate path_to_id
        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        assert len(edges) == 1
        edge = edges[0]
        # Edge direction: from utils -> to App (provider -> consumer)
        assert edge.import_type == ImportType.IMPORT

    def test_build_edges_no_duplicate(self, builder):
        """Test that duplicate edges are avoided."""
        # App imports utils twice (different imports from same file)
        parsed_files = [
            create_parsed_file(
                "src/App.tsx",
                imports=[
                    create_import("./utils"),
                    create_import("./utils"),
                ]
            ),
            create_parsed_file("src/utils.ts"),
        ]

        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        # Should only have one edge despite two imports
        assert len(edges) == 1

    def test_build_edges_external_excluded(self, builder):
        """Test that external imports don't create edges."""
        parsed_files = [
            create_parsed_file(
                "src/App.tsx",
                imports=[
                    create_import("react", is_relative=False),
                    create_import("lodash", is_relative=False),
                ]
            ),
        ]

        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        # No edges for external imports
        assert len(edges) == 0

    def test_build_edges_unresolved_import(self, builder):
        """Test that unresolved imports don't create edges."""
        parsed_files = [
            create_parsed_file(
                "src/App.tsx",
                imports=[create_import("./nonexistent")]
            ),
        ]

        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        assert len(edges) == 0


# ==================== Circular Dependency Handling Tests ====================

class TestCircularDependencyHandling:
    """Tests for handling circular dependencies."""

    def test_circular_dependency_creates_both_edges(self, builder):
        """Test that circular dependencies create edges in both directions."""
        # A imports B, B imports A
        parsed_files = [
            create_parsed_file("src/a.ts", imports=[create_import("./b")]),
            create_parsed_file("src/b.ts", imports=[create_import("./a")]),
        ]

        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        # Should have two edges (one in each direction)
        assert len(edges) == 2

    def test_self_import_handled(self, builder):
        """Test that self-imports don't crash."""
        parsed_files = [
            create_parsed_file("src/a.ts", imports=[create_import("./a")]),
        ]

        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        # Self-import should create a single edge from file to itself
        # (unless it's filtered - depends on implementation)
        assert isinstance(edges, list)


# ==================== Build Graph Tests ====================

class TestBuildGraph:
    """Tests for the complete graph building process."""

    def test_build_graph_complete(self, builder, sample_metadata):
        """Test complete graph building."""
        parsed_files = [
            create_parsed_file("src/App.tsx", imports=[create_import("./utils")]),
            create_parsed_file("src/utils.ts"),
        ]

        llm_analysis = {
            "src/App.tsx": create_llm_analysis("App.tsx"),
            "src/utils.ts": create_llm_analysis("utils.ts"),
        }

        nodes, edges = builder.build_graph(
            parsed_files, llm_analysis, "/project", sample_metadata
        )

        assert len(nodes) == 2
        assert len(edges) == 1

    def test_build_graph_resets_cache(self, builder, sample_metadata):
        """Test that build_graph resets the path-to-id cache."""
        # Build first graph
        parsed_files1 = [create_parsed_file("src/a.ts")]
        builder.build_graph(parsed_files1, {}, "/project", sample_metadata)

        # Cache should have been populated
        assert "src/a.ts" in builder._path_to_id

        # Build second graph
        parsed_files2 = [create_parsed_file("src/b.ts")]
        builder.build_graph(parsed_files2, {}, "/project", sample_metadata)

        # Cache should be reset
        assert "src/a.ts" not in builder._path_to_id
        assert "src/b.ts" in builder._path_to_id


# ==================== React Flow Format Conversion Tests ====================

class TestReactFlowFormatConversion:
    """Tests for converting to React Flow format."""

    def test_to_react_flow_format(self, builder, sample_metadata):
        """Test conversion to React Flow format."""
        nodes = [
            FileNode(
                id="node1",
                path="src/App.tsx",
                name="App.tsx",
                folder="src",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.REACT_COMPONENT,
                description="Main app component",
                category=Category.FRONTEND,
                imports=["./utils"],
                size_bytes=1000,
                line_count=50,
            ),
        ]

        edges = [
            DependencyEdge(
                id="edge1",
                source="node2",
                target="node1",
                import_type=ImportType.IMPORT,
                label="./utils",
            ),
        ]

        result = builder.to_react_flow_format(nodes, edges, sample_metadata)

        assert isinstance(result, ReactFlowGraph)
        assert len(result.nodes) == 1
        assert len(result.edges) == 1
        assert result.metadata == sample_metadata

    def test_react_flow_node_structure(self, builder, sample_metadata):
        """Test React Flow node structure."""
        nodes = [
            FileNode(
                id="node1",
                path="src/Button.tsx",
                name="Button.tsx",
                folder="src",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.REACT_COMPONENT,
                description="Button component",
                category=Category.FRONTEND,
                imports=[],
                size_bytes=500,
                line_count=25,
            ),
        ]

        result = builder.to_react_flow_format(nodes, [], sample_metadata)

        rf_node = result.nodes[0]
        assert rf_node.id == "node1"
        assert rf_node.type == "custom"
        assert rf_node.position.x >= 0
        assert rf_node.position.y >= 0
        assert rf_node.data.label == "Button.tsx"
        assert rf_node.data.path == "src/Button.tsx"
        assert rf_node.data.role == ArchitecturalRole.REACT_COMPONENT

    def test_react_flow_edge_structure(self, builder, sample_metadata):
        """Test React Flow edge structure."""
        edges = [
            DependencyEdge(
                id="edge1",
                source="node1",
                target="node2",
                import_type=ImportType.IMPORT,
                label="./utils",
            ),
        ]

        result = builder.to_react_flow_format([], edges, sample_metadata)

        rf_edge = result.edges[0]
        assert rf_edge.id == "edge1"
        assert rf_edge.source == "node1"
        assert rf_edge.target == "node2"
        assert rf_edge.type == "smoothstep"
        assert rf_edge.animated is False
        assert rf_edge.label == "./utils"

    def test_react_flow_layout_grid(self, builder, sample_metadata):
        """Test that nodes are laid out in a grid pattern."""
        nodes = [
            FileNode(
                id=f"node{i}",
                path=f"src/file{i}.ts",
                name=f"file{i}.ts",
                folder="src",
                language=Language.TYPESCRIPT,
                role=ArchitecturalRole.UTILITY,
                description="",
                category=Category.SHARED,
                imports=[],
                size_bytes=100,
                line_count=10,
            )
            for i in range(9)  # 3x3 grid
        ]

        result = builder.to_react_flow_format(nodes, [], sample_metadata)

        # All nodes should have positions
        assert all(n.position.x >= 0 for n in result.nodes)
        assert all(n.position.y >= 0 for n in result.nodes)

        # Nodes should be spread out (not all at same position)
        positions = [(n.position.x, n.position.y) for n in result.nodes]
        unique_positions = set(positions)
        assert len(unique_positions) == len(positions)


# ==================== Edge Label Tests ====================

class TestEdgeLabels:
    """Tests for edge label handling."""

    def test_short_import_has_label(self, builder):
        """Test that short imports have labels."""
        parsed_files = [
            create_parsed_file("src/App.tsx", imports=[create_import("./utils")]),
            create_parsed_file("src/utils.ts"),
        ]

        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        assert len(edges) == 1
        assert edges[0].label == "./utils"

    def test_long_import_no_label(self, builder):
        """Test that very long imports don't have labels."""
        long_import = "./" + "a" * 50  # > 30 chars
        parsed_files = [
            create_parsed_file("src/App.tsx", imports=[create_import(long_import)]),
            create_parsed_file("src/" + "a" * 50 + ".ts"),
        ]

        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        assert len(edges) == 1
        assert edges[0].label is None


# ==================== Singleton Pattern Tests ====================

class TestSingletonPattern:
    """Tests for the singleton pattern."""

    def test_get_graph_builder_returns_same_instance(self):
        """Test that get_graph_builder returns the same instance."""
        builder1 = get_graph_builder()
        builder2 = get_graph_builder()

        assert builder1 is builder2


# ==================== Edge Direction Tests ====================

class TestEdgeDirection:
    """Tests for edge direction (provider -> consumer)."""

    def test_edge_direction(self, builder):
        """Test that edge direction is from provider to consumer."""
        # App imports utils (utils provides, App consumes)
        parsed_files = [
            create_parsed_file("src/App.tsx", imports=[create_import("./utils")]),
            create_parsed_file("src/utils.ts"),
        ]

        builder.build_nodes(parsed_files, {})
        edges = builder.build_edges(parsed_files, "/project")

        assert len(edges) == 1
        edge = edges[0]

        # Get node IDs
        utils_id = builder._path_to_id.get("src/utils.ts")
        app_id = builder._path_to_id.get("src/App.tsx")

        # Edge should go from utils (source/provider) to App (target/consumer)
        assert edge.source == utils_id
        assert edge.target == app_id


# ==================== Python Import Resolution Tests ====================

class TestPythonImportResolution:
    """Tests for Python-specific import resolution."""

    def test_python_relative_import(self, builder):
        """Test resolving Python relative imports."""
        files = {
            "services/__init__.py": create_parsed_file(
                "services/__init__.py", language=Language.PYTHON
            ),
            "services/api.py": create_parsed_file(
                "services/api.py", language=Language.PYTHON
            ),
        }

        result = builder._resolve_import_path(
            ".",
            "services/api.py",
            files,
            "/project"
        )

        assert result == "services/__init__.py"

    def test_python_init_resolution(self, builder):
        """Test resolving to __init__.py file."""
        files = {
            "utils/__init__.py": create_parsed_file(
                "utils/__init__.py", language=Language.PYTHON
            ),
        }

        result = builder._resolve_import_path(
            "./utils",
            "main.py",
            files,
            "/project"
        )

        assert result == "utils/__init__.py"


# ==================== Multiple Extension Resolution Tests ====================

class TestMultipleExtensionResolution:
    """Tests for resolving imports with multiple possible extensions."""

    def test_prefers_ts_over_js(self, builder):
        """Test that .ts files are found before .js."""
        files = {
            "src/utils.ts": create_parsed_file("src/utils.ts"),
        }

        result = builder._resolve_import_path(
            "./utils",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result == "src/utils.ts"

    def test_finds_tsx_for_components(self, builder):
        """Test finding .tsx extension for components."""
        files = {
            "src/Button.tsx": create_parsed_file("src/Button.tsx"),
        }

        result = builder._resolve_import_path(
            "./Button",
            "src/App.tsx",
            files,
            "/project"
        )

        assert result == "src/Button.tsx"

    def test_finds_jsx_files(self, builder):
        """Test finding .jsx files."""
        files = {
            "src/Component.jsx": create_parsed_file(
                "src/Component.jsx", language=Language.JAVASCRIPT
            ),
        }

        result = builder._resolve_import_path(
            "./Component",
            "src/App.js",
            files,
            "/project"
        )

        assert result == "src/Component.jsx"


# ==================== Complex Graph Tests ====================

class TestComplexGraph:
    """Tests for complex graph scenarios."""

    def test_multiple_imports_from_same_file(self, builder, sample_metadata):
        """Test file with multiple imports from the same source."""
        parsed_files = [
            create_parsed_file(
                "src/App.tsx",
                imports=[
                    create_import("./utils"),
                    create_import("./components/Button"),
                ]
            ),
            create_parsed_file("src/utils.ts"),
            create_parsed_file("src/components/Button.tsx"),
        ]

        llm_analysis = {}

        nodes, edges = builder.build_graph(
            parsed_files, llm_analysis, "/project", sample_metadata
        )

        assert len(nodes) == 3
        assert len(edges) == 2  # Two edges from different files to App

    def test_diamond_dependency(self, builder, sample_metadata):
        """Test diamond dependency pattern (A->B, A->C, B->D, C->D)."""
        parsed_files = [
            create_parsed_file("src/A.ts", imports=[
                create_import("./B"),
                create_import("./C"),
            ]),
            create_parsed_file("src/B.ts", imports=[create_import("./D")]),
            create_parsed_file("src/C.ts", imports=[create_import("./D")]),
            create_parsed_file("src/D.ts"),
        ]

        nodes, edges = builder.build_graph(
            parsed_files, {}, "/project", sample_metadata
        )

        assert len(nodes) == 4
        assert len(edges) == 4  # A->B, A->C, B->D, C->D
