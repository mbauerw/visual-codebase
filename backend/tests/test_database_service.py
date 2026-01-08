"""
Database service tests for CRUD operations and RLS policy enforcement.

These tests cover:
- Create, Read, Update, Delete operations for analyses
- Node and edge storage
- File content storage for GitHub repos
- User isolation (RLS simulation)
- Function tier list queries with pagination
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch, AsyncMock
from uuid import uuid4

from app.models.schemas import (
    AnalysisStatus,
    AnalysisStatusResponse,
    AnalysisMetadata,
    FileNode,
    DependencyEdge,
    ParsedFile,
    Language,
    ArchitecturalRole,
    Category,
    ImportType,
    GitHubRepoInfo,
    FunctionTierItem,
    FunctionType,
    TierLevel,
    FunctionCallInfo,
    CallType,
    CallOrigin,
)


# ==================== Fixtures ====================

@pytest.fixture
def sample_nodes():
    """Create sample file nodes."""
    return [
        FileNode(
            id="node-1",
            path="src/App.tsx",
            name="App.tsx",
            folder="src",
            language=Language.TYPESCRIPT,
            role=ArchitecturalRole.REACT_COMPONENT,
            description="Main app component",
            category=Category.FRONTEND,
            imports=["react", "./components/Button"],
            size_bytes=2048,
            line_count=100,
        ),
        FileNode(
            id="node-2",
            path="src/components/Button.tsx",
            name="Button.tsx",
            folder="src/components",
            language=Language.TYPESCRIPT,
            role=ArchitecturalRole.REACT_COMPONENT,
            description="Button component",
            category=Category.FRONTEND,
            imports=["react"],
            size_bytes=1024,
            line_count=50,
        ),
    ]


@pytest.fixture
def sample_edges():
    """Create sample dependency edges."""
    return [
        DependencyEdge(
            id="edge-1",
            source="node-1",
            target="node-2",
            import_type=ImportType.IMPORT,
            label="imports",
        ),
    ]


@pytest.fixture
def sample_metadata():
    """Create sample analysis metadata."""
    now = datetime.now(timezone.utc)
    return AnalysisMetadata(
        analysis_id="test-analysis-123",
        directory_path="/Users/test/project",
        file_count=2,
        edge_count=1,
        analysis_time_seconds=3.5,
        started_at=now,
        completed_at=now,
        languages={"typescript": 2},
        errors=[],
    )


@pytest.fixture
def sample_parsed_files():
    """Create sample parsed files with content."""
    return [
        ParsedFile(
            path="/tmp/repo/src/App.tsx",
            relative_path="src/App.tsx",
            name="App.tsx",
            folder="src",
            language=Language.TYPESCRIPT,
            imports=[],
            exports=["App"],
            functions=["App"],
            classes=[],
            size_bytes=2048,
            content="import React from 'react';\nexport const App = () => <div>Hello</div>;",
            line_count=2,
        ),
    ]


def create_chainable_mock(default_data=None, default_count=0):
    """Create a chainable mock for Supabase table operations."""
    mock = MagicMock()
    mock.select = MagicMock(return_value=mock)
    mock.insert = MagicMock(return_value=mock)
    mock.update = MagicMock(return_value=mock)
    mock.delete = MagicMock(return_value=mock)
    mock.eq = MagicMock(return_value=mock)
    mock.neq = MagicMock(return_value=mock)
    mock.ilike = MagicMock(return_value=mock)
    mock.order = MagicMock(return_value=mock)
    mock.range = MagicMock(return_value=mock)
    mock.limit = MagicMock(return_value=mock)

    result = MagicMock()
    result.data = default_data if default_data is not None else []
    result.count = default_count
    mock.execute = MagicMock(return_value=result)

    return mock


# ==================== Create Analysis Tests ====================

class TestCreateAnalysis:
    """Test analysis creation."""

    @pytest.mark.asyncio
    async def test_create_analysis_local(self):
        """Test creating a local directory analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(
            default_data=[{"id": str(uuid4()), "analysis_id": "test-123"}]
        )
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.create_analysis(
                analysis_id="test-123",
                user_id="user-abc",
                directory_path="/Users/test/project",
            )

            # Verify insert was called
            table_mock.insert.assert_called_once()
            call_args = table_mock.insert.call_args[0][0]
            assert call_args["analysis_id"] == "test-123"
            assert call_args["user_id"] == "user-abc"
            assert call_args["directory_path"] == "/Users/test/project"
            assert call_args["status"] == AnalysisStatus.PENDING.value

    @pytest.mark.asyncio
    async def test_create_analysis_github(self):
        """Test creating a GitHub repository analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(
            default_data=[{"id": str(uuid4()), "analysis_id": "github-123"}]
        )
        mock_client.table = MagicMock(return_value=table_mock)

        github_repo = GitHubRepoInfo(
            owner="testuser",
            repo="testrepo",
            branch="main",
            path="src",
        )

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.create_analysis(
                analysis_id="github-123",
                user_id="user-abc",
                directory_path="/",
                github_repo=github_repo,
            )

            call_args = table_mock.insert.call_args[0][0]
            assert call_args["analysis_id"] == "github-123"
            assert call_args["github_repo"]["owner"] == "testuser"
            assert call_args["github_repo"]["repo"] == "testrepo"


# ==================== Update Status Tests ====================

class TestUpdateAnalysisStatus:
    """Test analysis status updates."""

    @pytest.mark.asyncio
    async def test_update_status(self):
        """Test updating analysis status."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock()
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            await service.update_analysis_status(
                analysis_id="test-123",
                status=AnalysisStatus.ANALYZING,
                current_step="Analyzing files...",
                total_files=50,
            )

            table_mock.update.assert_called_once()
            call_args = table_mock.update.call_args[0][0]
            assert call_args["status"] == "analyzing"
            assert call_args["current_step"] == "Analyzing files..."
            assert call_args["total_files"] == 50

    @pytest.mark.asyncio
    async def test_update_status_with_error(self):
        """Test updating status with error message."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock()
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            await service.update_analysis_status(
                analysis_id="test-123",
                status=AnalysisStatus.FAILED,
                current_step="Failed",
                error_message="Something went wrong",
            )

            call_args = table_mock.update.call_args[0][0]
            assert call_args["status"] == "failed"
            assert call_args["error_message"] == "Something went wrong"


# ==================== Complete Analysis Tests ====================

class TestCompleteAnalysis:
    """Test completing an analysis with full data."""

    @pytest.mark.asyncio
    async def test_complete_analysis_stores_nodes_and_edges(
        self, sample_nodes, sample_edges, sample_metadata
    ):
        """Test that completing analysis stores nodes and edges."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()

        # Track table calls
        tables_called = []

        def table_side_effect(name):
            tables_called.append(name)
            if name == "analyses":
                return create_chainable_mock(default_data=[{"id": str(uuid4())}])
            return create_chainable_mock()

        mock_client.table = MagicMock(side_effect=table_side_effect)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            await service.complete_analysis(
                analysis_id="test-123",
                metadata=sample_metadata,
                nodes=sample_nodes,
                edges=sample_edges,
            )

            # Verify all tables were accessed
            assert "analyses" in tables_called
            assert "analysis_nodes" in tables_called
            assert "analysis_edges" in tables_called

    @pytest.mark.asyncio
    async def test_complete_analysis_stores_file_content(
        self, sample_nodes, sample_edges, sample_metadata, sample_parsed_files
    ):
        """Test that file content is stored for GitHub analyses."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        tables_called = []

        def table_side_effect(name):
            tables_called.append(name)
            if name == "analyses":
                return create_chainable_mock(default_data=[{"id": str(uuid4())}])
            return create_chainable_mock()

        mock_client.table = MagicMock(side_effect=table_side_effect)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            await service.complete_analysis(
                analysis_id="test-123",
                metadata=sample_metadata,
                nodes=sample_nodes,
                edges=sample_edges,
                parsed_files=sample_parsed_files,
            )

            assert "analysis_file_contents" in tables_called

    @pytest.mark.asyncio
    async def test_complete_analysis_not_found_raises(
        self, sample_nodes, sample_edges, sample_metadata
    ):
        """Test that completing non-existent analysis raises error."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])  # Empty = not found
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            with pytest.raises(ValueError, match="not found"):
                await service.complete_analysis(
                    analysis_id="nonexistent",
                    metadata=sample_metadata,
                    nodes=sample_nodes,
                    edges=sample_edges,
                )


