"""Chat API endpoints for the chatbot feature."""
import json
import logging
import time
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import StreamingResponse

from ..models.chat_schemas import (
    ChatRequest,
    ChatResponse,
    ChatHistoryResponse,
    SuggestedQuestionsResponse,
    StreamEventType,
)
from ..services.chatbot import get_chatbot_service
from ..services.database import get_database_service
from ..auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


# Rate limiter configuration
RATE_LIMIT_REQUESTS = 20  # Max requests per window
RATE_LIMIT_WINDOW = 60  # Window in seconds (1 minute)


class RateLimiter:
    """Simple in-memory rate limiter per user."""

    def __init__(self, max_requests: int = RATE_LIMIT_REQUESTS, window_seconds: int = RATE_LIMIT_WINDOW):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)

    def is_allowed(self, user_id: str) -> tuple[bool, int]:
        """
        Check if a request is allowed for the given user.

        Returns:
            Tuple of (is_allowed, remaining_requests)
        """
        now = time.time()
        window_start = now - self.window_seconds

        # Clean up old requests outside the window
        self.requests[user_id] = [
            req_time for req_time in self.requests[user_id]
            if req_time > window_start
        ]

        # Check if under limit
        current_count = len(self.requests[user_id])
        if current_count >= self.max_requests:
            return False, 0

        # Record this request
        self.requests[user_id].append(now)
        remaining = self.max_requests - current_count - 1
        return True, remaining

    def get_retry_after(self, user_id: str) -> int:
        """Get seconds until the oldest request expires from the window."""
        if not self.requests[user_id]:
            return 0
        oldest_request = min(self.requests[user_id])
        retry_after = int(oldest_request + self.window_seconds - time.time())
        return max(0, retry_after)


# Global rate limiter instance
rate_limiter = RateLimiter()


async def check_rate_limit(current_user=Depends(get_current_user)):
    """Dependency to check rate limit for chat endpoints."""
    user_id = current_user.id
    is_allowed, remaining = rate_limiter.is_allowed(user_id)

    if not is_allowed:
        retry_after = rate_limiter.get_retry_after(user_id)
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)}
        )

    return current_user


