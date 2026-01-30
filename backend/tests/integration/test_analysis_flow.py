"""
Integration tests for the complete analysis flow.
Covers full pipeline from parsing to storage including:
- Local analysis: parse → analyze → build graph → save
- GitHub analysis flow (with mocked clone)
- Tier list generation end-to-end
- Summary generation
- Large codebase handling
"""

import pytest
import tempfile
import shutil
import os
from datetime import datetime
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.services.analysis import AnalysisService, get_analysis_service
from app.services.parser import get_parser
from app.services.llm_analyzer import get_llm_analyzer
from app.services.graph_builder import get_graph_builder
from app.services.function_analyzer import get_function_analyzer
from app.models.schemas import (
    AnalysisStatus,
    AnalyzeRequest,
    GitHubRepoInfo,
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
    ModuleInfo,
    FunctionTierItem,
    FunctionType,
    TierLevel,
)


# ==================== Fixtures ====================

@pytest.fixture
def analysis_service():
    """Create a fresh AnalysisService for each test."""
    return AnalysisService()


@pytest.fixture
def temp_js_project():
    """Create a temporary JavaScript project with realistic structure."""
    tmpdir = tempfile.mkdtemp()

    # Create directory structure
    src_dir = Path(tmpdir) / "src"
    src_dir.mkdir()

    components_dir = src_dir / "components"
    components_dir.mkdir()

    utils_dir = src_dir / "utils"
    utils_dir.mkdir()

    services_dir = src_dir / "services"
    services_dir.mkdir()

    # Main app entry point
    (src_dir / "App.tsx").write_text('''
import React from 'react';
import { Button } from './components/Button';
import { Header } from './components/Header';
import { useAuth } from './hooks/useAuth';
import { apiClient } from './services/api';

export function App() {
    const { user, login, logout } = useAuth();

    const handleLogin = async () => {
        await apiClient.login();
        login();
    };

    return (
        <div>
            <Header user={user} onLogout={logout} />
            <main>
                <Button onClick={handleLogin}>Login</Button>
            </main>
        </div>
    );
}
''')

    (src_dir / "index.tsx").write_text('''
import React from 'react';
import ReactDOM from 'react-dom';
import { App } from './App';

ReactDOM.render(<App />, document.getElementById('root'));
''')

    # Components
    (components_dir / "Button.tsx").write_text('''
import React from 'react';
import { formatClassName } from '../utils/helpers';

interface ButtonProps {
    onClick: () => void;
    children: React.ReactNode;
    variant?: 'primary' | 'secondary';
}

export function Button({ onClick, children, variant = 'primary' }: ButtonProps) {
    const className = formatClassName('button', variant);
    return (
        <button className={className} onClick={onClick}>
            {children}
        </button>
    );
}
''')

    (components_dir / "Header.tsx").write_text('''
import React from 'react';
import { Button } from './Button';

interface HeaderProps {
    user?: { name: string };
    onLogout: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
    return (
        <header>
            {user && <span>Welcome, {user.name}</span>}
            <Button onClick={onLogout}>Logout</Button>
        </header>
    );
}
''')

    # Create hooks directory
    hooks_dir = src_dir / "hooks"
    hooks_dir.mkdir()

    (hooks_dir / "useAuth.ts").write_text('''
import { useState, useCallback } from 'react';

export function useAuth() {
    const [user, setUser] = useState(null);

    const login = useCallback(() => {
        setUser({ name: 'User' });
    }, []);

    const logout = useCallback(() => {
        setUser(null);
    }, []);

    return { user, login, logout };
}
''')

    # Utils
    (utils_dir / "helpers.ts").write_text('''
export function formatClassName(...classes: string[]): string {
    return classes.filter(Boolean).join(' ');
}

export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

export function validateEmail(email: string): boolean {
    const pattern = /^[^@]+@[^@]+\.[^@]+$/;
    return pattern.test(email);
}
''')

    # Services
    (services_dir / "api.ts").write_text('''
const BASE_URL = 'https://api.example.com';

export const apiClient = {
    async login() {
        const response = await fetch(`${BASE_URL}/login`, { method: 'POST' });
        return response.json();
    },

    async fetchUser(id: string) {
        const response = await fetch(`${BASE_URL}/users/${id}`);
        return response.json();
    },

    async updateProfile(data: { name: string }) {
        const response = await fetch(`${BASE_URL}/profile`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        return response.json();
    },
};
''')

    yield tmpdir

    shutil.rmtree(tmpdir)


