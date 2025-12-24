"""Analysis orchestration service."""
import asyncio
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
        self.progress = 0.0
        self.current_step = "Initializing"
        self.files_processed = 0
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
            progress=job.progress,
            current_step=job.current_step,
            files_processed=job.files_processed,
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
    ) -> None:
        """Run the complete analysis pipeline."""
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
            job.current_step = "Scanning and parsing files"
            job.progress = 10.0

            # Update database if user is authenticated
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step
                )

            parsed_files = self._parser.parse_directory(
                job.directory_path, include_node_modules, max_depth
            )

            job.total_files = len(parsed_files)
            job.progress = 30.0

            # Update database
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step, 
                    job.files_processed, job.total_files
                )

            if not parsed_files:
                raise ValueError("No supported files found in directory")

            # Step 2: LLM Analysis
            job.status = AnalysisStatus.ANALYZING
            job.current_step = "Analyzing files with AI"
            job.progress = 40.0

            # Update database
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step, 
                    job.files_processed, job.total_files
                )

            llm_analysis = await self._llm_analyzer.analyze_files(
                parsed_files, job.directory_path
            )

            job.progress = 70.0
            job.files_processed = len(parsed_files)

            # Update database
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step, 
                    job.files_processed, job.total_files
                )

            # Step 3: Build Graph
            job.status = AnalysisStatus.BUILDING_GRAPH
            job.current_step = "Building dependency graph"
            job.progress = 80.0

            # Update database
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step, 
                    job.files_processed, job.total_files
                )

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
            )

            # Convert to React Flow format
            job.result = self._graph_builder.to_react_flow_format(
                nodes, edges, metadata
            )

            # Mark as completed
            job.status = AnalysisStatus.COMPLETED
            job.current_step = "Analysis complete"
            job.progress = 100.0
            job.completed_at = datetime.utcnow()

            # Store complete results in database if user is authenticated
            if db_service:
                await db_service.complete_analysis(
                    analysis_id, metadata, nodes, edges
                )

        except Exception as e:
            job.status = AnalysisStatus.FAILED
            job.error = str(e)
            job.current_step = "Analysis failed"
            
            # Update database with error if user is authenticated
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step,
                    job.files_processed, job.total_files, str(e)
                )
            
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
