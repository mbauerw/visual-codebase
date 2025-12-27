"""Codebase summary generation service."""
import json
import os
from typing import Optional

import anthropic

from ..settings import get_settings
from ..models.schemas import (
    CodebaseSummary,
    TechStackInfo,
    ModuleInfo,
    ComplexityInfo,
    FileNode,
    DependencyEdge,
)


# README detection patterns in priority order
README_PATTERNS = [
    "README.md",
    "readme.md",
    "README.MD",
    "README.rst",
    "README.txt",
    "docs/README.md",
    "documentation/README.md",
]

MAX_README_SIZE = 50 * 1024  # 50KB

SUMMARY_SYSTEM_PROMPT = """You are a technical documentation expert analyzing codebases.
Generate a concise but comprehensive summary of this project.

Return a JSON object with the following structure:
{
  "project_type": "<web_app|api|library|cli|monorepo|mobile_app|unknown>",
  "primary_purpose": "<1-2 sentence description of what this project does>",
  "tech_stack": {
    "languages": ["<language1>", "<language2>"],
    "frameworks": ["<detected framework1>", "<framework2>"],
    "key_patterns": ["<pattern1>", "<pattern2>"]
  },
  "architecture_summary": "<2-3 sentences describing the overall architecture>",
  "key_modules": [
    {"name": "<module/folder name>", "purpose": "<brief purpose>"}
  ],
  "complexity_assessment": {
    "level": "<simple|moderate|complex>",
    "reasoning": "<1 sentence explaining why>"
  },
  "notable_aspects": ["<interesting finding 1>", "<finding 2>"]
}

Return ONLY valid JSON, no markdown or explanation."""


