"""Service for resolving function calls to their definitions."""
import os
from typing import Optional
from collections import defaultdict

from ..models.schemas import (
    FunctionCallInfo,
    FunctionDefinition,
    ParsedFile,
    CallOrigin,
    ImportInfo,
)


class CallResolver:
    """Resolves function calls to their definitions across files."""

    def __init__(
        self,
        parsed_files: list[ParsedFile],
        functions: list[FunctionDefinition],
        base_path: str,
    ):
        """Initialize the call resolver.

        Args:
            parsed_files: List of parsed files
            functions: List of all function definitions
            base_path: Base directory path for the analysis
        """
        self.base_path = base_path

        # Build file map by relative path
        self.file_map: dict[str, ParsedFile] = {
            pf.relative_path: pf for pf in parsed_files
        }

        # Build function index: name -> list of definitions
        self.function_index: dict[str, list[FunctionDefinition]] = defaultdict(list)
        for func in functions:
            self.function_index[func.name].append(func)
            # Also index by qualified name for more precise matching
            self.function_index[func.qualified_name].append(func)

        # Build file -> functions map
        self.file_functions: dict[str, list[FunctionDefinition]] = defaultdict(list)
        for func in functions:
            rel_path = os.path.relpath(func.file_path, base_path)
            self.file_functions[rel_path].append(func)

        # Build import map: file -> imported name -> source file
        self.import_map: dict[str, dict[str, str]] = {}
        for pf in parsed_files:
            self.import_map[pf.relative_path] = self._build_file_import_map(pf)

    def _build_file_import_map(self, parsed_file: ParsedFile) -> dict[str, str]:
        """Build a map of imported names to their source files.

        Args:
            parsed_file: Parsed file to build import map for

        Returns:
            Dict mapping imported names to source file relative paths
        """
        import_names: dict[str, str] = {}

        for imp in parsed_file.imports:
            if not imp.is_relative and not imp.module.startswith("."):
                # External module - skip
                continue

            # Resolve the import path
            resolved = self._resolve_import_path(
                imp.module, parsed_file.relative_path
            )
            if not resolved:
                continue

            # Map each imported name to the source file
            if imp.imported_names:
                for name in imp.imported_names:
                    import_names[name] = resolved
            else:
                # Default import or module import - use module name
                module_name = os.path.basename(resolved).rsplit(".", 1)[0]
                import_names[module_name] = resolved

        return import_names

    def _resolve_import_path(
        self, module: str, from_file: str
    ) -> Optional[str]:
        """Resolve an import path to a file in the codebase.

        Args:
            module: The import module path
            from_file: The file containing the import

        Returns:
            Resolved relative file path or None if not found
        """
        from_dir = os.path.dirname(from_file)

        # Handle relative imports
        if module.startswith("."):
            # Count leading dots
            dots = 0
            for char in module:
                if char == ".":
                    dots += 1
                else:
                    break

            # Go up directories
            rel_path = from_dir
            for _ in range(dots - 1):
                rel_path = os.path.dirname(rel_path)

            # Append the rest of the module path
            rest = module[dots:].replace(".", "/")
            if rest:
                rel_path = os.path.join(rel_path, rest)

            # Try different extensions
            return self._find_file_with_extension(rel_path)

        # Handle absolute imports (@ or ~ aliases)
        if module.startswith("@/"):
            rel_path = os.path.join("src", module[2:].replace("/", os.sep))
            return self._find_file_with_extension(rel_path)

        if module.startswith("~/"):
            rel_path = module[2:].replace("/", os.sep)
            return self._find_file_with_extension(rel_path)

        return None

    def _find_file_with_extension(self, path: str) -> Optional[str]:
        """Find a file by trying different extensions.

        Args:
            path: Base path without extension

        Returns:
            The actual file path if found, None otherwise
        """
        extensions = [".ts", ".tsx", ".js", ".jsx", ".py", ""]

        for ext in extensions:
            # Try direct path
            test_path = f"{path}{ext}"
            if test_path in self.file_map:
                return test_path

            # Try index file
            index_path = os.path.join(path, f"index{ext}")
            if index_path in self.file_map:
                return index_path

        return None

    def resolve_all(
        self, calls: list[FunctionCallInfo]
    ) -> list[FunctionCallInfo]:
        """Resolve all calls to their definitions.

        Args:
            calls: List of function calls to resolve

        Returns:
            List of calls with resolved targets and origins
        """
        resolved_calls = []

        for call in calls:
            resolved = self._resolve_call(call)
            resolved_calls.append(resolved)

        return resolved_calls

    def _resolve_call(self, call: FunctionCallInfo) -> FunctionCallInfo:
        """Attempt to resolve a single call to its definition.

        Args:
            call: Function call to resolve

        Returns:
            Updated call with resolved target and origin
        """
        source_rel = os.path.relpath(call.source_file, self.base_path)

        # 1. Check local scope (same file)
        local_match = self._find_in_file(call.callee_name, source_rel)
        if local_match:
            return call.model_copy(update={
                "origin": CallOrigin.LOCAL,
                "resolved_target": local_match.file_path,
            })

        # 2. Check imports
        file_imports = self.import_map.get(source_rel, {})
        if call.callee_name in file_imports:
            target_file = file_imports[call.callee_name]
            return call.model_copy(update={
                "origin": CallOrigin.INTERNAL,
                "resolved_target": os.path.join(self.base_path, target_file),
            })

        # 3. Check if it's a method call on an imported object
        if call.qualified_name and "." in call.qualified_name:
            obj_name = call.qualified_name.split(".")[0]
            if obj_name in file_imports:
                target_file = file_imports[obj_name]
                return call.model_copy(update={
                    "origin": CallOrigin.INTERNAL,
                    "resolved_target": os.path.join(self.base_path, target_file),
                })

        # 4. Heuristic: try to find function by name in any file
        if call.callee_name in self.function_index:
            matches = self.function_index[call.callee_name]
            if len(matches) == 1:
                # Unique match
                return call.model_copy(update={
                    "origin": CallOrigin.INTERNAL,
                    "resolved_target": matches[0].file_path,
                })

        # 5. Mark as external (could be from node_modules, stdlib, etc.)
        return call.model_copy(update={
            "origin": CallOrigin.EXTERNAL,
        })

    def _find_in_file(
        self, name: str, rel_path: str
    ) -> Optional[FunctionDefinition]:
        """Find a function definition in a specific file.

        Args:
            name: Function name to find
            rel_path: Relative path to the file

        Returns:
            FunctionDefinition if found, None otherwise
        """
        file_funcs = self.file_functions.get(rel_path, [])
        for func in file_funcs:
            if func.name == name:
                return func
        return None

    def get_callers(
        self, function: FunctionDefinition, calls: list[FunctionCallInfo]
    ) -> list[FunctionCallInfo]:
        """Get all calls that target a specific function.

        Args:
            function: The function to find callers for
            calls: List of all resolved calls

        Returns:
            List of calls that target this function
        """
        callers = []
        for call in calls:
            if call.resolved_target == function.file_path and (
                call.callee_name == function.name or
                call.qualified_name and function.name in call.qualified_name
            ):
                callers.append(call)
        return callers


def create_call_resolver(
    parsed_files: list[ParsedFile],
    functions: list[FunctionDefinition],
    base_path: str,
) -> CallResolver:
    """Create a call resolver for the given files and functions.

    Args:
        parsed_files: List of parsed files
        functions: List of all function definitions
        base_path: Base directory path

    Returns:
        Configured CallResolver instance
    """
    return CallResolver(parsed_files, functions, base_path)
