"""Database service for storing analysis data in Supabase."""
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID

from ..config.supabase import get_supabase_admin_client
from ..models.schemas import (
    AnalysisResult,
    AnalysisMetadata,
    ReactFlowGraph,
    AnalysisStatus,
    AnalysisStatusResponse,
    FileNode,
    DependencyEdge,
    GitHubRepoInfo,
    ParsedFile,
)
from .analysis import PROGRESS_INIT


class DatabaseService:
    """Service for database operations."""

    def __init__(self):
        self.supabase = get_supabase_admin_client()

    async def create_analysis(
        self,
        analysis_id: str,
        user_id: str,
        directory_path: Optional[str] = None,
        github_repo: Optional[GitHubRepoInfo] = None,
    ) -> Dict[str, Any]:
        """Create a new analysis record."""
        analysis_data = {
            "analysis_id": analysis_id,
            "user_id": user_id,
            "directory_path": directory_path,
            "status": AnalysisStatus.PENDING.value,
            "progress": PROGRESS_INIT,  # Start with visible progress
            "current_step": "Initializing",
            "files_processed": 0,
            "total_files": 0,
        }

        # Add GitHub repository info if provided
        if github_repo:
            analysis_data["github_repo"] = {
                "owner": github_repo.owner,
                "repo": github_repo.repo,
                "branch": github_repo.branch,
                "path": github_repo.path,
            }

        result = self.supabase.table("analyses").insert(analysis_data).execute()
        return result.data[0] if result.data else {}

    async def update_analysis_progress(
        self,
        analysis_id: str,
        status: AnalysisStatus,
        progress: float = 0.0,
        current_step: str = "",
        files_processed: int = 0,
        total_files: int = 0,
        error_message: Optional[str] = None,
    ) -> None:
        """Update analysis progress."""
        update_data = {
            "status": status.value,
            "progress": progress,
            "current_step": current_step,
            "files_processed": files_processed,
            "total_files": total_files,
            "updated_at": datetime.utcnow().isoformat(),
        }

        if error_message:
            update_data["error_message"] = error_message

        self.supabase.table("analyses").update(update_data).eq(
            "analysis_id", analysis_id
        ).execute()

    async def complete_analysis(
        self,
        analysis_id: str,
        metadata: AnalysisMetadata,
        nodes: List[FileNode],
        edges: List[DependencyEdge],
        parsed_files: Optional[List[ParsedFile]] = None,
    ) -> None:
        """Complete an analysis and store all results.

        Args:
            analysis_id: The analysis identifier
            metadata: Analysis metadata
            nodes: Graph nodes (files)
            edges: Graph edges (dependencies)
            parsed_files: Optional parsed files with content (for GitHub analyses)
        """
        # Update analysis metadata
        analysis_update = {
            "status": AnalysisStatus.COMPLETED.value,
            "progress": 100.0,
            "current_step": "Analysis complete",
            "file_count": metadata.file_count,
            "edge_count": metadata.edge_count,
            "analysis_time_seconds": metadata.analysis_time_seconds,
            "languages": metadata.languages,
            "errors": metadata.errors,
            "summary": metadata.summary.model_dump() if metadata.summary else None,
            "readme_detected": metadata.readme_detected,
            "summary_generated_at": datetime.utcnow().isoformat() if metadata.summary else None,
            "completed_at": metadata.completed_at.isoformat() if metadata.completed_at else None,
            "updated_at": datetime.utcnow().isoformat(),
        }

        # Get the database analysis record to get the UUID
        analysis_result = (
            self.supabase.table("analyses")
            .select("id")
            .eq("analysis_id", analysis_id)
            .execute()
        )

        if not analysis_result.data:
            raise ValueError(f"Analysis {analysis_id} not found")

        db_analysis_id = analysis_result.data[0]["id"]

        # Update analysis
        self.supabase.table("analyses").update(analysis_update).eq(
            "analysis_id", analysis_id
        ).execute()

        # Store nodes
        node_data = []
        for node in nodes:
            node_record = {
                "analysis_id": db_analysis_id,
                "node_id": node.id,
                "path": node.path,
                "name": node.name,
                "folder": node.folder,
                "language": node.language.value,
                "role": node.role.value,
                "description": node.description,
                "category": node.category.value,
                "imports": node.imports,
                "size_bytes": node.size_bytes,
                "line_count": node.line_count,
            }
            node_data.append(node_record)

        if node_data:
            self.supabase.table("analysis_nodes").insert(node_data).execute()

        # Store edges
        edge_data = []
        for edge in edges:
            edge_record = {
                "analysis_id": db_analysis_id,
                "edge_id": edge.id,
                "source_node_id": edge.source,
                "target_node_id": edge.target,
                "import_type": edge.import_type.value,
                "label": edge.label,
            }
            edge_data.append(edge_record)

        if edge_data:
            self.supabase.table("analysis_edges").insert(edge_data).execute()

        # Store file contents for GitHub analyses (source code viewer)
        if parsed_files:
            # Create a map of relative_path to content for quick lookup
            content_map = {
                pf.relative_path: pf.content
                for pf in parsed_files
                if pf.content is not None
            }

            # Store contents linked to nodes
            content_data = []
            for node in nodes:
                # Look up content by relative path (node.path), but store with node.id (hash)
                content = content_map.get(node.path)
                if content:
                    content_data.append({
                        "analysis_id": db_analysis_id,
                        "node_id": node.id,
                        "content": content,
                    })

            if content_data:
                # Insert in batches to avoid hitting request size limits
                batch_size = 50
                for i in range(0, len(content_data), batch_size):
                    batch = content_data[i:i + batch_size]
                    self.supabase.table("analysis_file_contents").insert(batch).execute()

    async def get_analysis_status(self, analysis_id: str) -> Optional[AnalysisStatusResponse]:
        """Get analysis status from database."""
        result = (
            self.supabase.table("analyses")
            .select("*")
            .eq("analysis_id", analysis_id)
            .execute()
        )

        if not result.data:
            return None

        data = result.data[0]
        return AnalysisStatusResponse(
            analysis_id=data["analysis_id"],
            status=AnalysisStatus(data["status"]),
            progress=data["progress"],
            current_step=data["current_step"],
            files_processed=data["files_processed"],
            total_files=data["total_files"],
            error=data.get("error_message"),
        )

    async def get_analysis_result(self, analysis_id: str) -> Optional[ReactFlowGraph]:
        """Get complete analysis result from database."""
        # Get analysis metadata
        analysis_result = (
            self.supabase.table("analyses")
            .select("*")
            .eq("analysis_id", analysis_id)
            .execute()
        )

        if not analysis_result.data:
            return None

        analysis_data = analysis_result.data[0]
        db_analysis_id = analysis_data["id"]

        # Check if completed
        if analysis_data["status"] != AnalysisStatus.COMPLETED.value:
            return None

        # Get nodes
        nodes_result = (
            self.supabase.table("analysis_nodes")
            .select("*")
            .eq("analysis_id", db_analysis_id)
            .execute()
        )

        # Get edges
        edges_result = (
            self.supabase.table("analysis_edges")
            .select("*")
            .eq("analysis_id", db_analysis_id)
            .execute()
        )

        # Convert to ReactFlow format
        from ..services.graph_builder import get_graph_builder
        graph_builder = get_graph_builder()

        # Create metadata
        github_repo_data = analysis_data.get("github_repo")
        # Parse JSON string if needed (Supabase may return as string)
        if github_repo_data and isinstance(github_repo_data, str):
            github_repo_data = json.loads(github_repo_data)
        github_repo = None
        if github_repo_data:
            github_repo = GitHubRepoInfo(
                owner=github_repo_data["owner"],
                repo=github_repo_data["repo"],
                branch=github_repo_data.get("branch"),
                path=github_repo_data.get("path"),
            )

        # Parse summary if present
        summary = None
        summary_data = analysis_data.get("summary")
        if summary_data:
            # Parse JSON string if needed
            if isinstance(summary_data, str):
                summary_data = json.loads(summary_data)
            from ..models.schemas import CodebaseSummary
            summary = CodebaseSummary(**summary_data)

        metadata = AnalysisMetadata(
            analysis_id=analysis_data["analysis_id"],
            directory_path=analysis_data["directory_path"],
            github_repo=github_repo,
            file_count=analysis_data["file_count"],
            edge_count=analysis_data["edge_count"],
            analysis_time_seconds=analysis_data["analysis_time_seconds"],
            started_at=datetime.fromisoformat(analysis_data["started_at"].replace("Z", "+00:00")),
            completed_at=datetime.fromisoformat(analysis_data["completed_at"].replace("Z", "+00:00")) if analysis_data["completed_at"] else None,
            languages=analysis_data["languages"] or {},
            errors=analysis_data["errors"] or [],
            summary=summary,
            readme_detected=analysis_data.get("readme_detected", False),
        )

        # Convert database records back to domain objects
        nodes = []
        for node_data in nodes_result.data:
            from ..models.schemas import Language, ArchitecturalRole, Category
            node = FileNode(
                id=node_data["node_id"],
                path=node_data["path"],
                name=node_data["name"],
                folder=node_data["folder"],
                language=Language(node_data["language"]),
                role=ArchitecturalRole(node_data["role"]),
                description=node_data["description"],
                category=Category(node_data["category"]),
                imports=node_data["imports"] or [],
                size_bytes=node_data["size_bytes"],
                line_count=node_data["line_count"],
            )
            nodes.append(node)

        edges = []
        for edge_data in edges_result.data:
            from ..models.schemas import ImportType
            edge = DependencyEdge(
                id=edge_data["edge_id"],
                source=edge_data["source_node_id"],
                target=edge_data["target_node_id"],
                import_type=ImportType(edge_data["import_type"]),
                label=edge_data["label"],
            )
            edges.append(edge)

        # Convert to React Flow format
        return graph_builder.to_react_flow_format(nodes, edges, metadata)

    async def get_user_analyses(self, user_id: str) -> List[Dict[str, Any]]:
        """Get all analyses for a user."""
        result = (
            self.supabase.table("analyses")
            .select("analysis_id, directory_path, github_repo, status, progress, file_count, edge_count, started_at, completed_at, user_title")
            .eq("user_id", user_id)
            .order("started_at", desc=True)
            .execute()
        )

        return result.data or []

    async def update_analysis_title(
        self,
        analysis_id: str,
        user_id: str,
        user_title: Optional[str],
    ) -> bool:
        """Update the user-defined title for an analysis."""
        # Verify ownership first
        analysis_result = (
            self.supabase.table("analyses")
            .select("id")
            .eq("analysis_id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not analysis_result.data:
            return False

        # Update the title
        self.supabase.table("analyses").update({
            "user_title": user_title,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("analysis_id", analysis_id).execute()

        return True

    async def get_file_content(
        self,
        analysis_id: str,
        node_id: str,
        user_id: str,
    ) -> Optional[Dict[str, Any]]:
        """Get file content for a specific node in an analysis.

        Args:
            analysis_id: The analysis identifier
            node_id: The node identifier (relative file path)
            user_id: The user ID (for ownership verification)

        Returns:
            Dict with 'content' and 'source' keys, or None if not found
        """
        # First verify the user owns this analysis and get the DB analysis ID
        analysis_result = (
            self.supabase.table("analyses")
            .select("id, github_repo, directory_path")
            .eq("analysis_id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not analysis_result.data:
            return None

        analysis_data = analysis_result.data[0]
        db_analysis_id = analysis_data["id"]
        is_github = analysis_data.get("github_repo") is not None

        # Try to get content from database (stored for GitHub analyses)
        content_result = (
            self.supabase.table("analysis_file_contents")
            .select("content")
            .eq("analysis_id", db_analysis_id)
            .eq("node_id", node_id)
            .execute()
        )

        if content_result.data:
            return {
                "content": content_result.data[0]["content"],
                "source": "database",
                "available": True,
            }

        # For local analyses, content is not stored - need to get the actual file path
        if not is_github:
            # Look up the node's actual path from analysis_nodes table
            # node_id is a hash, we need the relative path
            node_result = (
                self.supabase.table("analysis_nodes")
                .select("path")
                .eq("analysis_id", db_analysis_id)
                .eq("node_id", node_id)
                .execute()
            )

            file_path = None
            if node_result.data:
                file_path = node_result.data[0]["path"]

            return {
                "content": None,
                "source": "filesystem",
                "available": False,
                "directory_path": analysis_data.get("directory_path"),
                "file_path": file_path,  # The actual relative path, not the hash
            }

        # GitHub analysis but content not found (shouldn't happen normally)
        return {
            "content": None,
            "source": "database",
            "available": False,
            "error": "Content not available",
        }

    async def delete_analysis(self, analysis_id: str, user_id: str) -> bool:
        """Delete an analysis and all related data."""
        # Verify ownership
        analysis_result = (
            self.supabase.table("analyses")
            .select("id")
            .eq("analysis_id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not analysis_result.data:
            return False

        # Delete analysis (cascading will handle nodes and edges)
        self.supabase.table("analyses").delete().eq("analysis_id", analysis_id).execute()
        return True


# Singleton instance
_database_service: Optional[DatabaseService] = None


def get_database_service() -> DatabaseService:
    """Get or create the database service instance."""
    global _database_service
    if _database_service is None:
        _database_service = DatabaseService()
    return _database_service