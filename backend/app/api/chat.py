"""Chat API endpoints for the chatbot feature."""
import json
import logging
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
from ..services.rate_limiter import get_rate_limiter
from ..auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def check_rate_limit(current_user=Depends(get_current_user)):
    """Dependency to check rate limit for chat endpoints."""
    user_id = current_user.id
    rate_limiter = get_rate_limiter()

    result = await rate_limiter.is_allowed(user_id)

    if not result.allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {result.retry_after} seconds.",
            headers={
                "Retry-After": str(result.retry_after),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Distributed": str(rate_limiter.is_distributed).lower()
            }
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
    graph = await db_service.get_analysis_result(analysis_id, user_id=current_user.id)
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

    # Process the chat message (with user ownership tracking)
    response = await chatbot_service.chat(
        analysis_id=analysis_id,
        message=request.message,
        graph=graph,
        highlighted_text=request.highlighted_text,
        selection_context=request.selection_context,
        conversation_id=request.conversation_id,
        tier_list=tier_list,
        context_mode=request.context_mode.value,
        user_id=current_user.id,
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
    graph = await db_service.get_analysis_result(analysis_id, user_id=current_user.id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    # Get conversation history (with ownership check)
    history = chatbot_service.get_conversation_history(conversation_id, user_id=current_user.id)
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
    graph = await db_service.get_analysis_result(analysis_id, user_id=current_user.id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    # Delete the conversation (with ownership check)
    success = chatbot_service.delete_conversation(conversation_id, user_id=current_user.id)
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
    graph = await db_service.get_analysis_result(analysis_id, user_id=current_user.id)
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
            selection_context=request.selection_context,
            conversation_id=request.conversation_id,
            tier_list=tier_list,
            context_mode=request.context_mode.value,
            user_id=current_user.id,
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
    graph = await db_service.get_analysis_result(analysis_id, user_id=current_user.id)
    if not graph:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    questions = chatbot_service.get_suggested_questions(graph)

    return SuggestedQuestionsResponse(questions=questions)
