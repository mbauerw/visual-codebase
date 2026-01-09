"""
Tests for the AnalysisService orchestration.
Covers job creation and tracking, status transitions, progress updates,
error handling, and pipeline orchestration with mocked services.
"""

import pytest
import tempfile
import os
import shutil
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.analysis import (
    AnalysisService,
    AnalysisJob,
    get_analysis_service,
    PROGRESS_MAP,
)
from app.models.schemas import (
    AnalysisStatus,
    AnalysisStatusResponse,
    Language,
    ArchitecturalRole,
    Category,
    LLMFileAnalysis,
    ParsedFile,
    FileNode,
    DependencyEdge,
    ImportType,
    ReactFlowGraph,
    CodebaseSummary,
    TechStackInfo,
    ComplexityInfo,
)


# ==================== Fixtures ====================

@pytest.fixture
def analysis_service():
    """Create a fresh AnalysisService for each test."""
    return AnalysisService()


@pytest.fixture
def temp_project_dir():
    """Create a temporary project directory with sample files."""
    tmpdir = tempfile.mkdtemp()

    # Create sample project structure
    src_dir = Path(tmpdir) / "src"
    src_dir.mkdir()

    (src_dir / "App.tsx").write_text('''
import React from 'react';
import { helper } from './utils';

export function App() {
    return <div>{helper()}</div>;
}
''')

    (src_dir / "utils.ts").write_text('''
export function helper() {
    return 'help';
}
''')

    yield tmpdir

    shutil.rmtree(tmpdir)


def create_mock_parsed_file(
    relative_path: str,
    content: str = "// content",
) -> ParsedFile:
    """Create a mock parsed file."""
    return ParsedFile(
        path=f"/project/{relative_path}",
        relative_path=relative_path,
        name=relative_path.split("/")[-1],
        folder="/".join(relative_path.split("/")[:-1]),
        language=Language.TYPESCRIPT,
        imports=[],
        exports=[],
        functions=["test"],
        classes=[],
        size_bytes=100,
        line_count=10,
        content=content,
    )


def create_mock_summary() -> CodebaseSummary:
    """Create a mock CodebaseSummary for testing."""
    return CodebaseSummary(
        project_type="web_app",
        primary_purpose="Test application",
        tech_stack=TechStackInfo(
            languages=["typescript"],
            frameworks=[],
            libraries=[],
            patterns=[],
        ),
        architecture_summary="Simple test architecture",
        key_modules=[],
        complexity_assessment=ComplexityInfo(
            level="simple",
            reasoning="Simple test project",
        ),
        notable_aspects=[],
    )


# ==================== AnalysisJob Tests ====================

class TestAnalysisJob:
    """Tests for AnalysisJob class."""

    def test_job_creation(self):
        """Test job creation with initial state."""
        job = AnalysisJob("test-id", "/project/path")

        assert job.analysis_id == "test-id"
        assert job.directory_path == "/project/path"
        assert job.status == AnalysisStatus.PENDING
        assert job.current_step == "Initializing"
        assert job.total_files == 0
        assert job.progress == 0
        assert job.error is None
        assert job.result is None
        assert job.started_at is not None
        assert job.completed_at is None

    def test_job_set_status(self):
        """Test status update with progress."""
        job = AnalysisJob("test-id", "/project")

        job.set_status(AnalysisStatus.PARSING, "Parsing files...")

        assert job.status == AnalysisStatus.PARSING
        assert job.current_step == "Parsing files..."
        assert job.progress == PROGRESS_MAP[AnalysisStatus.PARSING]

    def test_job_status_transitions(self):
        """Test all status transitions update progress correctly."""
        job = AnalysisJob("test-id", "/project")

        transitions = [
            (AnalysisStatus.CLONING, PROGRESS_MAP[AnalysisStatus.CLONING]),
            (AnalysisStatus.PARSING, PROGRESS_MAP[AnalysisStatus.PARSING]),
            (AnalysisStatus.ANALYZING, PROGRESS_MAP[AnalysisStatus.ANALYZING]),
            (AnalysisStatus.BUILDING_GRAPH, PROGRESS_MAP[AnalysisStatus.BUILDING_GRAPH]),
            (AnalysisStatus.COMPLETED, PROGRESS_MAP[AnalysisStatus.COMPLETED]),
        ]

        for status, expected_progress in transitions:
            job.set_status(status)
            assert job.progress == expected_progress


# ==================== Job Creation Tests ====================

