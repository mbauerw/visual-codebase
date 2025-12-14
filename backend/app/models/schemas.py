"""Pydantic schemas for the Visual Codebase API."""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


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
    PARSING = "parsing"
    ANALYZING = "analyzing"
    BUILDING_GRAPH = "building_graph"
    COMPLETED = "completed"
    FAILED = "failed"


# Request schemas
class AnalyzeRequest(BaseModel):
    """Request to start a codebase analysis."""

    directory_path: str = Field(..., description="Path to the directory to analyze")
    include_node_modules: bool = Field(
        default=False, description="Whether to include node_modules"
    )
    max_depth: Optional[int] = Field(
        default=None, description="Maximum directory depth to traverse"
    )


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
    language: Language = Field(..., description="Detected programming language")
    imports: list[ImportInfo] = Field(
        default_factory=list, description="Import statements found"
    )
    exports: list[str] = Field(
        default_factory=list, description="Exported names/modules"
    )
    size_bytes: int = Field(..., description="File size in bytes")
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


class AnalysisMetadata(BaseModel):
    """Metadata about the analysis."""

    analysis_id: str = Field(..., description="Unique analysis ID")
    directory_path: str = Field(..., description="Analyzed directory path")
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
    progress: float = Field(
        default=0.0, description="Progress percentage (0-100)"
    )
    current_step: str = Field(default="", description="Current processing step")
    files_processed: int = Field(default=0, description="Files processed so far")
    total_files: int = Field(default=0, description="Total files to process")
    error: Optional[str] = Field(default=None, description="Error message if failed")


class AnalyzeResponse(BaseModel):
    """Response when starting an analysis."""

    analysis_id: str = Field(..., description="ID to track the analysis")
    status: AnalysisStatus = Field(..., description="Initial status")
    message: str = Field(..., description="Status message")


# React Flow compatible schemas
class ReactFlowPosition(BaseModel):
    """Position for React Flow nodes."""

    x: float = 0
    y: float = 0


class ReactFlowNodeData(BaseModel):
    """Data payload for React Flow nodes."""

    label: str
    path: str
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
