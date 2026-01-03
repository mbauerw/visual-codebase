"""Service for extracting and analyzing function definitions and calls."""
import os
from typing import Optional

from ..models.schemas import (
    FunctionCallInfo,
    FunctionDefinition,
    ParsedFile,
    Language as LangEnum,
)
from .parser import get_parser


class FunctionAnalyzer:
    """Extracts and analyzes function definitions and calls from parsed files."""

    def __init__(self):
        """Initialize the function analyzer."""
        self._parser = get_parser()

    def analyze(
        self, parsed_files: list[ParsedFile]
    ) -> tuple[list[FunctionDefinition], list[FunctionCallInfo]]:
        """Extract all functions and calls from parsed files.

        Args:
            parsed_files: List of parsed files with content

        Returns:
            Tuple of (function definitions, function calls)
        """
        all_functions: list[FunctionDefinition] = []
        all_calls: list[FunctionCallInfo] = []

        for pf in parsed_files:
            # Skip files without content (content is required for call extraction)
            if not pf.content:
                continue

            try:
                functions, calls = self._analyze_file(pf)
                all_functions.extend(functions)
                all_calls.extend(calls)
            except Exception as e:
                print(f"Error analyzing functions in {pf.relative_path}: {e}")
                continue

        return all_functions, all_calls

    def _analyze_file(
        self, parsed_file: ParsedFile
    ) -> tuple[list[FunctionDefinition], list[FunctionCallInfo]]:
        """Analyze a single file for function definitions and calls.

        Args:
            parsed_file: Parsed file with content

        Returns:
            Tuple of (function definitions, function calls)
        """
        if not parsed_file.content:
            return [], []

        # Get the parser for this file type
        parser = self._parser.get_parser(parsed_file.path)
        if not parser:
            return [], []

        # Parse the content
        tree = parser.parse(bytes(parsed_file.content, "utf-8"))

        # Extract function definitions
        functions = self._parser.extract_function_definitions(
            parsed_file.path,
            parsed_file.content,
            tree,
            parsed_file.exports,
        )

        # Extract function calls
        calls = self._parser.extract_function_calls(
            parsed_file.path,
            parsed_file.content,
            tree,
        )

        return functions, calls

    def analyze_file_content(
        self, file_path: str, content: str, exports: list[str]
    ) -> tuple[list[FunctionDefinition], list[FunctionCallInfo]]:
        """Analyze a single file given its path and content.

        Args:
            file_path: Path to the file
            content: File content
            exports: List of exported names

        Returns:
            Tuple of (function definitions, function calls)
        """
        parser = self._parser.get_parser(file_path)
        if not parser:
            return [], []

        tree = parser.parse(bytes(content, "utf-8"))

        functions = self._parser.extract_function_definitions(
            file_path, content, tree, exports
        )
        calls = self._parser.extract_function_calls(file_path, content, tree)

        return functions, calls


# Singleton instance
_analyzer: Optional[FunctionAnalyzer] = None


def get_function_analyzer() -> FunctionAnalyzer:
    """Get or create the function analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = FunctionAnalyzer()
    return _analyzer