@router.post("/{analysis_id}", response_model=ChatResponse)
async def send_chat_message(
    analysis_id: str,
    request: ChatRequest,
    current_user=Depends(check_rate_limit),
) -> ChatResponse:
    """
    Send a message to the chatbot about an analysis.

    The chatbot will use tools to query the analysis data and provide
    contextual answers about the codebase.

    Args:
        analysis_id: ID of the analysis to discuss
        request: Chat request with message and optional highlighted text

    Returns:
        ChatResponse with the assistant's response
    """
    db_service = get_database_service()
    chatbot_service = get_chatbot_service()

    # Verify user has access to this analysis
    graph = await db_service.get_analysis_result(analysis_id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    # Get tier list data if available
    tier_list = None
    try:
        tier_data = await db_service.get_tier_list(
            analysis_id=analysis_id,
            user_id=current_user.id,
            page=1,
            per_page=1000  # Get all functions for chatbot context
        )
        if tier_data:
            # Convert FunctionTierItem objects to dicts
            tier_list = [
                {
                    "function_name": f.function_name,
                    "qualified_name": f.qualified_name,
                    "file_path": f.file_path,
                    "tier": f.tier.value if hasattr(f.tier, 'value') else f.tier,
                    "internal_call_count": f.internal_call_count,
                    "external_call_count": f.external_call_count,
                    "is_exported": f.is_exported,
                    "is_entry_point": f.is_entry_point,
                    "function_type": f.function_type.value if hasattr(f.function_type, 'value') else f.function_type,
                    "start_line": f.start_line,
                    "is_async": f.is_async
                }
                for f in tier_data.functions
            ]
    except Exception as e:
        logger.warning(f"Could not load tier list for chatbot: {e}")

    # Process the chat message
    response = await chatbot_service.chat(
        analysis_id=analysis_id,
        message=request.message,
        graph=graph,
        highlighted_text=request.highlighted_text,
        conversation_id=request.conversation_id,
        tier_list=tier_list
    )

    return response


@router.get("/{analysis_id}/history/{conversation_id}", response_model=ChatHistoryResponse)
async def get_chat_history(
    analysis_id: str,
    conversation_id: str,
    current_user=Depends(get_current_user),
) -> ChatHistoryResponse:
    """
    Get the conversation history for a chat session.

    Args:
        analysis_id: ID of the analysis
        conversation_id: ID of the conversation

    Returns:
        ChatHistoryResponse with the list of messages
    """
    db_service = get_database_service()
    chatbot_service = get_chatbot_service()

    # Verify user has access to this analysis
    graph = await db_service.get_analysis_result(analysis_id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    # Get conversation history
    history = chatbot_service.get_conversation_history(conversation_id)
    if history is None:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return ChatHistoryResponse(
        conversation_id=conversation_id,
        messages=history,
        analysis_id=analysis_id
    )


@router.delete("/{analysis_id}/history/{conversation_id}")
async def delete_chat_history(
    analysis_id: str,
    conversation_id: str,
    current_user=Depends(get_current_user),
):
    """
    Delete a conversation history.

    Args:
        analysis_id: ID of the analysis
        conversation_id: ID of the conversation to delete

    Returns:
        Success message
    """
    db_service = get_database_service()
    chatbot_service = get_chatbot_service()

    # Verify user has access to this analysis
    graph = await db_service.get_analysis_result(analysis_id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    # Delete the conversation
    success = chatbot_service.delete_conversation(conversation_id)
    if not success:
        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    return {"message": "Conversation deleted successfully"}


@router.post("/{analysis_id}/stream")
async def stream_chat_message(
    analysis_id: str,
    request: ChatRequest,
    current_user=Depends(check_rate_limit),
):
    """
    Send a message to the chatbot and receive a streaming response.

    This endpoint uses Server-Sent Events (SSE) to stream the response
    as it's being generated.

    Args:
        analysis_id: ID of the analysis to discuss
        request: Chat request with message and optional highlighted text

    Returns:
        StreamingResponse with SSE events
    """
    db_service = get_database_service()
    chatbot_service = get_chatbot_service()

    # Verify user has access to this analysis
    graph = await db_service.get_analysis_result(analysis_id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    # Get tier list data if available
    tier_list = None
    try:
        tier_data = await db_service.get_tier_list(
            analysis_id=analysis_id,
            user_id=current_user.id,
            page=1,
            per_page=1000
        )
        if tier_data:
            tier_list = [
                {
                    "function_name": f.function_name,
                    "qualified_name": f.qualified_name,
                    "file_path": f.file_path,
                    "tier": f.tier.value if hasattr(f.tier, 'value') else f.tier,
                    "internal_call_count": f.internal_call_count,
                    "external_call_count": f.external_call_count,
                    "is_exported": f.is_exported,
                    "is_entry_point": f.is_entry_point,
                    "function_type": f.function_type.value if hasattr(f.function_type, 'value') else f.function_type,
                    "start_line": f.start_line,
                    "is_async": f.is_async
                }
                for f in tier_data.functions
            ]
    except Exception as e:
        logger.warning(f"Could not load tier list for chatbot: {e}")

    async def event_generator():
        """Generate SSE events from the chat stream."""
        async for event in chatbot_service.chat_stream(
            analysis_id=analysis_id,
            message=request.message,
            graph=graph,
            highlighted_text=request.highlighted_text,
            conversation_id=request.conversation_id,
            tier_list=tier_list
        ):
            # Format as SSE
            data = json.dumps(event.model_dump())
            yield f"data: {data}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@router.get("/{analysis_id}/suggestions", response_model=SuggestedQuestionsResponse)
async def get_suggested_questions(
    analysis_id: str,
    current_user=Depends(get_current_user),
) -> SuggestedQuestionsResponse:
    """
    Get suggested questions based on the analysis data.

    These questions are generated based on the codebase structure,
    common patterns, and the analysis results.

    Args:
        analysis_id: ID of the analysis

    Returns:
        SuggestedQuestionsResponse with a list of suggested questions
    """
    db_service = get_database_service()
    chatbot_service = get_chatbot_service()

    # Verify user has access to this analysis
    graph = await db_service.get_analysis_result(analysis_id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    questions = chatbot_service.get_suggested_questions(graph)

    return SuggestedQuestionsResponse(questions=questions)
