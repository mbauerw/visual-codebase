"""Core chatbot service with tool execution loop."""
import json
import logging
import time
import uuid
from datetime import datetime
from typing import Optional, AsyncGenerator

import anthropic

from ..settings import get_settings
from ..models.schemas import ReactFlowGraph
from ..models.chat_schemas import (
    ChatMessage,
    MessageRole,
    ChatResponse,
    StreamEvent,
    StreamEventType,
    SuggestedQuestion,
    TokenUsage,
    ContextInfo,
)
from .chat_tools import CHAT_TOOLS, ChatToolExecutor
from .chat_context import build_base_context, format_user_message
from .token_counter import (
    count_message_tokens,
    count_system_prompt_tokens,
    count_tools_tokens,
    CLAUDE_SONNET_CONTEXT_WINDOW,
)

logger = logging.getLogger(__name__)


class ConversationState:
    """Manages state for a single conversation."""

    def __init__(self, analysis_id: str, conversation_id: str):
        self.analysis_id = analysis_id
        self.conversation_id = conversation_id
        self.messages: list[dict] = []  # Claude API message format
        self.created_at = datetime.utcnow()
        self.last_active = datetime.utcnow()

    def add_user_message(self, content: str):
        """Add a user message to the conversation."""
        self.messages.append({"role": "user", "content": content})
        self.last_active = datetime.utcnow()

    def add_assistant_message(self, content: str):
        """Add an assistant message to the conversation."""
        self.messages.append({"role": "assistant", "content": content})
        self.last_active = datetime.utcnow()

    def add_tool_use(self, tool_use_block: dict):
        """Add a tool use message from the assistant."""
        self.messages.append({"role": "assistant", "content": [tool_use_block]})
        self.last_active = datetime.utcnow()

    def add_tool_result(self, tool_use_id: str, result: str):
        """Add a tool result message."""
        self.messages.append({
            "role": "user",
            "content": [{
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": result
            }]
        })
        self.last_active = datetime.utcnow()

    def get_chat_history(self) -> list[ChatMessage]:
        """Convert internal messages to ChatMessage format for API response."""
        history = []
        for msg in self.messages:
            role = MessageRole.USER if msg["role"] == "user" else MessageRole.ASSISTANT

            # Handle different content formats
            content = msg["content"]
            if isinstance(content, list):
                # Extract text from content blocks
                text_parts = []
                for block in content:
                    if isinstance(block, dict):
                        if block.get("type") == "text":
                            text_parts.append(block.get("text", ""))
                        elif block.get("type") == "tool_use":
                            text_parts.append(f"[Using tool: {block.get('name')}]")
                        elif block.get("type") == "tool_result":
                            continue  # Skip tool results in history display
                content = " ".join(text_parts) if text_parts else ""

            if content:  # Only add non-empty messages
                history.append(ChatMessage(role=role, content=content))

        return history


class ConversationManager:
    """Manages all active conversations (in-memory storage)."""

    def __init__(self, max_conversations: int = 1000, ttl_minutes: int = 60):
        self._conversations: dict[str, ConversationState] = {}
        self._max_conversations = max_conversations
        self._ttl_minutes = ttl_minutes

    def get_or_create(
        self, analysis_id: str, conversation_id: Optional[str] = None
    ) -> ConversationState:
        """Get existing conversation or create a new one."""
        # Clean up old conversations periodically
        self._cleanup_old_conversations()

        if conversation_id and conversation_id in self._conversations:
            conv = self._conversations[conversation_id]
            # Verify it's for the right analysis
            if conv.analysis_id == analysis_id:
                return conv

        # Create new conversation
        new_id = conversation_id or str(uuid.uuid4())
        conv = ConversationState(analysis_id, new_id)
        self._conversations[new_id] = conv
        return conv

    def get(self, conversation_id: str) -> Optional[ConversationState]:
        """Get a conversation by ID."""
        return self._conversations.get(conversation_id)

    def delete(self, conversation_id: str) -> bool:
        """Delete a conversation."""
        if conversation_id in self._conversations:
            del self._conversations[conversation_id]
            return True
        return False

    def _cleanup_old_conversations(self):
        """Remove old conversations to prevent memory bloat."""
        if len(self._conversations) <= self._max_conversations:
            return

        now = datetime.utcnow()
        expired = []
        for conv_id, conv in self._conversations.items():
            age_minutes = (now - conv.last_active).total_seconds() / 60
            if age_minutes > self._ttl_minutes:
                expired.append(conv_id)

        for conv_id in expired:
            del self._conversations[conv_id]

        # If still over limit, remove oldest
        if len(self._conversations) > self._max_conversations:
            sorted_convs = sorted(
                self._conversations.items(),
                key=lambda x: x[1].last_active
            )
            for conv_id, _ in sorted_convs[:len(self._conversations) - self._max_conversations]:
                del self._conversations[conv_id]


