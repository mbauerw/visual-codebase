"""Tree-sitter based parser for extracting imports from source files."""
import os
import re
from pathlib import Path
from typing import Optional

import tree_sitter_javascript as tsjs
import tree_sitter_python as tspy
import tree_sitter_typescript as tsts
from tree_sitter import Language, Parser

from ..settings import get_settings
from ..models.schemas import ImportInfo, ImportType, Language as LangEnum, ParsedFile


class FileParser:
    """Parser service using Tree-sitter for AST-based import extraction."""

    def __init__(self):
        """Initialize parsers for supported languages."""
        self.settings = get_settings()

        # Initialize Tree-sitter languages (modern API for tree-sitter >= 0.23)
        # Language() wraps the language pointer returned by the binding
        self.js_language = Language(tsjs.language())
        self.ts_language = Language(tsts.language_typescript())
        self.tsx_language = Language(tsts.language_tsx())
        self.py_language = Language(tspy.language())

        # Create parsers with the language
        self.js_parser = Parser(self.js_language)
        self.ts_parser = Parser(self.ts_language)
        self.tsx_parser = Parser(self.tsx_language)
        self.py_parser = Parser(self.py_language)

        # Extension to language/parser mapping
        self.extension_map = {
            ".js": (LangEnum.JAVASCRIPT, self.js_parser),
            ".jsx": (LangEnum.JAVASCRIPT, self.js_parser),
            ".ts": (LangEnum.TYPESCRIPT, self.ts_parser),
            ".tsx": (LangEnum.TYPESCRIPT, self.tsx_parser),
            ".py": (LangEnum.PYTHON, self.py_parser),
        }

    def detect_language(self, file_path: str) -> LangEnum:
        """Detect the programming language from file extension."""
        ext = Path(file_path).suffix.lower()
        if ext in self.extension_map:
            return self.extension_map[ext][0]
        return LangEnum.UNKNOWN

    def get_parser(self, file_path: str) -> Optional[Parser]:
        """Get the appropriate parser for a file."""
        ext = Path(file_path).suffix.lower()
        if ext in self.extension_map:
            return self.extension_map[ext][1]
        return None

    def parse_file(
        self, file_path: str, base_path: str, include_content: bool = False
    ) -> Optional[ParsedFile]:
        """Parse a single file and extract import information.

        Args:
            file_path: Absolute path to the file
            base_path: Base directory for calculating relative paths
            include_content: If True, include raw file content in result (for storage)
        """
        try:
            # Read file content
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # Check file size
            size_bytes = len(content.encode("utf-8"))
            if size_bytes > self.settings.max_file_size_bytes:
                return None

            # Get language and parser
            language = self.detect_language(file_path)
            parser = self.get_parser(file_path)

            if language == LangEnum.UNKNOWN or parser is None:
                return None

            # Parse the file
            tree = parser.parse(bytes(content, "utf-8"))

            # Extract imports, functions, and classes based on language
            if language in (LangEnum.JAVASCRIPT, LangEnum.TYPESCRIPT):
                imports = self._extract_js_ts_imports(tree, content)
                exports = self._extract_js_ts_exports(tree, content)
                functions = self._extract_js_ts_functions(tree, content)
                classes = self._extract_js_ts_classes(tree, content)
            else:  # Python
                imports = self._extract_python_imports(tree, content)
                exports = []  # Python exports are implicit
                functions = self._extract_python_functions(tree, content)
                classes = self._extract_python_classes(tree, content)

            # Calculate relative path
            relative_path = os.path.relpath(file_path, base_path)

            # Calculate folder path (directory containing the file, relative to base)
            folder_path = os.path.dirname(relative_path)

            return ParsedFile(
                path=file_path,
                relative_path=relative_path,
                name=os.path.basename(file_path),
                folder=folder_path,
                language=language,
                imports=imports,
                exports=exports,
                functions=functions,
                classes=classes,
                size_bytes=size_bytes,
                line_count=content.count("\n") + 1,
                content=content if include_content else None,
            )

        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return None

    def _extract_js_ts_imports(self, tree, content: str) -> list[ImportInfo]:
        """Extract import statements from JavaScript/TypeScript files."""
        imports = []
        root = tree.root_node

        def traverse(node):
            # import ... from "module"
            if node.type == "import_statement":
                import_info = self._parse_js_import_statement(node, content)
                if import_info:
                    imports.append(import_info)

            # require("module")
            elif node.type == "call_expression":
                callee = node.child_by_field_name("function")
                if callee and self._get_node_text(callee, content) == "require":
                    args = node.child_by_field_name("arguments")
                    if args and args.child_count > 0:
                        for child in args.children:
                            if child.type == "string":
                                module = self._get_string_value(child, content)
                                if module:
                                    imports.append(
                                        ImportInfo(
                                            module=module,
                                            import_type=ImportType.REQUIRE,
                                            is_relative=module.startswith("."),
                                        )
                                    )

            # Dynamic import()
            elif node.type == "call_expression":
                callee = node.child_by_field_name("function")
                if callee and callee.type == "import":
                    args = node.child_by_field_name("arguments")
                    if args and args.child_count > 0:
                        for child in args.children:
                            if child.type == "string":
                                module = self._get_string_value(child, content)
                                if module:
                                    imports.append(
                                        ImportInfo(
                                            module=module,
                                            import_type=ImportType.DYNAMIC_IMPORT,
                                            is_relative=module.startswith("."),
                                        )
                                    )

            # Recurse into children
            for child in node.children:
                traverse(child)

        traverse(root)
        return imports

    def _parse_js_import_statement(
        self, node, content: str
    ) -> Optional[ImportInfo]:
        """Parse a JS/TS import statement node."""
        module = None
        imported_names = []

        for child in node.children:
            # Get the module source
            if child.type == "string":
                module = self._get_string_value(child, content)

            # Get imported names
            elif child.type == "import_clause":
                imported_names = self._extract_import_names(child, content)

        if module:
            return ImportInfo(
                module=module,
                import_type=ImportType.IMPORT,
                imported_names=imported_names,
                is_relative=module.startswith("."),
            )
        return None

    def _extract_import_names(self, node, content: str) -> list[str]:
        """Extract imported names from import clause."""
        names = []

        def traverse(n):
            if n.type == "identifier":
                names.append(self._get_node_text(n, content))
            elif n.type == "import_specifier":
                # Get the name being imported (could be aliased)
                name_node = n.child_by_field_name("name")
                if name_node:
                    names.append(self._get_node_text(name_node, content))
            for child in n.children:
                traverse(child)

        traverse(node)
        return names

    def _extract_js_ts_exports(self, tree, content: str) -> list[str]:
        """Extract export statements from JavaScript/TypeScript files."""
        exports = []
        root = tree.root_node

        def traverse(node):
            if node.type in (
                "export_statement",
                "export_default_declaration",
            ):
                # Look for the exported name
                for child in node.children:
                    if child.type == "identifier":
                        exports.append(self._get_node_text(child, content))
                    elif child.type in (
                        "function_declaration",
                        "class_declaration",
                    ):
                        name = child.child_by_field_name("name")
                        if name:
                            exports.append(self._get_node_text(name, content))

            for child in node.children:
                traverse(child)

        traverse(root)
        return exports

    def _extract_python_imports(self, tree, content: str) -> list[ImportInfo]:
        """Extract import statements from Python files."""
        imports = []
        root = tree.root_node

        def traverse(node):
            # import module
            if node.type == "import_statement":
                for child in node.children:
                    if child.type == "dotted_name":
                        module = self._get_node_text(child, content)
                        imports.append(
                            ImportInfo(
                                module=module,
                                import_type=ImportType.IMPORT,
                                is_relative=False,
                            )
                        )
                    elif child.type == "aliased_import":
                        name = child.child_by_field_name("name")
                        if name:
                            module = self._get_node_text(name, content)
                            imports.append(
                                ImportInfo(
                                    module=module,
                                    import_type=ImportType.IMPORT,
                                    is_relative=False,
                                )
                            )

            # from module import ...
            elif node.type == "import_from_statement":
                module = None
                imported_names = []
                is_relative = False

                for child in node.children:
                    if child.type == "dotted_name":
                        module = self._get_node_text(child, content)
                    elif child.type == "relative_import":
                        is_relative = True
                        # Get the module part after the dots
                        for subchild in child.children:
                            if subchild.type == "dotted_name":
                                module = self._get_node_text(subchild, content)
                            elif subchild.type == "import_prefix":
                                # Just dots, module might be empty
                                if module is None:
                                    module = "."
                    elif child.type in ("identifier", "dotted_name"):
                        # This might be the module or imported name
                        pass

                # Get imported names
                for child in node.children:
                    if child.type == "import_list":
                        for subchild in child.children:
                            if subchild.type in (
                                "identifier",
                                "aliased_import",
                            ):
                                if subchild.type == "identifier":
                                    imported_names.append(
                                        self._get_node_text(subchild, content)
                                    )
                                else:
                                    name = subchild.child_by_field_name("name")
                                    if name:
                                        imported_names.append(
                                            self._get_node_text(name, content)
                                        )

                if module or is_relative:
                    imports.append(
                        ImportInfo(
                            module=module or ".",
                            import_type=ImportType.FROM_IMPORT,
                            imported_names=imported_names,
                            is_relative=is_relative,
                        )
                    )

            for child in node.children:
                traverse(child)

        traverse(root)
        return imports

    def _extract_js_ts_functions(self, tree, content: str) -> list[str]:
        """Extract function and method names from JavaScript/TypeScript files."""
        functions = []
        root = tree.root_node

        def traverse(node):
            # Regular function declarations: function foo() {}
            if node.type == "function_declaration":
                name = node.child_by_field_name("name")
                if name:
                    functions.append(self._get_node_text(name, content))

            # Arrow functions assigned to variables: const foo = () => {}
            elif node.type == "variable_declarator":
                name = node.child_by_field_name("name")
                value = node.child_by_field_name("value")
                if name and value and value.type in ("arrow_function", "function_expression"):
                    functions.append(self._get_node_text(name, content))

            # Method definitions in classes/objects: foo() {} or foo: function() {}
            elif node.type == "method_definition":
                name = node.child_by_field_name("name")
                if name:
                    func_name = self._get_node_text(name, content)
                    # Skip constructor
                    if func_name != "constructor":
                        functions.append(func_name)

            # Property with function value in objects: { foo: () => {} }
            elif node.type == "pair":
                key = node.child_by_field_name("key")
                value = node.child_by_field_name("value")
                if key and value and value.type in ("arrow_function", "function_expression"):
                    functions.append(self._get_node_text(key, content))

            for child in node.children:
                traverse(child)

        traverse(root)
        return functions

    def _extract_js_ts_classes(self, tree, content: str) -> list[str]:
        """Extract class names from JavaScript/TypeScript files."""
        classes = []
        root = tree.root_node

        def traverse(node):
            if node.type == "class_declaration":
                name = node.child_by_field_name("name")
                if name:
                    classes.append(self._get_node_text(name, content))

            for child in node.children:
                traverse(child)

        traverse(root)
        return classes

    def _extract_python_functions(self, tree, content: str) -> list[str]:
        """Extract function and method names from Python files."""
        functions = []
        root = tree.root_node

        def traverse(node, in_class=False):
            if node.type == "function_definition":
                name = node.child_by_field_name("name")
                if name:
                    func_name = self._get_node_text(name, content)
                    # Skip dunder methods except __init__
                    if not (func_name.startswith("__") and func_name.endswith("__") and func_name != "__init__"):
                        functions.append(func_name)

            elif node.type == "class_definition":
                # Traverse class body to find methods
                for child in node.children:
                    traverse(child, in_class=True)
                return  # Don't double-traverse

            for child in node.children:
                traverse(child, in_class)

        traverse(root)
        return functions

    def _extract_python_classes(self, tree, content: str) -> list[str]:
        """Extract class names from Python files."""
        classes = []
        root = tree.root_node

        def traverse(node):
            if node.type == "class_definition":
                name = node.child_by_field_name("name")
                if name:
                    classes.append(self._get_node_text(name, content))

            for child in node.children:
                traverse(child)

        traverse(root)
        return classes

    def _get_node_text(self, node, content: str) -> str:
        """Get the text content of a node."""
        return content[node.start_byte : node.end_byte]

    def _get_string_value(self, node, content: str) -> str:
        """Get the string value without quotes."""
        text = self._get_node_text(node, content)
        # Remove quotes (single, double, or template literals)
        return text.strip("\"'`")

    def walk_directory(
        self,
        directory: str,
        include_node_modules: bool = False,
        max_depth: Optional[int] = None,
    ) -> list[str]:
        """Walk a directory and find all supported source files."""
        files = []
        base_depth = directory.rstrip(os.sep).count(os.sep)

        for root, dirs, filenames in os.walk(directory):
            # Calculate current depth
            current_depth = root.count(os.sep) - base_depth

            # Check max depth
            if max_depth is not None and current_depth >= max_depth:
                dirs.clear()
                continue

            # Skip common non-source directories
            dirs[:] = [
                d
                for d in dirs
                if d
                not in (
                    ".git",
                    ".svn",
                    ".hg",
                    "__pycache__",
                    ".pytest_cache",
                    ".mypy_cache",
                    ".tox",
                    ".venv",
                    "venv",
                    "env",
                    ".env",
                    "dist",
                    "build",
                    ".next",
                    ".nuxt",
                    "coverage",
                )
            ]

            # Skip node_modules unless explicitly included
            if not include_node_modules and "node_modules" in dirs:
                dirs.remove("node_modules")

            for filename in filenames:
                ext = Path(filename).suffix.lower()
                if ext in self.settings.supported_extensions:
                    files.append(os.path.join(root, filename))

        return files

    def parse_directory(
        self,
        directory: str,
        include_node_modules: bool = False,
        max_depth: Optional[int] = None,
        include_content: bool = False,
    ) -> list[ParsedFile]:
        """Parse all supported files in a directory.

        Args:
            directory: Directory to parse
            include_node_modules: Whether to include node_modules
            max_depth: Maximum directory depth to traverse
            include_content: If True, include raw file content (for storage)
        """
        files = self.walk_directory(directory, include_node_modules, max_depth)
        parsed_files = []

        for file_path in files:
            parsed = self.parse_file(file_path, directory, include_content)
            if parsed:
                parsed_files.append(parsed)

        return parsed_files


# Singleton instance
_parser: Optional[FileParser] = None


def get_parser() -> FileParser:
    """Get or create the parser instance."""
    global _parser
    if _parser is None:
        _parser = FileParser()
    return _parser