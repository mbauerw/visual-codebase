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
    Language,
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
        # Go module resolution
        self._go_module_path: Optional[str] = None
        self._go_package_index: dict[str, str] = {}  # Maps package path to file path
        # Rust module resolution
        self._rust_crate_root: Optional[str] = None  # Path to lib.rs or main.rs
        self._rust_module_tree: dict[str, str] = {}  # Maps module path to file path
        # Swift type resolution
        self._swift_type_to_file: dict[str, str] = {}  # Maps type name to file path
        self._swift_module_name: Optional[str] = None  # Inferred module name

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

    def _detect_go_module_path(self, base_path: str) -> Optional[str]:
        """Detect Go module path from go.mod file."""
        go_mod_path = os.path.join(base_path, "go.mod")
        try:
            with open(go_mod_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("module "):
                        # Extract module path: "module github.com/user/repo"
                        return line[7:].strip()
        except (FileNotFoundError, IOError):
            pass
        return None

    def _build_go_package_index(
        self, all_files: dict[str, ParsedFile], base_path: str
    ) -> dict[str, str]:
        """Build an index mapping Go package paths to file paths.

        Go packages are directories, not individual files. Multiple .go files
        in the same directory belong to the same package.
        """
        index: dict[str, str] = {}

        for file_path in all_files.keys():
            if not file_path.endswith(".go"):
                continue

            normalized = file_path.replace("\\", "/")
            dir_path = os.path.dirname(normalized)

            # Build the full import path for this package
            if self._go_module_path and dir_path:
                # Package import path is module_path + relative directory
                package_path = f"{self._go_module_path}/{dir_path}"
                if package_path not in index:
                    index[package_path] = file_path
            elif self._go_module_path and not dir_path:
                # Root package
                if self._go_module_path not in index:
                    index[self._go_module_path] = file_path
            elif dir_path:
                # No go.mod, use relative path as package path
                if dir_path not in index:
                    index[dir_path] = file_path

        return index

    def _resolve_go_import(
        self,
        import_path: str,
        all_files: dict[str, ParsedFile],
    ) -> Optional[str]:
        """Resolve a Go import path to a file path.

        Go imports reference packages (directories), not individual files.
        We return the first .go file in that package directory.
        """
        # Check direct match in package index
        if import_path in self._go_package_index:
            return self._go_package_index[import_path]

        # If we have a module path, try to resolve relative to it
        if self._go_module_path and import_path.startswith(self._go_module_path):
            # Extract relative path from module path
            relative_dir = import_path[len(self._go_module_path):].lstrip("/")

            # Find any .go file in this directory
            for file_path in all_files.keys():
                if not file_path.endswith(".go"):
                    continue
                file_dir = os.path.dirname(file_path.replace("\\", "/"))
                if file_dir == relative_dir:
                    return file_path

        # Try matching by directory name (last component of import path)
        # This handles cases like "internal/pkg" matching "./internal/pkg"
        import_dir = import_path.rsplit("/", 1)[-1] if "/" in import_path else import_path
        for file_path in all_files.keys():
            if not file_path.endswith(".go"):
                continue
            file_dir = os.path.dirname(file_path.replace("\\", "/"))
            if file_dir.endswith(import_dir) or file_dir == import_dir:
                return file_path

        return None

    def _detect_rust_crate_root(
        self, all_files: dict[str, ParsedFile]
    ) -> Optional[str]:
        """Detect the Rust crate root (lib.rs or main.rs)."""
        # Prefer lib.rs over main.rs for library crates
        for file_path in all_files.keys():
            if file_path.endswith("src/lib.rs") or file_path == "lib.rs":
                return file_path

        for file_path in all_files.keys():
            if file_path.endswith("src/main.rs") or file_path == "main.rs":
                return file_path

        return None

    def _build_rust_module_tree(
        self, all_files: dict[str, ParsedFile], crate_root: Optional[str]
    ) -> dict[str, str]:
        """Build a module tree mapping module paths to file paths.

        Rust's module system maps paths to files:
        - crate -> lib.rs or main.rs
        - crate::foo -> src/foo.rs or src/foo/mod.rs
        - crate::foo::bar -> src/foo/bar.rs or src/foo/bar/mod.rs
        """
        module_tree: dict[str, str] = {}

        if crate_root:
            module_tree["crate"] = crate_root

        for file_path in all_files.keys():
            if not file_path.endswith(".rs"):
                continue

            normalized = file_path.replace("\\", "/")

            # Skip the crate root itself
            if normalized == crate_root:
                continue

            # Calculate module path from file path
            # Remove src/ prefix if present
            rel_path = normalized
            if rel_path.startswith("src/"):
                rel_path = rel_path[4:]

            # Remove .rs extension
            if rel_path.endswith(".rs"):
                rel_path = rel_path[:-3]

            # Handle mod.rs files
            if rel_path.endswith("/mod"):
                rel_path = rel_path[:-4]

            # Convert path to module path: foo/bar -> crate::foo::bar
            if rel_path:
                module_path = "crate::" + rel_path.replace("/", "::")
                module_tree[module_path] = file_path

                # Also index without crate:: prefix for self:: resolution
                module_tree[rel_path.replace("/", "::")] = file_path

        return module_tree

    def _resolve_rust_import(
        self,
        use_path: str,
        source_file_path: str,
        all_files: dict[str, ParsedFile],
    ) -> Optional[str]:
        """Resolve a Rust use path to a file path."""
        # Check for crate:: paths
        if use_path.startswith("crate::"):
            # Remove the item name, keep the module path
            parts = use_path.split("::")
            # Try progressively shorter paths to find the module
            for i in range(len(parts), 1, -1):
                module_path = "::".join(parts[:i])
                if module_path in self._rust_module_tree:
                    return self._rust_module_tree[module_path]

        # Check for self:: paths (relative to current module)
        elif use_path.startswith("self::"):
            source_dir = os.path.dirname(source_file_path.replace("\\", "/"))
            relative_path = use_path[6:]  # Remove "self::"

            # Build the target path
            parts = relative_path.split("::")
            # Try to find the module file
            for i in range(len(parts), 0, -1):
                sub_path = "/".join(parts[:i])
                # Try direct .rs file
                candidate = f"{source_dir}/{sub_path}.rs"
                if candidate in all_files:
                    return candidate
                # Try mod.rs in directory
                candidate = f"{source_dir}/{sub_path}/mod.rs"
                if candidate in all_files:
                    return candidate

        # Check for super:: paths (parent module)
        elif use_path.startswith("super::"):
            source_dir = os.path.dirname(source_file_path.replace("\\", "/"))
            parent_dir = os.path.dirname(source_dir)
            relative_path = use_path[7:]  # Remove "super::"

            parts = relative_path.split("::")
            for i in range(len(parts), 0, -1):
                sub_path = "/".join(parts[:i])
                candidate = f"{parent_dir}/{sub_path}.rs"
                if candidate in all_files:
                    return candidate
                candidate = f"{parent_dir}/{sub_path}/mod.rs"
                if candidate in all_files:
                    return candidate

        # Check module tree directly
        if use_path in self._rust_module_tree:
            return self._rust_module_tree[use_path]

        # Try without the last component (which might be an item, not a module)
        parts = use_path.split("::")
        for i in range(len(parts), 0, -1):
            module_path = "::".join(parts[:i])
            if module_path in self._rust_module_tree:
                return self._rust_module_tree[module_path]

        return None

    # ========== Swift Resolution Methods ==========

    def _build_swift_type_index(
        self, all_files: dict[str, ParsedFile]
    ) -> dict[str, str]:
        """Build an index mapping Swift type names to file paths.

        Swift doesn't have a strict file-to-module mapping like Java.
        Types within the same module can be referenced without imports.
        We index type names to help resolve @testable imports and
        cross-file references within the same project.
        """
        type_to_file: dict[str, str] = {}

        for file_path, parsed_file in all_files.items():
            if not file_path.endswith(".swift"):
                continue

            # Index all classes/structs/enums/protocols
            for type_name in parsed_file.classes:
                if type_name not in type_to_file:
                    type_to_file[type_name] = file_path

        return type_to_file

    def _infer_swift_module_name(self, all_files: dict[str, ParsedFile]) -> Optional[str]:
        """Infer the Swift module name from project structure.

        Look for common indicators:
        - Package.swift (SPM)
        - Sources/ModuleName/ directory
        """
        for file_path in all_files.keys():
            if file_path.endswith(".swift"):
                # Check for Sources/ModuleName/ pattern
                normalized = file_path.replace("\\", "/")
                if "Sources/" in normalized:
                    parts = normalized.split("Sources/")
                    if len(parts) > 1:
                        module_part = parts[1].split("/")[0]
                        if module_part and not module_part.startswith("."):
                            return module_part
        return None

    def _resolve_swift_import(
        self,
        import_module: str,
        all_files: dict[str, ParsedFile],
    ) -> Optional[str]:
        """Resolve a Swift import to file paths.

        Swift imports work at the module level, not file level.
        We can only resolve:
        1. Internal module references (same project)
        2. Specific type imports (import class Module.Type)
        """
        # Check if this is our inferred module name
        base_module = import_module.split(".")[0]
        if self._swift_module_name and base_module == self._swift_module_name:
            # This is an internal import - check for specific type
            if "." in import_module:
                type_name = import_module.split(".")[-1]
                if type_name in self._swift_type_to_file:
                    return self._swift_type_to_file[type_name]
            return None  # Module-level import, no specific file

        # Try direct type name lookup (for selective imports)
        if "." in import_module:
            type_name = import_module.split(".")[-1]
            if type_name in self._swift_type_to_file:
                return self._swift_type_to_file[type_name]

        return None

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

        # Handle Go imports (package-based)
        if source_file_path.endswith(".go"):
            # Skip Go standard library packages (no dots in path)
            # Standard library packages don't contain dots: fmt, net/http, encoding/json
            # Third-party packages have domains: github.com/..., golang.org/...
            if "/" not in import_module or not any(c == "." for c in import_module.split("/")[0]):
                # This is a standard library package (fmt, net/http, etc.)
                return None
            return self._resolve_go_import(import_module, all_files)

        # Handle Rust use statements
        if source_file_path.endswith(".rs"):
            # Skip standard library and common external crates
            rust_external_prefixes = (
                "std", "core", "alloc", "proc_macro", "test",
                "serde", "tokio", "async_std", "futures", "hyper",
                "reqwest", "actix", "rocket", "axum", "warp",
                "diesel", "sqlx", "rusqlite", "mongodb",
                "clap", "structopt", "tracing", "log", "env_logger",
                "anyhow", "thiserror", "eyre",
                "rand", "chrono", "uuid", "regex", "lazy_static",
                "itertools", "rayon", "crossbeam",
            )
            first_part = import_module.split("::")[0]
            if first_part in rust_external_prefixes:
                return None
            return self._resolve_rust_import(import_module, source_file_path, all_files)

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

        # Handle Swift imports (module-based)
        if source_file_path.endswith(".swift"):
            # Skip Apple system frameworks
            apple_frameworks = (
                "Foundation", "CoreFoundation", "Swift", "Darwin", "Dispatch",
                "os", "ObjectiveC", "Combine", "Observation",
                "UIKit", "SwiftUI", "AppKit", "WatchKit", "WidgetKit",
                "CoreGraphics", "CoreAnimation", "QuartzCore", "CoreImage",
                "CoreData", "SwiftData", "CloudKit", "FileProvider",
                "Network", "CFNetwork", "WebKit", "LinkPresentation",
                "AVFoundation", "AVKit", "CoreMedia", "CoreAudio", "AudioToolbox",
                "MediaPlayer", "PhotosUI", "Photos", "Vision", "CoreVideo",
                "CoreLocation", "MapKit", "CoreMotion",
                "UserNotifications", "NotificationCenter", "EventKit", "Contacts",
                "ContactsUI", "MessageUI", "Messages", "StoreKit", "GameKit",
                "Security", "CryptoKit", "LocalAuthentication",
                "CoreBluetooth", "CoreNFC", "ARKit", "RealityKit",
                "CoreML", "NaturalLanguage", "CreateML", "SoundAnalysis",
                "XCTest", "Testing",
                "HealthKit", "HomeKit", "SiriKit", "Intents", "IntentsUI",
                "CallKit", "PushKit", "CarPlay", "CoreTelephony",
                "MetricKit", "OSLog", "Accelerate", "simd",
            )
            base_module = import_module.split(".")[0]
            if base_module in apple_frameworks:
                return None
            return self._resolve_swift_import(import_module, all_files)

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

        # Build lookup of node ID to language for cross-language detection
        id_to_language: dict[str, Language] = {}
        for pf in parsed_files:
            node_id = self._generate_node_id(pf.relative_path)
            id_to_language[node_id] = pf.language

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

            # Get source and target languages for cross-language detection
            source_lang = id_to_language.get(target_id, Language.UNKNOWN)  # target_id is the exporting file
            target_lang = id_to_language.get(source_id, Language.UNKNOWN)  # source_id is the importing file
            is_cross_language = (
                source_lang != Language.UNKNOWN and
                target_lang != Language.UNKNOWN and
                source_lang != target_lang
            )

            edges.append(
                DependencyEdge(
                    id=edge_id,
                    source=target_id,
                    target=source_id,
                    import_type=data["import_type"],
                    label=label,
                    imported_names=imported_names,
                    module_path=data["module_path"],
                    source_language=source_lang,
                    target_language=target_lang,
                    is_cross_language=is_cross_language,
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

        # Initialize Go-specific indices if Go files are present
        has_go = any(pf.relative_path.endswith(".go") for pf in parsed_files)
        if has_go:
            self._go_module_path = self._detect_go_module_path(base_path)
            self._go_package_index = self._build_go_package_index(files_by_path, base_path)
        else:
            self._go_module_path = None
            self._go_package_index = {}

        # Initialize Rust-specific indices if Rust files are present
        has_rust = any(pf.relative_path.endswith(".rs") for pf in parsed_files)
        if has_rust:
            self._rust_crate_root = self._detect_rust_crate_root(files_by_path)
            self._rust_module_tree = self._build_rust_module_tree(files_by_path, self._rust_crate_root)
        else:
            self._rust_crate_root = None
            self._rust_module_tree = {}

        # Initialize Swift-specific indices if Swift files are present
        has_swift = any(pf.relative_path.endswith(".swift") for pf in parsed_files)
        if has_swift:
            self._swift_type_to_file = self._build_swift_type_index(files_by_path)
            self._swift_module_name = self._infer_swift_module_name(files_by_path)
        else:
            self._swift_type_to_file = {}
            self._swift_module_name = None

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
            # Use different style for cross-language edges
            edge_style = {"stroke": "#888", "strokeWidth": 1.5}
            if edge.is_cross_language:
                edge_style = {
                    "stroke": "#f59e0b",  # amber-500 for cross-language
                    "strokeWidth": 2,
                    "strokeDasharray": "5,5",  # dashed line
                }

            rf_edge = ReactFlowEdge(
                id=edge.id,
                source=edge.source,
                target=edge.target,
                type="import",  # Use custom import edge type
                animated=False,
                label=edge.label,
                style=edge_style,
                data=ReactFlowEdgeData(
                    imported_names=edge.imported_names,
                    module_path=edge.module_path,
                    import_type=edge.import_type,
                    source_language=edge.source_language,
                    target_language=edge.target_language,
                    is_cross_language=edge.is_cross_language,
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