class ChatbotService:
    """Main chatbot service with Claude integration and tool execution."""

    def __init__(self):
        self.settings = get_settings()
        self.client = anthropic.AsyncAnthropic(api_key=self.settings.anthropic_api_key)
        self.conversation_manager = ConversationManager()
        # Cache for tool executors by analysis_id
        self._tool_executors: dict[str, ChatToolExecutor] = {}

    def _get_tool_executor(
        self, analysis_id: str, graph: ReactFlowGraph, tier_list: Optional[list] = None
    ) -> ChatToolExecutor:
        """Get or create a tool executor for an analysis."""
        # Create fresh executor each time to ensure data is current
        executor = ChatToolExecutor(graph, tier_list)
        self._tool_executors[analysis_id] = executor
        return executor

    def _compute_context_info(
        self,
        system_context: str,
        messages: list[dict],
        actual_input_tokens: int = 0
    ) -> ContextInfo:
        """Compute context window information for debugging.

        Args:
            system_context: The system prompt
            messages: Conversation messages
            actual_input_tokens: Actual input tokens from API response (if available)

        Returns:
            ContextInfo with token counts and utilization
        """
        system_tokens = count_system_prompt_tokens(system_context)
        conversation_tokens = count_message_tokens(messages)
        tools_tokens = count_tools_tokens(CHAT_TOOLS)

        # Pre-request estimate
        pre_request_tokens = system_tokens + conversation_tokens + tools_tokens

        # Use actual tokens if available, otherwise use estimate
        post_request_tokens = actual_input_tokens if actual_input_tokens > 0 else pre_request_tokens

        # Calculate utilization
        utilization = (post_request_tokens / CLAUDE_SONNET_CONTEXT_WINDOW) * 100

        return ContextInfo(
            pre_request_tokens=pre_request_tokens,
            post_request_tokens=post_request_tokens,
            system_prompt_tokens=system_tokens,
            conversation_tokens=conversation_tokens,
            tools_tokens=tools_tokens,
            context_window_limit=CLAUDE_SONNET_CONTEXT_WINDOW,
            utilization_percent=round(utilization, 2)
        )

    @staticmethod
    def _truncate_string(s: str, max_length: int) -> str:
        """Truncate a string to max_length, adding ellipsis if truncated."""
        if len(s) <= max_length:
            return s
        return s[:max_length - 3] + "..."

    async def chat(
        self,
        analysis_id: str,
        message: str,
        graph: ReactFlowGraph,
        highlighted_text: Optional[str] = None,
        conversation_id: Optional[str] = None,
        tier_list: Optional[list] = None
    ) -> ChatResponse:
        """Process a chat message and return a response.

        Args:
            analysis_id: ID of the analysis being discussed
            message: The user's message
            graph: ReactFlowGraph with analysis data
            highlighted_text: Optional highlighted text from visualization
            conversation_id: Optional existing conversation ID
            tier_list: Optional function tier list data

        Returns:
            ChatResponse with the assistant's response
        """
        # Get or create conversation
        conversation = self.conversation_manager.get_or_create(analysis_id, conversation_id)

        # Get tool executor
        tool_executor = self._get_tool_executor(analysis_id, graph, tier_list)

        # Build system context
        system_context = build_base_context(graph)

        # Format user message with highlighted text
        formatted_message = format_user_message(message, highlighted_text)
        conversation.add_user_message(formatted_message)

        # Execute tool loop
        tools_used = []
        max_iterations = 10  # Prevent infinite loops
        total_input_tokens = 0
        total_output_tokens = 0

        for _ in range(max_iterations):
            try:
                response = await self.client.messages.create(
                    model=self.settings.llm_model,
                    max_tokens=2048,
                    system=system_context,
                    tools=CHAT_TOOLS,
                    messages=conversation.messages
                )

                # Track token usage
                if hasattr(response, 'usage'):
                    total_input_tokens += response.usage.input_tokens
                    total_output_tokens += response.usage.output_tokens

                # Check if we need to execute tools
                if response.stop_reason == "tool_use":
                    # Process all tool uses in this response
                    assistant_content = []
                    tool_results = []

                    for block in response.content:
                        if block.type == "text":
                            assistant_content.append({
                                "type": "text",
                                "text": block.text
                            })
                        elif block.type == "tool_use":
                            tools_used.append(block.name)
                            logger.info(f"Executing tool: {block.name} with input: {block.input}")

                            # Execute the tool
                            result = tool_executor.execute_tool(block.name, block.input)
                            result_str = json.dumps(result, default=str)

                            assistant_content.append({
                                "type": "tool_use",
                                "id": block.id,
                                "name": block.name,
                                "input": block.input
                            })

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_str
                            })

                    # Add assistant message with tool uses
                    conversation.messages.append({
                        "role": "assistant",
                        "content": assistant_content
                    })

                    # Add tool results
                    conversation.messages.append({
                        "role": "user",
                        "content": tool_results
                    })

                    # Continue loop to get final response
                    continue

                # No more tool use - extract final response
                final_text = ""
                for block in response.content:
                    if block.type == "text":
                        final_text += block.text

                conversation.add_assistant_message(final_text)

                return ChatResponse(
                    response=final_text,
                    conversation_id=conversation.conversation_id,
                    tools_used=list(set(tools_used)),  # Deduplicate
                    token_usage=TokenUsage(
                        input_tokens=total_input_tokens,
                        output_tokens=total_output_tokens,
                        total_tokens=total_input_tokens + total_output_tokens
                    )
                )

            except Exception as e:
                logger.error(f"Chat error: {e}")
                error_msg = "I encountered an error processing your request. Please try again."
                conversation.add_assistant_message(error_msg)
                return ChatResponse(
                    response=error_msg,
                    conversation_id=conversation.conversation_id,
                    tools_used=tools_used,
                    token_usage=TokenUsage(
                        input_tokens=total_input_tokens,
                        output_tokens=total_output_tokens,
                        total_tokens=total_input_tokens + total_output_tokens
                    ) if total_input_tokens > 0 or total_output_tokens > 0 else None
                )

        # Max iterations reached
        fallback_msg = "I've gathered information but reached my processing limit. Please try a more specific question."
        conversation.add_assistant_message(fallback_msg)
        return ChatResponse(
            response=fallback_msg,
            conversation_id=conversation.conversation_id,
            tools_used=tools_used,
            token_usage=TokenUsage(
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens,
                total_tokens=total_input_tokens + total_output_tokens
            )
        )

    async def chat_stream(
        self,
        analysis_id: str,
        message: str,
        graph: ReactFlowGraph,
        highlighted_text: Optional[str] = None,
        conversation_id: Optional[str] = None,
        tier_list: Optional[list] = None
    ) -> AsyncGenerator[StreamEvent, None]:
        """Process a chat message and stream the response.

        Uses a hybrid approach: non-streaming for tool execution iterations,
        streaming for the final text response.

        Args:
            analysis_id: ID of the analysis being discussed
            message: The user's message
            graph: ReactFlowGraph with analysis data
            highlighted_text: Optional highlighted text from visualization
            conversation_id: Optional existing conversation ID
            tier_list: Optional function tier list data

        Yields:
            StreamEvent objects for each chunk of the response
        """
        # Get or create conversation
        conversation = self.conversation_manager.get_or_create(analysis_id, conversation_id)

        # Get tool executor
        tool_executor = self._get_tool_executor(analysis_id, graph, tier_list)

        # Build system context
        system_context = build_base_context(graph)

        # Format user message with highlighted text
        formatted_message = format_user_message(message, highlighted_text)
        conversation.add_user_message(formatted_message)

        # Execute tool loop (non-streaming for tool iterations)
        tools_used = []
        max_iterations = 10
        total_input_tokens = 0
        total_output_tokens = 0

        # Send initial context info before first request
        initial_context_info = self._compute_context_info(
            system_context, conversation.messages
        )
        yield StreamEvent(
            type=StreamEventType.CONTEXT_UPDATE,
            conversation_id=conversation.conversation_id,
            context_info=initial_context_info,
            model_id=self.settings.llm_model
        )

        for iteration in range(max_iterations):
            try:
                # First, do non-streaming call to handle tools
                response = await self.client.messages.create(
                    model=self.settings.llm_model,
                    max_tokens=2048,
                    system=system_context,
                    tools=CHAT_TOOLS,
                    messages=conversation.messages
                )

                # Track token usage
                if hasattr(response, 'usage'):
                    total_input_tokens += response.usage.input_tokens
                    total_output_tokens += response.usage.output_tokens

                # Check if we need to execute tools
                if response.stop_reason == "tool_use":
                    # Process all tool uses in this response
                    assistant_content = []
                    tool_results = []

                    for block in response.content:
                        if block.type == "text":
                            assistant_content.append({
                                "type": "text",
                                "text": block.text
                            })
                        elif block.type == "tool_use":
                            tools_used.append(block.name)

                            # Prepare tool input preview
                            input_str = json.dumps(block.input, default=str)
                            input_preview = self._truncate_string(input_str, 200)

                            # Notify about tool use with input details
                            yield StreamEvent(
                                type=StreamEventType.TOOL_USE_START,
                                tool_name=block.name,
                                tool_call_id=block.id,
                                tool_input=block.input,
                                tool_input_preview=input_preview,
                                conversation_id=conversation.conversation_id
                            )

                            logger.info(f"Executing tool: {block.name} with input: {block.input}")

                            # Execute the tool with timing
                            start_time = time.time()
                            result = tool_executor.execute_tool(block.name, block.input)
                            duration_ms = int((time.time() - start_time) * 1000)

                            result_str = json.dumps(result, default=str)
                            output_preview = self._truncate_string(result_str, 500)

                            assistant_content.append({
                                "type": "tool_use",
                                "id": block.id,
                                "name": block.name,
                                "input": block.input
                            })

                            tool_results.append({
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_str
                            })

                            yield StreamEvent(
                                type=StreamEventType.TOOL_USE_END,
                                tool_name=block.name,
                                tool_call_id=block.id,
                                tool_output=result_str,
                                tool_output_preview=output_preview,
                                tool_duration_ms=duration_ms,
                                conversation_id=conversation.conversation_id
                            )

                    # Add assistant message with tool uses
                    conversation.messages.append({
                        "role": "assistant",
                        "content": assistant_content
                    })

                    # Add tool results
                    conversation.messages.append({
                        "role": "user",
                        "content": tool_results
                    })

                    # Continue loop to get response after tools
                    continue

                # No tool use - stream the final text response
                # Extract text from the non-streaming response and stream it
                final_text = ""
                for block in response.content:
                    if block.type == "text":
                        final_text += block.text

                # Stream the text in chunks for a better UX
                chunk_size = 20  # Characters per chunk
                for i in range(0, len(final_text), chunk_size):
                    chunk = final_text[i:i + chunk_size]
                    yield StreamEvent(
                        type=StreamEventType.TEXT_DELTA,
                        content=chunk,
                        conversation_id=conversation.conversation_id
                    )

                conversation.add_assistant_message(final_text)

                # Compute final context info with actual token counts
                final_context_info = self._compute_context_info(
                    system_context,
                    conversation.messages,
                    actual_input_tokens=total_input_tokens
                )

                yield StreamEvent(
                    type=StreamEventType.MESSAGE_COMPLETE,
                    conversation_id=conversation.conversation_id,
                    tools_used=list(set(tools_used)),
                    token_usage=TokenUsage(
                        input_tokens=total_input_tokens,
                        output_tokens=total_output_tokens,
                        total_tokens=total_input_tokens + total_output_tokens
                    ),
                    context_info=final_context_info,
                    model_id=self.settings.llm_model
                )
                return

            except Exception as e:
                logger.error(f"Streaming chat error: {e}")
                yield StreamEvent(
                    type=StreamEventType.ERROR,
                    error=str(e),
                    conversation_id=conversation.conversation_id
                )
                return

        # Max iterations reached
        fallback_msg = "I've gathered information but reached my processing limit. Please try a more specific question."
        conversation.add_assistant_message(fallback_msg)

        yield StreamEvent(
            type=StreamEventType.TEXT_DELTA,
            content=fallback_msg,
            conversation_id=conversation.conversation_id
        )
        yield StreamEvent(
            type=StreamEventType.MESSAGE_COMPLETE,
            conversation_id=conversation.conversation_id,
            tools_used=tools_used,
            token_usage=TokenUsage(
                input_tokens=total_input_tokens,
                output_tokens=total_output_tokens,
                total_tokens=total_input_tokens + total_output_tokens
            )
        )

    def get_suggested_questions(self, graph: ReactFlowGraph) -> list[SuggestedQuestion]:
        """Generate suggested questions based on the analysis data.

        Args:
            graph: ReactFlowGraph with analysis data

        Returns:
            List of suggested questions
        """
        questions = []
        metadata = graph.metadata

        # Overview questions
        questions.append(SuggestedQuestion(
            question="What is the overall architecture of this codebase?",
            category="overview"
        ))

        if metadata.summary:
            questions.append(SuggestedQuestion(
                question=f"Explain the {metadata.summary.project_type} architecture in more detail.",
                category="overview"
            ))

        # File-based questions
        if metadata.file_count > 0:
            # Find the most connected file
            role_counts = {}
            for node in graph.nodes:
                role = node.data.role.value if hasattr(node.data.role, 'value') else node.data.role
                role_counts[role] = role_counts.get(role, 0) + 1

            if role_counts:
                top_role = max(role_counts, key=role_counts.get)
                questions.append(SuggestedQuestion(
                    question=f"What are the main {top_role.replace('_', ' ')} files and what do they do?",
                    category="files"
                ))

        # Dependency questions
        if metadata.edge_count > 0:
            questions.append(SuggestedQuestion(
                question="Which files have the most dependencies?",
                category="dependencies"
            ))
            questions.append(SuggestedQuestion(
                question="Are there any circular dependencies in this codebase?",
                category="dependencies"
            ))

        # Function-based questions
        if metadata.function_stats:
            if metadata.function_stats.total_functions > 0:
                questions.append(SuggestedQuestion(
                    question="What are the most important functions in this codebase?",
                    category="functions"
                ))
            if metadata.function_stats.tier_counts.get("S", 0) > 0:
                questions.append(SuggestedQuestion(
                    question="Tell me about the S-tier functions and why they're important.",
                    category="functions"
                ))

        # Technology questions
        if metadata.summary and metadata.summary.tech_stack:
            if metadata.summary.tech_stack.frameworks:
                framework = metadata.summary.tech_stack.frameworks[0]
                questions.append(SuggestedQuestion(
                    question=f"How is {framework} used in this project?",
                    category="overview"
                ))

        return questions[:6]  # Return max 6 questions

    def get_conversation_history(
        self, conversation_id: str
    ) -> Optional[list[ChatMessage]]:
        """Get the chat history for a conversation."""
        conversation = self.conversation_manager.get(conversation_id)
        if conversation:
            return conversation.get_chat_history()
        return None

    def delete_conversation(self, conversation_id: str) -> bool:
        """Delete a conversation and its history."""
        return self.conversation_manager.delete(conversation_id)


# Singleton instance
_chatbot_service: Optional[ChatbotService] = None


def get_chatbot_service() -> ChatbotService:
    """Get or create the chatbot service instance."""
    global _chatbot_service
    if _chatbot_service is None:
        _chatbot_service = ChatbotService()
    return _chatbot_service
