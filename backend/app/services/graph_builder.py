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
    ReactFlowEdgeData,
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
        self._java_source_roots: list[str] = []
        self._java_package_index: dict[str, str] = {}  # Maps FQN to relative path
        # C# namespace resolution
        self._csharp_namespace_to_files: dict[str, list[str]] = {}  # Maps namespace to file paths
        self._csharp_type_to_file: dict[str, str] = {}  # Maps FQN type to file path

    def _generate_node_id(self, path: str) -> str:
        """Generate a stable node ID from a file path."""
        if path in self._path_to_id:
            return self._path_to_id[path]

        # Use hash of the path for stable IDs
        node_id = hashlib.md5(path.encode()).hexdigest()[:12]
        self._path_to_id[path] = node_id
        return node_id

    def _detect_java_source_roots(self, all_files: dict[str, ParsedFile]) -> list[str]:
        """Detect Java source root directories from file paths."""
        patterns = ["src/main/java/", "src/test/java/", "src/", "app/src/main/java/"]
        source_roots = set()

        for file_path in all_files.keys():
            if not file_path.endswith(".java"):
                continue
            normalized = file_path.replace("\\", "/")
            for pattern in patterns:
                if f"/{pattern}" in f"/{normalized}" or normalized.startswith(pattern):
                    idx = normalized.find(pattern)
                    if idx >= 0:
                        source_roots.add(normalized[:idx + len(pattern)].rstrip("/"))

        # Sort by length descending (prefer more specific roots)
        return sorted(source_roots, key=len, reverse=True)

    def _build_java_package_index(
        self, all_files: dict[str, ParsedFile], source_roots: list[str]
    ) -> dict[str, str]:
        """Build an index mapping Java FQN to relative file paths."""
        index = {}

        for file_path, parsed_file in all_files.items():
            if not file_path.endswith(".java"):
                continue

            normalized = file_path.replace("\\", "/")

            # Find the source root for this file
            source_root = ""
            for root in source_roots:
                if normalized.startswith(root + "/") or normalized.startswith(root):
                    source_root = root
                    break

            # Extract package path after source root
            if source_root:
                relative_to_root = normalized[len(source_root):].lstrip("/")
            else:
                relative_to_root = normalized

            # Convert path to package name: com/example/MyClass.java -> com.example.MyClass
            if relative_to_root.endswith(".java"):
                package_path = relative_to_root[:-5].replace("/", ".")
                index[package_path] = file_path

                # Also index just the class name for simpler lookups
                class_name = package_path.split(".")[-1]
                if class_name not in index:
                    index[class_name] = file_path

        return index

    def _resolve_java_import(
        self,
        import_module: str,
        all_files: dict[str, ParsedFile],
    ) -> Optional[str]:
        """Resolve a Java import to a file path."""
        # Check direct FQN match
        if import_module in self._java_package_index:
            return self._java_package_index[import_module]

        # Try converting package to path and searching
        path_from_package = import_module.replace(".", "/") + ".java"
        for source_root in self._java_source_roots:
            candidate = source_root + "/" + path_from_package if source_root else path_from_package
            candidate = candidate.lstrip("/")
            if candidate in all_files:
                return candidate

        # Also try without source root (direct path)
        if path_from_package in all_files:
            return path_from_package

        return None

    def _build_csharp_namespace_index(
        self, all_files: dict[str, ParsedFile]
    ) -> tuple[dict[str, list[str]], dict[str, str]]:
        """Build an index mapping C# namespaces and types to file paths.

        Unlike Java, C# namespaces don't directly map to directories,
        so we need to parse the actual namespace declarations from files.
        """
        namespace_to_files: dict[str, list[str]] = {}
        type_to_file: dict[str, str] = {}

        for file_path, parsed_file in all_files.items():
            if not file_path.endswith(".cs"):
                continue

            # For C#, we extract namespace from the file path pattern
            # and use the class names from exports
            normalized = file_path.replace("\\", "/")

            # Try to infer namespace from path
            # Common patterns: src/Namespace/SubNamespace/Class.cs
            inferred_namespace = self._infer_csharp_namespace(normalized)

            if inferred_namespace:
                if inferred_namespace not in namespace_to_files:
                    namespace_to_files[inferred_namespace] = []
                namespace_to_files[inferred_namespace].append(file_path)

            # Index types from exports (class/interface names)
            for type_name in parsed_file.classes:
                # Index by simple name
                if type_name not in type_to_file:
                    type_to_file[type_name] = file_path

                # Index by fully qualified name if we have namespace
                if inferred_namespace:
                    fqn = f"{inferred_namespace}.{type_name}"
                    type_to_file[fqn] = file_path

        return namespace_to_files, type_to_file

    def _infer_csharp_namespace(self, file_path: str) -> Optional[str]:
        """Infer C# namespace from file path structure."""
        # Remove common root patterns
        path = file_path
        for prefix in ["src/", "Source/", "Src/", "lib/", "app/"]:
            if path.lower().startswith(prefix.lower()):
                path = path[len(prefix):]
                break

        # Remove the filename
        if "/" in path:
            path = path.rsplit("/", 1)[0]
        else:
            return None

        # Convert path to namespace: Controllers/UserController -> Controllers
        namespace = path.replace("/", ".")

        return namespace if namespace else None

    def _resolve_csharp_using(
        self,
        using_namespace: str,
        all_files: dict[str, ParsedFile],
    ) -> list[str]:
        """Resolve a C# using directive to file paths.

        Returns a list because a namespace can span multiple files.
        """
        resolved = []

        # Check if it's a namespace match
        if using_namespace in self._csharp_namespace_to_files:
            resolved.extend(self._csharp_namespace_to_files[using_namespace])

        # Check if it's a type match (using static or specific type)
        if using_namespace in self._csharp_type_to_file:
            resolved.append(self._csharp_type_to_file[using_namespace])

        # Try partial namespace matching (e.g., "MyApp.Services" matches "MyApp.Services.UserService")
        for namespace, files in self._csharp_namespace_to_files.items():
            if namespace.startswith(using_namespace + "."):
                for f in files:
                    if f not in resolved:
                        resolved.append(f)

        return resolved

    def _resolve_import_path(
        self,
        import_module: str,
        source_file_path: str,
        all_files: dict[str, ParsedFile],
        base_path: str,
    ) -> Optional[str]:
        """Resolve an import module to an actual file path."""
        # Handle Java imports (package-based, non-relative)
        if source_file_path.endswith(".java"):
            # Skip common Java standard library packages
            java_stdlib_prefixes = (
                "java.", "javax.", "sun.", "com.sun.",
                "org.w3c.", "org.xml.", "org.ietf.",
            )
            if any(import_module.startswith(prefix) for prefix in java_stdlib_prefixes):
                return None
            return self._resolve_java_import(import_module, all_files)

        # Handle C# using directives (namespace-based)
        if source_file_path.endswith(".cs"):
            # Skip .NET BCL and common NuGet packages
            csharp_stdlib_prefixes = (
                "System", "Microsoft", "Newtonsoft", "AutoMapper",
                "FluentValidation", "Serilog", "NLog", "Dapper",
            )
            if any(import_module.startswith(prefix) for prefix in csharp_stdlib_prefixes):
                return None
            # C# using directives can resolve to multiple files, return first match
            resolved = self._resolve_csharp_using(import_module, all_files)
            return resolved[0] if resolved else None

        # Skip external packages for JS/TS/Python
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
            ".java",
            ".cs",
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
            # Get LLM analysis if available - try relative path first, then basename
            analysis = llm_analysis.get(pf.relative_path) or llm_analysis.get(pf.name)

            node = FileNode(
                id=self._generate_node_id(pf.relative_path),
                path=pf.relative_path,
                name=pf.name,
                folder=pf.folder,
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

    def _format_import_label(self, imported_names: list[str]) -> str:
        """Format imported names into a display label with truncation."""
        if not imported_names:
            return ""

        if len(imported_names) == 1:
            name = imported_names[0]
            return name if len(name) <= 20 else name[:17] + "..."
        elif len(imported_names) == 2:
            return ", ".join(imported_names[:2])
        else:
            # Show first two and count
            return f"{imported_names[0]}, +{len(imported_names) - 1}"

    def build_edges(
        self,
        parsed_files: list[ParsedFile],
        base_path: str,
    ) -> list[DependencyEdge]:
        """Build dependency edges from parsed files."""
        # Build a lookup of relative path to parsed file
        files_by_path: dict[str, ParsedFile] = {
            pf.relative_path: pf for pf in parsed_files
        }

        # Aggregate imports by edge (source-target pair)
        # This combines multiple import statements between the same files
        edge_data: dict[tuple[str, str], dict] = {}

        for pf in parsed_files:
            source_id = self._generate_node_id(pf.relative_path)

            for imp in pf.imports:
                # Try to resolve the import to a file in our codebase
                target_path = self._resolve_import_path(
                    imp.module, pf.relative_path, files_by_path, base_path
                )

                if target_path and target_path in files_by_path:
                    target_id = self._generate_node_id(target_path)

                    # Edge direction: from imported file -> to importing file
                    # This shows the flow of dependencies (what provides to what consumes)
                    edge_key = (target_id, source_id)

                    if edge_key not in edge_data:
                        edge_data[edge_key] = {
                            "import_type": imp.import_type,
                            "imported_names": [],
                            "module_path": imp.module,
                        }

                    # Aggregate imported names from multiple import statements
                    for name in imp.imported_names:
                        if name and name not in edge_data[edge_key]["imported_names"]:
                            edge_data[edge_key]["imported_names"].append(name)

        # Build edges from aggregated data
        edges = []
        for (target_id, source_id), data in edge_data.items():
            edge_id = f"e-{target_id}-{source_id}"
            imported_names = data["imported_names"]

            # Create label from imported names, fallback to module path
            if imported_names:
                label = self._format_import_label(imported_names)
            else:
                module = data["module_path"]
                label = module if len(module) < 30 else None

            edges.append(
                DependencyEdge(
                    id=edge_id,
                    source=target_id,
                    target=source_id,
                    import_type=data["import_type"],
                    label=label,
                    imported_names=imported_names,
                    module_path=data["module_path"],
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

        # Build lookup for parsed files
        files_by_path = {pf.relative_path: pf for pf in parsed_files}

        # Initialize Java-specific indices if Java files are present
        has_java = any(pf.relative_path.endswith(".java") for pf in parsed_files)
        if has_java:
            self._java_source_roots = self._detect_java_source_roots(files_by_path)
            self._java_package_index = self._build_java_package_index(
                files_by_path, self._java_source_roots
            )
        else:
            self._java_source_roots = []
            self._java_package_index = {}

        # Initialize C#-specific indices if C# files are present
        has_csharp = any(pf.relative_path.endswith(".cs") for pf in parsed_files)
        if has_csharp:
            self._csharp_namespace_to_files, self._csharp_type_to_file = \
                self._build_csharp_namespace_index(files_by_path)
        else:
            self._csharp_namespace_to_files = {}
            self._csharp_type_to_file = {}

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
        node_width = 50
        node_height = 10
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
                    folder=node.folder,
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
                type="import",  # Use custom import edge type
                animated=False,
                label=edge.label,
                style={"stroke": "#888", "strokeWidth": 1.5},
                data=ReactFlowEdgeData(
                    imported_names=edge.imported_names,
                    module_path=edge.module_path,
                    import_type=edge.import_type,
                ),
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