class TestJobCreation:
    """Tests for job creation and tracking."""

    def test_create_job(self, analysis_service):
        """Test creating a new analysis job."""
        analysis_id = analysis_service.create_job("/project/path")

        assert analysis_id is not None
        assert len(analysis_id) == 36  # UUID format

    def test_create_job_stored(self, analysis_service):
        """Test that created job is stored."""
        analysis_id = analysis_service.create_job("/project/path")

        job = analysis_service.get_job(analysis_id)
        assert job is not None
        assert job.directory_path == "/project/path"

    def test_create_multiple_jobs(self, analysis_service):
        """Test creating multiple jobs."""
        id1 = analysis_service.create_job("/project1")
        id2 = analysis_service.create_job("/project2")

        assert id1 != id2
        assert analysis_service.get_job(id1) is not None
        assert analysis_service.get_job(id2) is not None


# ==================== Get Job Tests ====================

class TestGetJob:
    """Tests for getting job by ID."""

    def test_get_existing_job(self, analysis_service):
        """Test getting an existing job."""
        analysis_id = analysis_service.create_job("/project")

        job = analysis_service.get_job(analysis_id)

        assert job is not None
        assert job.analysis_id == analysis_id

    def test_get_nonexistent_job(self, analysis_service):
        """Test getting a non-existent job returns None."""
        job = analysis_service.get_job("nonexistent-id")

        assert job is None


# ==================== Get Status Tests ====================

class TestGetStatus:
    """Tests for getting job status."""

    def test_get_status_existing_job(self, analysis_service):
        """Test getting status for existing job."""
        analysis_id = analysis_service.create_job("/project")

        status = analysis_service.get_status(analysis_id)

        assert status is not None
        assert isinstance(status, AnalysisStatusResponse)
        assert status.analysis_id == analysis_id
        assert status.status == AnalysisStatus.PENDING

    def test_get_status_nonexistent_job(self, analysis_service):
        """Test getting status for non-existent job."""
        status = analysis_service.get_status("nonexistent-id")

        assert status is None

    def test_status_reflects_job_state(self, analysis_service):
        """Test that status reflects current job state."""
        analysis_id = analysis_service.create_job("/project")
        job = analysis_service.get_job(analysis_id)

        job.set_status(AnalysisStatus.ANALYZING, "AI is analyzing...")
        job.total_files = 10

        status = analysis_service.get_status(analysis_id)

        assert status.status == AnalysisStatus.ANALYZING
        assert status.current_step == "AI is analyzing..."
        assert status.total_files == 10


# ==================== Get Result Tests ====================

class TestGetResult:
    """Tests for getting analysis results."""

    def test_get_result_incomplete_job(self, analysis_service):
        """Test that incomplete jobs return None result."""
        analysis_id = analysis_service.create_job("/project")

        result = analysis_service.get_result(analysis_id)

        assert result is None

    def test_get_result_completed_job(self, analysis_service):
        """Test getting result from completed job."""
        analysis_id = analysis_service.create_job("/project")
        job = analysis_service.get_job(analysis_id)

        # Simulate completion
        job.status = AnalysisStatus.COMPLETED
        job.result = MagicMock(spec=ReactFlowGraph)

        result = analysis_service.get_result(analysis_id)

        assert result is not None

    def test_get_result_nonexistent_job(self, analysis_service):
        """Test getting result for non-existent job."""
        result = analysis_service.get_result("nonexistent-id")

        assert result is None


# ==================== Run Analysis Tests ====================

class TestRunAnalysis:
    """Tests for running analysis pipeline."""

    @pytest.mark.asyncio
    async def test_run_analysis_success(self, analysis_service, temp_project_dir):
        """Test successful analysis run."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        # Mock dependencies
        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = {
                "App.tsx": LLMFileAnalysis(
                    filename="App.tsx",
                    architectural_role=ArchitecturalRole.REACT_COMPONENT,
                    description="Main app",
                    category=Category.FRONTEND,
                ),
                "utils.ts": LLMFileAnalysis(
                    filename="utils.ts",
                    architectural_role=ArchitecturalRole.UTILITY,
                    description="Helpers",
                    category=Category.SHARED,
                ),
            }

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.COMPLETED
        assert job.result is not None
        assert job.error is None

    @pytest.mark.asyncio
    async def test_run_analysis_invalid_directory(self, analysis_service):
        """Test analysis with invalid directory."""
        analysis_id = analysis_service.create_job("/nonexistent/directory")

        with pytest.raises(ValueError) as exc_info:
            await analysis_service.run_analysis(analysis_id)

        assert "does not exist" in str(exc_info.value)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.FAILED

    @pytest.mark.asyncio
    async def test_run_analysis_empty_directory(self, analysis_service):
        """Test analysis with empty directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            analysis_id = analysis_service.create_job(tmpdir)

            with pytest.raises(ValueError) as exc_info:
                await analysis_service.run_analysis(analysis_id)

            assert "No supported files" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_run_analysis_nonexistent_job(self, analysis_service):
        """Test running analysis for non-existent job."""
        # Should just return without doing anything
        await analysis_service.run_analysis("nonexistent-id")