# ==================== Get Analysis Status Tests ====================

class TestGetAnalysisStatus:
    """Test getting analysis status."""

    @pytest.mark.asyncio
    async def test_get_status_found(self):
        """Test getting status for existing analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(
            default_data=[{
                "analysis_id": "test-123",
                "status": "analyzing",
                "current_step": "Processing...",
                "total_files": 50,
                "error_message": None,
            }]
        )
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            status = await service.get_analysis_status("test-123")

            assert status is not None
            assert status.analysis_id == "test-123"
            assert status.status == AnalysisStatus.ANALYZING
            assert status.current_step == "Processing..."

    @pytest.mark.asyncio
    async def test_get_status_not_found(self):
        """Test getting status for non-existent analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            status = await service.get_analysis_status("nonexistent")

            assert status is None


# ==================== Get User Analyses Tests ====================

class TestGetUserAnalyses:
    """Test getting user's analyses."""

    @pytest.mark.asyncio
    async def test_get_user_analyses_empty(self):
        """Test getting analyses for user with none."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            analyses = await service.get_user_analyses("user-123")

            assert analyses == []

    @pytest.mark.asyncio
    async def test_get_user_analyses_with_data(self):
        """Test getting analyses for user with existing data."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(
            default_data=[
                {
                    "analysis_id": "analysis-1",
                    "directory_path": "/path/1",
                    "github_repo": None,
                    "status": "completed",
                    "file_count": 50,
                    "edge_count": 30,
                    "started_at": "2024-01-01T00:00:00Z",
                    "completed_at": "2024-01-01T00:01:00Z",
                    "user_title": "My Project",
                },
                {
                    "analysis_id": "analysis-2",
                    "directory_path": None,
                    "github_repo": '{"owner": "user", "repo": "repo"}',
                    "status": "completed",
                    "file_count": 100,
                    "edge_count": 75,
                    "started_at": "2024-01-02T00:00:00Z",
                    "completed_at": "2024-01-02T00:02:00Z",
                    "user_title": None,
                },
            ]
        )
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            analyses = await service.get_user_analyses("user-123")

            assert len(analyses) == 2
            # Verify JSON parsing of github_repo
            assert analyses[1]["github_repo"]["owner"] == "user"

    @pytest.mark.asyncio
    async def test_get_user_analyses_ordered_by_date(self):
        """Test that analyses are ordered by started_at descending."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            await service.get_user_analyses("user-123")

            table_mock.order.assert_called_with("started_at", desc=True)


# ==================== Delete Analysis Tests ====================

class TestDeleteAnalysis:
    """Test analysis deletion."""

    @pytest.mark.asyncio
    async def test_delete_analysis_success(self):
        """Test successful analysis deletion."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()

        # First call returns analysis (ownership check), second is delete
        call_count = [0]

        def table_side_effect(name):
            mock = create_chainable_mock()
            call_count[0] += 1
            if call_count[0] == 1:
                mock.execute.return_value.data = [{"id": str(uuid4())}]
            return mock

        mock_client.table = MagicMock(side_effect=table_side_effect)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.delete_analysis("test-123", "user-abc")

            assert result is True

    @pytest.mark.asyncio
    async def test_delete_analysis_not_owned(self):
        """Test deleting analysis not owned by user."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])  # Not found = not owned
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.delete_analysis("test-123", "wrong-user")

            assert result is False

    @pytest.mark.asyncio
    async def test_delete_analysis_not_found(self):
        """Test deleting non-existent analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.delete_analysis("nonexistent", "user-abc")

            assert result is False


