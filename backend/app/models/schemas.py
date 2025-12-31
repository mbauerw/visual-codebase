"""Pydantic schemas for the Visual Codebase API."""
import re
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class Language(str, Enum):
    """Supported programming languages."""

    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    PYTHON = "python"
    UNKNOWN = "unknown"


class ImportType(str, Enum):
    """Types of import statements."""

    IMPORT = "import"
    REQUIRE = "require"
    FROM_IMPORT = "from_import"
    DYNAMIC_IMPORT = "dynamic_import"


class ArchitecturalRole(str, Enum):
    """Architectural roles for files."""

    REACT_COMPONENT = "react_component"
    UTILITY = "utility"
    API_SERVICE = "api_service"
    MODEL = "model"
    CONFIG = "config"
    TEST = "test"
    HOOK = "hook"
    CONTEXT = "context"
    STORE = "store"
    MIDDLEWARE = "middleware"
    CONTROLLER = "controller"
    ROUTER = "router"
    SCHEMA = "schema"
    UNKNOWN = "unknown"


class Category(str, Enum):
    """High-level file categories."""

    FRONTEND = "frontend"
    BACKEND = "backend"
    SHARED = "shared"
    INFRASTRUCTURE = "infrastructure"
    TEST = "test"
    CONFIG = "config"
    UNKNOWN = "unknown"


class AnalysisStatus(str, Enum):
    """Status of an analysis job."""

    PENDING = "pending"
    CLONING = "cloning"
    PARSING = "parsing"
    ANALYZING = "analyzing"
    BUILDING_GRAPH = "building_graph"
    GENERATING_SUMMARY = "generating_summary"
    COMPLETED = "completed"
    FAILED = "failed"


# GitHub schemas
# Regex patterns for GitHub naming validation
# Owner/repo: alphanumeric, hyphens, underscores, dots
# Cannot start/end with special chars, no consecutive special chars
_GITHUB_NAME_PATTERN = re.compile(
    r"^[a-zA-Z0-9](?:[a-zA-Z0-9]|[-_.](?=[a-zA-Z0-9]))*[a-zA-Z0-9]$|^[a-zA-Z0-9]$"
)
# Branch: alphanumeric, dots, hyphens, underscores, forward slashes
# Cannot start/end with slash, no consecutive slashes, no ".." sequences
_BRANCH_NAME_PATTERN = re.compile(
    r"^(?!.*\.\.)[a-zA-Z0-9](?:[a-zA-Z0-9._/-]*[a-zA-Z0-9._-])?$|^[a-zA-Z0-9]$"
)


class GitHubRepoInfo(BaseModel):
    """GitHub repository information."""

    owner: str = Field(..., description="Repository owner", min_length=1, max_length=39)
    repo: str = Field(..., description="Repository name", min_length=1, max_length=100)
    branch: Optional[str] = Field(default=None, description="Branch to analyze", max_length=256)
    path: Optional[str] = Field(default=None, description="Subdirectory path", max_length=4096)

    @field_validator("owner")
    @classmethod
    def validate_owner(cls, v: str) -> str:
        """Validate GitHub owner name to prevent command injection."""
        if not v or not v.strip():
            raise ValueError("Owner cannot be empty")
        v = v.strip()
        if not _GITHUB_NAME_PATTERN.match(v):
            raise ValueError(
                "Invalid owner name. Must contain only alphanumeric characters, "
                "hyphens, underscores, or dots. Cannot start or end with special "
                "characters or have consecutive special characters."
            )
        return v

    @field_validator("repo")
    @classmethod
    def validate_repo(cls, v: str) -> str:
        """Validate GitHub repository name to prevent command injection."""
        if not v or not v.strip():
            raise ValueError("Repository name cannot be empty")
        v = v.strip()
        if not _GITHUB_NAME_PATTERN.match(v):
            raise ValueError(
                "Invalid repository name. Must contain only alphanumeric characters, "
                "hyphens, underscores, or dots. Cannot start or end with special "
                "characters or have consecutive special characters."
            )
        return v

    @field_validator("branch")
    @classmethod
    def validate_branch(cls, v: Optional[str]) -> Optional[str]:
        """Validate branch name to prevent command injection."""
        if v is None:
            return v
        if not v.strip():
            return None
        v = v.strip()
        # Check for dangerous characters that could enable command injection
        dangerous_chars = [";", "&", "|", "$", "`", "(", ")", "{", "}", "<", ">", "\\", "\n", "\r", "\t", "'", '"']
        for char in dangerous_chars:
            if char in v:
                raise ValueError(f"Branch name contains invalid character: {repr(char)}")
        # Check for ".." sequences (path traversal in branch names)
        if ".." in v:
            raise ValueError("Branch name cannot contain '..' sequences")
        # Validate against branch name pattern
        if not _BRANCH_NAME_PATTERN.match(v):
            raise ValueError(
                "Invalid branch name. Must contain only alphanumeric characters, "
                "dots, hyphens, underscores, or forward slashes. Cannot start or "
                "end with a slash."
            )
        return v

    @field_validator("path")
    @classmethod
    def validate_path(cls, v: Optional[str]) -> Optional[str]:
        """Validate subdirectory path to prevent path traversal attacks."""
        if v is None:
            return v
        if not v.strip():
            return None
        v = v.strip()
        # Check for path traversal attempts
        if ".." in v:
            raise ValueError("Path cannot contain '..' sequences (path traversal not allowed)")
        # Check for absolute paths
        if v.startswith("/") or v.startswith("\\"):
            raise ValueError("Path must be relative, not absolute")
        # Check for Windows-style absolute paths (e.g., C:\)
        if len(v) >= 2 and v[1] == ":":
            raise ValueError("Path must be relative, not absolute")
        # Check for dangerous characters that could enable command injection
        dangerous_chars = [";", "&", "|", "$", "`", "(", ")", "{", "}", "<", ">", "\n", "\r", "\t", "'", '"']
        for char in dangerous_chars:
            if char in v:
                raise ValueError(f"Path contains invalid character: {repr(char)}")
        # Normalize path separators and validate
        v = v.replace("\\", "/")
        # Remove leading/trailing slashes for consistency
        v = v.strip("/")
        return v if v else None


