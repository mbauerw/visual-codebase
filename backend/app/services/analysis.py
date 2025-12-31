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
        self.progress = 5.0  # Start at 5% to show immediate activity
        self.current_step = "Initializing"
        self.files_processed = 0
        self.total_files = 0
        self.error: Optional[str] = None
        self.result: Optional[ReactFlowGraph] = None
        self.started_at = datetime.utcnow()
        self.completed_at: Optional[datetime] = None


# Progress allocation constants (should sum to ~100)
# These define what percentage of the bar each phase occupies
PROGRESS_INIT = 5.0           # 0-5%: Initialization
PROGRESS_CLONING_END = 40.0   # 5-40%: Cloning (GitHub only) - cosmetic fill over 20s
PROGRESS_PARSING_START = 40.0 # Start of parsing (same as cloning end)
PROGRESS_PARSING_END = 50.0   # 40-50%: Parsing files
PROGRESS_LLM_START = 50.0     # Start of LLM analysis
PROGRESS_LLM_END = 90.0       # 50-90%: LLM analysis (biggest phase - 40% of bar)
PROGRESS_GRAPH_END = 95.0     # 90-95%: Building graph
PROGRESS_COMPLETE = 100.0     # 95-100%: Summary generation

# Cloning animation settings
CLONING_DURATION_SECONDS = 20.0  # Time to fill cloning progress cosmetically
CLONING_UPDATE_INTERVAL = 0.5   # Update progress every 0.5 seconds


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
            job.current_step = "Scanning and parsing files"
            job.progress = PROGRESS_PARSING_START

            # Update database if user is authenticated
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step
                )

            # For GitHub analyses, include file content for storage (repo is deleted after)
            parsed_files = self._parser.parse_directory(
                job.directory_path,
                include_node_modules,
                max_depth,
                include_content=is_github_analysis,
            )

            job.total_files = len(parsed_files)
            job.progress = PROGRESS_PARSING_END
            job.current_step = f"Found {len(parsed_files)} files to analyze"

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
            job.progress = PROGRESS_LLM_START

            # Update database
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step,
                    job.files_processed, job.total_files
                )

            # Create progress callback for per-batch updates
            async def update_llm_progress(batch_num: int, total_batches: int, files_in_batch: int):
                """Update progress as each LLM batch completes."""
                # Calculate progress within LLM phase (25% to 85%)
                llm_progress_range = PROGRESS_LLM_END - PROGRESS_LLM_START
                batch_progress = (batch_num / total_batches) * llm_progress_range
                job.progress = PROGRESS_LLM_START + batch_progress
                job.files_processed = min(batch_num * 20, job.total_files)  # Approximate
                job.current_step = f"Analyzing files with AI ({batch_num}/{total_batches} batches)"

                if db_service:
                    await db_service.update_analysis_progress(
                        analysis_id, job.status, job.progress, job.current_step,
                        job.files_processed, job.total_files
                    )

            # Wrapper to make the sync callback work with async updates
            def sync_progress_callback(batch_num: int, total_batches: int, files_in_batch: int):
                asyncio.create_task(update_llm_progress(batch_num, total_batches, files_in_batch))

            llm_analysis = await self._llm_analyzer.analyze_files(
                parsed_files, job.directory_path, progress_callback=sync_progress_callback
            )

            job.progress = PROGRESS_LLM_END
            job.files_processed = len(parsed_files)
            job.current_step = "AI analysis complete"

            # Update database
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step,
                    job.files_processed, job.total_files
                )

            # Step 3: Build Graph
            job.status = AnalysisStatus.BUILDING_GRAPH
            job.current_step = "Building dependency graph"
            job.progress = PROGRESS_LLM_END + 2.0  # 87%

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

            # Step 4: Generate codebase summary
            job.status = AnalysisStatus.GENERATING_SUMMARY
            job.current_step = "Generating codebase summary"
            job.progress = PROGRESS_GRAPH_END

            # Update database
            if db_service:
                await db_service.update_analysis_progress(
                    analysis_id, job.status, job.progress, job.current_step,
                    job.files_processed, job.total_files
                )

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
            job.progress = PROGRESS_COMPLETE
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