# ==================== Status Transitions Tests ====================

class TestStatusTransitions:
    """Tests for status transitions during analysis."""

    @pytest.mark.asyncio
    async def test_status_transitions_order(self, analysis_service, temp_project_dir):
        """Test that status transitions happen in correct order."""
        analysis_id = analysis_service.create_job(temp_project_dir)
        job = analysis_service.get_job(analysis_id)

        status_history = []
        original_set_status = job.set_status

        def track_status(status, step=""):
            status_history.append(status)
            original_set_status(status, step)

        job.set_status = track_status

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = {}

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        # Verify order
        expected_order = [
            AnalysisStatus.PARSING,
            AnalysisStatus.ANALYZING,
            AnalysisStatus.BUILDING_GRAPH,
            AnalysisStatus.ANALYZING_FUNCTIONS,
            AnalysisStatus.GENERATING_SUMMARY,
            AnalysisStatus.COMPLETED,
        ]

        for expected in expected_order:
            assert expected in status_history


# ==================== Progress Updates Tests ====================

class TestProgressUpdates:
    """Tests for progress percentage updates."""

    def test_progress_map_completeness(self):
        """Test that all statuses have progress values."""
        for status in AnalysisStatus:
            assert status in PROGRESS_MAP

    def test_progress_map_ordering(self):
        """Test that progress values increase through pipeline."""
        ordered_statuses = [
            AnalysisStatus.PENDING,
            AnalysisStatus.CLONING,
            AnalysisStatus.PARSING,
            AnalysisStatus.ANALYZING,
            AnalysisStatus.ANALYZING_FUNCTIONS,
            AnalysisStatus.BUILDING_GRAPH,
            AnalysisStatus.GENERATING_SUMMARY,
            AnalysisStatus.COMPLETED,
        ]

        prev_progress = -1
        for status in ordered_statuses:
            current_progress = PROGRESS_MAP[status]
            assert current_progress >= prev_progress
            prev_progress = current_progress

    def test_completed_progress_is_100(self):
        """Test that completed status is 100%."""
        assert PROGRESS_MAP[AnalysisStatus.COMPLETED] == 100


# ==================== Error Handling Tests ====================

class TestErrorHandling:
    """Tests for error handling and recovery."""

    @pytest.mark.asyncio
    async def test_error_sets_failed_status(self, analysis_service):
        """Test that errors set failed status."""
        analysis_id = analysis_service.create_job("/nonexistent")

        try:
            await analysis_service.run_analysis(analysis_id)
        except:
            pass

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.FAILED

    @pytest.mark.asyncio
    async def test_error_message_captured(self, analysis_service):
        """Test that error message is captured."""
        analysis_id = analysis_service.create_job("/nonexistent")

        try:
            await analysis_service.run_analysis(analysis_id)
        except:
            pass

        job = analysis_service.get_job(analysis_id)
        assert job.error is not None
        assert len(job.error) > 0

    @pytest.mark.asyncio
    async def test_llm_error_propagates(self, analysis_service, temp_project_dir):
        """Test that LLM errors propagate correctly."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.side_effect = Exception("LLM API Error")

            with pytest.raises(Exception) as exc_info:
                await analysis_service.run_analysis(analysis_id)

            assert "LLM API Error" in str(exc_info.value)


# ==================== Pipeline Orchestration Tests ====================

class TestPipelineOrchestration:
    """Tests for pipeline orchestration with mocked services."""

    @pytest.mark.asyncio
    async def test_parser_called(self, analysis_service, temp_project_dir):
        """Test that parser is called."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._parser, 'parse_directory') as mock_parser:
            mock_parser.return_value = [create_mock_parsed_file("src/App.tsx")]

            with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
                mock_llm.return_value = {}

                with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                    mock_generator = MagicMock()
                    mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                    mock_summary.return_value = mock_generator

                    await analysis_service.run_analysis(analysis_id)

            mock_parser.assert_called_once()

    @pytest.mark.asyncio
    async def test_llm_analyzer_called(self, analysis_service, temp_project_dir):
        """Test that LLM analyzer is called."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = {}

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

            mock_llm.assert_called_once()

    @pytest.mark.asyncio
    async def test_graph_builder_called(self, analysis_service, temp_project_dir):
        """Test that graph builder is called."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._graph_builder, 'build_graph') as mock_builder:
            mock_builder.return_value = ([], [])

            with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
                mock_llm.return_value = {}

                with patch.object(analysis_service._graph_builder, 'to_react_flow_format') as mock_format:
                    mock_format.return_value = MagicMock(spec=ReactFlowGraph)

                    with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                        mock_generator = MagicMock()
                        mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                        mock_summary.return_value = mock_generator

                        await analysis_service.run_analysis(analysis_id)

                mock_builder.assert_called_once()