# Request schemas
class AnalyzeRequest(BaseModel):
    """Request to start a codebase analysis."""

    directory_path: Optional[str] = Field(None, description="Path to the directory to analyze")
    github_repo: Optional[GitHubRepoInfo] = Field(None, description="GitHub repository to analyze")
    include_node_modules: bool = Field(
        default=False, description="Whether to include node_modules"
    )
    max_depth: Optional[int] = Field(
        default=None, description="Maximum directory depth to traverse"
    )

    def model_post_init(self, __context):
        """Validate that exactly one source is provided."""
        if not self.directory_path and not self.github_repo:
            raise ValueError("Either directory_path or github_repo must be provided")
        if self.directory_path and self.github_repo:
            raise ValueError("Cannot provide both directory_path and github_repo")


# Core data schemas
class ImportInfo(BaseModel):
    """Information about an import statement."""

    module: str = Field(..., description="The imported module or file path")
    import_type: ImportType = Field(..., description="Type of import statement")
    imported_names: list[str] = Field(
        default_factory=list, description="Specific names imported"
    )
    is_relative: bool = Field(
        default=False, description="Whether this is a relative import"
    )
    resolved_path: Optional[str] = Field(
        default=None, description="Resolved absolute path if determinable"
    )


class ParsedFile(BaseModel):
    """Parsed file information from Tree-sitter."""

    path: str = Field(..., description="Absolute path to the file")
    relative_path: str = Field(..., description="Path relative to analysis root")
    name: str = Field(..., description="File name without path")
    folder: str = Field(..., description="Folder path relative to analysis root")
    language: Language = Field(..., description="Detected programming language")
    imports: list[ImportInfo] = Field(
        default_factory=list, description="Import statements found"
    )
    exports: list[str] = Field(
        default_factory=list, description="Exported names/modules"
    )
    functions: list[str] = Field(
        default_factory=list, description="Function/method names defined in file"
    )
    classes: list[str] = Field(
        default_factory=list, description="Class names defined in file"
    )
    size_bytes: int = Field(..., description="File size in bytes")
    content: Optional[str] = Field(
        default=None, description="Raw file content (populated for storage)"
    )
    line_count: int = Field(..., description="Number of lines in file")


class LLMFileAnalysis(BaseModel):
    """LLM analysis result for a single file."""

    filename: str = Field(..., description="Name of the analyzed file")
    architectural_role: ArchitecturalRole = Field(
        ..., description="The role this file plays in the architecture"
    )
    description: str = Field(
        ..., description="Brief description of what the file does"
    )
    category: Category = Field(..., description="High-level category")


# Graph schemas
class FileNode(BaseModel):
    """A node in the dependency graph representing a file."""

    id: str = Field(..., description="Unique identifier for the node")
    path: str = Field(..., description="File path")
    name: str = Field(..., description="File name")
    folder: str = Field(default="", description="Folder path relative to analysis root")
    language: Language = Field(..., description="Programming language")
    role: ArchitecturalRole = Field(
        default=ArchitecturalRole.UNKNOWN, description="Architectural role"
    )
    description: str = Field(default="", description="LLM-generated description")
    category: Category = Field(default=Category.UNKNOWN, description="File category")
    imports: list[str] = Field(
        default_factory=list, description="List of imported modules"
    )
    size_bytes: int = Field(default=0, description="File size")
    line_count: int = Field(default=0, description="Line count")


class DependencyEdge(BaseModel):
    """An edge in the dependency graph representing a dependency."""

    id: str = Field(..., description="Unique identifier for the edge")
    source: str = Field(..., description="Source node ID (importing file)")
    target: str = Field(..., description="Target node ID (imported file)")
    import_type: ImportType = Field(..., description="Type of import")
    label: Optional[str] = Field(default=None, description="Edge label")


