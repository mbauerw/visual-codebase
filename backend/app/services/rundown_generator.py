"""Codebase rundown generation service."""
import asyncio
import json
import re
from typing import Optional

import anthropic

from ..settings import get_settings
from ..models.schemas import (
    CodebaseRundown,
    RundownLayer,
    RundownEntryPoint,
    RundownFlowStep,
    RundownFlow,
    RundownCrossCutting,
    FileNode,
    DependencyEdge,
)

MAX_FILES_PER_ROLE = 5
MAX_DEPENDENCY_PAIRS = 20
MAX_ENTRY_POINTS = 5
MAX_LEAF_NODES = 10
MAX_RETRIES = 1
RETRY_DELAY = 2.0

RUNDOWN_SYSTEM_PROMPT = """You are a senior software architect analyzing a codebase dependency graph \
to produce "The Rundown" — a structured high-level flow analysis.

Your goal: Help a developer who just joined this project understand how \
the codebase is organized and how data/control flows through it.

RESPONSE FORMAT: Return ONLY a valid JSON object (no markdown, no explanation) \
with this exact structure:

{
  "layers": [
    {
      "id": "<snake_case_unique_id>",
      "label": "<Human Readable Name>",
      "description": "<1-2 sentences explaining what this layer does>",
      "order": <integer, 0 = topmost entry layer, increasing downward>,
      "roles": ["<architectural_role_1>", "<architectural_role_2>"],
      "key_files": ["<path/to/file1>", "<path/to/file2>"]
    }
  ],
  "entry_points": [
    {
      "file_path": "<exact path from input data>",
      "description": "<what this entry point handles>",
      "starts_flow": "<flow_id it initiates>"
    }
  ],
  "flows": [
    {
      "id": "<snake_case_flow_id>",
      "name": "<Human Readable Flow Name>",
      "description": "<1 sentence summary>",
      "steps": [
        {
          "layer_id": "<must match a layer id>",
          "action": "<what happens at this layer in this flow>",
          "key_files": ["<path/to/relevant_file>"]
        }
      ]
    }
  ],
  "cross_cutting": [
    {
      "name": "<Concern Name>",
      "description": "<what this concern handles>",
      "files": ["<path/to/file>"]
    }
  ],
  "narrative": "<3-6 paragraph walkthrough>"
}

CONSTRAINTS:
- Layers: 3-7 layers ordered top-to-bottom. Group related roles into \
single layers (e.g., hooks+context = "State Management"). Not every \
role needs its own layer.
- Flows: 1-3 primary flows showing the most important data/control paths. \
Each flow must reference only layer IDs that exist in the layers array.
- Entry points: 1-5 entry points. Use exact file paths from the input.
- Cross-cutting: 0-4 concerns (config, logging, auth, etc.). Omit if none.
- Narrative: Written as a senior engineer explaining architecture to a new \
team member. Reference specific layers and files. Minimum 200 words.
- ALL file paths in the output must appear exactly as provided in the input.
- ALL layer_id references in flows must match an id in the layers array."""


