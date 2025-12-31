"""Analysis orchestration service."""
import os
import time
import uuid
from datetime import datetime
from typing import Optional

from ..models.schemas import (
    AnalysisMetadata,
    AnalysisResult,
    AnalysisStatus,
    AnalysisStatusResponse,
    ReactFlowGraph,
    Language,
)
from .graph_builder import get_graph_builder
from .llm_analyzer import get_llm_analyzer
from .parser import get_parser


class AnalysisJob:
    """Represents an analysis job with its state."""

    def __init__(self, analysis_id: str, directory_path: str):
        self.analysis_id = analysis_id
        self.directory_path = directory_path
        self.status = AnalysisStatus.PENDING
        self.current_step = "Initializing"
        self.total_files = 0
        self.error: Optional[str] = None
        self.result: Optional[ReactFlowGraph] = None
        self.started_at = datetime.utcnow()
        self.completed_at: Optional[datetime] = None


class AnalysisService:
    """Service for orchestrating codebase analysis."""

    def __init__(self):
        """Initialize the analysis service."""
        self._jobs: dict[str, AnalysisJob] = {}
        self._parser = get_parser()
        self._llm_analyzer = get_llm_analyzer()
        self._graph_builder = get_graph_builder()

    def create_job(self, directory_path: str) -> str:
        """Create a new analysis job."""
        analysis_id = str(uuid.uuid4())
        job = AnalysisJob(analysis_id, directory_path)
        self._jobs[analysis_id] = job
        return analysis_id

    def get_job(self, analysis_id: str) -> Optional[AnalysisJob]:
        """Get an analysis job by ID."""
        return self._jobs.get(analysis_id)

    def get_status(self, analysis_id: str) -> Optional[AnalysisStatusResponse]:
        """Get the status of an analysis job."""
        job = self.get_job(analysis_id)
        if not job:
            return None

        return AnalysisStatusResponse(
            analysis_id=job.analysis_id,
            status=job.status,
            current_step=job.current_step,
            total_files=job.total_files,
            error=job.error,
        )

    def get_result(self, analysis_id: str) -> Optional[ReactFlowGraph]:
        """Get the result of a completed analysis."""
        job = self.get_job(analysis_id)
        if not job or job.status != AnalysisStatus.COMPLETED:
            return None
        return job.result

    async def run_analysis(
        self,
        analysis_id: str,
        include_node_modules: bool = False,
        max_depth: Optional[int] = None,
        user_id: Optional[str] = None,
        is_github_analysis: bool = False,
    ) -> None:
        """Run the complete analysis pipeline.

        Args:
            analysis_id: Unique analysis identifier
            include_node_modules: Whether to include node_modules in analysis
            max_depth: Maximum directory depth to traverse
            user_id: User ID for authenticated users (enables persistence)
            is_github_analysis: If True, store file contents (GitHub repos are deleted after analysis)
        """
        job = self.get_job(analysis_id)
        if not job:
            return

        start_time = time.time()

        # Get database service if user is authenticated
        db_service = None
        if user_id:
            from .database import get_database_service
            db_service = get_database_service()

        try:
            # Validate directory exists
            if not os.path.isdir(job.directory_path):
                raise ValueError(f"Directory does not exist: {job.directory_path}")

            # Step 1: Parse files
            job.status = AnalysisStatus.PARSING
            job.current_step = "Scanning and parsing files..."

            # For GitHub analyses, include file content for storage (repo is deleted after)
            parsed_files = self._parser.parse_directory(
                job.directory_path,
                include_node_modules,
                max_depth,
                include_content=is_github_analysis,
            )

            job.total_files = len(parsed_files)
            job.current_step = f"Found {len(parsed_files)} files"

            if not parsed_files:
                raise ValueError("No supported files found in directory")

            # Step 2: LLM Analysis
            job.status = AnalysisStatus.ANALYZING
            job.current_step = "AI is analyzing your code..."

            llm_analysis = await self._llm_analyzer.analyze_files(
                parsed_files, job.directory_path
            )

            # Step 3: Build Graph
            job.status = AnalysisStatus.BUILDING_GRAPH
            job.current_step = "Building dependency graph..."

            # Count languages
            language_counts: dict[str, int] = {}
            for pf in parsed_files:
                lang = pf.language.value
                language_counts[lang] = language_counts.get(lang, 0) + 1

            nodes, edges = self._graph_builder.build_graph(
                parsed_files,
                llm_analysis,
                job.directory_path,
                None,  # metadata will be created below
            )

            # Step 4: Generate codebase summary
            job.status = AnalysisStatus.GENERATING_SUMMARY
            job.current_step = "Generating codebase summary..."

            # Generate summary
            from .summary_generator import get_summary_generator
            summary_generator = get_summary_generator()
            summary, readme_detected = await summary_generator.generate_summary(
                directory_path=job.directory_path,
                nodes=nodes,
                edges=edges,
                language_distribution=language_counts,
            )

            # Create metadata
            analysis_time = time.time() - start_time
            metadata = AnalysisMetadata(
                analysis_id=analysis_id,
                directory_path=job.directory_path,
                file_count=len(nodes),
                edge_count=len(edges),
                analysis_time_seconds=round(analysis_time, 2),
                started_at=job.started_at,
                completed_at=datetime.utcnow(),
                languages=language_counts,
                errors=[],
                summary=summary,
                readme_detected=readme_detected,
            )

            # Convert to React Flow format
            job.result = self._graph_builder.to_react_flow_format(
                nodes, edges, metadata
            )

            # Mark as completed
            job.status = AnalysisStatus.COMPLETED
            job.current_step = "Analysis complete"
            job.completed_at = datetime.utcnow()

            # Store complete results in database if user is authenticated
            if db_service:
                await db_service.complete_analysis(
                    analysis_id,
                    metadata,
                    nodes,
                    edges,
                    parsed_files if is_github_analysis else None,
                )

        except Exception as e:
            job.status = AnalysisStatus.FAILED
            job.error = str(e)
            job.current_step = "Analysis failed"
            print(f"Analysis failed: {e}")
            raise


# Singleton instance
_service: Optional[AnalysisService] = None


def get_analysis_service() -> AnalysisService:
    """Get or create the analysis service instance."""
    global _service
    if _service is None:
        _service = AnalysisService()
    return _service
