"""Pydantic schemas for the chatbot feature."""
from datetime import datetime
from enum import Enum
from typing import Optional, Literal
from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    """Role of a message in the conversation."""

    USER = "user"
    ASSISTANT = "assistant"


class SelectionSource(str, Enum):
    """Source of the text selection."""

    SOURCE_CODE_PANEL = "source_code_panel"
    GRAPH_NODE = "graph_node"
    TIER_LIST = "tier_list"
    FILE_TREE = "file_tree"
    UNKNOWN = "unknown"


class SelectionType(str, Enum):
    """Type of the selected text."""

    FUNCTION_NAME = "function_name"
    VARIABLE = "variable"
    IMPORT = "import"
    FILE_NAME = "file_name"
    CODE_BLOCK = "code_block"
    UNKNOWN = "unknown"


class CurrentFileContext(BaseModel):
    """Context about the currently viewed file."""

    node_id: str = Field(..., description="Node ID in the graph")
    file_path: str = Field(..., description="Full file path")
    file_name: str = Field(..., description="File name only")
    language: str = Field(..., description="Programming language")
    role: Optional[str] = Field(None, description="Architectural role")
    category: Optional[str] = Field(None, description="File category")


class SelectedNodeContext(BaseModel):
    """Context about the selected graph node."""

    node_id: str = Field(..., description="Node ID in the graph")
    file_path: str = Field(..., description="Full file path")
    role: Optional[str] = Field(None, description="Architectural role")
    category: Optional[str] = Field(None, description="File category")


class LineRange(BaseModel):
    """Line range of a selection in source code."""

    start: int = Field(..., description="Start line number")
    end: int = Field(..., description="End line number")


class SelectionContext(BaseModel):
    """Rich context about the user's selection to reduce unnecessary tool calls.

    When provided, the model can directly look up the relevant file/function
    instead of searching through all files.
    """

    source: SelectionSource = Field(..., description="Where the selection originated")
    current_file: Optional[CurrentFileContext] = Field(
        None, description="Current file being viewed in source panel"
    )
    selected_node: Optional[SelectedNodeContext] = Field(
        None, description="Currently selected graph node"
    )
    line_range: Optional[LineRange] = Field(
        None, description="Line range if selecting from source code"
    )
    selection_type: Optional[SelectionType] = Field(
        None, description="Detected type of the selection"
    )


class ChatMessage(BaseModel):
    """A single message in the conversation."""

    role: MessageRole = Field(..., description="Role of the message sender")
    content: str = Field(..., description="Message content")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Message timestamp")
    tools_used: list[str] = Field(default_factory=list, description="Tools used to generate this response")


class ChatRequest(BaseModel):
    """Request to send a chat message."""

    message: str = Field(..., description="The user's message", min_length=1, max_length=4000)
    highlighted_text: Optional[str] = Field(
        None, description="Text highlighted by the user in the visualization", max_length=1000
    )
    selection_context: Optional[SelectionContext] = Field(
        None, description="Rich context about the selection to optimize tool usage"
    )
    conversation_id: Optional[str] = Field(
        None, description="Existing conversation ID to continue"
    )


class TokenUsage(BaseModel):
    """Token usage statistics for a chat response."""

    input_tokens: int = Field(0, description="Number of input tokens used")
    output_tokens: int = Field(0, description="Number of output tokens generated")
    total_tokens: int = Field(0, description="Total tokens (input + output)")


class ContextInfo(BaseModel):
    """Context window information for debugging."""

    pre_request_tokens: int = Field(0, description="Estimated tokens before request")
    post_request_tokens: int = Field(0, description="Actual tokens after request (from API)")
    system_prompt_tokens: int = Field(0, description="Tokens in system prompt")
    conversation_tokens: int = Field(0, description="Tokens in conversation history")
    tools_tokens: int = Field(0, description="Tokens in tool definitions")
    context_window_limit: int = Field(200000, description="Model context window limit")
    utilization_percent: float = Field(0.0, description="Percentage of context used")


class ToolCallInfo(BaseModel):
    """Information about a single tool call for debugging."""

    id: str = Field(..., description="Unique identifier for this tool call")
    name: str = Field(..., description="Name of the tool")
    input_preview: Optional[str] = Field(None, description="Truncated input for display (first 200 chars)")
    input_full: Optional[dict] = Field(None, description="Full input parameters")
    output_preview: Optional[str] = Field(None, description="Truncated output for display (first 500 chars)")
    output_full: Optional[str] = Field(None, description="Full output (JSON string)")
    duration_ms: Optional[int] = Field(None, description="Execution time in milliseconds")
    status: str = Field("pending", description="Status: pending, running, completed, error")
    error: Optional[str] = Field(None, description="Error message if failed")