# Codebase summary schemas
class TechStackInfo(BaseModel):
    """Technology stack information."""

    languages: list[str] = Field(default_factory=list, description="Programming languages used")
    frameworks: list[str] = Field(default_factory=list, description="Detected frameworks")
    key_patterns: list[str] = Field(default_factory=list, description="Architectural patterns")


class ModuleInfo(BaseModel):
    """Information about a key module or folder."""

    name: str = Field(..., description="Module/folder name")
    purpose: str = Field(..., description="Brief description of the module's purpose")


class ComplexityInfo(BaseModel):
    """Codebase complexity assessment."""

    level: str = Field(..., description="Complexity level: simple, moderate, or complex")
    reasoning: str = Field(..., description="Explanation for the complexity assessment")


class CodebaseSummary(BaseModel):
    """AI-generated codebase summary."""

    project_type: str = Field(
        ...,
        description="Type of project: web_app, api, library, cli, monorepo, mobile_app, or unknown"
    )
    primary_purpose: str = Field(
        ...,
        description="1-2 sentence description of what the project does"
    )
    tech_stack: TechStackInfo = Field(
        ...,
        description="Detected technologies and patterns"
    )
    architecture_summary: str = Field(
        ...,
        description="2-3 sentence overview of the architecture"
    )
    key_modules: list[ModuleInfo] = Field(
        default_factory=list,
        description="Important modules or folders in the codebase"
    )
    complexity_assessment: ComplexityInfo = Field(
        ...,
        description="Assessment of codebase complexity"
    )
    notable_aspects: list[str] = Field(
        default_factory=list,
        description="Interesting or notable findings about the codebase"
    )


class AnalysisMetadata(BaseModel):
    """Metadata about the analysis."""

    analysis_id: str = Field(..., description="Unique analysis ID")
    directory_path: Optional[str] = Field(None, description="Analyzed directory path")
    github_repo: Optional[GitHubRepoInfo] = Field(None, description="GitHub repository analyzed")
    user_title: Optional[str] = Field(None, description="User-customizable display title")
    file_count: int = Field(..., description="Total files analyzed")
    edge_count: int = Field(..., description="Total dependencies found")
    analysis_time_seconds: float = Field(..., description="Time taken for analysis")
    started_at: datetime = Field(..., description="When analysis started")
    completed_at: Optional[datetime] = Field(
        default=None, description="When analysis completed"
    )
    languages: dict[str, int] = Field(
        default_factory=dict, description="File count per language"
    )
    errors: list[str] = Field(
        default_factory=list, description="Any errors encountered"
    )
    summary: Optional[CodebaseSummary] = Field(
        default=None, description="AI-generated codebase summary"
    )
    readme_detected: bool = Field(
        default=False, description="Whether a README file was found and analyzed"
    )


# Response schemas
class AnalysisResult(BaseModel):
    """Complete analysis result with graph data."""

    nodes: list[FileNode] = Field(..., description="File nodes in the graph")
    edges: list[DependencyEdge] = Field(..., description="Dependency edges")
    metadata: AnalysisMetadata = Field(..., description="Analysis metadata")


class AnalysisStatusResponse(BaseModel):
    """Response for analysis status check."""

    analysis_id: str = Field(..., description="Analysis ID")
    status: AnalysisStatus = Field(..., description="Current status")
    current_step: str = Field(default="", description="Current processing step")
    total_files: int = Field(default=0, description="Total files found")
    error: Optional[str] = Field(default=None, description="Error message if failed")


class AnalyzeResponse(BaseModel):
    """Response when starting an analysis."""

    analysis_id: str = Field(..., description="ID to track the analysis")
    status: AnalysisStatus = Field(..., description="Initial status")
    message: str = Field(..., description="Status message")


class UpdateAnalysisRequest(BaseModel):
    """Request to update analysis metadata."""

    user_title: Optional[str] = Field(None, description="Custom display title for the analysis")


# React Flow compatible schemas
class ReactFlowPosition(BaseModel):
    """Position for React Flow nodes."""

    x: float = 0
    y: float = 0


class ReactFlowNodeData(BaseModel):
    """Data payload for React Flow nodes."""

    label: str
    path: str
    folder: str
    language: Language
    role: ArchitecturalRole
    description: str
    category: Category
    imports: list[str]
    size_bytes: int
    line_count: int


class ReactFlowNode(BaseModel):
    """Node formatted for React Flow."""

    id: str
    type: str = "custom"
    position: ReactFlowPosition = Field(default_factory=ReactFlowPosition)
    data: ReactFlowNodeData


class ReactFlowEdge(BaseModel):
    """Edge formatted for React Flow."""

    id: str
    source: str
    target: str
    type: str = "smoothstep"
    animated: bool = False
    label: Optional[str] = None
    style: Optional[dict] = None


class ReactFlowGraph(BaseModel):
    """Complete graph formatted for React Flow."""

    nodes: list[ReactFlowNode]
    edges: list[ReactFlowEdge]
    metadata: AnalysisMetadata