# ==================== Update Title Tests ====================

class TestUpdateAnalysisTitle:
    """Test analysis title updates."""

    @pytest.mark.asyncio
    async def test_update_title_success(self):
        """Test successful title update."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()

        call_count = [0]

        def table_side_effect(name):
            mock = create_chainable_mock()
            call_count[0] += 1
            if call_count[0] == 1:
                mock.execute.return_value.data = [{"id": str(uuid4())}]
            return mock

        mock_client.table = MagicMock(side_effect=table_side_effect)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.update_analysis_title(
                analysis_id="test-123",
                user_id="user-abc",
                user_title="My Custom Title",
            )

            assert result is True

    @pytest.mark.asyncio
    async def test_update_title_not_owned(self):
        """Test updating title for analysis not owned by user."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.update_analysis_title(
                analysis_id="test-123",
                user_id="wrong-user",
                user_title="Title",
            )

            assert result is False


# ==================== Get File Content Tests ====================

class TestGetFileContent:
    """Test file content retrieval."""

    @pytest.mark.asyncio
    async def test_get_file_content_from_database(self):
        """Test getting file content stored in database."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()

        call_count = [0]

        def table_side_effect(name):
            call_count[0] += 1
            if name == "analyses":
                return create_chainable_mock(
                    default_data=[{"id": str(uuid4()), "github_repo": {"owner": "user"}, "directory_path": None}]
                )
            elif name == "analysis_file_contents":
                return create_chainable_mock(
                    default_data=[{"content": "const x = 1;"}]
                )
            return create_chainable_mock()

        mock_client.table = MagicMock(side_effect=table_side_effect)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.get_file_content(
                analysis_id="test-123",
                node_id="node-1",
                user_id="user-abc",
            )

            assert result is not None
            assert result["content"] == "const x = 1;"
            assert result["available"] is True
            assert result["source"] == "database"

    @pytest.mark.asyncio
    async def test_get_file_content_not_owned(self):
        """Test that file content is not returned for non-owned analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.get_file_content(
                analysis_id="test-123",
                node_id="node-1",
                user_id="wrong-user",
            )

            assert result is None