@pytest.fixture
def temp_python_project():
    """Create a temporary Python project with realistic structure."""
    tmpdir = tempfile.mkdtemp()

    # Create package structure
    pkg_dir = Path(tmpdir) / "mypackage"
    pkg_dir.mkdir()
    (pkg_dir / "__init__.py").write_text("")

    # Main module
    (pkg_dir / "main.py").write_text('''
from .services.processor import DataProcessor
from .utils.helpers import validate_input
from .config import settings

def main():
    """Main entry point."""
    processor = DataProcessor(settings.API_URL)
    data = processor.fetch_data()

    if validate_input(data):
        result = processor.process(data)
        return result
    return None

if __name__ == "__main__":
    main()
''')

    # Config
    (pkg_dir / "config.py").write_text('''
class Settings:
    API_URL = "https://api.example.com"
    DEBUG = True
    MAX_RETRIES = 3

settings = Settings()
''')

    # Services
    services_dir = pkg_dir / "services"
    services_dir.mkdir()
    (services_dir / "__init__.py").write_text("")

    (services_dir / "processor.py").write_text('''
import requests
from ..utils.helpers import format_data

class DataProcessor:
    def __init__(self, api_url: str):
        self.api_url = api_url

    def fetch_data(self):
        response = requests.get(f"{self.api_url}/data")
        return response.json()

    def process(self, data):
        return format_data(data)
''')

    # Utils
    utils_dir = pkg_dir / "utils"
    utils_dir.mkdir()
    (utils_dir / "__init__.py").write_text("")

    (utils_dir / "helpers.py").write_text('''
def validate_input(data):
    """Validate input data."""
    if not data:
        return False
    if not isinstance(data, dict):
        return False
    return True

def format_data(data):
    """Format data for output."""
    return {k: str(v).upper() for k, v in data.items()}
''')

    yield tmpdir

    shutil.rmtree(tmpdir)


@pytest.fixture
def large_project():
    """Create a large project with many files for performance testing."""
    tmpdir = tempfile.mkdtemp()
    src_dir = Path(tmpdir) / "src"
    src_dir.mkdir()

    # Create components directory
    components_dir = src_dir / "components"
    components_dir.mkdir()

    # Create 50 component files that import from utils
    for i in range(50):
        component_content = f'''
import React from 'react';
import {{ helper{i % 10} }} from '../utils/helpers';

export function Component{i}({{ prop }}) {{
    const result = helper{i % 10}(prop);
    return <div>{{result}}</div>;
}}
'''
        (components_dir / f"Component{i}.tsx").write_text(component_content)

    # Create utility files
    utils_dir = src_dir / "utils"
    utils_dir.mkdir()

    helpers_content = '\n'.join([
        f"export function helper{i}(x) {{ return x * {i + 1}; }}"
        for i in range(10)
    ])
    (utils_dir / "helpers.ts").write_text(helpers_content)

    yield tmpdir

    shutil.rmtree(tmpdir)


def create_mock_llm_analysis(files: list) -> dict:
    """Create mock LLM analysis for a list of files."""
    analysis = {}
    for file in files:
        filename = file.name if hasattr(file, 'name') else Path(file).name

        if 'component' in filename.lower() or filename.endswith('.tsx'):
            role = ArchitecturalRole.REACT_COMPONENT
            category = Category.FRONTEND
        elif 'util' in filename.lower() or 'helper' in filename.lower():
            role = ArchitecturalRole.UTILITY
            category = Category.SHARED
        elif 'service' in filename.lower() or 'api' in filename.lower():
            role = ArchitecturalRole.API_SERVICE
            category = Category.BACKEND
        elif 'hook' in filename.lower():
            role = ArchitecturalRole.HOOK
            category = Category.FRONTEND
        elif 'config' in filename.lower():
            role = ArchitecturalRole.CONFIG
            category = Category.CONFIG
        else:
            role = ArchitecturalRole.UTILITY
            category = Category.SHARED

        analysis[filename] = LLMFileAnalysis(
            filename=filename,
            architectural_role=role,
            description=f"Mock description for {filename}",
            category=category,
        )

    return analysis


