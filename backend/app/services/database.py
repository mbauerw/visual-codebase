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
    FunctionTierItem,
    FunctionStats,
    FunctionCallInfo,
    TierListResponse,
    FunctionDetailResponse,
    FunctionType,
    TierLevel,
    CallType,
)


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
            "current_step": "Initializing",
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

    async def update_analysis_status(
        self,
        analysis_id: str,
        status: AnalysisStatus,
        current_step: str = "",
        total_files: int = 0,
        error_message: Optional[str] = None,
    ) -> None:
        """Update analysis status."""
        update_data = {
            "status": status.value,
            "current_step": current_step,
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
            current_step=data["current_step"],
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
            .select("analysis_id, directory_path, github_repo, status, file_count, edge_count, started_at, completed_at, user_title")
            .eq("user_id", user_id)
            .order("started_at", desc=True)
            .execute()
        )

        # Parse github_repo JSON strings if needed (Supabase may return as string)
        analyses = result.data or []
        for analysis in analyses:
            github_repo_data = analysis.get("github_repo")
            if github_repo_data and isinstance(github_repo_data, str):
                analysis["github_repo"] = json.loads(github_repo_data)

        return analyses

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

    # ==================== Function Tier List Methods ====================

    async def save_functions(
        self,
        analysis_id: str,
        tier_items: List[FunctionTierItem],
        language: str = "typescript",
    ) -> None:
        """Save function tier items to the database.

        Args:
            analysis_id: The analysis identifier
            tier_items: List of function tier items to save
            language: Primary language of the codebase
        """
        # Get the database analysis record
        analysis_result = (
            self.supabase.table("analyses")
            .select("id")
            .eq("analysis_id", analysis_id)
            .execute()
        )

        if not analysis_result.data:
            raise ValueError(f"Analysis {analysis_id} not found")

        db_analysis_id = analysis_result.data[0]["id"]

        # Prepare function records
        function_data = []
        for item in tier_items:
            function_data.append({
                "analysis_id": db_analysis_id,
                "node_id": item.node_id,
                "function_name": item.function_name,
                "qualified_name": item.qualified_name,
                "function_type": item.function_type.value,
                "start_line": item.start_line,
                "end_line": item.end_line,
                "internal_call_count": item.internal_call_count,
                "external_call_count": item.external_call_count,
                "is_exported": item.is_exported,
                "is_entry_point": item.is_entry_point,
                "tier": item.tier.value,
                "tier_percentile": item.tier_percentile,
                "language": language,
                "is_async": item.is_async,
                "parameters_count": item.parameters_count,
            })

        # Insert in batches
        if function_data:
            batch_size = 100
            for i in range(0, len(function_data), batch_size):
                batch = function_data[i:i + batch_size]
                self.supabase.table("analysis_functions").insert(batch).execute()

        # Update function count in analyses table
        self.supabase.table("analyses").update({
            "function_count": len(tier_items),
        }).eq("analysis_id", analysis_id).execute()

    async def save_function_calls(
        self,
        analysis_id: str,
        calls: List[FunctionCallInfo],
    ) -> None:
        """Save function call graph to the database.

        Args:
            analysis_id: The analysis identifier
            calls: List of function calls
        """
        # Get the database analysis record
        analysis_result = (
            self.supabase.table("analyses")
            .select("id")
            .eq("analysis_id", analysis_id)
            .execute()
        )

        if not analysis_result.data:
            raise ValueError(f"Analysis {analysis_id} not found")

        db_analysis_id = analysis_result.data[0]["id"]

        # Prepare call records
        call_data = []
        for call in calls:
            if call.resolved_target:  # Only save resolved calls
                call_data.append({
                    "analysis_id": db_analysis_id,
                    "caller_node_id": call.source_file,
                    "call_line": call.line_number,
                    "callee_qualified_name": call.qualified_name or call.callee_name,
                    "callee_node_id": call.resolved_target,
                    "call_type": call.call_type.value,
                })

        # Insert in batches
        if call_data:
            batch_size = 100
            for i in range(0, len(call_data), batch_size):
                batch = call_data[i:i + batch_size]
                self.supabase.table("analysis_function_calls").insert(batch).execute()

        # Update call count in analyses table
        self.supabase.table("analyses").update({
            "function_call_count": len(calls),
        }).eq("analysis_id", analysis_id).execute()

    async def get_tier_list(
        self,
        analysis_id: str,
        user_id: str,
        tier: Optional[str] = None,
        file_filter: Optional[str] = None,
        function_type: Optional[str] = None,
        search: Optional[str] = None,
        sort_by: str = "call_count",
        sort_order: str = "desc",
        page: int = 1,
        per_page: int = 50,
    ) -> Optional[TierListResponse]:
        """Get paginated tier list with filtering.

        Args:
            analysis_id: The analysis identifier
            user_id: User ID for ownership verification
            tier: Filter by tier (S/A/B/C/D/F)
            file_filter: Filter by file path (partial match)
            function_type: Filter by function type
            search: Search function names
            sort_by: Sort field (call_count, name, file, tier)
            sort_order: Sort order (asc, desc)
            page: Page number
            per_page: Items per page (max 100)

        Returns:
            TierListResponse with paginated functions
        """
        # Verify ownership and get DB analysis ID
        analysis_result = (
            self.supabase.table("analyses")
            .select("id, function_count")
            .eq("analysis_id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not analysis_result.data:
            return None

        db_analysis_id = analysis_result.data[0]["id"]
        total_functions = analysis_result.data[0].get("function_count", 0)

        # Build query
        query = (
            self.supabase.table("analysis_functions")
            .select("*", count="exact")
            .eq("analysis_id", db_analysis_id)
        )

        # Apply filters
        if tier:
            query = query.eq("tier", tier)
        if file_filter:
            query = query.ilike("node_id", f"%{file_filter}%")
        if function_type:
            query = query.eq("function_type", function_type)
        if search:
            query = query.ilike("function_name", f"%{search}%")

        # Apply sorting
        sort_column = {
            "call_count": "internal_call_count",
            "name": "function_name",
            "file": "node_id",
            "tier": "tier_percentile",
        }.get(sort_by, "internal_call_count")

        is_desc = sort_order.lower() == "desc"
        query = query.order(sort_column, desc=is_desc)

        # Apply pagination
        per_page = min(per_page, 100)
        offset = (page - 1) * per_page
        query = query.range(offset, offset + per_page - 1)

        result = query.execute()

        # Get tier summary
        tier_summary = await self._get_tier_summary(db_analysis_id)

        # Get node_id -> file path mapping from analysis_nodes
        node_ids = [row["node_id"] for row in result.data]
        node_path_map = {}
        if node_ids:
            nodes_result = (
                self.supabase.table("analysis_nodes")
                .select("node_id, path, name")
                .eq("analysis_id", db_analysis_id)
                .in_("node_id", node_ids)
                .execute()
            )
            node_path_map = {
                node["node_id"]: {"path": node["path"], "name": node["name"]}
                for node in nodes_result.data
            }

        # Convert to FunctionTierItem objects
        functions = []
        for row in result.data:
            node_id = row["node_id"]
            node_info = node_path_map.get(node_id, {})
            file_path = node_info.get("path", node_id)
            file_name = node_info.get("name", file_path.split("/")[-1] if file_path else "")

            functions.append(FunctionTierItem(
                id=str(row["id"]),
                function_name=row["function_name"],
                qualified_name=row["qualified_name"],
                function_type=FunctionType(row["function_type"]),
                file_path=file_path,
                file_name=file_name,
                node_id=node_id,
                internal_call_count=row["internal_call_count"],
                external_call_count=row["external_call_count"],
                is_exported=row["is_exported"],
                is_entry_point=row["is_entry_point"],
                tier=TierLevel(row["tier"]),
                tier_percentile=row["tier_percentile"],
                start_line=row["start_line"],
                end_line=row["end_line"],
                is_async=row["is_async"],
                parameters_count=row["parameters_count"],
            ))

        # Calculate pagination info
        total_count = result.count if result.count else len(functions)
        total_pages = (total_count + per_page - 1) // per_page if per_page > 0 else 1

        return TierListResponse(
            analysis_id=analysis_id,
            total_functions=total_functions,
            tier_summary=tier_summary,
            functions=functions,
            page=page,
            per_page=per_page,
            total_pages=total_pages,
            has_next=page < total_pages,
        )

    async def _get_tier_summary(self, db_analysis_id: str) -> Dict[str, int]:
        """Get count of functions per tier."""
        result = (
            self.supabase.table("analysis_functions")
            .select("tier")
            .eq("analysis_id", db_analysis_id)
            .execute()
        )

        summary = {"S": 0, "A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
        for row in result.data:
            tier = row.get("tier")
            if tier in summary:
                summary[tier] += 1

        return summary

    async def get_function_detail(
        self,
        analysis_id: str,
        function_id: str,
        user_id: str,
    ) -> Optional[FunctionDetailResponse]:
        """Get detailed information about a single function.

        Args:
            analysis_id: The analysis identifier
            function_id: The function UUID
            user_id: User ID for ownership verification

        Returns:
            FunctionDetailResponse with function details and call info
        """
        # Verify ownership
        analysis_result = (
            self.supabase.table("analyses")
            .select("id")
            .eq("analysis_id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not analysis_result.data:
            return None

        db_analysis_id = analysis_result.data[0]["id"]

        # Get function
        func_result = (
            self.supabase.table("analysis_functions")
            .select("*")
            .eq("analysis_id", db_analysis_id)
            .eq("id", function_id)
            .execute()
        )

        if not func_result.data:
            return None

        row = func_result.data[0]
        node_id = row["node_id"]

        # Get file path from analysis_nodes
        node_result = (
            self.supabase.table("analysis_nodes")
            .select("path, name")
            .eq("analysis_id", db_analysis_id)
            .eq("node_id", node_id)
            .execute()
        )
        if node_result.data:
            file_path = node_result.data[0]["path"]
            file_name = node_result.data[0]["name"]
        else:
            file_path = node_id
            file_name = node_id.split("/")[-1] if node_id else ""

        function = FunctionTierItem(
            id=str(row["id"]),
            function_name=row["function_name"],
            qualified_name=row["qualified_name"],
            function_type=FunctionType(row["function_type"]),
            file_path=file_path,
            file_name=file_name,
            node_id=node_id,
            internal_call_count=row["internal_call_count"],
            external_call_count=row["external_call_count"],
            is_exported=row["is_exported"],
            is_entry_point=row["is_entry_point"],
            tier=TierLevel(row["tier"]),
            tier_percentile=row["tier_percentile"],
            start_line=row["start_line"],
            end_line=row["end_line"],
            is_async=row["is_async"],
            parameters_count=row["parameters_count"],
        )

        # Get callers (functions that call this function)
        callers_result = (
            self.supabase.table("analysis_function_calls")
            .select("caller_node_id, call_line, call_type")
            .eq("analysis_id", db_analysis_id)
            .eq("callee_qualified_name", row["qualified_name"])
            .limit(10)
            .execute()
        )

        callers = [
            {
                "file": c["caller_node_id"],
                "line": c["call_line"],
                "call_type": c["call_type"],
            }
            for c in callers_result.data
        ]

        # Get callees (functions called by this function)
        callees_result = (
            self.supabase.table("analysis_function_calls")
            .select("callee_qualified_name, callee_node_id, call_line, call_type")
            .eq("analysis_id", db_analysis_id)
            .eq("caller_node_id", row["node_id"])
            .limit(10)
            .execute()
        )

        callees = [
            {
                "name": c["callee_qualified_name"],
                "file": c["callee_node_id"],
                "line": c["call_line"],
                "call_type": c["call_type"],
            }
            for c in callees_result.data
        ]

        # Get total counts
        caller_count_result = (
            self.supabase.table("analysis_function_calls")
            .select("id", count="exact")
            .eq("analysis_id", db_analysis_id)
            .eq("callee_qualified_name", row["qualified_name"])
            .execute()
        )

        callee_count_result = (
            self.supabase.table("analysis_function_calls")
            .select("id", count="exact")
            .eq("analysis_id", db_analysis_id)
            .eq("caller_node_id", row["node_id"])
            .execute()
        )

        return FunctionDetailResponse(
            function=function,
            callers=callers,
            callees=callees,
            caller_count=caller_count_result.count or 0,
            callee_count=callee_count_result.count or 0,
        )

    async def get_function_stats(
        self,
        analysis_id: str,
        user_id: str,
    ) -> Optional[FunctionStats]:
        """Get aggregate statistics for function analysis.

        Args:
            analysis_id: The analysis identifier
            user_id: User ID for ownership verification

        Returns:
            FunctionStats with aggregate data
        """
        # Verify ownership
        analysis_result = (
            self.supabase.table("analyses")
            .select("id, function_count, function_call_count")
            .eq("analysis_id", analysis_id)
            .eq("user_id", user_id)
            .execute()
        )

        if not analysis_result.data:
            return None

        data = analysis_result.data[0]
        db_analysis_id = data["id"]

        # Get tier counts
        tier_summary = await self._get_tier_summary(db_analysis_id)

        # Get top functions
        top_result = (
            self.supabase.table("analysis_functions")
            .select("function_name")
            .eq("analysis_id", db_analysis_id)
            .order("internal_call_count", desc=True)
            .limit(5)
            .execute()
        )

        top_functions = [row["function_name"] for row in top_result.data]

        return FunctionStats(
            total_functions=data.get("function_count", 0),
            total_calls=data.get("function_call_count", 0),
            tier_counts=tier_summary,
            top_functions=top_functions,
        )


# Singleton instance
_database_service: Optional[DatabaseService] = None


def get_database_service() -> DatabaseService:
    """Get or create the database service instance."""
    global _database_service
    if _database_service is None:
        _database_service = DatabaseService()
    return _database_service