# ==================== Tier List Tests ====================

class TestTierListOperations:
    """Test function tier list database operations."""

    @pytest.mark.asyncio
    async def test_save_functions(self):
        """Test saving function tier items."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        tables_called = []

        def table_side_effect(name):
            tables_called.append(name)
            if name == "analyses":
                return create_chainable_mock(default_data=[{"id": str(uuid4())}])
            return create_chainable_mock()

        mock_client.table = MagicMock(side_effect=table_side_effect)

        tier_items = [
            FunctionTierItem(
                id="func-1",
                function_name="handleClick",
                qualified_name="Button.handleClick",
                function_type=FunctionType.FUNCTION,
                file_path="src/Button.tsx",
                file_name="Button.tsx",
                node_id="node-1",
                internal_call_count=5,
                external_call_count=2,
                is_exported=True,
                is_entry_point=False,
                tier=TierLevel.A,
                tier_percentile=85.0,
                start_line=10,
                end_line=25,
            ),
        ]

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            await service.save_functions(
                analysis_id="test-123",
                tier_items=tier_items,
                language="typescript",
            )

            assert "analysis_functions" in tables_called

    @pytest.mark.asyncio
    async def test_get_tier_list_not_owned(self):
        """Test tier list returns None for non-owned analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.get_tier_list(
                analysis_id="test-123",
                user_id="wrong-user",
            )

            assert result is None


# ==================== Function Stats Tests ====================