class SummaryGenerator:
    """Service for generating codebase summaries using Claude."""

    def __init__(self):
        self.settings = get_settings()
        self.client = anthropic.Anthropic(api_key=self.settings.anthropic_api_key)

    async def generate_summary(
        self,
        directory_path: str,
        nodes: list[FileNode],
        edges: list[DependencyEdge],
        language_distribution: dict[str, int],
    ) -> tuple[CodebaseSummary, bool]:
        """
        Generate a codebase summary.

        Args:
            directory_path: Path to the analyzed directory
            nodes: List of file nodes from analysis
            edges: List of dependency edges
            language_distribution: Count of files per language

        Returns:
            Tuple of (summary, readme_detected)
        """
        # 1. Detect and read README
        readme_info = self._detect_readme(directory_path)
        readme_detected = readme_info is not None
        readme_content = readme_info[1] if readme_info else None

        # 2. Calculate statistics
        role_distribution = self._calculate_role_distribution(nodes)
        category_distribution = self._calculate_category_distribution(nodes)

        # 3. Identify key files (most connected)
        top_files = self._get_top_files(nodes, edges, limit=10)

        # 4. Build prompt
        prompt = self._build_prompt(
            directory_name=os.path.basename(directory_path.rstrip(os.sep)),
            readme_content=readme_content,
            role_distribution=role_distribution,
            category_distribution=category_distribution,
            language_distribution=language_distribution,
            file_count=len(nodes),
            edge_count=len(edges),
            top_files=top_files,
        )

        # 5. Call LLM
        try:
            summary = await self._call_llm(prompt)
            return (summary, readme_detected)
        except Exception as e:
            print(f"Summary generation failed: {e}")
            return (
                self._generate_fallback_summary(
                    len(nodes), language_distribution, category_distribution
                ),
                readme_detected,
            )

    def _detect_readme(self, directory_path: str) -> Optional[tuple[str, str]]:
        """
        Detect and read README file.

        Args:
            directory_path: Directory to search for README

        Returns:
            Tuple of (readme_path, content) or None if not found
        """
        for pattern in README_PATTERNS:
            readme_path = os.path.join(directory_path, pattern)
            if os.path.isfile(readme_path):
                try:
                    with open(readme_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read(MAX_README_SIZE)
                        if len(content) == MAX_README_SIZE:
                            content += "\n\n... [README truncated due to size]"
                        return (pattern, content)
                except Exception as e:
                    print(f"Failed to read README at {readme_path}: {e}")
                    continue
        return None

    def _calculate_role_distribution(self, nodes: list[FileNode]) -> dict[str, int]:
        """Count files by architectural role."""
        distribution = {}
        for node in nodes:
            role = node.role.value
            distribution[role] = distribution.get(role, 0) + 1
        return distribution

    def _calculate_category_distribution(self, nodes: list[FileNode]) -> dict[str, int]:
        """Count files by category."""
        distribution = {}
        for node in nodes:
            category = node.category.value
            distribution[category] = distribution.get(category, 0) + 1
        return distribution

    def _get_top_files(
        self, nodes: list[FileNode], edges: list[DependencyEdge], limit: int = 10
    ) -> list[dict]:
        """
        Get most connected files by incoming + outgoing edges.

        Args:
            nodes: List of file nodes
            edges: List of dependency edges
            limit: Maximum number of files to return

        Returns:
            List of dicts with path, description, and connection count
        """
        connection_count = {}
        for edge in edges:
            connection_count[edge.source] = connection_count.get(edge.source, 0) + 1
            connection_count[edge.target] = connection_count.get(edge.target, 0) + 1

        # Sort nodes by connection count
        node_map = {node.id: node for node in nodes}
        sorted_ids = sorted(
            connection_count.keys(), key=lambda x: connection_count[x], reverse=True
        )[:limit]

        return [
            {
                "path": node_map[node_id].path,
                "description": node_map[node_id].description,
                "connections": connection_count[node_id],
            }
            for node_id in sorted_ids
            if node_id in node_map
        ]

    def _format_distribution(self, distribution: dict[str, int]) -> str:
        """Format a distribution dict as a bulleted list."""
        items = sorted(distribution.items(), key=lambda x: x[1], reverse=True)
        return "\n".join([f"- {k}: {v}" for k, v in items])

    def _build_prompt(
        self,
        directory_name: str,
        readme_content: Optional[str],
        role_distribution: dict[str, int],
        category_distribution: dict[str, int],
        language_distribution: dict[str, int],
        file_count: int,
        edge_count: int,
        top_files: list[dict],
    ) -> str:
        """Build the summary generation prompt."""
        sections = [f"# Project: {directory_name}\n"]

        # README section (truncated to ~4000 chars for token efficiency)
        if readme_content:
            truncated = readme_content[:4000]
            if len(readme_content) > 4000:
                truncated += "\n... (truncated)"
            sections.append(f"## README Content:\n{truncated}\n")
        else:
            sections.append("## README: Not available\n")

        # Architecture statistics
        avg_deps = edge_count / max(file_count, 1)
        sections.append(
            f"""## Architecture Statistics:
- Total files analyzed: {file_count}
- Total dependencies: {edge_count}
- Average dependencies per file: {avg_deps:.1f}

### File Roles:
{self._format_distribution(role_distribution)}

### Categories:
{self._format_distribution(category_distribution)}

### Languages:
{self._format_distribution(language_distribution)}
"""
        )

        # Key files (most connected/important)
        if top_files:
            sections.append("## Key Files (most connected):\n")
            for f in top_files:
                sections.append(
                    f"- {f['path']} ({f['connections']} connections): {f['description']}"
                )

        return "\n".join(sections)

    async def _call_llm(self, prompt: str) -> CodebaseSummary:
        """Call Claude API and parse response."""
        message = self.client.messages.create(
            model=self.settings.llm_model,
            max_tokens=1024,
            system=SUMMARY_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}],
        )

        response_text = message.content[0].text
        return self._parse_response(response_text)

    def _parse_response(self, response: str) -> CodebaseSummary:
        """Parse LLM response into structured summary."""
        # Clean response - remove markdown code blocks if present
        cleaned = response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        # Parse JSON
        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            raise ValueError(f"Failed to parse LLM response as JSON: {e}")

        # Validate and create Pydantic model
        return CodebaseSummary(
            project_type=data.get("project_type", "unknown"),
            primary_purpose=data.get(
                "primary_purpose", "Unable to determine project purpose."
            ),
            tech_stack=TechStackInfo(
                languages=data.get("tech_stack", {}).get("languages", []),
                frameworks=data.get("tech_stack", {}).get("frameworks", []),
                key_patterns=data.get("tech_stack", {}).get("key_patterns", []),
            ),
            architecture_summary=data.get(
                "architecture_summary", "Architecture summary unavailable."
            ),
            key_modules=[
                ModuleInfo(name=m["name"], purpose=m["purpose"])
                for m in data.get("key_modules", [])
            ],
            complexity_assessment=ComplexityInfo(
                level=data.get("complexity_assessment", {}).get("level", "moderate"),
                reasoning=data.get("complexity_assessment", {}).get(
                    "reasoning", "Unable to assess complexity."
                ),
            ),
            notable_aspects=data.get("notable_aspects", []),
        )

    def _generate_fallback_summary(
        self, file_count: int, language_distribution: dict, category_distribution: dict
    ) -> CodebaseSummary:
        """Generate minimal summary when LLM fails."""
        primary_lang = (
            max(language_distribution, key=language_distribution.get)
            if language_distribution
            else "unknown"
        )
        primary_category = (
            max(category_distribution, key=category_distribution.get)
            if category_distribution
            else "unknown"
        )

        return CodebaseSummary(
            project_type="unknown",
            primary_purpose=f"A {primary_lang} project with {file_count} analyzed files.",
            tech_stack=TechStackInfo(
                languages=list(language_distribution.keys()), frameworks=[], key_patterns=[]
            ),
            architecture_summary=f"Project organized with {primary_category} as the primary category.",
            key_modules=[],
            complexity_assessment=ComplexityInfo(
                level="moderate", reasoning="Unable to perform detailed analysis"
            ),
            notable_aspects=[],
        )


# Singleton
_generator: Optional[SummaryGenerator] = None


def get_summary_generator() -> SummaryGenerator:
    """Get or create the singleton SummaryGenerator instance."""
    global _generator
    if _generator is None:
        _generator = SummaryGenerator()
    return _generator
