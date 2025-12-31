"""LLM-based semantic analysis service using Claude."""
import json
import os
from typing import Callable, Optional

import anthropic

# Type alias for progress callback: (batch_number, total_batches, files_in_batch) -> None
ProgressCallback = Callable[[int, int, int], None]

from ..settings import get_settings
from ..models.schemas import (
    ArchitecturalRole,
    Category,
    LLMFileAnalysis,
    ParsedFile,
)


class LLMAnalyzer:
    """Service for analyzing codebase files using Claude."""

    def __init__(self):
        """Initialize the Anthropic client."""
        self.settings = get_settings()
        self.client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)

    def _build_file_summary(self, files: list[ParsedFile]) -> str:
        """Build a summary of files for the LLM prompt."""
        summaries = []
        for f in files:
            # Format imports (limit to 10)
            imports_str = ", ".join([imp.module for imp in f.imports[:10]])
            if len(f.imports) > 10:
                imports_str += f"... (+{len(f.imports) - 10} more)"

            # Format functions (limit to 15)
            functions_str = ", ".join(f.functions[:15])
            if len(f.functions) > 15:
                functions_str += f"... (+{len(f.functions) - 15} more)"

            # Format classes (limit to 10)
            classes_str = ", ".join(f.classes[:10])
            if len(f.classes) > 10:
                classes_str += f"... (+{len(f.classes) - 10} more)"

            summary = f"- {f.relative_path} ({f.language.value}, {f.line_count} lines)\n"
            summary += f"  Imports: {imports_str or 'none'}\n"
            summary += f"  Functions: {functions_str or 'none'}\n"
            summary += f"  Classes: {classes_str or 'none'}"

            summaries.append(summary)
        return "\n".join(summaries)

    def _get_analysis_prompt(
        self, directory_name: str, files: list[ParsedFile]
    ) -> str:
        """Generate the analysis prompt for Claude."""
        file_summary = self._build_file_summary(files)

        return f"""You are analyzing a codebase. Here is information about files in the "{directory_name}" directory:

        {file_summary}

        For each file, provide:
        1. architectural_role: The role this file plays. Use one of these values: react_component, utility, api_service, model, config, test, hook, context, store, middleware, controller, router, schema, unknown
        2. description: 1-3 sentence description of what this file does. Base this on the function names, class names, and imports. Be specific - mention key functions/classes by name when relevant. Do not just describe the file path.
        3. category: High-level category. Use one of: frontend, backend, shared, infrastructure, test, config, unknown

        Return ONLY a valid JSON array with no additional text. Format:
        [{{"filename": "example.ts", "architectural_role": "utility", "description": "Provides helper functions for...", "category": "shared"}}]

        Important:
        - Return ONLY the JSON array, no markdown code blocks or explanations
        - Use the exact enum values provided
        - Include an entry for EVERY file listed above
        - Write descriptions that reference the actual function/class names found in the file
        - If uncertain, use "unknown" for role/category"""

    def _parse_role(self, role_str: str) -> ArchitecturalRole:
        """Parse a role string to enum, with fallback."""
        try:
            return ArchitecturalRole(role_str.lower())
        except ValueError:
            return ArchitecturalRole.UNKNOWN

    def _parse_category(self, category_str: str) -> Category:
        """Parse a category string to enum, with fallback."""
        try:
            return Category(category_str.lower())
        except ValueError:
            return Category.UNKNOWN

    def _parse_llm_response(self, response: str) -> list[LLMFileAnalysis]:
        """Parse the LLM response into structured data."""
        # Clean up response - remove markdown code blocks if present
        response = response.strip()
        if response.startswith("```"):
            # Remove markdown code block
            lines = response.split("\n")
            response = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])
            response = response.strip()

        try:
            data = json.loads(response)
            results = []
            for item in data:
                results.append(
                    LLMFileAnalysis(
                        filename=item.get("filename", ""),
                        architectural_role=self._parse_role(
                            item.get("architectural_role", "unknown")
                        ),
                        description=item.get("description", ""),
                        category=self._parse_category(
                            item.get("category", "unknown")
                        ),
                    )
                )
            return results
        except json.JSONDecodeError as e:
            print(f"Failed to parse LLM response: {e}")
            print(f"Response was: {response[:500]}")
            return []

    async def analyze_batch(
        self, files: list[ParsedFile], directory_name: str
    ) -> list[LLMFileAnalysis]:
        """Analyze a batch of files using Claude."""
        if not files:
            return []

        prompt = self._get_analysis_prompt(directory_name, files)

        try:
            message = self.client.messages.create(
                model=self.settings.llm_model,
                max_tokens=self.settings.llm_max_tokens,
                messages=[{"role": "user", "content": prompt}],
            )

            response_text = message.content[0].text
            print("LLM Response: ", response_text)
            return self._parse_llm_response(response_text)

        except Exception as e:
            print(f"LLM analysis failed: {e}")
            # Return basic analysis without LLM insights
            return [
                LLMFileAnalysis(
                    filename=f.name,
                    architectural_role=self._infer_role_from_path(f.relative_path),
                    description=f"File in {os.path.dirname(f.relative_path) or 'root'}",
                    category=self._infer_category_from_path(f.relative_path),
                )
                for f in files
            ]

    def _infer_role_from_path(self, path: str) -> ArchitecturalRole:
        """Infer architectural role from file path patterns."""
        path_lower = path.lower()
        name = os.path.basename(path_lower)

        # Test files
        if "test" in path_lower or "spec" in path_lower or name.startswith("test_"):
            return ArchitecturalRole.TEST

        # Config files
        if any(
            x in name
            for x in (
                "config",
                ".config.",
                "settings",
                ".env",
                "package.json",
                "tsconfig",
                "webpack",
                "vite",
                "eslint",
                "prettier",
            )
        ):
            return ArchitecturalRole.CONFIG

        # React components
        if any(
            x in path_lower for x in ("components/", "pages/", "views/")
        ) or name.endswith((".jsx", ".tsx")):
            return ArchitecturalRole.REACT_COMPONENT

        # Hooks
        if "hooks/" in path_lower or name.startswith("use"):
            return ArchitecturalRole.HOOK

        # Context
        if "context" in path_lower:
            return ArchitecturalRole.CONTEXT

        # Store/State
        if any(x in path_lower for x in ("store/", "redux", "zustand", "state/")):
            return ArchitecturalRole.STORE

        # API/Services
        if any(x in path_lower for x in ("api/", "services/", "service.")):
            return ArchitecturalRole.API_SERVICE

        # Models
        if any(x in path_lower for x in ("models/", "model.", "types/", "schemas/")):
            return ArchitecturalRole.MODEL

        # Middleware
        if "middleware" in path_lower:
            return ArchitecturalRole.MIDDLEWARE

        # Controllers
        if "controller" in path_lower:
            return ArchitecturalRole.CONTROLLER

        # Routers
        if "router" in path_lower or "routes/" in path_lower:
            return ArchitecturalRole.ROUTER

        # Utils
        if any(x in path_lower for x in ("utils/", "util.", "helpers/", "lib/")):
            return ArchitecturalRole.UTILITY

        return ArchitecturalRole.UNKNOWN

    def _infer_category_from_path(self, path: str) -> Category:
        """Infer category from file path patterns."""
        path_lower = path.lower()

        # Test files
        if "test" in path_lower or "spec" in path_lower:
            return Category.TEST

        # Config files
        if any(
            x in path_lower
            for x in ("config", ".config", "settings", ".env", "package.json")
        ):
            return Category.CONFIG

        # Frontend patterns
        if any(
            x in path_lower
            for x in (
                "frontend/",
                "client/",
                "src/components",
                "src/pages",
                "src/views",
                "src/hooks",
                "src/context",
                ".jsx",
                ".tsx",
            )
        ):
            return Category.FRONTEND

        # Backend patterns
        if any(
            x in path_lower
            for x in (
                "backend/",
                "server/",
                "api/",
                "controllers/",
                "routes/",
                "middleware/",
            )
        ):
            return Category.BACKEND

        # Shared patterns
        if any(x in path_lower for x in ("shared/", "common/", "utils/", "lib/")):
            return Category.SHARED

        # Infrastructure
        if any(
            x in path_lower
            for x in ("docker", "kubernetes", "terraform", "infra/", ".yml", ".yaml")
        ):
            return Category.INFRASTRUCTURE

        return Category.UNKNOWN

    async def analyze_files(
        self,
        files: list[ParsedFile],
        directory_path: str,
        progress_callback: Optional[ProgressCallback] = None,
    ) -> dict[str, LLMFileAnalysis]:
        """Analyze all files in batches and return a mapping of filename to analysis.

        Args:
            files: List of parsed files to analyze
            directory_path: Path to the directory being analyzed
            progress_callback: Optional callback for progress updates.
                              Called with (batch_number, total_batches, files_in_batch)
        """
        directory_name = os.path.basename(directory_path.rstrip(os.sep))
        results: dict[str, LLMFileAnalysis] = {}

        # Process in batches
        batch_size = self.settings.max_files_per_batch
        total_batches = (len(files) + batch_size - 1) // batch_size  # Ceiling division

        for batch_num, i in enumerate(range(0, len(files), batch_size), start=1):
            batch = files[i : i + batch_size]
            batch_results = await self.analyze_batch(batch, directory_name)

            for analysis in batch_results:
                # Store by both full path and basename for flexible lookup
                # LLM may return either "App.tsx" or "src/App.tsx"
                results[analysis.filename] = analysis
                basename = os.path.basename(analysis.filename)
                if basename != analysis.filename:
                    results[basename] = analysis

            # Report progress after each batch
            if progress_callback:
                progress_callback(batch_num, total_batches, len(batch))

        # Add fallback analysis for any files not in results
        for f in files:
            # Check both relative path and basename
            if f.relative_path not in results and f.name not in results:
                results[f.name] = LLMFileAnalysis(
                    filename=f.name,
                    architectural_role=self._infer_role_from_path(f.relative_path),
                    description=f"File located at {f.relative_path}",
                    category=self._infer_category_from_path(f.relative_path),
                )

        return results


# Singleton instance
_analyzer: Optional[LLMAnalyzer] = None


def get_llm_analyzer() -> LLMAnalyzer:
    """Get or create the LLM analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = LLMAnalyzer()
    return _analyzer