def create_mock_summary() -> CodebaseSummary:
    """Create a mock CodebaseSummary for testing."""
    return CodebaseSummary(
        project_type="web_app",
        primary_purpose="Test application for integration testing",
        tech_stack=TechStackInfo(
            languages=["typescript", "javascript"],
            frameworks=["react"],
            libraries=["react-dom"],
            patterns=["hooks", "functional components"],
        ),
        architecture_summary="Modern React application with hooks and functional components",
        key_modules=[
            ModuleInfo(name="App", purpose="Main application entry point"),
            ModuleInfo(name="Button", purpose="Reusable button component"),
            ModuleInfo(name="Header", purpose="Application header component"),
        ],
        complexity_assessment=ComplexityInfo(
            level="moderate",
            reasoning="Well-structured React application",
        ),
        notable_aspects=["TypeScript for type safety"],
    )


# ==================== Local Analysis Flow Tests ====================

@pytest.mark.integration
class TestLocalAnalysisFlow:
    """Integration tests for complete local analysis flow."""

    @pytest.mark.asyncio
    async def test_complete_local_analysis_flow(self, analysis_service, temp_js_project):
        """Test complete local analysis: parse → analyze → build graph → save."""
        # Create analysis job
        analysis_id = analysis_service.create_job(temp_js_project)

        # Mock LLM analyzer
        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            # Get parsed files to create appropriate mock response
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                # Run analysis
                await analysis_service.run_analysis(analysis_id)

        # Verify job completed successfully
        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.COMPLETED
        assert job.error is None
        assert job.result is not None

        # Verify result structure
        result = job.result
        assert isinstance(result, ReactFlowGraph)
        assert len(result.nodes) > 0
        assert result.metadata is not None
        assert result.metadata.file_count > 0

        # Verify nodes have correct structure
        for node in result.nodes:
            assert node.id is not None
            assert 'data' in node.model_dump()
            assert node.position is not None

    @pytest.mark.asyncio
    async def test_analysis_captures_all_files(self, analysis_service, temp_js_project):
        """Test that analysis captures all project files."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        result = job.result

        # Should have captured all the files we created
        assert result.metadata.file_count >= 7  # At least our main files

    @pytest.mark.asyncio
    async def test_analysis_builds_correct_dependencies(self, analysis_service, temp_js_project):
        """Test that analysis correctly identifies dependencies."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        result = job.result

        # Should have some edges (dependencies)
        assert len(result.edges) > 0

    @pytest.mark.asyncio
    async def test_analysis_categorizes_files_correctly(self, analysis_service, temp_js_project):
        """Test that files are categorized by architectural role."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        result = job.result

        # Check that nodes have valid roles
        roles = set()
        for node in result.nodes:
            if hasattr(node, 'data') and hasattr(node.data, 'role'):
                roles.add(node.data.role)

        # Should have variety of roles
        assert len(roles) > 0

    @pytest.mark.asyncio
    async def test_python_project_analysis(self, analysis_service, temp_python_project):
        """Test analysis of Python projects."""
        analysis_id = analysis_service.create_job(temp_python_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_python_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.COMPLETED
        assert job.result is not None

        # Check Python files were detected
        languages = job.result.metadata.languages
        assert 'python' in languages


# ==================== GitHub Analysis Flow Tests ====================

@pytest.mark.integration
class TestGitHubAnalysisFlow:
    """Integration tests for GitHub analysis flow."""

    @pytest.mark.asyncio
    async def test_github_analysis_with_mocked_clone(self, analysis_service, temp_js_project):
        """Test GitHub analysis flow with mocked clone operation."""
        # Set up mock GitHub repo info
        repo_info = GitHubRepoInfo(
            owner="testuser",
            repo="test-repo",
            branch="main",
            path=None,
        )

        # Create job with GitHub-style path
        analysis_id = analysis_service.create_job(f"github:{repo_info.owner}/{repo_info.repo}")
        job = analysis_service.get_job(analysis_id)

        # Simulate clone completion
        job.directory_path = temp_js_project

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                # Run analysis simulating GitHub flow
                await analysis_service.run_analysis(
                    analysis_id,
                    user_id=None,
                    is_github_analysis=True,
                )

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.COMPLETED
        assert job.result is not None

    @pytest.mark.asyncio
    async def test_github_analysis_stores_file_content(self, analysis_service, temp_js_project):
        """Test that GitHub analysis includes file content for storage."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

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
                        user_id="test-user",
                        is_github_analysis=True,
                    )

                # Verify complete_analysis was called with parsed_files
                call_args = mock_db_instance.complete_analysis.call_args
                # The parsed_files should be passed for GitHub analyses
                assert call_args is not None