class ChatResponse(BaseModel):
    """Response from the chatbot."""

    response: str = Field(..., description="The assistant's response")
    conversation_id: str = Field(..., description="Conversation ID for continuation")
    tools_used: list[str] = Field(default_factory=list, description="Tools used to generate the response")
    token_usage: Optional[TokenUsage] = Field(None, description="Token usage statistics")


class ChatHistoryResponse(BaseModel):
    """Response containing conversation history."""

    conversation_id: str = Field(..., description="Conversation ID")
    messages: list[ChatMessage] = Field(..., description="List of messages in the conversation")
    analysis_id: str = Field(..., description="Associated analysis ID")


class ToolResult(BaseModel):
    """Result from executing a tool."""

    tool_name: str = Field(..., description="Name of the tool executed")
    success: bool = Field(..., description="Whether the tool executed successfully")
    result: dict = Field(default_factory=dict, description="Tool execution result")
    error: Optional[str] = Field(None, description="Error message if failed")


# Tool input schemas for Claude's tool use
class GetFileInfoInput(BaseModel):
    """Input schema for get_file_info tool."""

    filename: str = Field(..., description="File path or name (e.g., 'src/utils/auth.ts' or 'auth.ts')")


class SearchFilesInput(BaseModel):
    """Input schema for search_files tool."""

    query: Optional[str] = Field(None, description="Search term to match against file names or descriptions")
    role: Optional[str] = Field(None, description="Filter by architectural role")
    category: Optional[str] = Field(None, description="Filter by category")


class GetDependenciesInput(BaseModel):
    """Input schema for get_dependencies tool."""

    filename: str = Field(..., description="File path or name")
    direction: str = Field(
        default="both",
        description="Direction of dependencies: 'imports', 'imported_by', or 'both'"
    )


class GetFunctionInfoInput(BaseModel):
    """Input schema for get_function_info tool."""

    function_name: str = Field(..., description="Name of the function")
    file_path: Optional[str] = Field(
        None, description="Optional file path to disambiguate functions with the same name"
    )


class ListFunctionsInput(BaseModel):
    """Input schema for list_functions tool."""

    tier: Optional[str] = Field(None, description="Filter by function tier (S/A/B/C/D/F)")
    file_path: Optional[str] = Field(None, description="Filter to functions in a specific file")
    min_calls: Optional[int] = Field(None, description="Minimum number of calls to include")
    limit: int = Field(default=20, description="Maximum results to return")


class ExplainHighlightedInput(BaseModel):
    """Input schema for explain_highlighted tool."""

    text: str = Field(..., description="The highlighted text to explain")


class StreamEventType(str, Enum):
    """Types of streaming events."""

    TEXT_DELTA = "text_delta"
    TOOL_USE_START = "tool_use_start"
    TOOL_USE_END = "tool_use_end"
    MESSAGE_COMPLETE = "message_complete"
    ERROR = "error"
    CONTEXT_UPDATE = "context_update"


class StreamEvent(BaseModel):
    """A single streaming event."""

    type: StreamEventType = Field(..., description="Type of the event")
    content: Optional[str] = Field(None, description="Text content for text_delta events")
    tool_name: Optional[str] = Field(None, description="Tool name for tool events")
    conversation_id: Optional[str] = Field(None, description="Conversation ID")
    tools_used: list[str] = Field(default_factory=list, description="Tools used (for complete event)")
    error: Optional[str] = Field(None, description="Error message for error events")
    token_usage: Optional[TokenUsage] = Field(None, description="Token usage (for complete event)")

    # Developer tools fields
    tool_call_id: Optional[str] = Field(None, description="Tool call ID for tool events")
    tool_input: Optional[dict] = Field(None, description="Tool input parameters (for tool_use_start)")
    tool_input_preview: Optional[str] = Field(None, description="Truncated tool input for display")
    tool_output: Optional[str] = Field(None, description="Tool output (for tool_use_end)")
    tool_output_preview: Optional[str] = Field(None, description="Truncated tool output for display")
    tool_duration_ms: Optional[int] = Field(None, description="Tool execution time in ms")
    context_info: Optional[ContextInfo] = Field(None, description="Context window info (for context_update/message_complete)")
    model_id: Optional[str] = Field(None, description="Model identifier used")


class SuggestedQuestion(BaseModel):
    """A suggested question for the user."""

    question: str = Field(..., description="The suggested question text")
    category: str = Field(..., description="Category of the question (overview, files, functions, dependencies)")


class SuggestedQuestionsResponse(BaseModel):
    """Response containing suggested questions."""

    questions: list[SuggestedQuestion] = Field(..., description="List of suggested questions")
