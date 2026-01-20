"""Chat API endpoints for the chatbot feature."""
import logging
from fastapi import APIRouter, HTTPException, Depends

from ..models.chat_schemas import (
    ChatRequest,
    ChatResponse,
    ChatHistoryResponse,
)
from ..services.chatbot import get_chatbot_service
from ..services.database import get_database_service
from ..auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/{analysis_id}", response_model=ChatResponse)
async def send_chat_message(
    analysis_id: str,
    request: ChatRequest,
    current_user=Depends(get_current_user),
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
