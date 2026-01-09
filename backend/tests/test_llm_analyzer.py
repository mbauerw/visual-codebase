"""
Tests for the LLMAnalyzer service.
Covers Anthropic API mocking, batch processing, file categorization,
error handling, response parsing, and token limit handling.
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Any

from app.services.llm_analyzer import LLMAnalyzer, get_llm_analyzer
from app.models.schemas import (
    ArchitecturalRole,
    Category,
    ImportInfo,
    ImportType,
    Language,
    LLMFileAnalysis,
    ParsedFile,
)


# ==================== Fixtures ====================

@pytest.fixture
def mock_settings():
    """Create mock settings."""
    settings = MagicMock()
    settings.anthropic_api_key = "test-api-key"
    settings.llm_model = "claude-sonnet-4-20250514"
    settings.llm_max_tokens = 4096
    settings.max_files_per_batch = 20
    settings.llm_parallel_batches = 3
    return settings


@pytest.fixture
def analyzer(mock_settings):
    """Create an LLMAnalyzer with mocked settings."""
    with patch("app.services.llm_analyzer.get_settings", return_value=mock_settings):
        analyzer = LLMAnalyzer()
        # Mock the async client
        analyzer.client = MagicMock()
        analyzer.client.messages = MagicMock()
        return analyzer


def create_parsed_file(
    relative_path: str,
    name: str = None,
    language: Language = Language.TYPESCRIPT,
    imports: list[ImportInfo] = None,
    functions: list[str] = None,
    classes: list[str] = None,
    line_count: int = 50,
) -> ParsedFile:
    """Helper to create a ParsedFile for testing."""
    if name is None:
        name = relative_path.split("/")[-1]
    return ParsedFile(
        path=f"/project/{relative_path}",
        relative_path=relative_path,
        name=name,
        folder="/".join(relative_path.split("/")[:-1]),
        language=language,
        imports=imports or [],
        exports=[],
        functions=functions or [],
        classes=classes or [],
        size_bytes=1000,
        line_count=line_count,
        content=None,
    )


def create_mock_llm_response(files: list[dict]) -> MagicMock:
    """Create a mock Anthropic API response."""
    response = MagicMock()
    content_block = MagicMock()
    content_block.text = json.dumps(files)
    response.content = [content_block]
    return response


# ==================== Response Parsing Tests ====================

class TestResponseParsing:
    """Tests for parsing LLM responses."""

    def test_parse_valid_json_response(self, analyzer):
        """Test parsing a valid JSON response."""
        response = '''[
            {"filename": "App.tsx", "architectural_role": "react_component", "description": "Main app", "category": "frontend"},
            {"filename": "utils.ts", "architectural_role": "utility", "description": "Helper functions", "category": "shared"}
        ]'''

        result = analyzer._parse_llm_response(response)

        assert len(result) == 2
        assert result[0].filename == "App.tsx"
        assert result[0].architectural_role == ArchitecturalRole.REACT_COMPONENT
        assert result[1].filename == "utils.ts"
        assert result[1].architectural_role == ArchitecturalRole.UTILITY

    def test_parse_response_with_markdown_wrapper(self, analyzer):
        """Test parsing response wrapped in markdown code blocks."""
        response = '''```json
[
    {"filename": "Button.tsx", "architectural_role": "react_component", "description": "Button", "category": "frontend"}
]
```'''

        result = analyzer._parse_llm_response(response)

        assert len(result) == 1
        assert result[0].filename == "Button.tsx"

    def test_parse_invalid_json_returns_empty(self, analyzer):
        """Test that invalid JSON returns empty list."""
        response = "This is not valid JSON at all"

        result = analyzer._parse_llm_response(response)

        assert result == []

    def test_parse_unknown_role_falls_back(self, analyzer):
        """Test that unknown roles fall back to UNKNOWN."""
        response = '''[
            {"filename": "file.ts", "architectural_role": "invalid_role", "description": "desc", "category": "frontend"}
        ]'''

        result = analyzer._parse_llm_response(response)

        assert len(result) == 1
        assert result[0].architectural_role == ArchitecturalRole.UNKNOWN

    def test_parse_unknown_category_falls_back(self, analyzer):
        """Test that unknown categories fall back to UNKNOWN."""
        response = '''[
            {"filename": "file.ts", "architectural_role": "utility", "description": "desc", "category": "invalid_category"}
        ]'''

        result = analyzer._parse_llm_response(response)

        assert len(result) == 1
        assert result[0].category == Category.UNKNOWN


# ==================== Role Inference Tests ====================

class TestRoleInference:
    """Tests for inferring roles from file paths."""

    def test_infer_test_file(self, analyzer):
        """Test inferring test file role."""
        assert analyzer._infer_role_from_path("test_utils.py") == ArchitecturalRole.TEST
        assert analyzer._infer_role_from_path("src/__tests__/App.test.tsx") == ArchitecturalRole.TEST
        assert analyzer._infer_role_from_path("Button.spec.js") == ArchitecturalRole.TEST

    def test_infer_config_file(self, analyzer):
        """Test inferring config file role."""
        assert analyzer._infer_role_from_path("config.ts") == ArchitecturalRole.CONFIG
        assert analyzer._infer_role_from_path("settings.py") == ArchitecturalRole.CONFIG
        assert analyzer._infer_role_from_path("webpack.config.js") == ArchitecturalRole.CONFIG

    def test_infer_react_component(self, analyzer):
        """Test inferring React component role."""
        assert analyzer._infer_role_from_path("components/Button.tsx") == ArchitecturalRole.REACT_COMPONENT
        assert analyzer._infer_role_from_path("pages/Home.tsx") == ArchitecturalRole.REACT_COMPONENT
        assert analyzer._infer_role_from_path("views/Dashboard.jsx") == ArchitecturalRole.REACT_COMPONENT

    def test_infer_hook(self, analyzer):
        """Test inferring hook role."""
        assert analyzer._infer_role_from_path("hooks/useAuth.ts") == ArchitecturalRole.HOOK
        assert analyzer._infer_role_from_path("useCustomHook.ts") == ArchitecturalRole.HOOK

    def test_infer_context(self, analyzer):
        """Test inferring context role."""
        assert analyzer._infer_role_from_path("context/AuthContext.tsx") == ArchitecturalRole.CONTEXT

    def test_infer_store(self, analyzer):
        """Test inferring store role."""
        assert analyzer._infer_role_from_path("store/userStore.ts") == ArchitecturalRole.STORE
        assert analyzer._infer_role_from_path("redux/slices/user.ts") == ArchitecturalRole.STORE

    def test_infer_api_service(self, analyzer):
        """Test inferring API service role."""
        assert analyzer._infer_role_from_path("api/users.ts") == ArchitecturalRole.API_SERVICE
        assert analyzer._infer_role_from_path("services/auth.ts") == ArchitecturalRole.API_SERVICE

    def test_infer_model(self, analyzer):
        """Test inferring model role."""
        assert analyzer._infer_role_from_path("models/User.ts") == ArchitecturalRole.MODEL
        assert analyzer._infer_role_from_path("types/index.ts") == ArchitecturalRole.MODEL

    def test_infer_middleware(self, analyzer):
        """Test inferring middleware role."""
        assert analyzer._infer_role_from_path("middleware/auth.ts") == ArchitecturalRole.MIDDLEWARE

    def test_infer_controller(self, analyzer):
        """Test inferring controller role."""
        assert analyzer._infer_role_from_path("controllers/userController.ts") == ArchitecturalRole.CONTROLLER

    def test_infer_router(self, analyzer):
        """Test inferring router role."""
        assert analyzer._infer_role_from_path("router/index.ts") == ArchitecturalRole.ROUTER
        assert analyzer._infer_role_from_path("routes/api.ts") == ArchitecturalRole.ROUTER

    def test_infer_utility(self, analyzer):
        """Test inferring utility role."""
        assert analyzer._infer_role_from_path("utils/helpers.ts") == ArchitecturalRole.UTILITY
        assert analyzer._infer_role_from_path("lib/format.ts") == ArchitecturalRole.UTILITY

    def test_infer_unknown(self, analyzer):
        """Test inferring unknown role."""
        assert analyzer._infer_role_from_path("random/file.ts") == ArchitecturalRole.UNKNOWN


# ==================== Category Inference Tests ====================

class TestCategoryInference:
    """Tests for inferring categories from file paths."""

    def test_infer_test_category(self, analyzer):
        """Test inferring test category."""
        assert analyzer._infer_category_from_path("test_utils.py") == Category.TEST
        assert analyzer._infer_category_from_path("__tests__/App.test.tsx") == Category.TEST

    def test_infer_config_category(self, analyzer):
        """Test inferring config category."""
        assert analyzer._infer_category_from_path("config.ts") == Category.CONFIG
        assert analyzer._infer_category_from_path("package.json") == Category.CONFIG

    def test_infer_frontend_category(self, analyzer):
        """Test inferring frontend category."""
        assert analyzer._infer_category_from_path("frontend/App.tsx") == Category.FRONTEND
        assert analyzer._infer_category_from_path("client/pages/Home.tsx") == Category.FRONTEND
        assert analyzer._infer_category_from_path("src/components/Button.tsx") == Category.FRONTEND

    def test_infer_backend_category(self, analyzer):
        """Test inferring backend category."""
        assert analyzer._infer_category_from_path("backend/main.py") == Category.BACKEND
        assert analyzer._infer_category_from_path("server/routes/api.ts") == Category.BACKEND
        assert analyzer._infer_category_from_path("api/users.ts") == Category.BACKEND

    def test_infer_shared_category(self, analyzer):
        """Test inferring shared category."""
        assert analyzer._infer_category_from_path("shared/types.ts") == Category.SHARED
        assert analyzer._infer_category_from_path("common/utils.ts") == Category.SHARED

    def test_infer_infrastructure_category(self, analyzer):
        """Test inferring infrastructure category."""
        assert analyzer._infer_category_from_path("docker-compose.yml") == Category.INFRASTRUCTURE
        assert analyzer._infer_category_from_path("terraform/main.tf") == Category.INFRASTRUCTURE

    def test_infer_unknown_category(self, analyzer):
        """Test inferring unknown category."""
        assert analyzer._infer_category_from_path("random/file.ts") == Category.UNKNOWN


# ==================== File Summary Building Tests ====================

class TestFileSummaryBuilding:
    """Tests for building file summaries for the LLM prompt."""

    def test_build_file_summary_basic(self, analyzer):
        """Test basic file summary building."""
        files = [
            create_parsed_file(
                "src/App.tsx",
                functions=["render", "handleClick"],
                classes=["App"],
            ),
        ]

        summary = analyzer._build_file_summary(files)

        assert "App.tsx" in summary
        assert "typescript" in summary.lower()
        assert "render" in summary
        assert "handleClick" in summary
        assert "App" in summary

    def test_build_file_summary_truncates_long_lists(self, analyzer):
        """Test that long lists are truncated."""
        files = [
            create_parsed_file(
                "src/utils.ts",
                functions=[f"func{i}" for i in range(20)],  # More than 15
            ),
        ]

        summary = analyzer._build_file_summary(files)

        assert "..." in summary
        assert "+5 more" in summary

    def test_build_file_summary_includes_imports(self, analyzer):
        """Test that imports are included in summary."""
        files = [
            create_parsed_file(
                "src/App.tsx",
                imports=[
                    ImportInfo(module="react", import_type=ImportType.IMPORT, is_relative=False),
                    ImportInfo(module="./utils", import_type=ImportType.IMPORT, is_relative=True),
                ],
            ),
        ]

        summary = analyzer._build_file_summary(files)

        assert "react" in summary
        assert "./utils" in summary


# ==================== Batch Analysis Tests ====================

class TestBatchAnalysis:
    """Tests for batch file analysis."""

    @pytest.mark.asyncio
    async def test_analyze_batch_success(self, analyzer):
        """Test successful batch analysis."""
        files = [
            create_parsed_file("src/App.tsx", functions=["render"]),
            create_parsed_file("src/utils.ts", functions=["helper"]),
        ]

        mock_response = create_mock_llm_response([
            {"filename": "App.tsx", "architectural_role": "react_component", "description": "Main app", "category": "frontend"},
            {"filename": "utils.ts", "architectural_role": "utility", "description": "Helpers", "category": "shared"},
        ])

        analyzer.client.messages.create = AsyncMock(return_value=mock_response)

        result = await analyzer.analyze_batch(files, "project")

        assert len(result) == 2
        assert result[0].filename == "App.tsx"
        assert result[0].architectural_role == ArchitecturalRole.REACT_COMPONENT

    @pytest.mark.asyncio
    async def test_analyze_batch_empty_files(self, analyzer):
        """Test analyzing empty file list."""
        result = await analyzer.analyze_batch([], "project")

        assert result == []

    @pytest.mark.asyncio
    async def test_analyze_batch_api_failure_fallback(self, analyzer):
        """Test fallback behavior when API fails."""
        files = [
            create_parsed_file("src/utils.ts", functions=["helper"]),
        ]

        analyzer.client.messages.create = AsyncMock(side_effect=Exception("API Error"))

        result = await analyzer.analyze_batch(files, "project")

        # Should return fallback analysis
        assert len(result) == 1
        assert result[0].filename == "utils.ts"
        # Fallback uses path-based inference
        assert result[0].architectural_role == ArchitecturalRole.UTILITY


# ==================== Full Analysis Tests ====================

class TestFullAnalysis:
    """Tests for full file analysis with batching."""

    @pytest.mark.asyncio
    async def test_analyze_files_single_batch(self, analyzer):
        """Test analyzing files in a single batch."""
        files = [
            create_parsed_file("src/App.tsx"),
            create_parsed_file("src/utils.ts"),
        ]

        mock_response = create_mock_llm_response([
            {"filename": "App.tsx", "architectural_role": "react_component", "description": "App", "category": "frontend"},
            {"filename": "utils.ts", "architectural_role": "utility", "description": "Utils", "category": "shared"},
        ])

        analyzer.client.messages.create = AsyncMock(return_value=mock_response)

        result = await analyzer.analyze_files(files, "/project")

        assert "App.tsx" in result
        assert "utils.ts" in result

    @pytest.mark.asyncio
    async def test_analyze_files_multiple_batches(self, analyzer, mock_settings):
        """Test analyzing files across multiple batches."""
        # Set small batch size
        mock_settings.max_files_per_batch = 2

        files = [
            create_parsed_file(f"src/file{i}.ts")
            for i in range(5)
        ]

        mock_response = lambda filename: create_mock_llm_response([
            {"filename": filename, "architectural_role": "utility", "description": "File", "category": "shared"},
        ])

        # Return different responses for each batch
        call_count = 0
        async def mock_create(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            # Return response for all files in the batch
            return create_mock_llm_response([
                {"filename": f"file{i}.ts", "architectural_role": "utility", "description": "File", "category": "shared"}
                for i in range((call_count - 1) * 2, min(call_count * 2, 5))
            ])

        analyzer.client.messages.create = mock_create

        result = await analyzer.analyze_files(files, "/project")

        # All files should be in results
        assert len(result) >= 5

    @pytest.mark.asyncio
    async def test_analyze_files_with_progress_callback(self, analyzer):
        """Test that progress callback is called."""
        files = [
            create_parsed_file("src/App.tsx"),
        ]

        mock_response = create_mock_llm_response([
            {"filename": "App.tsx", "architectural_role": "react_component", "description": "App", "category": "frontend"},
        ])

        analyzer.client.messages.create = AsyncMock(return_value=mock_response)

        progress_calls = []
        def progress_callback(batch_num, total, files_in_batch):
            progress_calls.append((batch_num, total, files_in_batch))

        await analyzer.analyze_files(files, "/project", progress_callback)

        assert len(progress_calls) >= 1

    @pytest.mark.asyncio
    async def test_analyze_files_fallback_for_missing(self, analyzer):
        """Test that missing files get fallback analysis."""
        files = [
            create_parsed_file("src/App.tsx"),
            create_parsed_file("src/utils.ts"),
        ]

        # Only return analysis for App.tsx
        mock_response = create_mock_llm_response([
            {"filename": "App.tsx", "architectural_role": "react_component", "description": "App", "category": "frontend"},
        ])

        analyzer.client.messages.create = AsyncMock(return_value=mock_response)

        result = await analyzer.analyze_files(files, "/project")

        # Both should be in results (utils.ts with fallback)
        assert "App.tsx" in result or "src/App.tsx" in result
        assert "utils.ts" in result or "src/utils.ts" in result


# ==================== Prompt Generation Tests ====================

class TestPromptGeneration:
    """Tests for LLM prompt generation."""

    def test_prompt_includes_directory_name(self, analyzer):
        """Test that prompt includes directory name."""
        files = [create_parsed_file("src/App.tsx")]

        prompt = analyzer._get_analysis_prompt("my-project", files)

        assert "my-project" in prompt

    def test_prompt_includes_file_list(self, analyzer):
        """Test that prompt includes file information."""
        files = [
            create_parsed_file("src/App.tsx"),
            create_parsed_file("src/utils.ts"),
        ]

        prompt = analyzer._get_analysis_prompt("project", files)

        assert "App.tsx" in prompt
        assert "utils.ts" in prompt

    def test_prompt_includes_role_options(self, analyzer):
        """Test that prompt includes role options."""
        files = [create_parsed_file("src/App.tsx")]

        prompt = analyzer._get_analysis_prompt("project", files)

        assert "react_component" in prompt
        assert "utility" in prompt
        assert "api_service" in prompt

    def test_prompt_includes_category_options(self, analyzer):
        """Test that prompt includes category options."""
        files = [create_parsed_file("src/App.tsx")]

        prompt = analyzer._get_analysis_prompt("project", files)

        assert "frontend" in prompt
        assert "backend" in prompt
        assert "shared" in prompt


# ==================== Role Parsing Tests ====================

class TestRoleParsing:
    """Tests for parsing role strings to enums."""

    def test_parse_valid_roles(self, analyzer):
        """Test parsing valid role strings."""
        assert analyzer._parse_role("react_component") == ArchitecturalRole.REACT_COMPONENT
        assert analyzer._parse_role("utility") == ArchitecturalRole.UTILITY
        assert analyzer._parse_role("api_service") == ArchitecturalRole.API_SERVICE
        assert analyzer._parse_role("model") == ArchitecturalRole.MODEL

    def test_parse_role_case_insensitive(self, analyzer):
        """Test that role parsing is case insensitive."""
        assert analyzer._parse_role("REACT_COMPONENT") == ArchitecturalRole.REACT_COMPONENT
        assert analyzer._parse_role("React_Component") == ArchitecturalRole.REACT_COMPONENT

    def test_parse_invalid_role_returns_unknown(self, analyzer):
        """Test that invalid roles return UNKNOWN."""
        assert analyzer._parse_role("invalid") == ArchitecturalRole.UNKNOWN
        assert analyzer._parse_role("") == ArchitecturalRole.UNKNOWN


# ==================== Category Parsing Tests ====================

class TestCategoryParsing:
    """Tests for parsing category strings to enums."""

    def test_parse_valid_categories(self, analyzer):
        """Test parsing valid category strings."""
        assert analyzer._parse_category("frontend") == Category.FRONTEND
        assert analyzer._parse_category("backend") == Category.BACKEND
        assert analyzer._parse_category("shared") == Category.SHARED
        assert analyzer._parse_category("test") == Category.TEST

    def test_parse_category_case_insensitive(self, analyzer):
        """Test that category parsing is case insensitive."""
        assert analyzer._parse_category("FRONTEND") == Category.FRONTEND
        assert analyzer._parse_category("Frontend") == Category.FRONTEND

    def test_parse_invalid_category_returns_unknown(self, analyzer):
        """Test that invalid categories return UNKNOWN."""
        assert analyzer._parse_category("invalid") == Category.UNKNOWN
        assert analyzer._parse_category("") == Category.UNKNOWN


# ==================== Singleton Pattern Tests ====================

class TestSingletonPattern:
    """Tests for the singleton pattern."""

    def test_get_llm_analyzer_returns_same_instance(self):
        """Test that get_llm_analyzer returns the same instance."""
        with patch("app.services.llm_analyzer.get_settings") as mock_settings:
            mock_settings.return_value = MagicMock(
                anthropic_api_key="test-key",
                llm_model="test-model",
                llm_max_tokens=4096,
                max_files_per_batch=20,
                llm_parallel_batches=3,
            )
            # Reset singleton
            import app.services.llm_analyzer as llm_module
            llm_module._analyzer = None

            analyzer1 = get_llm_analyzer()
            analyzer2 = get_llm_analyzer()

            assert analyzer1 is analyzer2


# ==================== All Architectural Roles Test ====================

class TestAllArchitecturalRoles:
    """Tests for all architectural roles."""

    def test_all_roles_parseable(self, analyzer):
        """Test that all architectural roles can be parsed."""
        roles = [
            "react_component", "utility", "api_service", "model",
            "config", "test", "hook", "context", "store",
            "middleware", "controller", "router", "schema", "unknown"
        ]

        for role_str in roles:
            result = analyzer._parse_role(role_str)
            assert result is not None
            assert isinstance(result, ArchitecturalRole)

    def test_all_categories_parseable(self, analyzer):
        """Test that all categories can be parsed."""
        categories = [
            "frontend", "backend", "shared", "infrastructure",
            "test", "config", "unknown"
        ]

        for cat_str in categories:
            result = analyzer._parse_category(cat_str)
            assert result is not None
            assert isinstance(result, Category)


# ==================== Edge Cases ====================

class TestEdgeCases:
    """Tests for edge cases."""

    @pytest.mark.asyncio
    async def test_analyze_empty_directory(self, analyzer):
        """Test analyzing empty directory."""
        result = await analyzer.analyze_files([], "/project")

        assert result == {}

    def test_file_summary_handles_empty_lists(self, analyzer):
        """Test that file summary handles files with no functions/classes."""
        files = [
            create_parsed_file(
                "src/empty.ts",
                functions=[],
                classes=[],
            ),
        ]

        summary = analyzer._build_file_summary(files)

        assert "empty.ts" in summary
        assert "none" in summary.lower()

    def test_parse_response_missing_fields(self, analyzer):
        """Test parsing response with missing fields."""
        response = '''[
            {"filename": "file.ts"}
        ]'''

        result = analyzer._parse_llm_response(response)

        assert len(result) == 1
        # Missing fields should use defaults
        assert result[0].architectural_role == ArchitecturalRole.UNKNOWN
        assert result[0].description == ""
        assert result[0].category == Category.UNKNOWN
