"""Analysis orchestration service."""
import logging
import os
import time
import uuid
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)

from ..models.schemas import (
    AnalysisMetadata,
    AnalysisResult,
    AnalysisStatus,
    AnalysisStatusResponse,
    ReactFlowGraph,
    FunctionTierItem,
    FunctionStats,
    Language,
)
from .graph_builder import get_graph_builder
from .llm_analyzer import get_llm_analyzer
from .parser import get_parser
from .function_analyzer import get_function_analyzer
from .call_resolver import create_call_resolver
from .tier_calculator import create_tier_calculator
from .network_logger import log_parse, log_llm_analyze, log_build_graph, log_analyze_functions, log_generate_summary


# Progress percentages for each phase (reflecting actual time distribution)
PROGRESS_MAP = {
    AnalysisStatus.PENDING: 0,
    AnalysisStatus.CLONING: 5,       # Clone is fast
    AnalysisStatus.PARSING: 10,      # Parsing is quick
    AnalysisStatus.ANALYZING: 15,    # Start of LLM (main work starts here)
    AnalysisStatus.ANALYZING_FUNCTIONS: 75,  # After LLM
    AnalysisStatus.BUILDING_GRAPH: 85,
    AnalysisStatus.GENERATING_SUMMARY: 92,
    AnalysisStatus.COMPLETED: 100,
    AnalysisStatus.FAILED: 0,
}


class AnalysisJob:
    """Represents an analysis job with its state."""

    def __init__(self, analysis_id: str, directory_path: str):
        self.analysis_id = analysis_id
        self.directory_path = directory_path
        self.status = AnalysisStatus.PENDING
        self.current_step = "Initializing"
        self.total_files = 0
        self.progress = 0  # 0-100 percentage
        self.error: Optional[str] = None
        self.result: Optional[ReactFlowGraph] = None
        self.started_at = datetime.utcnow()
        self.completed_at: Optional[datetime] = None
        # Function tier list data
        self.function_tier_items: list[FunctionTierItem] = []
        self.function_stats: Optional[FunctionStats] = None

    def set_status(self, status: AnalysisStatus, step: str = "") -> None:
        """Update status and progress together."""
        old_status = self.status
        self.status = status
        self.progress = PROGRESS_MAP.get(status, self.progress)
        if step:
            self.current_step = step
        logger.info(f"[PHASE] {self.analysis_id}: {old_status} -> {status}, progress: {self.progress}, step: {step}")


class AnalysisService:
    """Service for orchestrating codebase analysis."""

    def __init__(self):
        """Initialize the analysis service."""
        self._jobs: dict[str, AnalysisJob] = {}
        self._parser = get_parser()
        self._llm_analyzer = get_llm_analyzer()
        self._graph_builder = get_graph_builder()
        self._function_analyzer = get_function_analyzer()

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
            progress=job.progress,
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
        logger.info(f"[DEBUG] run_analysis called for {analysis_id}, job found: {job is not None}")
        if not job:
            logger.error(f"[DEBUG] Job not found for {analysis_id}! Returning early.")
            return

        logger.info(f"[DEBUG] Job {analysis_id} current status: {job.status}, path: {job.directory_path}")
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
            job.set_status(AnalysisStatus.PARSING, "Scanning and parsing files...")
            parse_start = time.perf_counter()

            # Always include content for function analysis
            # For GitHub analyses, content is also needed for storage (repo is deleted after)
            parsed_files = self._parser.parse_directory(
                job.directory_path,
                include_node_modules,
                max_depth,
                include_content=True,
            )

            parse_duration = time.perf_counter() - parse_start
            log_parse(parse_duration, True, len(parsed_files))

            job.total_files = len(parsed_files)
            job.current_step = f"Found {len(parsed_files)} files"

            if not parsed_files:
                raise ValueError("No supported files found in directory")

            # Step 2: LLM Analysis (main work - takes longest)
            job.set_status(AnalysisStatus.ANALYZING, "AI is analyzing your code...")
            llm_start = time.perf_counter()
            batch_count = (len(parsed_files) + 19) // 20  # Ceiling division

            llm_analysis = await self._llm_analyzer.analyze_files(
                parsed_files, job.directory_path
            )

            llm_duration = time.perf_counter() - llm_start
            log_llm_analyze(llm_duration, True, len(parsed_files), batch_count)

            # Step 3: Build Graph
            job.set_status(AnalysisStatus.BUILDING_GRAPH, "Building dependency graph...")
            graph_start = time.perf_counter()

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

            graph_duration = time.perf_counter() - graph_start
            log_build_graph(graph_duration, True, len(nodes), len(edges))

            # Step 4: Analyze functions (requires file content)
            job.set_status(AnalysisStatus.ANALYZING_FUNCTIONS, "Analyzing function calls...")
            func_analysis_start = time.perf_counter()

            function_stats = None
            tier_items = []
            resolved_calls = []
            functions = []
            calls = []

            # Only run function analysis if we have file content
            files_with_content = [pf for pf in parsed_files if pf.content]
            if files_with_content:
                try:
                    # Extract functions and calls
                    functions, calls = self._function_analyzer.analyze(files_with_content)

                    if functions:
                        # Build node ID map from nodes
                        node_id_map = {node.path: node.id for node in nodes}

                        # Resolve calls to definitions
                        call_resolver = create_call_resolver(
                            files_with_content, functions, job.directory_path
                        )
                        resolved_calls = call_resolver.resolve_all(calls)

                        # Calculate tiers
                        tier_calculator = create_tier_calculator(job.directory_path)
                        tier_items, function_stats = tier_calculator.classify(
                            functions, resolved_calls, node_id_map
                        )

                        job.function_tier_items = tier_items
                        job.function_stats = function_stats
                        job.current_step = f"Found {len(functions)} functions, {len(calls)} calls"
                except Exception as e:
                    print(f"Function analysis failed (non-fatal): {e}")
                    # Continue without function analysis

            func_analysis_duration = time.perf_counter() - func_analysis_start
            log_analyze_functions(func_analysis_duration, True, len(functions), len(calls))

            # Step 5: Generate codebase summary
            job.set_status(AnalysisStatus.GENERATING_SUMMARY, "Generating codebase summary...")
            summary_start = time.perf_counter()

            # Generate summary
            from .summary_generator import get_summary_generator
            summary_generator = get_summary_generator()
            summary, readme_detected = await summary_generator.generate_summary(
                directory_path=job.directory_path,
                nodes=nodes,
                edges=edges,
                language_distribution=language_counts,
            )

            summary_duration = time.perf_counter() - summary_start
            log_generate_summary(summary_duration, True)

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
                function_stats=function_stats,
            )

            # Convert to React Flow format
            job.result = self._graph_builder.to_react_flow_format(
                nodes, edges, metadata
            )

            # Mark as completed
            job.set_status(AnalysisStatus.COMPLETED, "Analysis complete")
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

                # Save function tier data if available
                if tier_items:
                    try:
                        # Determine primary language
                        primary_lang = max(language_counts, key=language_counts.get) if language_counts else "unknown"
                        await db_service.save_functions(analysis_id, tier_items, primary_lang)

                        # Save resolved calls
                        if resolved_calls:
                            await db_service.save_function_calls(analysis_id, resolved_calls)
                    except Exception as e:
                        print(f"Failed to save function data (non-fatal): {e}")

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
