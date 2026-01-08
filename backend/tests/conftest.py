"""
Pytest configuration and fixtures for backend tests.
"""

import pytest
import asyncio
from datetime import datetime
from typing import Optional
from unittest.mock import MagicMock, AsyncMock, patch
from pathlib import Path
import tempfile
import shutil


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "benchmark: marks tests as benchmarks"
    )
    config.addinivalue_line(
        "markers", "security: marks tests as security tests"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use the default event loop policy for async tests."""
    return asyncio.DefaultEventLoopPolicy()


# ==================== Mock User Fixtures ====================

@pytest.fixture
def mock_user():
    """Create a mock authenticated user."""
    user = MagicMock()
    user.id = "test-user-id-12345"
    user.email = "testuser@example.com"
    user.app_metadata = {}
    user.user_metadata = {"name": "Test User"}
    return user


@pytest.fixture
def mock_user_2():
    """Create a second mock user for testing isolation."""
    user = MagicMock()
    user.id = "other-user-id-67890"
    user.email = "otheruser@example.com"
    user.app_metadata = {}
    user.user_metadata = {"name": "Other User"}
    return user


# ==================== Mock Supabase Fixtures ====================

@pytest.fixture
def mock_supabase_client():
    """Create a mock Supabase client."""
    client = MagicMock()

    # Mock auth methods
    client.auth = MagicMock()
    client.auth.get_user = MagicMock()

    # Mock table methods with chainable interface
    def create_table_mock():
        table = MagicMock()
        table.select = MagicMock(return_value=table)
        table.insert = MagicMock(return_value=table)
        table.update = MagicMock(return_value=table)
        table.delete = MagicMock(return_value=table)
        table.eq = MagicMock(return_value=table)
        table.neq = MagicMock(return_value=table)
        table.ilike = MagicMock(return_value=table)
        table.order = MagicMock(return_value=table)
        table.range = MagicMock(return_value=table)
        table.limit = MagicMock(return_value=table)

        # Default execute response
        execute_result = MagicMock()
        execute_result.data = []
        execute_result.count = 0
        table.execute = MagicMock(return_value=execute_result)

        return table

    client.table = MagicMock(side_effect=lambda name: create_table_mock())

    return client


@pytest.fixture
def mock_supabase_admin_client(mock_supabase_client):
    """Create a mock Supabase admin client."""
    return mock_supabase_client


# ==================== Mock Analysis Service Fixtures ====================

@pytest.fixture
def mock_analysis_service():
    """Create a mock analysis service."""
    service = MagicMock()
    service.create_job = MagicMock(return_value="test-analysis-id")
    service.get_job = MagicMock()
    service.get_status = MagicMock()
    service.get_result = MagicMock()
    service.run_analysis = AsyncMock()
    return service


@pytest.fixture
def mock_database_service():
    """Create a mock database service."""
    service = MagicMock()
    service.create_analysis = AsyncMock()
    service.update_analysis_status = AsyncMock()
    service.complete_analysis = AsyncMock()
    service.get_analysis_status = AsyncMock(return_value=None)
    service.get_analysis_result = AsyncMock(return_value=None)
    service.get_user_analyses = AsyncMock(return_value=[])
    service.delete_analysis = AsyncMock(return_value=True)
    service.update_analysis_title = AsyncMock(return_value=True)
    service.get_file_content = AsyncMock(return_value=None)
    service.get_tier_list = AsyncMock(return_value=None)
    service.get_function_stats = AsyncMock(return_value=None)
    service.get_function_detail = AsyncMock(return_value=None)
    return service


@pytest.fixture
def mock_github_service():
    """Create a mock GitHub service."""
    service = MagicMock()
    service.clone_repository = AsyncMock(return_value="/tmp/test-repo")
    service.list_user_repos = AsyncMock(return_value={"repos": [], "total": 0})
    service.list_owner_repos = AsyncMock(return_value={"repos": [], "total": 0})
    service.cleanup = MagicMock()
    return service


# ==================== Sample Data Fixtures ====================

@pytest.fixture
def sample_github_repo_info():
    """Create sample GitHub repo info."""
    from app.models.schemas import GitHubRepoInfo
    return GitHubRepoInfo(
        owner="testuser",
        repo="test-repo",
        branch="main",
        path=None,
    )


@pytest.fixture
def sample_analyze_request():
    """Create a sample analysis request for local directory."""
    from app.models.schemas import AnalyzeRequest
    return AnalyzeRequest(
        directory_path="/Users/test/project",
        include_node_modules=False,
        max_depth=None,
    )


@pytest.fixture
def sample_github_analyze_request(sample_github_repo_info):
    """Create a sample analysis request for GitHub."""
    from app.models.schemas import AnalyzeRequest
    return AnalyzeRequest(
        github_repo=sample_github_repo_info,
        include_node_modules=False,
        max_depth=None,
    )


@pytest.fixture
def sample_analysis_status():
    """Create a sample analysis status response."""
    from app.models.schemas import AnalysisStatus, AnalysisStatusResponse
    return AnalysisStatusResponse(
        analysis_id="test-analysis-id",
        status=AnalysisStatus.COMPLETED,
        current_step="Analysis complete",
        total_files=10,
        progress=100,
        error=None,
    )


@pytest.fixture
def sample_file_node():
    """Create a sample file node."""
    from app.models.schemas import FileNode, Language, ArchitecturalRole, Category
    return FileNode(
        id="node-1",
        path="src/components/Button.tsx",
        name="Button.tsx",
        folder="src/components",
        language=Language.TYPESCRIPT,
        role=ArchitecturalRole.REACT_COMPONENT,
        description="A reusable button component",
        category=Category.FRONTEND,
        imports=["react", "./styles"],
        size_bytes=1024,
        line_count=50,
    )


@pytest.fixture
def sample_dependency_edge():
    """Create a sample dependency edge."""
    from app.models.schemas import DependencyEdge, ImportType
    return DependencyEdge(
        id="edge-1",
        source="node-1",
        target="node-2",
        import_type=ImportType.IMPORT,
        label="import",
    )


@pytest.fixture
def sample_analysis_metadata():
    """Create sample analysis metadata."""
    from app.models.schemas import AnalysisMetadata
    return AnalysisMetadata(
        analysis_id="test-analysis-id",
        directory_path="/Users/test/project",
        file_count=10,
        edge_count=15,
        analysis_time_seconds=5.5,
        started_at=datetime.utcnow(),
        completed_at=datetime.utcnow(),
        languages={"typescript": 8, "javascript": 2},
        errors=[],
    )


@pytest.fixture
def sample_function_tier_item():
    """Create a sample function tier item."""
    from app.models.schemas import FunctionTierItem, FunctionType, TierLevel
    return FunctionTierItem(
        id="func-1",
        function_name="handleClick",
        qualified_name="Button.handleClick",
        function_type=FunctionType.FUNCTION,
        file_path="src/components/Button.tsx",
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
        is_async=False,
        parameters_count=2,
    )


# ==================== Temporary Directory Fixtures ====================

@pytest.fixture
def temp_project_dir():
    """Create a temporary project directory with sample files."""
    temp_dir = tempfile.mkdtemp()

    # Create sample project structure
    src_dir = Path(temp_dir) / "src"
    src_dir.mkdir()

    components_dir = src_dir / "components"
    components_dir.mkdir()

    utils_dir = src_dir / "utils"
    utils_dir.mkdir()

    # Create sample files
    (components_dir / "Button.tsx").write_text('''
import React from 'react';
import { formatText } from '../utils/helpers';

export const Button = ({ label, onClick }) => {
    return <button onClick={onClick}>{formatText(label)}</button>;
};
''')

    (components_dir / "Input.tsx").write_text('''
import React from 'react';
import { validateInput } from '../utils/helpers';

export const Input = ({ value, onChange }) => {
    const handleChange = (e) => {
        if (validateInput(e.target.value)) {
            onChange(e.target.value);
        }
    };
    return <input value={value} onChange={handleChange} />;
};
''')

    (utils_dir / "helpers.ts").write_text('''
export function formatText(text: string): string {
    return text.trim().toUpperCase();
}

export function validateInput(input: string): boolean {
    return input.length > 0;
}
''')

    yield temp_dir

    # Cleanup
    shutil.rmtree(temp_dir)


@pytest.fixture
def temp_python_project():
    """Create a temporary Python project directory."""
    temp_dir = tempfile.mkdtemp()

    # Create sample Python project structure
    (Path(temp_dir) / "main.py").write_text('''
from utils.helpers import process_data
from services.api import fetch_data

def main():
    data = fetch_data()
    result = process_data(data)
    return result

if __name__ == "__main__":
    main()
''')

    utils_dir = Path(temp_dir) / "utils"
    utils_dir.mkdir()
    (utils_dir / "__init__.py").write_text("")
    (utils_dir / "helpers.py").write_text('''
def process_data(data):
    return [item.upper() for item in data]

def validate_data(data):
    return isinstance(data, list) and len(data) > 0
''')

    services_dir = Path(temp_dir) / "services"
    services_dir.mkdir()
    (services_dir / "__init__.py").write_text("")
    (services_dir / "api.py").write_text('''
import requests

def fetch_data():
    return ["item1", "item2", "item3"]

def post_data(data):
    return {"status": "ok"}
''')

    yield temp_dir

    # Cleanup
    shutil.rmtree(temp_dir)


# ==================== Test Client Fixtures ====================

@pytest.fixture
def test_client():
    """Create a FastAPI test client."""
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app)


@pytest.fixture
def async_test_client():
    """Create an async test client using httpx."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app

    async def get_client():
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client

    return get_client


# ==================== Auth Fixtures ====================

@pytest.fixture
def valid_auth_header(mock_user):
    """Create a valid authorization header."""
    return {"Authorization": "Bearer valid-test-token"}


@pytest.fixture
def invalid_auth_header():
    """Create an invalid authorization header."""
    return {"Authorization": "Bearer invalid-token"}


@pytest.fixture
def github_token_header():
    """Create a GitHub token header."""
    return {"X-GitHub-Token": "ghp_test_github_token"}


# ==================== Mock Anthropic Fixtures ====================

@pytest.fixture
def mock_anthropic_client():
    """Create a mock Anthropic client."""
    client = MagicMock()

    # Mock messages.create
    message_response = MagicMock()
    message_response.content = [MagicMock(text='{"files": []}')]
    client.messages.create = MagicMock(return_value=message_response)

    return client


# ==================== Helper Functions ====================

def create_mock_execute_result(data=None, count=None):
    """Helper to create mock Supabase execute results."""
    result = MagicMock()
    result.data = data or []
    result.count = count or len(result.data)
    return result