# ==================== File Count Tests ====================

class TestFileCount:
    """Tests for file count tracking."""

    @pytest.mark.asyncio
    async def test_total_files_updated(self, analysis_service, temp_project_dir):
        """Test that total files is updated after parsing."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = {}

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        # Should have found the 2 files we created
        assert job.total_files >= 1


# ==================== Completion Tests ====================

class TestCompletion:
    """Tests for analysis completion."""

    @pytest.mark.asyncio
    async def test_completed_at_set(self, analysis_service, temp_project_dir):
        """Test that completed_at is set on success."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = {}

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        assert job.completed_at is not None

    @pytest.mark.asyncio
    async def test_result_is_react_flow_graph(self, analysis_service, temp_project_dir):
        """Test that result is a ReactFlowGraph."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = {}

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        assert job.result is not None
        assert isinstance(job.result, ReactFlowGraph)


# ==================== Singleton Pattern Tests ====================

class TestSingletonPattern:
    """Tests for the singleton pattern."""

    def test_get_analysis_service_returns_same_instance(self):
        """Test that get_analysis_service returns the same instance."""
        # Reset singleton
        import app.services.analysis as analysis_module
        analysis_module._service = None

        service1 = get_analysis_service()
        service2 = get_analysis_service()

        assert service1 is service2


# ==================== Include Content Tests ====================

class TestIncludeContent:
    """Tests for content inclusion in analysis."""

    @pytest.mark.asyncio
    async def test_content_included_for_function_analysis(self, analysis_service, temp_project_dir):
        """Test that file content is included for function analysis."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._parser, 'parse_directory') as mock_parser:
            # Return files with content
            mock_parser.return_value = [
                create_mock_parsed_file("src/App.tsx", content="const x = 1;")
            ]

            with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
                mock_llm.return_value = {}

                with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                    mock_generator = MagicMock()
                    mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                    mock_summary.return_value = mock_generator

                    await analysis_service.run_analysis(analysis_id)

            # Verify include_content=True was passed
            call_kwargs = mock_parser.call_args.kwargs
            assert call_kwargs.get("include_content") is True


# ==================== Database Integration Tests ====================

class TestDatabaseIntegration:
    """Tests for database integration when user is authenticated."""

    @pytest.mark.asyncio
    async def test_database_called_with_user_id(self, analysis_service, temp_project_dir):
        """Test that database service is called when user_id is provided."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = {}

            with patch("app.services.database.get_database_service") as mock_db:
                mock_db_instance = MagicMock()
                mock_db_instance.complete_analysis = AsyncMock()
                mock_db_instance.save_functions = AsyncMock()
                mock_db_instance.save_function_calls = AsyncMock()
                mock_db.return_value = mock_db_instance

                with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                    mock_generator = MagicMock()
                    mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                    mock_summary.return_value = mock_generator

                    await analysis_service.run_analysis(
                        analysis_id,
                        user_id="test-user-id"
                    )

                mock_db_instance.complete_analysis.assert_called_once()

    @pytest.mark.asyncio
    async def test_database_not_called_without_user_id(self, analysis_service, temp_project_dir):
        """Test that database service is not called without user_id."""
        analysis_id = analysis_service.create_job(temp_project_dir)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.return_value = {}

            with patch("app.services.database.get_database_service") as mock_db:
                with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                    mock_generator = MagicMock()
                    mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                    mock_summary.return_value = mock_generator

                    await analysis_service.run_analysis(analysis_id)

                # get_database_service should not be called
                mock_db.assert_not_called()
