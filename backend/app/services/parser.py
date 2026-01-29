"""Tree-sitter based parser for extracting imports from source files."""
import os
import re
from pathlib import Path
from typing import Optional

import tree_sitter_javascript as tsjs
import tree_sitter_python as tspy
import tree_sitter_typescript as tsts
import tree_sitter_java as tsjava
import tree_sitter_c_sharp as tscsharp
from tree_sitter import Language, Parser

from ..settings import get_settings
from ..models.schemas import (
    ImportInfo,
    ImportType,
    Language as LangEnum,
    ParsedFile,
    FunctionCallInfo,
    FunctionDefinition,
    FunctionType,
    CallType,
    CallOrigin,
)


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
        self.java_language = Language(tsjava.language())
        self.csharp_language = Language(tscsharp.language())

        # Create parsers with the language
        self.js_parser = Parser(self.js_language)
        self.ts_parser = Parser(self.ts_language)
        self.tsx_parser = Parser(self.tsx_language)
        self.py_parser = Parser(self.py_language)
        self.java_parser = Parser(self.java_language)
        self.csharp_parser = Parser(self.csharp_language)

        # Extension to language/parser mapping
        self.extension_map = {
            ".js": (LangEnum.JAVASCRIPT, self.js_parser),
            ".jsx": (LangEnum.JAVASCRIPT, self.js_parser),
            ".ts": (LangEnum.TYPESCRIPT, self.ts_parser),
            ".tsx": (LangEnum.TYPESCRIPT, self.tsx_parser),
            ".py": (LangEnum.PYTHON, self.py_parser),
            ".java": (LangEnum.JAVA, self.java_parser),
            ".cs": (LangEnum.CSHARP, self.csharp_parser),
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
            elif language == LangEnum.JAVA:
                imports = self._extract_java_imports(tree, content)
                exports = self._extract_java_exports(tree, content)
                functions = self._extract_java_functions(tree, content)
                classes = self._extract_java_classes(tree, content)
            elif language == LangEnum.CSHARP:
                imports = self._extract_csharp_imports(tree, content)
                exports = self._extract_csharp_exports(tree, content)
                functions = self._extract_csharp_functions(tree, content)
                classes = self._extract_csharp_classes(tree, content)
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

            # require("module") or dynamic import()
            elif node.type == "call_expression":
                callee = node.child_by_field_name("function")
                if callee:
                    # Check for require("module")
                    if self._get_node_text(callee, content) == "require":
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
                    # Check for dynamic import()
                    elif callee.type == "import":
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
                seen_import_keyword = False

                for child in node.children:
                    # Track when we've passed the 'import' keyword
                    if self._get_node_text(child, content) == "import":
                        seen_import_keyword = True
                        continue

                    if child.type == "dotted_name" and not seen_import_keyword:
                        # Module name (multi-part like os.path)
                        module = self._get_node_text(child, content)
                    elif child.type == "identifier" and not seen_import_keyword:
                        # Module name (simple like os in 'from os import path')
                        module = self._get_node_text(child, content)
                    elif child.type == "relative_import":
                        is_relative = True
                        # Get the module part after the dots
                        for subchild in child.children:
                            if subchild.type == "dotted_name":
                                module = self._get_node_text(subchild, content)
                            elif subchild.type == "identifier":
                                module = self._get_node_text(subchild, content)
                            elif subchild.type == "import_prefix":
                                # Just dots, module might be empty
                                if module is None:
                                    module = "."
                    elif child.type == "import_list":
                        # Get imported names from import list
                        for subchild in child.children:
                            if subchild.type == "identifier":
                                imported_names.append(
                                    self._get_node_text(subchild, content)
                                )
                            elif subchild.type == "aliased_import":
                                name = subchild.child_by_field_name("name")
                                if name:
                                    imported_names.append(
                                        self._get_node_text(name, content)
                                    )
                    elif child.type == "identifier" and seen_import_keyword:
                        # Single imported name (from x import y without parentheses)
                        imported_names.append(self._get_node_text(child, content))

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

    def _extract_java_imports(self, tree, content: str) -> list[ImportInfo]:
        """Extract import statements from Java files."""
        imports = []
        root = tree.root_node

        def traverse(node):
            if node.type == "import_declaration":
                import_info = self._parse_java_import(node, content)
                if import_info:
                    imports.append(import_info)
            for child in node.children:
                traverse(child)

        traverse(root)
        return imports

    def _parse_java_import(self, node, content: str) -> Optional[ImportInfo]:
        """Parse a Java import declaration node."""
        is_static = False
        is_wildcard = False
        import_path_parts = []

        for child in node.children:
            if child.type == "static":
                is_static = True
            elif child.type == "asterisk":
                is_wildcard = True
            elif child.type == "scoped_identifier":
                import_path_parts = self._extract_scoped_identifier(child, content)
            elif child.type == "identifier":
                import_path_parts = [self._get_node_text(child, content)]

        if not import_path_parts:
            return None

        module = ".".join(import_path_parts)

        if is_static:
            import_type = ImportType.STATIC_IMPORT
        elif is_wildcard:
            import_type = ImportType.WILDCARD_IMPORT
        else:
            import_type = ImportType.IMPORT

        return ImportInfo(
            module=module,
            import_type=import_type,
            is_relative=False,
            imported_names=[import_path_parts[-1]] if not is_wildcard else [],
        )

    def _extract_scoped_identifier(self, node, content: str) -> list[str]:
        """Extract parts of a scoped identifier (e.g., com.example.MyClass)."""
        parts = []

        def traverse(n):
            if n.type == "identifier":
                parts.append(self._get_node_text(n, content))
            elif n.type == "scoped_identifier":
                for child in n.children:
                    traverse(child)

        traverse(node)
        return parts

    def _extract_java_exports(self, tree, content: str) -> list[str]:
        """Extract public class/interface names from Java files (Java's 'exports')."""
        exports = []
        root = tree.root_node

        def traverse(node):
            if node.type in ("class_declaration", "interface_declaration", "enum_declaration", "annotation_type_declaration"):
                # Check if it has public modifier
                is_public = False
                name = None
                for child in node.children:
                    if child.type == "modifiers":
                        modifier_text = self._get_node_text(child, content)
                        if "public" in modifier_text:
                            is_public = True
                    elif child.type == "identifier":
                        name = self._get_node_text(child, content)

                if is_public and name:
                    exports.append(name)

            for child in node.children:
                traverse(child)

        traverse(root)
        return exports

    def _extract_java_functions(self, tree, content: str) -> list[str]:
        """Extract method names from Java files."""
        functions = []
        root = tree.root_node

        def traverse(node):
            if node.type == "method_declaration":
                name = node.child_by_field_name("name")
                if name:
                    func_name = self._get_node_text(name, content)
                    functions.append(func_name)
            elif node.type == "constructor_declaration":
                name = node.child_by_field_name("name")
                if name:
                    func_name = self._get_node_text(name, content)
                    functions.append(func_name)

            for child in node.children:
                traverse(child)

        traverse(root)
        return functions

    def _extract_java_classes(self, tree, content: str) -> list[str]:
        """Extract class, interface, enum, and annotation names from Java files."""
        classes = []
        root = tree.root_node

        def traverse(node):
            if node.type in ("class_declaration", "interface_declaration", "enum_declaration", "annotation_type_declaration"):
                name = None
                for child in node.children:
                    if child.type == "identifier":
                        name = self._get_node_text(child, content)
                        break
                if name:
                    classes.append(name)

            for child in node.children:
                traverse(child)

        traverse(root)
        return classes

    def _extract_csharp_imports(self, tree, content: str) -> list[ImportInfo]:
        """Extract using directives from C# files."""
        imports = []
        root = tree.root_node

        def traverse(node):
            if node.type == "using_directive":
                import_info = self._parse_csharp_using(node, content)
                if import_info:
                    imports.append(import_info)
            for child in node.children:
                traverse(child)

        traverse(root)
        return imports

    def _parse_csharp_using(self, node, content: str) -> Optional[ImportInfo]:
        """Parse a C# using directive into ImportInfo."""
        is_global = False
        is_static = False
        alias_name = None
        namespace = None

        for child in node.children:
            if child.type == "global":
                is_global = True
            elif child.type == "static":
                is_static = True
            elif child.type == "name_equals":
                # Alias using: using Alias = Namespace.Type;
                for subchild in child.children:
                    if subchild.type == "identifier":
                        alias_name = self._get_node_text(subchild, content)
                        break
            elif child.type in ("qualified_name", "identifier_name", "identifier", "generic_name"):
                namespace = self._get_node_text(child, content)
            elif child.type == "alias_qualified_name":
                namespace = self._get_node_text(child, content)

        if namespace:
            if is_static:
                import_type = ImportType.STATIC_USING
            elif alias_name:
                import_type = ImportType.ALIAS_USING
            elif is_global:
                import_type = ImportType.GLOBAL_USING
            else:
                import_type = ImportType.USING

            return ImportInfo(
                module=namespace,
                import_type=import_type,
                is_relative=False,
                imported_names=[alias_name] if alias_name else [],
            )
        return None

    def _extract_csharp_exports(self, tree, content: str) -> list[str]:
        """Extract public class/interface/struct/record names from C# files."""
        exports = []
        root = tree.root_node

        def traverse(node):
            if node.type in ("class_declaration", "interface_declaration", "struct_declaration",
                            "record_declaration", "enum_declaration", "delegate_declaration"):
                # Check if it has public modifier
                is_public = False
                name = None
                for child in node.children:
                    if child.type == "modifier" and self._get_node_text(child, content) == "public":
                        is_public = True
                    elif child.type == "identifier":
                        name = self._get_node_text(child, content)

                if is_public and name:
                    exports.append(name)

            for child in node.children:
                traverse(child)

        traverse(root)
        return exports

    def _extract_csharp_functions(self, tree, content: str) -> list[str]:
        """Extract method names from C# files."""
        functions = []
        root = tree.root_node

        def traverse(node):
            if node.type == "method_declaration":
                name = node.child_by_field_name("name")
                if name:
                    func_name = self._get_node_text(name, content)
                    functions.append(func_name)
            elif node.type == "constructor_declaration":
                name = node.child_by_field_name("name")
                if name:
                    func_name = self._get_node_text(name, content)
                    functions.append(func_name)
            elif node.type == "property_declaration":
                # Properties with get/set are like methods
                name = node.child_by_field_name("name")
                if name:
                    prop_name = self._get_node_text(name, content)
                    functions.append(prop_name)

            for child in node.children:
                traverse(child)

        traverse(root)
        return functions

    def _extract_csharp_classes(self, tree, content: str) -> list[str]:
        """Extract class, interface, struct, record, enum, and delegate names from C# files."""
        classes = []
        root = tree.root_node

        def traverse(node):
            if node.type in ("class_declaration", "interface_declaration", "struct_declaration",
                            "record_declaration", "enum_declaration", "delegate_declaration"):
                name = None
                for child in node.children:
                    if child.type == "identifier":
                        name = self._get_node_text(child, content)
                        break
                if name:
                    classes.append(name)

            for child in node.children:
                traverse(child)

        traverse(root)
        return classes

    def _get_node_text(self, node, content: str) -> str:
        """Get the text content of a node.

        Uses byte offsets from tree-sitter on the UTF-8 encoded content
        to correctly handle multi-byte characters.
        """
        if not content:
            return ""
        content_bytes = content.encode("utf-8")
        text_bytes = content_bytes[node.start_byte : node.end_byte]
        return text_bytes.decode("utf-8")

    def _get_string_value(self, node, content: str) -> str:
        """Get the string value without quotes."""
        text = self._get_node_text(node, content)
        # Remove quotes (single, double, or template literals)
        return text.strip("\"'`")

    def extract_function_calls(
        self, file_path: str, content: str, tree
    ) -> list[FunctionCallInfo]:
        """Extract function call sites from a parsed file.

        Args:
            file_path: Path to the file
            content: File content
            tree: Parsed AST tree
        """
        language = self.detect_language(file_path)

        if language in (LangEnum.JAVASCRIPT, LangEnum.TYPESCRIPT):
            return self._extract_js_ts_calls(tree, content, file_path)
        elif language == LangEnum.PYTHON:
            return self._extract_python_calls(tree, content, file_path)
        elif language == LangEnum.JAVA:
            return self._extract_java_calls(tree, content, file_path)
        elif language == LangEnum.CSHARP:
            return self._extract_csharp_calls(tree, content, file_path)

        return []

    def extract_function_definitions(
        self, file_path: str, content: str, tree, exports: list[str]
    ) -> list[FunctionDefinition]:
        """Extract detailed function definitions from a parsed file.

        Args:
            file_path: Path to the file
            content: File content
            tree: Parsed AST tree
            exports: List of exported names
        """
        language = self.detect_language(file_path)

        if language in (LangEnum.JAVASCRIPT, LangEnum.TYPESCRIPT):
            return self._extract_js_ts_function_definitions(tree, content, file_path, exports)
        elif language == LangEnum.PYTHON:
            return self._extract_python_function_definitions(tree, content, file_path)
        elif language == LangEnum.JAVA:
            return self._extract_java_function_definitions(tree, content, file_path, exports)
        elif language == LangEnum.CSHARP:
            return self._extract_csharp_function_definitions(tree, content, file_path, exports)

        return []

    def _extract_js_ts_calls(
        self, tree, content: str, file_path: str
    ) -> list[FunctionCallInfo]:
        """Extract function call sites from JS/TS files."""
        calls = []
        root = tree.root_node

        def traverse(node):
            if node.type == "call_expression":
                callee = node.child_by_field_name("function")
                if callee:
                    call_info = self._parse_call_expression(callee, node, content, file_path)
                    if call_info:
                        calls.append(call_info)

            # Also check for new expressions (constructor calls)
            elif node.type == "new_expression":
                constructor = node.child_by_field_name("constructor")
                if constructor:
                    call_info = self._parse_new_expression(constructor, node, content, file_path)
                    if call_info:
                        calls.append(call_info)

            for child in node.children:
                traverse(child)

        traverse(root)
        return calls

    def _parse_call_expression(
        self, callee, call_node, content: str, file_path: str
    ) -> Optional[FunctionCallInfo]:
        """Parse a JS/TS call expression node into FunctionCallInfo."""
        line = call_node.start_point[0] + 1
        column = call_node.start_point[1]

        if callee.type == "identifier":
            # Direct function call: foo()
            name = self._get_node_text(callee, content)
            # Skip common built-ins
            if name in ("console", "setTimeout", "setInterval", "clearTimeout", "clearInterval"):
                return None
            return FunctionCallInfo(
                callee_name=name,
                call_type=CallType.FUNCTION,
                origin=CallOrigin.LOCAL,
                source_file=file_path,
                line_number=line,
                column=column,
            )

        elif callee.type == "member_expression":
            # Method call: obj.method()
            prop = callee.child_by_field_name("property")
            obj = callee.child_by_field_name("object")
            if prop:
                method_name = self._get_node_text(prop, content)
                obj_name = self._get_node_text(obj, content) if obj else None

                # Skip console.log etc
                if obj_name == "console":
                    return None

                return FunctionCallInfo(
                    callee_name=method_name,
                    qualified_name=f"{obj_name}.{method_name}" if obj_name else method_name,
                    call_type=CallType.METHOD,
                    origin=CallOrigin.LOCAL,
                    source_file=file_path,
                    line_number=line,
                    column=column,
                )

        return None

    def _parse_new_expression(
        self, constructor, new_node, content: str, file_path: str
    ) -> Optional[FunctionCallInfo]:
        """Parse a new expression (constructor call)."""
        line = new_node.start_point[0] + 1
        column = new_node.start_point[1]

        if constructor.type == "identifier":
            name = self._get_node_text(constructor, content)
            return FunctionCallInfo(
                callee_name=name,
                call_type=CallType.CONSTRUCTOR,
                origin=CallOrigin.LOCAL,
                source_file=file_path,
                line_number=line,
                column=column,
            )
        elif constructor.type == "member_expression":
            prop = constructor.child_by_field_name("property")
            obj = constructor.child_by_field_name("object")
            if prop:
                class_name = self._get_node_text(prop, content)
                obj_name = self._get_node_text(obj, content) if obj else None
                return FunctionCallInfo(
                    callee_name=class_name,
                    qualified_name=f"{obj_name}.{class_name}" if obj_name else class_name,
                    call_type=CallType.CONSTRUCTOR,
                    origin=CallOrigin.LOCAL,
                    source_file=file_path,
                    line_number=line,
                    column=column,
                )

        return None

    def _extract_python_calls(
        self, tree, content: str, file_path: str
    ) -> list[FunctionCallInfo]:
        """Extract function call sites from Python files."""
        calls = []
        root = tree.root_node

        def traverse(node):
            if node.type == "call":
                func = node.child_by_field_name("function")
                if func:
                    call_info = self._parse_python_call(func, node, content, file_path)
                    if call_info:
                        calls.append(call_info)

            for child in node.children:
                traverse(child)

        traverse(root)
        return calls

    def _parse_python_call(
        self, func, call_node, content: str, file_path: str
    ) -> Optional[FunctionCallInfo]:
        """Parse a Python call node into FunctionCallInfo."""
        line = call_node.start_point[0] + 1
        column = call_node.start_point[1]

        if func.type == "identifier":
            # Direct function call: foo()
            name = self._get_node_text(func, content)
            # Skip common built-ins
            if name in ("print", "len", "str", "int", "float", "list", "dict", "set", "tuple", "range", "type", "isinstance", "hasattr", "getattr", "setattr"):
                return None
            return FunctionCallInfo(
                callee_name=name,
                call_type=CallType.FUNCTION,
                origin=CallOrigin.LOCAL,
                source_file=file_path,
                line_number=line,
                column=column,
            )

        elif func.type == "attribute":
            # Method call: obj.method()
            attr = func.child_by_field_name("attribute")
            obj = func.child_by_field_name("object")
            if attr:
                method_name = self._get_node_text(attr, content)
                obj_name = self._get_node_text(obj, content) if obj else None
                return FunctionCallInfo(
                    callee_name=method_name,
                    qualified_name=f"{obj_name}.{method_name}" if obj_name else method_name,
                    call_type=CallType.METHOD,
                    origin=CallOrigin.LOCAL,
                    source_file=file_path,
                    line_number=line,
                    column=column,
                )

        return None

    def _extract_js_ts_function_definitions(
        self, tree, content: str, file_path: str, exports: list[str]
    ) -> list[FunctionDefinition]:
        """Extract detailed function definitions from JS/TS files."""
        definitions = []
        root = tree.root_node
        file_name = os.path.basename(file_path).rsplit(".", 1)[0]
        export_set = set(exports)

        def traverse(node, parent_class: Optional[str] = None):
            # Regular function declarations: function foo() {}
            if node.type == "function_declaration":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._get_node_text(name_node, content)
                    is_async = any(
                        child.type == "async" for child in node.children
                    )
                    params = node.child_by_field_name("parameters")
                    param_count = self._count_parameters(params) if params else 0

                    func_type = FunctionType.HOOK if name.startswith("use") else FunctionType.FUNCTION
                    qualified = f"{file_name}.{name}"

                    definitions.append(FunctionDefinition(
                        name=name,
                        qualified_name=qualified,
                        function_type=func_type,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        is_exported=name in export_set,
                        is_async=is_async,
                        is_entry_point=self._is_entry_point(name),
                        parameters_count=param_count,
                        parent_class=parent_class,
                    ))

            # Arrow functions assigned to variables
            elif node.type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                value = node.child_by_field_name("value")
                if name_node and value and value.type in ("arrow_function", "function_expression"):
                    name = self._get_node_text(name_node, content)
                    is_async = any(
                        child.type == "async" for child in value.children
                    )
                    params = value.child_by_field_name("parameters")
                    param_count = self._count_parameters(params) if params else 0

                    func_type = FunctionType.HOOK if name.startswith("use") else FunctionType.ARROW_FUNCTION
                    qualified = f"{file_name}.{name}"

                    definitions.append(FunctionDefinition(
                        name=name,
                        qualified_name=qualified,
                        function_type=func_type,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        is_exported=name in export_set,
                        is_async=is_async,
                        is_entry_point=self._is_entry_point(name),
                        parameters_count=param_count,
                        parent_class=parent_class,
                    ))

            # Class declarations
            elif node.type == "class_declaration":
                class_name_node = node.child_by_field_name("name")
                if class_name_node:
                    class_name = self._get_node_text(class_name_node, content)
                    # Traverse class body
                    body = node.child_by_field_name("body")
                    if body:
                        for child in body.children:
                            traverse(child, parent_class=class_name)
                    return

            # Method definitions in classes
            elif node.type == "method_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._get_node_text(name_node, content)
                    is_async = any(
                        child.type == "async" for child in node.children
                    )
                    params = node.child_by_field_name("parameters")
                    param_count = self._count_parameters(params) if params else 0

                    func_type = FunctionType.CONSTRUCTOR if name == "constructor" else FunctionType.METHOD
                    qualified = f"{file_name}.{parent_class}.{name}" if parent_class else f"{file_name}.{name}"

                    definitions.append(FunctionDefinition(
                        name=name,
                        qualified_name=qualified,
                        function_type=func_type,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        is_exported=parent_class in export_set if parent_class else False,
                        is_async=is_async,
                        is_entry_point=False,
                        parameters_count=param_count,
                        parent_class=parent_class,
                    ))

            for child in node.children:
                traverse(child, parent_class)

        traverse(root)
        return definitions

    def _extract_python_function_definitions(
        self, tree, content: str, file_path: str
    ) -> list[FunctionDefinition]:
        """Extract detailed function definitions from Python files."""
        definitions = []
        root = tree.root_node
        file_name = os.path.basename(file_path).rsplit(".", 1)[0]

        def traverse(node, parent_class: Optional[str] = None):
            if node.type == "function_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._get_node_text(name_node, content)

                    # Skip dunder methods except __init__
                    if name.startswith("__") and name.endswith("__") and name != "__init__":
                        for child in node.children:
                            traverse(child, parent_class)
                        return

                    is_async = node.type == "async_function_definition" or any(
                        child.type == "async" for child in node.children
                    )
                    params = node.child_by_field_name("parameters")
                    param_count = self._count_python_parameters(params, content) if params else 0

                    if parent_class:
                        func_type = FunctionType.CONSTRUCTOR if name == "__init__" else FunctionType.METHOD
                        qualified = f"{file_name}.{parent_class}.{name}"
                    else:
                        func_type = FunctionType.FUNCTION
                        qualified = f"{file_name}.{name}"

                    # Check for decorators to detect entry points
                    is_entry = self._is_entry_point(name) or self._has_entry_decorator(node, content)

                    definitions.append(FunctionDefinition(
                        name=name,
                        qualified_name=qualified,
                        function_type=func_type,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        is_exported=not name.startswith("_"),
                        is_async=is_async,
                        is_entry_point=is_entry,
                        parameters_count=param_count,
                        parent_class=parent_class,
                    ))

            elif node.type == "class_definition":
                class_name_node = node.child_by_field_name("name")
                if class_name_node:
                    class_name = self._get_node_text(class_name_node, content)
                    body = node.child_by_field_name("body")
                    if body:
                        for child in body.children:
                            traverse(child, parent_class=class_name)
                    return

            for child in node.children:
                traverse(child, parent_class)

        traverse(root)
        return definitions

    def _count_parameters(self, params_node) -> int:
        """Count parameters in JS/TS function."""
        if not params_node:
            return 0
        count = 0
        for child in params_node.children:
            if child.type in ("identifier", "required_parameter", "optional_parameter", "rest_pattern"):
                count += 1
        return count

    def _count_python_parameters(self, params_node, content: str) -> int:
        """Count parameters in Python function (excluding self/cls)."""
        if not params_node:
            return 0
        count = 0
        for child in params_node.children:
            if child.type in ("identifier", "default_parameter", "typed_parameter", "typed_default_parameter"):
                name = self._get_node_text(child, content)
                # Try to get the name for typed parameters
                if child.type in ("typed_parameter", "typed_default_parameter"):
                    name_node = child.children[0] if child.children else None
                    if name_node:
                        name = self._get_node_text(name_node, content)
                if name not in ("self", "cls"):
                    count += 1
        return count

    def _is_entry_point(self, name: str) -> bool:
        """Check if function name indicates an entry point."""
        entry_patterns = (
            "main", "handler", "handle", "endpoint", "route",
            "get", "post", "put", "delete", "patch",
            "on_", "handle_",
        )
        lower_name = name.lower()
        return lower_name == "main" or any(lower_name.startswith(p) for p in entry_patterns)

    def _has_entry_decorator(self, node, content: str) -> bool:
        """Check if function has entry point decorators (Python)."""
        entry_decorators = ("app.", "router.", "@route", "@get", "@post", "@put", "@delete")
        for child in node.children:
            if child.type == "decorator":
                decorator_text = self._get_node_text(child, content)
                if any(d in decorator_text for d in entry_decorators):
                    return True
        return False

    def _extract_java_calls(
        self, tree, content: str, file_path: str
    ) -> list[FunctionCallInfo]:
        """Extract function call sites from Java files."""
        calls = []
        root = tree.root_node

        def traverse(node):
            if node.type == "method_invocation":
                call_info = self._parse_java_method_invocation(node, content, file_path)
                if call_info:
                    calls.append(call_info)
            elif node.type == "object_creation_expression":
                call_info = self._parse_java_constructor_call(node, content, file_path)
                if call_info:
                    calls.append(call_info)

            for child in node.children:
                traverse(child)

        traverse(root)
        return calls

    def _parse_java_method_invocation(
        self, node, content: str, file_path: str
    ) -> Optional[FunctionCallInfo]:
        """Parse a Java method invocation."""
        line = node.start_point[0] + 1
        column = node.start_point[1]

        method_name = None
        obj_name = None

        for child in node.children:
            if child.type == "identifier":
                # Could be method name or object
                if method_name is None:
                    method_name = self._get_node_text(child, content)
                else:
                    obj_name = method_name
                    method_name = self._get_node_text(child, content)
            elif child.type == "field_access":
                # Get the rightmost identifier as method name
                for subchild in child.children:
                    if subchild.type == "identifier":
                        obj_name = self._get_node_text(subchild, content)

        if not method_name:
            return None

        # Skip common system calls
        if obj_name and obj_name.lower() in ("system", "out", "err"):
            return None

        return FunctionCallInfo(
            callee_name=method_name,
            qualified_name=f"{obj_name}.{method_name}" if obj_name else method_name,
            call_type=CallType.METHOD if obj_name else CallType.FUNCTION,
            origin=CallOrigin.LOCAL,
            source_file=file_path,
            line_number=line,
            column=column,
        )

    def _parse_java_constructor_call(
        self, node, content: str, file_path: str
    ) -> Optional[FunctionCallInfo]:
        """Parse a Java constructor call (new expression)."""
        line = node.start_point[0] + 1
        column = node.start_point[1]

        class_name = None
        for child in node.children:
            if child.type == "type_identifier":
                class_name = self._get_node_text(child, content)
                break
            elif child.type == "generic_type":
                # Get the base type from generic (e.g., ArrayList from ArrayList<String>)
                for subchild in child.children:
                    if subchild.type == "type_identifier":
                        class_name = self._get_node_text(subchild, content)
                        break

        if not class_name:
            return None

        return FunctionCallInfo(
            callee_name=class_name,
            call_type=CallType.CONSTRUCTOR,
            origin=CallOrigin.LOCAL,
            source_file=file_path,
            line_number=line,
            column=column,
        )

    def _extract_java_function_definitions(
        self, tree, content: str, file_path: str, exports: list[str]
    ) -> list[FunctionDefinition]:
        """Extract detailed method definitions from Java files."""
        definitions = []
        root = tree.root_node
        file_name = os.path.basename(file_path).rsplit(".", 1)[0]
        export_set = set(exports)

        def traverse(node, parent_class: Optional[str] = None):
            if node.type in ("class_declaration", "interface_declaration", "enum_declaration"):
                class_name = None
                for child in node.children:
                    if child.type == "identifier":
                        class_name = self._get_node_text(child, content)
                        break
                if class_name:
                    body = node.child_by_field_name("body")
                    if body:
                        for child in body.children:
                            traverse(child, parent_class=class_name)
                return

            elif node.type == "method_declaration":
                name = node.child_by_field_name("name")
                if name:
                    method_name = self._get_node_text(name, content)
                    params = node.child_by_field_name("parameters")
                    param_count = self._count_java_parameters(params) if params else 0

                    # Check if method is public/exported
                    is_public = self._is_java_public(node, content)

                    qualified = f"{file_name}.{parent_class}.{method_name}" if parent_class else f"{file_name}.{method_name}"

                    definitions.append(FunctionDefinition(
                        name=method_name,
                        qualified_name=qualified,
                        function_type=FunctionType.METHOD,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        is_exported=is_public or (parent_class in export_set if parent_class else False),
                        is_async=False,
                        is_entry_point=self._is_java_entry_point(method_name, node, content),
                        parameters_count=param_count,
                        parent_class=parent_class,
                    ))

            elif node.type == "constructor_declaration":
                name = node.child_by_field_name("name")
                if name:
                    ctor_name = self._get_node_text(name, content)
                    params = node.child_by_field_name("parameters")
                    param_count = self._count_java_parameters(params) if params else 0
                    is_public = self._is_java_public(node, content)

                    qualified = f"{file_name}.{parent_class}.{ctor_name}" if parent_class else f"{file_name}.{ctor_name}"

                    definitions.append(FunctionDefinition(
                        name=ctor_name,
                        qualified_name=qualified,
                        function_type=FunctionType.CONSTRUCTOR,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        is_exported=is_public,
                        is_async=False,
                        is_entry_point=False,
                        parameters_count=param_count,
                        parent_class=parent_class,
                    ))

            for child in node.children:
                traverse(child, parent_class)

        traverse(root)
        return definitions

    def _count_java_parameters(self, params_node) -> int:
        """Count parameters in Java method."""
        if not params_node:
            return 0
        count = 0
        for child in params_node.children:
            if child.type == "formal_parameter":
                count += 1
        return count

    def _is_java_public(self, node, content: str) -> bool:
        """Check if a Java declaration has public modifier."""
        for child in node.children:
            if child.type == "modifiers":
                modifier_text = self._get_node_text(child, content)
                if "public" in modifier_text:
                    return True
        return False

    def _is_java_entry_point(self, method_name: str, node, content: str) -> bool:
        """Check if method is a Java entry point."""
        # Main method
        if method_name == "main":
            return True

        # Spring annotations
        for child in node.children:
            if child.type in ("marker_annotation", "annotation"):
                annotation_text = self._get_node_text(child, content)
                if any(ann in annotation_text for ann in (
                    "@GetMapping", "@PostMapping", "@PutMapping", "@DeleteMapping",
                    "@RequestMapping", "@Scheduled", "@EventListener"
                )):
                    return True
        return False

    def _extract_csharp_calls(
        self, tree, content: str, file_path: str
    ) -> list[FunctionCallInfo]:
        """Extract function call sites from C# files."""
        calls = []
        root = tree.root_node

        def traverse(node):
            if node.type == "invocation_expression":
                call_info = self._parse_csharp_invocation(node, content, file_path)
                if call_info:
                    calls.append(call_info)
            elif node.type == "object_creation_expression":
                call_info = self._parse_csharp_constructor_call(node, content, file_path)
                if call_info:
                    calls.append(call_info)

            for child in node.children:
                traverse(child)

        traverse(root)
        return calls

    def _parse_csharp_invocation(
        self, node, content: str, file_path: str
    ) -> Optional[FunctionCallInfo]:
        """Parse a C# method invocation."""
        line = node.start_point[0] + 1
        column = node.start_point[1]

        method_name = None
        obj_name = None

        for child in node.children:
            if child.type == "identifier":
                method_name = self._get_node_text(child, content)
            elif child.type == "member_access_expression":
                # obj.Method()
                for subchild in child.children:
                    if subchild.type == "identifier":
                        if obj_name is None:
                            obj_name = self._get_node_text(subchild, content)
                        else:
                            method_name = self._get_node_text(subchild, content)
                    elif subchild.type == "simple_name":
                        method_name = self._get_node_text(subchild, content)

        if not method_name:
            return None

        # Skip common system calls
        if obj_name and obj_name.lower() in ("console", "debug", "trace"):
            return None

        return FunctionCallInfo(
            callee_name=method_name,
            qualified_name=f"{obj_name}.{method_name}" if obj_name else method_name,
            call_type=CallType.METHOD if obj_name else CallType.FUNCTION,
            origin=CallOrigin.LOCAL,
            source_file=file_path,
            line_number=line,
            column=column,
        )

    def _parse_csharp_constructor_call(
        self, node, content: str, file_path: str
    ) -> Optional[FunctionCallInfo]:
        """Parse a C# constructor call (new expression)."""
        line = node.start_point[0] + 1
        column = node.start_point[1]

        class_name = None
        for child in node.children:
            if child.type == "identifier":
                class_name = self._get_node_text(child, content)
                break
            elif child.type == "generic_name":
                # Get the base type from generic (e.g., List from List<string>)
                for subchild in child.children:
                    if subchild.type == "identifier":
                        class_name = self._get_node_text(subchild, content)
                        break

        if not class_name:
            return None

        return FunctionCallInfo(
            callee_name=class_name,
            call_type=CallType.CONSTRUCTOR,
            origin=CallOrigin.LOCAL,
            source_file=file_path,
            line_number=line,
            column=column,
        )

    def _extract_csharp_function_definitions(
        self, tree, content: str, file_path: str, exports: list[str]
    ) -> list[FunctionDefinition]:
        """Extract detailed method definitions from C# files."""
        definitions = []
        root = tree.root_node
        file_name = os.path.basename(file_path).rsplit(".", 1)[0]
        export_set = set(exports)

        def traverse(node, parent_class: Optional[str] = None):
            if node.type in ("class_declaration", "interface_declaration", "struct_declaration", "record_declaration"):
                class_name = None
                for child in node.children:
                    if child.type == "identifier":
                        class_name = self._get_node_text(child, content)
                        break
                if class_name:
                    # Traverse class body
                    for child in node.children:
                        if child.type == "declaration_list":
                            for body_child in child.children:
                                traverse(body_child, parent_class=class_name)
                return

            elif node.type == "method_declaration":
                name = node.child_by_field_name("name")
                if name:
                    method_name = self._get_node_text(name, content)
                    params = node.child_by_field_name("parameters")
                    param_count = self._count_csharp_parameters(params) if params else 0

                    # Check if method is public
                    is_public = self._is_csharp_public(node, content)
                    is_async = self._is_csharp_async(node, content)

                    qualified = f"{file_name}.{parent_class}.{method_name}" if parent_class else f"{file_name}.{method_name}"

                    definitions.append(FunctionDefinition(
                        name=method_name,
                        qualified_name=qualified,
                        function_type=FunctionType.METHOD,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        is_exported=is_public or (parent_class in export_set if parent_class else False),
                        is_async=is_async,
                        is_entry_point=self._is_csharp_entry_point(method_name, node, content),
                        parameters_count=param_count,
                        parent_class=parent_class,
                    ))

            elif node.type == "constructor_declaration":
                name = node.child_by_field_name("name")
                if name:
                    ctor_name = self._get_node_text(name, content)
                    params = node.child_by_field_name("parameters")
                    param_count = self._count_csharp_parameters(params) if params else 0
                    is_public = self._is_csharp_public(node, content)

                    qualified = f"{file_name}.{parent_class}.{ctor_name}" if parent_class else f"{file_name}.{ctor_name}"

                    definitions.append(FunctionDefinition(
                        name=ctor_name,
                        qualified_name=qualified,
                        function_type=FunctionType.CONSTRUCTOR,
                        file_path=file_path,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        is_exported=is_public,
                        is_async=False,
                        is_entry_point=False,
                        parameters_count=param_count,
                        parent_class=parent_class,
                    ))

            for child in node.children:
                traverse(child, parent_class)

        traverse(root)
        return definitions

    def _count_csharp_parameters(self, params_node) -> int:
        """Count parameters in C# method."""
        if not params_node:
            return 0
        count = 0
        for child in params_node.children:
            if child.type == "parameter":
                count += 1
        return count

    def _is_csharp_public(self, node, content: str) -> bool:
        """Check if a C# declaration has public modifier."""
        for child in node.children:
            if child.type == "modifier":
                if self._get_node_text(child, content) == "public":
                    return True
        return False

    def _is_csharp_async(self, node, content: str) -> bool:
        """Check if a C# method is async."""
        for child in node.children:
            if child.type == "modifier":
                if self._get_node_text(child, content) == "async":
                    return True
        return False

    def _is_csharp_entry_point(self, method_name: str, node, content: str) -> bool:
        """Check if method is a C# entry point."""
        # Main method
        if method_name == "Main":
            return True

        # ASP.NET Core attributes
        for child in node.children:
            if child.type == "attribute_list":
                attr_text = self._get_node_text(child, content)
                if any(attr in attr_text for attr in (
                    "[HttpGet", "[HttpPost", "[HttpPut", "[HttpDelete",
                    "[Route", "[ApiController"
                )):
                    return True
        return False

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
                    # Java/Gradle/Maven build directories
                    "target",
                    ".gradle",
                    ".idea",
                    "out",
                    # C#/.NET build directories
                    "bin",
                    "obj",
                    ".vs",
                    "packages",
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