class RundownGenerator:
    """Service for generating codebase rundowns using Claude."""

    def __init__(self):
        self.settings = get_settings()
        self.client = anthropic.AsyncAnthropic(api_key=self.settings.anthropic_api_key)

    async def generate_rundown(
        self,
        nodes: list[FileNode],
        edges: list[DependencyEdge],
        language_distribution: dict[str, int],
    ) -> Optional[CodebaseRundown]:
        """Generate an architectural rundown of the codebase.

        Args:
            nodes: List of file nodes from analysis
            edges: List of dependency edges
            language_distribution: Count of files per language

        Returns:
            CodebaseRundown or None if generation fails or is skipped
        """
        if len(nodes) < self.settings.rundown_min_files:
            return None

        try:
            prompt = self._build_prompt(nodes, edges, language_distribution)
            response_text = await self._call_llm_with_retry(
                RUNDOWN_SYSTEM_PROMPT, prompt
            )
            rundown = self._parse_response(response_text)
            valid_paths = {node.path for node in nodes}
            rundown = self._sanitize_file_paths(rundown, valid_paths)
            return rundown
        except Exception as e:
            print(f"Rundown generation failed: {e}")
            return None

    def _compute_role_groups(
        self,
        nodes: list[FileNode],
        edges: list[DependencyEdge],
    ) -> dict:
        """Group nodes by architectural role with edge statistics."""
        # Build node-level edge counts
        incoming_by_node: dict[str, int] = {}
        outgoing_by_node: dict[str, int] = {}
        for edge in edges:
            outgoing_by_node[edge.source] = outgoing_by_node.get(edge.source, 0) + 1
            incoming_by_node[edge.target] = incoming_by_node.get(edge.target, 0) + 1

        # Group by role
        role_groups: dict[str, dict] = {}
        for node in nodes:
            role = node.role.value
            if role not in role_groups:
                role_groups[role] = {
                    "file_count": 0,
                    "key_files": [],
                    "total_incoming_edges": 0,
                    "total_outgoing_edges": 0,
                }
            group = role_groups[role]
            group["file_count"] += 1
            if len(group["key_files"]) < MAX_FILES_PER_ROLE:
                group["key_files"].append(node.path)
            group["total_incoming_edges"] += incoming_by_node.get(node.id, 0)
            group["total_outgoing_edges"] += outgoing_by_node.get(node.id, 0)

        return role_groups

    def _compute_inter_role_matrix(
        self,
        nodes: list[FileNode],
        edges: list[DependencyEdge],
    ) -> list[dict]:
        """Build inter-role dependency matrix."""
        node_id_to_role = {node.id: node.role.value for node in nodes}

        matrix: dict[tuple[str, str], int] = {}
        for edge in edges:
            source_role = node_id_to_role.get(edge.source)
            target_role = node_id_to_role.get(edge.target)
            if source_role and target_role and source_role != target_role:
                key = (source_role, target_role)
                matrix[key] = matrix.get(key, 0) + 1

        # Sort by count and cap
        sorted_pairs = sorted(matrix.items(), key=lambda x: x[1], reverse=True)
        return [
            {"source_role": k[0], "target_role": k[1], "count": v}
            for k, v in sorted_pairs[:MAX_DEPENDENCY_PAIRS]
        ]

    def _identify_entry_points(
        self,
        nodes: list[FileNode],
        edges: list[DependencyEdge],
    ) -> list[dict]:
        """Identify entry points via structural analysis and heuristics."""
        incoming = set()
        outgoing_count: dict[str, int] = {}
        for edge in edges:
            incoming.add(edge.target)
            outgoing_count[edge.source] = outgoing_count.get(edge.source, 0) + 1

        node_map = {node.id: node for node in nodes}

        # Structural: no incoming edges
        structural = []
        for node in nodes:
            if node.id not in incoming:
                structural.append(node)

        # Heuristic patterns
        entry_patterns = [
            re.compile(r"^(main|Main)\.", re.IGNORECASE),
            re.compile(r"^App\.", re.IGNORECASE),
            re.compile(r"^index\.", re.IGNORECASE),
            re.compile(r"^server\.", re.IGNORECASE),
            re.compile(r"^__main__\."),
            re.compile(r"^Program\.", re.IGNORECASE),
        ]

        heuristic = []
        for node in nodes:
            name = node.name
            if any(p.match(name) for p in entry_patterns):
                heuristic.append(node)

        # Merge and deduplicate, heuristic first
        seen = set()
        result = []
        for node in heuristic:
            if node.id not in seen:
                seen.add(node.id)
                result.append({
                    "file_path": node.path,
                    "role": node.role.value,
                    "description": node.description,
                    "reason": "matches entry point pattern",
                    "outgoing_count": outgoing_count.get(node.id, 0),
                })
        # Then structural, sorted by outgoing count
        structural.sort(key=lambda n: outgoing_count.get(n.id, 0), reverse=True)
        for node in structural:
            if node.id not in seen:
                seen.add(node.id)
                result.append({
                    "file_path": node.path,
                    "role": node.role.value,
                    "description": node.description,
                    "reason": "no incoming dependencies",
                    "outgoing_count": outgoing_count.get(node.id, 0),
                })

        return result[:MAX_ENTRY_POINTS]

    def _identify_leaf_nodes(
        self,
        nodes: list[FileNode],
        edges: list[DependencyEdge],
    ) -> list[dict]:
        """Identify leaf nodes (no outgoing edges)."""
        outgoing = set()
        incoming_count: dict[str, int] = {}
        for edge in edges:
            outgoing.add(edge.source)
            incoming_count[edge.target] = incoming_count.get(edge.target, 0) + 1

        leaves = []
        for node in nodes:
            if node.id not in outgoing:
                leaves.append({
                    "file_path": node.path,
                    "role": node.role.value,
                    "incoming_count": incoming_count.get(node.id, 0),
                })

        leaves.sort(key=lambda x: x["incoming_count"], reverse=True)
        return leaves[:MAX_LEAF_NODES]

    def _build_prompt(
        self,
        nodes: list[FileNode],
        edges: list[DependencyEdge],
        language_distribution: dict[str, int],
    ) -> str:
        """Build the user prompt for rundown generation."""
        role_groups = self._compute_role_groups(nodes, edges)
        inter_role = self._compute_inter_role_matrix(nodes, edges)
        entry_points = self._identify_entry_points(nodes, edges)
        leaf_nodes = self._identify_leaf_nodes(nodes, edges)

        # Get top files by connectivity
        connection_count: dict[str, int] = {}
        for edge in edges:
            connection_count[edge.source] = connection_count.get(edge.source, 0) + 1
            connection_count[edge.target] = connection_count.get(edge.target, 0) + 1
        node_map = {node.id: node for node in nodes}
        sorted_ids = sorted(
            connection_count.keys(), key=lambda x: connection_count[x], reverse=True
        )[:10]
        top_files = [
            {
                "path": node_map[nid].path,
                "description": node_map[nid].description,
                "connections": connection_count[nid],
            }
            for nid in sorted_ids
            if nid in node_map
        ]

        sections = []

        # Header
        sections.append(
            f"# Codebase Analysis\n\n"
            f"Files: {len(nodes)} | Dependencies: {len(edges)}\n"
            f"Languages: {', '.join(f'{k} ({v})' for k, v in sorted(language_distribution.items(), key=lambda x: x[1], reverse=True))}"
        )

        # Role groups
        sections.append("\n## File Roles (grouped by architectural role):")
        for role, data in sorted(
            role_groups.items(), key=lambda x: x[1]["file_count"], reverse=True
        ):
            files_str = ", ".join(data["key_files"][:MAX_FILES_PER_ROLE])
            sections.append(
                f"- {role} ({data['file_count']} files): {files_str}\n"
                f"  Incoming deps: {data['total_incoming_edges']} | Outgoing deps: {data['total_outgoing_edges']}"
            )

        # Inter-role dependencies
        if inter_role:
            sections.append("\n## Dependency Flow Between Roles:")
            for pair in inter_role:
                sections.append(
                    f"{pair['source_role']} -> {pair['target_role']}: {pair['count']} edges"
                )

        # Entry points
        if entry_points:
            sections.append("\n## Entry Point Candidates:")
            for ep in entry_points:
                sections.append(
                    f"- {ep['file_path']} ({ep['role']}): {ep['description']}\n"
                    f"  Reason: {ep['reason']}"
                )

        # Leaf nodes
        if leaf_nodes:
            sections.append("\n## Leaf Files (no outgoing project dependencies):")
            for leaf in leaf_nodes:
                sections.append(
                    f"- {leaf['file_path']} ({leaf['role']}): {leaf['incoming_count']} dependents"
                )

        # Key files
        if top_files:
            sections.append("\n## Key Files (most connections):")
            for f in top_files:
                sections.append(
                    f"- {f['path']}: {f['connections']} connections - {f['description']}"
                )

        return "\n".join(sections)

    async def _call_llm_with_retry(
        self, system_prompt: str, user_prompt: str
    ) -> str:
        """Call Claude API with single retry on API errors."""
        last_error = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                message = await self.client.messages.create(
                    model=self.settings.llm_model,
                    max_tokens=self.settings.rundown_max_tokens,
                    system=system_prompt,
                    messages=[{"role": "user", "content": user_prompt}],
                )
                return message.content[0].text
            except anthropic.APIError as e:
                last_error = e
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(RETRY_DELAY * (attempt + 1))
        raise last_error

    def _parse_response(self, response_text: str) -> CodebaseRundown:
        """Parse LLM response into CodebaseRundown using multiple strategies."""
        text = response_text.strip()

        # Strategy 1: Direct parse
        data = self._try_parse_json(text)

        # Strategy 2: Strip ```json fences
        if data is None and text.startswith("```json"):
            stripped = text[7:]
            if stripped.endswith("```"):
                stripped = stripped[:-3]
            data = self._try_parse_json(stripped.strip())

        # Strategy 3: Strip generic ``` fences
        if data is None and text.startswith("```"):
            stripped = text[3:]
            if stripped.endswith("```"):
                stripped = stripped[:-3]
            data = self._try_parse_json(stripped.strip())

        # Strategy 4: Extract first { to last }
        if data is None:
            first_brace = text.find("{")
            last_brace = text.rfind("}")
            if first_brace != -1 and last_brace > first_brace:
                data = self._try_parse_json(text[first_brace : last_brace + 1])

        if data is None:
            raise ValueError("Failed to parse LLM response as JSON")

        # Build models
        layers = [
            RundownLayer(**layer_data) for layer_data in data.get("layers", [])
        ]
        entry_points = [
            RundownEntryPoint(**ep_data) for ep_data in data.get("entry_points", [])
        ]
        flows = []
        for flow_data in data.get("flows", []):
            steps = [
                RundownFlowStep(**step_data)
                for step_data in flow_data.get("steps", [])
            ]
            flows.append(
                RundownFlow(
                    id=flow_data.get("id", ""),
                    name=flow_data.get("name", ""),
                    description=flow_data.get("description", ""),
                    steps=steps,
                )
            )
        cross_cutting = [
            RundownCrossCutting(**cc_data)
            for cc_data in data.get("cross_cutting", [])
        ]
        narrative = data.get("narrative", "")

        if not layers:
            raise ValueError("Rundown must contain at least one layer")
        if not flows:
            raise ValueError("Rundown must contain at least one flow")

        return CodebaseRundown(
            layers=layers,
            entry_points=entry_points,
            flows=flows,
            cross_cutting=cross_cutting,
            narrative=narrative,
        )

    def _try_parse_json(self, text: str) -> Optional[dict]:
        """Attempt to parse JSON, returning None on failure."""
        try:
            result = json.loads(text)
            if isinstance(result, dict):
                return result
        except (json.JSONDecodeError, ValueError):
            pass
        return None

    def _sanitize_file_paths(
        self, rundown: CodebaseRundown, valid_paths: set[str]
    ) -> CodebaseRundown:
        """Remove file paths from rundown that don't exist in the analyzed nodes."""
        for layer in rundown.layers:
            layer.key_files = [p for p in layer.key_files if p in valid_paths]
        for ep in rundown.entry_points:
            if ep.file_path not in valid_paths:
                ep.file_path = ""
        for flow in rundown.flows:
            for step in flow.steps:
                step.key_files = [p for p in step.key_files if p in valid_paths]
        for cc in rundown.cross_cutting:
            cc.files = [p for p in cc.files if p in valid_paths]
        return rundown


# Singleton
_generator: Optional[RundownGenerator] = None


def get_rundown_generator() -> RundownGenerator:
    """Get or create the singleton RundownGenerator instance."""
    global _generator
    if _generator is None:
        _generator = RundownGenerator()
    return _generator
