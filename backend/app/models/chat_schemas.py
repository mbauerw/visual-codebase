"""Pydantic schemas for the chatbot feature."""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class MessageRole(str, Enum):
    """Role of a message in the conversation."""

    USER = "user"
    ASSISTANT = "assistant"


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
    conversation_id: Optional[str] = Field(
        None, description="Existing conversation ID to continue"
    )


class ChatResponse(BaseModel):
    """Response from the chatbot."""

    response: str = Field(..., description="The assistant's response")
    conversation_id: str = Field(..., description="Conversation ID for continuation")
    tools_used: list[str] = Field(default_factory=list, description="Tools used to generate the response")


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