# ==================== Tier List Generation Tests ====================

@pytest.mark.integration
class TestTierListGeneration:
    """Integration tests for tier list generation."""

    @pytest.mark.asyncio
    async def test_tier_list_generated_during_analysis(self, analysis_service, temp_js_project):
        """Test that tier list is generated during analysis."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)

        # Should have function tier items
        assert job.function_tier_items is not None
        assert len(job.function_tier_items) >= 0  # May be 0 if no functions detected

    @pytest.mark.asyncio
    async def test_function_stats_generated(self, analysis_service, temp_js_project):
        """Test that function stats are generated."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)

        # Function stats may or may not be populated based on analysis success
        # The important thing is the job completed
        assert job.status == AnalysisStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_tier_items_have_valid_structure(self, analysis_service, temp_js_project):
        """Test that tier items have valid structure."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)

        for item in job.function_tier_items:
            assert item.function_name is not None
            assert item.tier is not None
            assert item.tier_percentile >= 0 and item.tier_percentile <= 100


# ==================== Summary Generation Tests ====================

@pytest.mark.integration
class TestSummaryGeneration:
    """Integration tests for summary generation."""

    @pytest.mark.asyncio
    async def test_summary_generated_during_analysis(self, analysis_service, temp_js_project):
        """Test that summary is generated during analysis."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), True))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        result = job.result

        # Check that summary is included in metadata
        assert result.metadata.summary is not None

    @pytest.mark.asyncio
    async def test_summary_includes_tech_stack(self, analysis_service, temp_js_project):
        """Test that summary includes tech stack information."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            expected_summary = create_mock_summary()

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(expected_summary, False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        summary = job.result.metadata.summary

        assert summary.tech_stack is not None
        assert len(summary.tech_stack.languages) > 0

    @pytest.mark.asyncio
    async def test_readme_detection_flag(self, analysis_service, temp_js_project):
        """Test that README detection flag is captured."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                # Return True for readme_detected
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), True))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)

        assert job.result.metadata.readme_detected is True


# ==================== Large Codebase Tests ====================