class TestFunctionStats:
    """Test function statistics retrieval."""

    @pytest.mark.asyncio
    async def test_get_function_stats(self):
        """Test getting function statistics."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()

        # Create persistent mocks for analysis_functions table
        analysis_functions_mock = create_chainable_mock()
        analysis_functions_call_count = [0]

        def analysis_functions_execute():
            analysis_functions_call_count[0] += 1
            if analysis_functions_call_count[0] == 1:
                # First call: tier summary
                result = MagicMock()
                result.data = [{"tier": "S"}, {"tier": "A"}]
                return result
            else:
                # Second call: top functions
                result = MagicMock()
                result.data = [{"function_name": "handleClick"}]
                return result

        analysis_functions_mock.execute = MagicMock(side_effect=analysis_functions_execute)

        def table_side_effect(name):
            if name == "analyses":
                return create_chainable_mock(
                    default_data=[{
                        "id": str(uuid4()),
                        "function_count": 100,
                        "function_call_count": 500,
                    }]
                )
            elif name == "analysis_functions":
                return analysis_functions_mock
            return create_chainable_mock()

        mock_client.table = MagicMock(side_effect=table_side_effect)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.get_function_stats(
                analysis_id="test-123",
                user_id="user-abc",
            )

            assert result is not None
            assert result.total_functions == 100
            assert result.total_calls == 500


# ==================== Function Detail Tests ====================

class TestFunctionDetail:
    """Test function detail retrieval."""

    @pytest.mark.asyncio
    async def test_get_function_detail(self):
        """Test getting detailed function information."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()

        def table_side_effect(name):
            if name == "analyses":
                return create_chainable_mock(default_data=[{"id": str(uuid4())}])
            elif name == "analysis_functions":
                return create_chainable_mock(
                    default_data=[{
                        "id": str(uuid4()),
                        "function_name": "handleClick",
                        "qualified_name": "Button.handleClick",
                        "function_type": "function",
                        "node_id": "src/Button.tsx",
                        "internal_call_count": 5,
                        "external_call_count": 2,
                        "is_exported": True,
                        "is_entry_point": False,
                        "tier": "A",
                        "tier_percentile": 85.0,
                        "start_line": 10,
                        "end_line": 25,
                        "is_async": False,
                        "parameters_count": 2,
                    }]
                )
            elif name == "analysis_function_calls":
                mock = create_chainable_mock()
                mock.execute.side_effect = [
                    MagicMock(data=[]),  # callers
                    MagicMock(data=[]),  # callees
                    MagicMock(data=[], count=0),  # caller count
                    MagicMock(data=[], count=0),  # callee count
                ]
                return mock
            return create_chainable_mock()

        mock_client.table = MagicMock(side_effect=table_side_effect)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.get_function_detail(
                analysis_id="test-123",
                function_id="func-1",
                user_id="user-abc",
            )

            assert result is not None
            assert result.function.function_name == "handleClick"


# ==================== RLS Simulation Tests ====================

class TestRLSPolicySimulation:
    """Test that code respects user isolation (simulating RLS)."""

    @pytest.mark.asyncio
    async def test_user_cannot_access_other_user_analysis(self):
        """Test that user A cannot access user B's analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])  # Not found for this user
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.get_file_content(
                analysis_id="other-user-analysis",
                node_id="node-1",
                user_id="user-abc",  # Not the owner
            )

            assert result is None

    @pytest.mark.asyncio
    async def test_user_cannot_delete_other_user_analysis(self):
        """Test that user A cannot delete user B's analysis."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])  # Ownership check fails
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            result = await service.delete_analysis(
                analysis_id="other-user-analysis",
                user_id="user-abc",
            )

            assert result is False

    @pytest.mark.asyncio
    async def test_queries_always_filter_by_user_id(self):
        """Test that all user-specific queries include user_id filter."""
        from app.services.database import DatabaseService

        mock_client = MagicMock()
        table_mock = create_chainable_mock(default_data=[])
        mock_client.table = MagicMock(return_value=table_mock)

        with patch("app.services.database.get_supabase_admin_client", return_value=mock_client):
            service = DatabaseService()

            await service.get_user_analyses("user-123")

            # Verify .eq was called (for user_id filter)
            table_mock.eq.assert_called()


# ==================== Singleton Tests ====================

class TestDatabaseServiceSingleton:
    """Test the singleton pattern for DatabaseService."""

    def test_get_database_service_returns_singleton(self):
        """Test that get_database_service returns the same instance."""
        from app.services.database import get_database_service
        import app.services.database as db_module

        with patch("app.services.database.get_supabase_admin_client"):
            # Reset singleton
            db_module._database_service = None

            service1 = get_database_service()
            service2 = get_database_service()

            assert service1 is service2
