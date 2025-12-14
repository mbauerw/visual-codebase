"""Graph builder service for constructing dependency graphs."""
import hashlib
import os
from pathlib import Path
from typing import Optional

from ..models.schemas import (
    ArchitecturalRole,
    Category,
    DependencyEdge,
    FileNode,
    ImportType,
    LLMFileAnalysis,
    ParsedFile,
    ReactFlowEdge,
    ReactFlowGraph,
    ReactFlowNode,
    ReactFlowNodeData,
    ReactFlowPosition,
    AnalysisMetadata,
)


class GraphBuilder:
    """Service for building dependency graphs from parsed files."""

    def __init__(self):
        """Initialize the graph builder."""
        self._path_to_id: dict[str, str] = {}

    def _generate_node_id(self, path: str) -> str:
        """Generate a stable node ID from a file path."""
        if path in self._path_to_id:
            return self._path_to_id[path]

        # Use hash of the path for stable IDs
        node_id = hashlib.md5(path.encode()).hexdigest()[:12]
        self._path_to_id[path] = node_id
        return node_id

    def _resolve_import_path(
        self,
        import_module: str,
        source_file_path: str,
        all_files: dict[str, ParsedFile],
        base_path: str,
    ) -> Optional[str]:
        """Resolve an import module to an actual file path."""
        # Skip external packages
        if not import_module.startswith("."):
            # Check if it might be an internal alias (like @/components)
            if import_module.startswith("@/") or import_module.startswith("~/"):
                # Try to resolve as relative to src/
                potential_path = import_module.replace("@/", "src/").replace("~/", "src/")
                for ext in ("", ".ts", ".tsx", ".js", ".jsx", "/index.ts", "/index.tsx", "/index.js", "/index.jsx"):
                    full_path = potential_path + ext
                    if full_path in all_files:
                        return full_path
            return None

        # Resolve relative import
        source_dir = os.path.dirname(source_file_path)

        # Handle relative path resolution
        if import_module == ".":
            relative_path = source_dir
        elif import_module == "..":
            relative_path = os.path.dirname(source_dir)
        else:
            # Normalize the path
            parts = import_module.split("/")
            current_dir = source_dir

            for part in parts:
                if part == ".":
                    continue
                elif part == "..":
                    current_dir = os.path.dirname(current_dir)
                else:
                    current_dir = os.path.join(current_dir, part)

            relative_path = current_dir

        # Try to find the actual file with various extensions
        extensions = [
            "",
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".py",
            "/index.ts",
            "/index.tsx",
            "/index.js",
            "/index.jsx",
            "/index.py",
            "/__init__.py",
        ]

        for ext in extensions:
            test_path = relative_path + ext
            # Normalize path
            test_path = os.path.normpath(test_path)
            if test_path in all_files:
                return test_path

        return None

    def build_nodes(
        self,
        parsed_files: list[ParsedFile],
        llm_analysis: dict[str, LLMFileAnalysis],
    ) -> list[FileNode]:
        """Build graph nodes from parsed files and LLM analysis."""
        nodes = []

        for pf in parsed_files:
            # Get LLM analysis if available
            analysis = llm_analysis.get(pf.name)

            node = FileNode(
                id=self._generate_node_id(pf.relative_path),
                path=pf.relative_path,
                name=pf.name,
                language=pf.language,
                role=analysis.architectural_role if analysis else ArchitecturalRole.UNKNOWN,
                description=analysis.description if analysis else "",
                category=analysis.category if analysis else Category.UNKNOWN,
                imports=[imp.module for imp in pf.imports],
                size_bytes=pf.size_bytes,
                line_count=pf.line_count,
            )
            nodes.append(node)

        return nodes

    def build_edges(
        self,
        parsed_files: list[ParsedFile],
        base_path: str,
    ) -> list[DependencyEdge]:
        """Build dependency edges from parsed files."""
        edges = []
        seen_edges: set[tuple[str, str]] = set()

        # Build a lookup of relative path to parsed file
        files_by_path: dict[str, ParsedFile] = {
            pf.relative_path: pf for pf in parsed_files
        }

        for pf in parsed_files:
            source_id = self._generate_node_id(pf.relative_path)

            for imp in pf.imports:
                # Try to resolve the import to a file in our codebase
                target_path = self._resolve_import_path(
                    imp.module, pf.relative_path, files_by_path, base_path
                )

                if target_path and target_path in files_by_path:
                    target_id = self._generate_node_id(target_path)

                    # Avoid duplicate edges
                    edge_key = (source_id, target_id)
                    if edge_key not in seen_edges:
                        seen_edges.add(edge_key)

                        edge_id = f"e-{source_id}-{target_id}"
                        edges.append(
                            DependencyEdge(
                                id=edge_id,
                                source=source_id,
                                target=target_id,
                                import_type=imp.import_type,
                                label=imp.module if len(imp.module) < 30 else None,
                            )
                        )

        return edges

    def build_graph(
        self,
        parsed_files: list[ParsedFile],
        llm_analysis: dict[str, LLMFileAnalysis],
        base_path: str,
        metadata: AnalysisMetadata,
    ) -> tuple[list[FileNode], list[DependencyEdge]]:
        """Build the complete dependency graph."""
        # Reset path to ID mapping
        self._path_to_id = {}

        nodes = self.build_nodes(parsed_files, llm_analysis)
        edges = self.build_edges(parsed_files, base_path)

        return nodes, edges

    def to_react_flow_format(
        self,
        nodes: list[FileNode],
        edges: list[DependencyEdge],
        metadata: AnalysisMetadata,
    ) -> ReactFlowGraph:
        """Convert graph to React Flow format with layout positions."""
        # Use simple grid layout (dagre layout will be done on frontend)
        rf_nodes = []
        rf_edges = []

        # Calculate initial positions in a grid
        cols = max(1, int(len(nodes) ** 0.5) + 1)
        node_width = 250
        node_height = 100
        padding = 50

        for i, node in enumerate(nodes):
            row = i // cols
            col = i % cols

            rf_node = ReactFlowNode(
                id=node.id,
                type="custom",
                position=ReactFlowPosition(
                    x=col * (node_width + padding),
                    y=row * (node_height + padding),
                ),
                data=ReactFlowNodeData(
                    label=node.name,
                    path=node.path,
                    language=node.language,
                    role=node.role,
                    description=node.description,
                    category=node.category,
                    imports=node.imports,
                    size_bytes=node.size_bytes,
                    line_count=node.line_count,
                ),
            )
            rf_nodes.append(rf_node)

        # Convert edges
        for edge in edges:
            rf_edge = ReactFlowEdge(
                id=edge.id,
                source=edge.source,
                target=edge.target,
                type="smoothstep",
                animated=False,
                label=edge.label,
                style={"stroke": "#888", "strokeWidth": 1.5},
            )
            rf_edges.append(rf_edge)

        return ReactFlowGraph(
            nodes=rf_nodes,
            edges=rf_edges,
            metadata=metadata,
        )


# Singleton instance
_builder: Optional[GraphBuilder] = None


def get_graph_builder() -> GraphBuilder:
    """Get or create the graph builder instance."""
    global _builder
    if _builder is None:
        _builder = GraphBuilder()
    return _builder