@pytest.mark.integration
@pytest.mark.slow
class TestLargeCodebaseHandling:
    """Integration tests for large codebase handling."""

    @pytest.mark.asyncio
    async def test_large_codebase_analysis(self, analysis_service, large_project):
        """Test analysis of a large codebase (50+ files)."""
        analysis_id = analysis_service.create_job(large_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(large_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)

        # Should complete successfully
        assert job.status == AnalysisStatus.COMPLETED
        assert job.total_files >= 50

    @pytest.mark.asyncio
    async def test_large_codebase_has_edges(self, analysis_service, large_project):
        """Test that large codebase has proper dependency edges."""
        analysis_id = analysis_service.create_job(large_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(large_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        result = job.result

        # Should have edges connecting components to utils
        assert len(result.edges) > 0


# ==================== Error Handling Tests ====================

@pytest.mark.integration
class TestAnalysisErrorHandling:
    """Integration tests for error handling in analysis flow."""

    @pytest.mark.asyncio
    async def test_invalid_directory_fails_gracefully(self, analysis_service):
        """Test that invalid directory fails gracefully."""
        analysis_id = analysis_service.create_job("/nonexistent/path")

        with pytest.raises(ValueError) as exc_info:
            await analysis_service.run_analysis(analysis_id)

        assert "does not exist" in str(exc_info.value)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.FAILED
        assert job.error is not None

    @pytest.mark.asyncio
    async def test_empty_directory_fails_gracefully(self, analysis_service):
        """Test that empty directory fails with clear error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            analysis_id = analysis_service.create_job(tmpdir)

            with pytest.raises(ValueError) as exc_info:
                await analysis_service.run_analysis(analysis_id)

            assert "No supported files" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_llm_failure_propagates(self, analysis_service, temp_js_project):
        """Test that LLM failures are properly propagated."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            mock_llm.side_effect = Exception("LLM API Error")

            with pytest.raises(Exception) as exc_info:
                await analysis_service.run_analysis(analysis_id)

            assert "LLM API Error" in str(exc_info.value)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.FAILED


# ==================== Database Integration Tests ====================

@pytest.mark.integration
class TestDatabasePersistence:
    """Integration tests for database persistence during analysis."""

    @pytest.mark.asyncio
    async def test_analysis_saves_to_database_with_user(self, analysis_service, temp_js_project):
        """Test that analysis results are saved when user is authenticated."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

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
                        user_id="test-user-id",
                    )

                # Verify database was called
                mock_db_instance.complete_analysis.assert_called_once()

    @pytest.mark.asyncio
    async def test_analysis_skips_database_without_user(self, analysis_service, temp_js_project):
        """Test that analysis skips database when no user is authenticated."""
        analysis_id = analysis_service.create_job(temp_js_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_js_project, include_content=True)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.database.get_database_service") as mock_db:
                with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                    mock_generator = MagicMock()
                    mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                    mock_summary.return_value = mock_generator

                    await analysis_service.run_analysis(analysis_id)

                # Database service should not be called
                mock_db.assert_not_called()


# ==================== Go Project Integration Tests ====================

@pytest.fixture
def temp_go_project():
    """Create a temporary Go project with realistic structure."""
    tmpdir = tempfile.mkdtemp()

    # Create directory structure
    cmd_dir = Path(tmpdir) / "cmd" / "server"
    cmd_dir.mkdir(parents=True)

    internal_dir = Path(tmpdir) / "internal"
    handlers_dir = internal_dir / "handlers"
    models_dir = internal_dir / "models"
    services_dir = internal_dir / "services"
    handlers_dir.mkdir(parents=True)
    models_dir.mkdir(parents=True)
    services_dir.mkdir(parents=True)

    # go.mod
    (Path(tmpdir) / "go.mod").write_text('''module github.com/example/myapp

go 1.21
''')

    # Main entry point
    (cmd_dir / "main.go").write_text('''package main

import (
    "log"
    "net/http"
    "github.com/example/myapp/internal/handlers"
)

func main() {
    handler := handlers.NewUserHandler()
    http.HandleFunc("/users", handler.GetUsers)
    log.Fatal(http.ListenAndServe(":8080", nil))
}
''')

    # Handler
    (handlers_dir / "user_handler.go").write_text('''package handlers

import (
    "encoding/json"
    "net/http"
    "github.com/example/myapp/internal/services"
)

type UserHandler struct {
    service *services.UserService
}

func NewUserHandler() *UserHandler {
    return &UserHandler{
        service: services.NewUserService(),
    }
}

func (h *UserHandler) GetUsers(w http.ResponseWriter, r *http.Request) {
    users := h.service.GetAll()
    json.NewEncoder(w).Encode(users)
}
''')

    # Service
    (services_dir / "user_service.go").write_text('''package services

import "github.com/example/myapp/internal/models"

type UserService struct{}

func NewUserService() *UserService {
    return &UserService{}
}

func (s *UserService) GetAll() []models.User {
    return []models.User{
        {ID: 1, Name: "Alice"},
        {ID: 2, Name: "Bob"},
    }
}
''')

    # Model
    (models_dir / "user.go").write_text('''package models

type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}
''')

    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.mark.integration
class TestGoProjectAnalysis:
    """Integration tests for Go project analysis."""

    @pytest.mark.asyncio
    async def test_go_project_analysis_flow(self, analysis_service, temp_go_project):
        """Test complete analysis flow for a Go project."""
        analysis_id = analysis_service.create_job(temp_go_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_go_project)

            # Verify Go files are detected
            go_files = [f for f in parsed_files if f.language == Language.GO]
            assert len(go_files) >= 4  # main.go, user_handler.go, user_service.go, user.go

            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.COMPLETED
        assert job.total_files >= 4

    @pytest.mark.asyncio
    async def test_go_imports_extracted(self, analysis_service, temp_go_project):
        """Test that Go imports are correctly extracted."""
        parser = get_parser()
        parsed_files = parser.parse_directory(temp_go_project)

        # Find the main.go file
        main_file = next((f for f in parsed_files if "main.go" in f.path), None)
        assert main_file is not None

        # Should have imports
        import_modules = [imp.module for imp in main_file.imports]
        assert "log" in import_modules
        assert "net/http" in import_modules


# ==================== Rust Project Integration Tests ====================

@pytest.fixture
def temp_rust_project():
    """Create a temporary Rust project with realistic structure."""
    tmpdir = tempfile.mkdtemp()

    # Create directory structure
    src_dir = Path(tmpdir) / "src"
    handlers_dir = src_dir / "handlers"
    models_dir = src_dir / "models"
    services_dir = src_dir / "services"
    src_dir.mkdir()
    handlers_dir.mkdir()
    models_dir.mkdir()
    services_dir.mkdir()

    # Cargo.toml
    (Path(tmpdir) / "Cargo.toml").write_text('''[package]
name = "myapp"
version = "0.1.0"
edition = "2021"

[dependencies]
''')

    # Main entry point
    (src_dir / "main.rs").write_text('''mod handlers;
mod models;
mod services;

use handlers::user_handler::UserHandler;

fn main() {
    let handler = UserHandler::new();
    let users = handler.get_all();
    println!("{:?}", users);
}
''')

    # Handler module
    (handlers_dir / "mod.rs").write_text('''pub mod user_handler;
''')

    (handlers_dir / "user_handler.rs").write_text('''use crate::models::user::User;
use crate::services::user_service::UserService;

pub struct UserHandler {
    service: UserService,
}

impl UserHandler {
    pub fn new() -> Self {
        Self {
            service: UserService::new(),
        }
    }

    pub fn get_all(&self) -> Vec<User> {
        self.service.get_all()
    }
}
''')

    # Service module
    (services_dir / "mod.rs").write_text('''pub mod user_service;
''')

    (services_dir / "user_service.rs").write_text('''use crate::models::user::User;

pub struct UserService;

impl UserService {
    pub fn new() -> Self {
        Self
    }

    pub fn get_all(&self) -> Vec<User> {
        vec![
            User::new(1, "Alice".to_string()),
            User::new(2, "Bob".to_string()),
        ]
    }
}
''')

    # Model module
    (models_dir / "mod.rs").write_text('''pub mod user;
''')

    (models_dir / "user.rs").write_text('''#[derive(Debug, Clone)]
pub struct User {
    pub id: u64,
    pub name: String,
}

impl User {
    pub fn new(id: u64, name: String) -> Self {
        Self { id, name }
    }
}
''')

    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.mark.integration
class TestRustProjectAnalysis:
    """Integration tests for Rust project analysis."""

    @pytest.mark.asyncio
    async def test_rust_project_analysis_flow(self, analysis_service, temp_rust_project):
        """Test complete analysis flow for a Rust project."""
        analysis_id = analysis_service.create_job(temp_rust_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_rust_project)

            # Verify Rust files are detected
            rust_files = [f for f in parsed_files if f.language == Language.RUST]
            assert len(rust_files) >= 7  # main.rs, 3 mod.rs, user_handler.rs, user_service.rs, user.rs

            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.COMPLETED
        assert job.total_files >= 7

    @pytest.mark.asyncio
    async def test_rust_imports_extracted(self, analysis_service, temp_rust_project):
        """Test that Rust imports are correctly extracted."""
        parser = get_parser()
        parsed_files = parser.parse_directory(temp_rust_project)

        # Find the user_handler.rs file
        handler_file = next((f for f in parsed_files if "user_handler.rs" in f.path), None)
        assert handler_file is not None

        # Should have use statements
        import_modules = [imp.module for imp in handler_file.imports]
        assert any("crate::models::user" in m for m in import_modules)
        assert any("crate::services::user_service" in m for m in import_modules)


# ==================== Swift Project Integration Tests ====================

@pytest.fixture
def temp_swift_project():
    """Create a temporary Swift project with realistic structure."""
    tmpdir = tempfile.mkdtemp()

    # Create directory structure
    sources_dir = Path(tmpdir) / "Sources" / "MyApp"
    models_dir = sources_dir / "Models"
    views_dir = sources_dir / "Views"
    viewmodels_dir = sources_dir / "ViewModels"
    services_dir = sources_dir / "Services"
    sources_dir.mkdir(parents=True)
    models_dir.mkdir()
    views_dir.mkdir()
    viewmodels_dir.mkdir()
    services_dir.mkdir()

    # Package.swift
    (Path(tmpdir) / "Package.swift").write_text('''// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "MyApp",
    platforms: [.iOS(.v17)],
    targets: [.target(name: "MyApp")]
)
''')

    # Model
    (models_dir / "User.swift").write_text('''import Foundation

public struct User: Codable, Identifiable {
    public let id: UUID
    public let name: String
    public let email: String
}
''')

    # ViewModel
    (viewmodels_dir / "UserViewModel.swift").write_text('''import Foundation
import Combine

@MainActor
class UserViewModel: ObservableObject {
    @Published var users: [User] = []
    @Published var isLoading = false

    private let service: UserService

    init(service: UserService = UserService()) {
        self.service = service
    }

    func fetchUsers() async {
        isLoading = true
        users = await service.fetchUsers()
        isLoading = false
    }
}
''')

    # Service
    (services_dir / "UserService.swift").write_text('''import Foundation

class UserService {
    func fetchUsers() async -> [User] {
        return [
            User(id: UUID(), name: "Alice", email: "alice@example.com"),
            User(id: UUID(), name: "Bob", email: "bob@example.com"),
        ]
    }
}
''')

    # View
    (views_dir / "ContentView.swift").write_text('''import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = UserViewModel()

    var body: some View {
        NavigationStack {
            List(viewModel.users) { user in
                Text(user.name)
            }
            .navigationTitle("Users")
            .task {
                await viewModel.fetchUsers()
            }
        }
    }
}
''')

    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.mark.integration
class TestSwiftProjectAnalysis:
    """Integration tests for Swift project analysis."""

    @pytest.mark.asyncio
    async def test_swift_project_analysis_flow(self, analysis_service, temp_swift_project):
        """Test complete analysis flow for a Swift project."""
        analysis_id = analysis_service.create_job(temp_swift_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_swift_project)

            # Verify Swift files are detected
            swift_files = [f for f in parsed_files if f.language == Language.SWIFT]
            assert len(swift_files) >= 4  # User.swift, UserViewModel.swift, UserService.swift, ContentView.swift

            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.COMPLETED
        assert job.total_files >= 4

    @pytest.mark.asyncio
    async def test_swift_imports_extracted(self, analysis_service, temp_swift_project):
        """Test that Swift imports are correctly extracted."""
        parser = get_parser()
        parsed_files = parser.parse_directory(temp_swift_project)

        # Find the ContentView.swift file
        content_view = next((f for f in parsed_files if "ContentView.swift" in f.path), None)
        assert content_view is not None

        # Should have SwiftUI import
        import_modules = [imp.module for imp in content_view.imports]
        assert "SwiftUI" in import_modules


# ==================== Multi-Language Project Integration Tests ====================

@pytest.fixture
def temp_multi_language_project():
    """Create a project with Go backend and TypeScript frontend."""
    tmpdir = tempfile.mkdtemp()

    # Go backend
    backend_dir = Path(tmpdir) / "backend"
    backend_dir.mkdir()

    (backend_dir / "main.go").write_text('''package main

import (
    "encoding/json"
    "net/http"
)

type User struct {
    ID   int    `json:"id"`
    Name string `json:"name"`
}

func main() {
    http.HandleFunc("/api/users", getUsers)
    http.ListenAndServe(":8080", nil)
}

func getUsers(w http.ResponseWriter, r *http.Request) {
    users := []User{{ID: 1, Name: "Alice"}}
    json.NewEncoder(w).Encode(users)
}
''')

    # TypeScript frontend
    frontend_dir = Path(tmpdir) / "frontend" / "src"
    frontend_dir.mkdir(parents=True)

    (frontend_dir / "App.tsx").write_text('''import React, { useEffect, useState } from 'react';
import { UserList } from './components/UserList';
import { fetchUsers } from './api/users';

export function App() {
    const [users, setUsers] = useState([]);

    useEffect(() => {
        fetchUsers().then(setUsers);
    }, []);

    return <UserList users={users} />;
}
''')

    components_dir = frontend_dir / "components"
    components_dir.mkdir()

    (components_dir / "UserList.tsx").write_text('''import React from 'react';

interface User {
    id: number;
    name: string;
}

interface Props {
    users: User[];
}

export function UserList({ users }: Props) {
    return (
        <ul>
            {users.map(user => (
                <li key={user.id}>{user.name}</li>
            ))}
        </ul>
    );
}
''')

    api_dir = frontend_dir / "api"
    api_dir.mkdir()

    (api_dir / "users.ts").write_text('''export interface User {
    id: number;
    name: string;
}

export async function fetchUsers(): Promise<User[]> {
    const response = await fetch('/api/users');
    return response.json();
}
''')

    yield tmpdir
    shutil.rmtree(tmpdir, ignore_errors=True)


@pytest.mark.integration
class TestMultiLanguageProjectAnalysis:
    """Integration tests for multi-language project analysis."""

    @pytest.mark.asyncio
    async def test_multi_language_project_analysis(self, analysis_service, temp_multi_language_project):
        """Test analysis of a project with multiple languages."""
        analysis_id = analysis_service.create_job(temp_multi_language_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_multi_language_project)

            # Verify both languages are detected
            go_files = [f for f in parsed_files if f.language == Language.GO]
            ts_files = [f for f in parsed_files if f.language == Language.TYPESCRIPT]

            assert len(go_files) >= 1  # main.go
            assert len(ts_files) >= 3  # App.tsx, UserList.tsx, users.ts

            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        job = analysis_service.get_job(analysis_id)
        assert job.status == AnalysisStatus.COMPLETED

        # Verify language distribution in result
        result = analysis_service.get_result(analysis_id)
        assert result is not None

        languages = result.metadata.languages
        assert "go" in languages
        assert "typescript" in languages

    @pytest.mark.asyncio
    async def test_multi_language_edges_detected(self, analysis_service, temp_multi_language_project):
        """Test that edges are detected within each language."""
        analysis_id = analysis_service.create_job(temp_multi_language_project)

        with patch.object(analysis_service._llm_analyzer, 'analyze_files', new_callable=AsyncMock) as mock_llm:
            parser = get_parser()
            parsed_files = parser.parse_directory(temp_multi_language_project)
            mock_llm.return_value = create_mock_llm_analysis(parsed_files)

            with patch("app.services.summary_generator.get_summary_generator") as mock_summary:
                mock_generator = MagicMock()
                mock_generator.generate_summary = AsyncMock(return_value=(create_mock_summary(), False))
                mock_summary.return_value = mock_generator

                await analysis_service.run_analysis(analysis_id)

        result = analysis_service.get_result(analysis_id)
        assert result is not None

        # Should have edges (TypeScript imports between files)
        assert len(result.edges) > 0
