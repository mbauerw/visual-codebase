"""Core chatbot service with tool execution loop."""
import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
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
    SelectionContext,
    ContextMode,
)
from .chat_tools import CHAT_TOOLS, ChatToolExecutor, get_tools_for_intent
from .chat_context import build_base_context, build_general_context, format_user_message
from .intent_classifier import IntentClassifier
from .tool_output_formatter import ToolOutputFormatter
from .chat_constants import MAX_RESPONSE_TOKENS, MAX_TOOL_ITERATIONS
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
        # Cached system context - computed once per conversation
        self._system_context: Optional[str] = None

    def get_system_context(self, graph: 'ReactFlowGraph') -> str:
        """Get or compute the system context (cached per conversation)."""
        if self._system_context is None:
            from .chat_context import build_base_context
            self._system_context = build_base_context(graph)
        return self._system_context

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


@dataclass
class CachedToolExecutor:
    """Cached tool executor with metadata for TTL validation."""
    executor: ChatToolExecutor
    tier_list_hash: int
    created_at: datetime


class ChatbotService:
    """Main chatbot service with Claude integration and tool execution."""

    def __init__(self):
        self.settings = get_settings()
        self.client = anthropic.AsyncAnthropic(api_key=self.settings.anthropic_api_key)
        self.conversation_manager = ConversationManager()
        # Cache for tool executors by analysis_id with TTL
        self._tool_executor_cache: dict[str, CachedToolExecutor] = {}
        self._tool_executor_ttl = timedelta(minutes=10)

    def _compute_tier_list_hash(self, tier_list: Optional[list]) -> int:
        """Compute a comprehensive hash of the tier list for cache validation.

        Uses all qualified names to ensure changes in the middle of the list
        are detected, preventing false cache hits.
        """
        if not tier_list:
            return 0
        # Hash all qualified names for comprehensive comparison
        # This catches reordering and middle-item changes
        names = tuple(
            f.get("qualified_name", "") for f in tier_list
        )
        return hash(names)

    def _get_tool_executor(
        self, analysis_id: str, graph: ReactFlowGraph, tier_list: Optional[list] = None
    ) -> ChatToolExecutor:
        """Get or create a tool executor for an analysis with TTL caching."""
        now = datetime.utcnow()
        tier_hash = self._compute_tier_list_hash(tier_list)

        # Check cache
        if analysis_id in self._tool_executor_cache:
            cached = self._tool_executor_cache[analysis_id]
            age = now - cached.created_at

            # Valid if within TTL and tier_list hasn't changed
            if age < self._tool_executor_ttl and cached.tier_list_hash == tier_hash:
                logger.debug(f"Using cached tool executor for {analysis_id}")
                return cached.executor

        # Create new executor
        logger.debug(f"Creating new tool executor for {analysis_id}")
        executor = ChatToolExecutor(graph, tier_list)
        self._tool_executor_cache[analysis_id] = CachedToolExecutor(
            executor=executor,
            tier_list_hash=tier_hash,
            created_at=now
        )

        # Cleanup old entries periodically
        self._cleanup_executor_cache()

        return executor

    def _cleanup_executor_cache(self):
        """Remove expired tool executors from cache."""
        now = datetime.utcnow()
        expired = [
            aid for aid, cached in self._tool_executor_cache.items()
            if now - cached.created_at > self._tool_executor_ttl
        ]
        for aid in expired:
            del self._tool_executor_cache[aid]

    def _compute_context_info(
        self,
        system_context: str,
        messages: list[dict],
        actual_input_tokens: int = 0,
        tools: Optional[list] = None,
    ) -> ContextInfo:
        """Compute context window information for debugging.

        Args:
            system_context: The system prompt
            messages: Conversation messages
            actual_input_tokens: Actual input tokens from API response (if available)
            tools: Tool definitions (None for general mode)

        Returns:
            ContextInfo with token counts and utilization
        """
        system_tokens = count_system_prompt_tokens(system_context)
        conversation_tokens = count_message_tokens(messages)
        tools_tokens = count_tools_tokens(tools) if tools else 0

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
        selection_context: Optional[SelectionContext] = None,
        conversation_id: Optional[str] = None,
        tier_list: Optional[list] = None,
        context_mode: str = "codebase",
    ) -> ChatResponse:
        """Process a chat message and return a response.

        Args:
            analysis_id: ID of the analysis being discussed
            message: The user's message
            graph: ReactFlowGraph with analysis data
            highlighted_text: Optional highlighted text from visualization
            selection_context: Optional rich context about the selection source
            conversation_id: Optional existing conversation ID
            tier_list: Optional function tier list data
            context_mode: 'codebase' for full context + tools, 'general' for minimal

        Returns:
            ChatResponse with the assistant's response
        """
        # Get or create conversation
        conversation = self.conversation_manager.get_or_create(analysis_id, conversation_id)

        # Determine context and tools based on mode
        is_general = context_mode == "general"

        if is_general:
            system_context = build_general_context()
            tools_to_use = None
        else:
            # Get tool executor (cached) - only needed for codebase mode
            tool_executor = self._get_tool_executor(analysis_id, graph, tier_list)
            system_context = conversation.get_system_context(graph)

            # Intent-based tool selection: classify the question and load
            # only the relevant tool subset with compressed descriptions
            intent = IntentClassifier.classify(
                message,
                highlighted_text=highlighted_text,
                has_selection_context=selection_context is not None,
            )
            tools_to_use = get_tools_for_intent(intent) or None
            logger.debug(f"Intent: {intent.value}, tools: {len(tools_to_use) if tools_to_use else 0}")

        # Format user message with highlighted text and selection context
        formatted_message = format_user_message(message, highlighted_text, selection_context)
        conversation.add_user_message(formatted_message)

        # Execute tool loop
        tools_used = []
        total_input_tokens = 0
        total_output_tokens = 0

        for _ in range(MAX_TOOL_ITERATIONS):
            try:
                # Build API call kwargs - only include tools if intent requires them
                api_kwargs = dict(
                    model=self.settings.llm_model,
                    max_tokens=MAX_RESPONSE_TOKENS,
                    system=system_context,
                    messages=conversation.messages,
                )
                if tools_to_use:
                    api_kwargs["tools"] = tools_to_use

                response = await self.client.messages.create(**api_kwargs)

                # Track token usage
                if hasattr(response, 'usage'):
                    total_input_tokens += response.usage.input_tokens
                    total_output_tokens += response.usage.output_tokens

                # Check if we need to execute tools
                if response.stop_reason == "tool_use":
                    # Separate text blocks and tool_use blocks
                    text_blocks = [b for b in response.content if b.type == "text"]
                    tool_blocks = [b for b in response.content if b.type == "tool_use"]

                    # Build assistant_content with text blocks first
                    assistant_content = [
                        {"type": "text", "text": b.text} for b in text_blocks
                    ]

                    # Track tools used
                    for block in tool_blocks:
                        tools_used.append(block.name)

                    # Execute all tools in parallel with error handling
                    async def execute_single_tool(block):
                        """Execute a single tool and return result."""
                        logger.info(f"Executing tool: {block.name} with input: {block.input}")
                        try:
                            result = await asyncio.to_thread(
                                tool_executor.execute_tool, block.name, block.input
                            )
                            result_str = json.dumps(result, default=str)
                            return block, result_str, None
                        except Exception as e:
                            logger.error(f"Tool execution failed for {block.name}: {e}")
                            return block, None, str(e)

                    # Run all tools concurrently, handling individual failures
                    tool_execution_results = await asyncio.gather(*[
                        execute_single_tool(block) for block in tool_blocks
                    ])

                    # Process results (handle both successes and failures)
                    tool_results = []
                    for block, result_str, error in tool_execution_results:
                        # Handle failed tool execution
                        if error is not None:
                            result_str = json.dumps({"error": f"Tool execution failed: {error}"})

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
        selection_context: Optional[SelectionContext] = None,
        conversation_id: Optional[str] = None,
        tier_list: Optional[list] = None,
        context_mode: str = "codebase",
    ) -> AsyncGenerator[StreamEvent, None]:
        """Process a chat message and stream the response.

        Uses a hybrid approach: non-streaming for tool execution iterations,
        streaming for the final text response.

        Args:
            analysis_id: ID of the analysis being discussed
            message: The user's message
            graph: ReactFlowGraph with analysis data
            highlighted_text: Optional highlighted text from visualization
            selection_context: Optional rich context about the selection source
            conversation_id: Optional existing conversation ID
            tier_list: Optional function tier list data
            context_mode: 'codebase' for full context + tools, 'general' for minimal

        Yields:
            StreamEvent objects for each chunk of the response
        """
        # Get or create conversation
        conversation = self.conversation_manager.get_or_create(analysis_id, conversation_id)

        # Determine context and tools based on mode
        is_general = context_mode == "general"

        if is_general:
            system_context = build_general_context()
            tools_to_use = None
            tool_executor = None
        else:
            # Get tool executor (cached) - only needed for codebase mode
            tool_executor = self._get_tool_executor(analysis_id, graph, tier_list)
            system_context = conversation.get_system_context(graph)

            # Intent-based tool selection: classify the question and load
            # only the relevant tool subset with compressed descriptions
            intent = IntentClassifier.classify(
                message,
                highlighted_text=highlighted_text,
                has_selection_context=selection_context is not None,
            )
            tools_to_use = get_tools_for_intent(intent) or None
            logger.debug(f"Intent: {intent.value}, tools: {len(tools_to_use) if tools_to_use else 0}")

        # Format user message with highlighted text and selection context
        formatted_message = format_user_message(message, highlighted_text, selection_context)
        conversation.add_user_message(formatted_message)

        # Execute tool loop (non-streaming for tool iterations)
        tools_used = []
        total_input_tokens = 0
        total_output_tokens = 0

        # Send initial context info before first request
        initial_context_info = self._compute_context_info(
            system_context, conversation.messages, tools=tools_to_use
        )
        yield StreamEvent(
            type=StreamEventType.CONTEXT_UPDATE,
            conversation_id=conversation.conversation_id,
            context_info=initial_context_info,
            model_id=self.settings.llm_model,
            question_intent=intent.value if not is_general else "general",
        )

        for iteration in range(MAX_TOOL_ITERATIONS):
            try:
                # Build API call kwargs - only include tools for codebase mode
                api_kwargs = dict(
                    model=self.settings.llm_model,
                    max_tokens=MAX_RESPONSE_TOKENS,
                    system=system_context,
                    messages=conversation.messages,
                )
                if tools_to_use:
                    api_kwargs["tools"] = tools_to_use

                # First, do non-streaming call to handle tools
                response = await self.client.messages.create(**api_kwargs)

                # Track token usage
                if hasattr(response, 'usage'):
                    total_input_tokens += response.usage.input_tokens
                    total_output_tokens += response.usage.output_tokens

                # Check if we need to execute tools
                if response.stop_reason == "tool_use":
                    # Separate text blocks and tool_use blocks
                    text_blocks = [b for b in response.content if b.type == "text"]
                    tool_blocks = [b for b in response.content if b.type == "tool_use"]

                    # Build assistant_content with text blocks first
                    assistant_content = [
                        {"type": "text", "text": b.text} for b in text_blocks
                    ]

                    # Emit tool_use_start events for all tools
                    for block in tool_blocks:
                        tools_used.append(block.name)
                        input_str = json.dumps(block.input, default=str)
                        input_preview = self._truncate_string(input_str, 200)

                        yield StreamEvent(
                            type=StreamEventType.TOOL_USE_START,
                            tool_name=block.name,
                            tool_call_id=block.id,
                            tool_input=block.input,
                            tool_input_preview=input_preview,
                            conversation_id=conversation.conversation_id
                        )

                    # Execute all tools in parallel with error handling
                    async def execute_single_tool(block):
                        """Execute a single tool and return result with timing."""
                        logger.info(f"Executing tool: {block.name} with input: {block.input}")
                        start_time = time.time()
                        try:
                            result = await asyncio.to_thread(
                                tool_executor.execute_tool, block.name, block.input
                            )
                            duration_ms = int((time.time() - start_time) * 1000)
                            result_str = json.dumps(result, default=str)
                            return block, result_str, duration_ms, None
                        except Exception as e:
                            duration_ms = int((time.time() - start_time) * 1000)
                            logger.error(f"Tool execution failed for {block.name}: {e}")
                            return block, None, duration_ms, str(e)

                    # Run all tools concurrently, handling individual failures
                    tool_execution_results = await asyncio.gather(*[
                        execute_single_tool(block) for block in tool_blocks
                    ])

                    # Process results and emit end events (handle both successes and failures)
                    tool_results = []
                    for block, result_str, duration_ms, error in tool_execution_results:
                        # Handle failed tool execution
                        if error is not None:
                            result_str = json.dumps({"error": f"Tool execution failed: {error}"})

                        # Use smart formatter for human-readable preview
                        output_preview = ToolOutputFormatter.format_preview(
                            block.name, result_str
                        )

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

                # No tool use - use true streaming for final response
                final_text_parts = []

                # Build streaming kwargs - only include tools for codebase mode
                stream_kwargs = dict(
                    model=self.settings.llm_model,
                    max_tokens=MAX_RESPONSE_TOKENS,
                    system=system_context,
                    messages=conversation.messages,
                )
                if tools_to_use:
                    stream_kwargs["tools"] = tools_to_use

                async with self.client.messages.stream(**stream_kwargs) as stream:
                    async for event in stream:
                        if hasattr(event, 'type'):
                            if event.type == "content_block_delta":
                                if hasattr(event.delta, 'text'):
                                    text_chunk = event.delta.text
                                    final_text_parts.append(text_chunk)
                                    yield StreamEvent(
                                        type=StreamEventType.TEXT_DELTA,
                                        content=text_chunk,
                                        conversation_id=conversation.conversation_id
                                    )

                    # Get final message for accurate token counts
                    final_message = await stream.get_final_message()
                    if hasattr(final_message, 'usage'):
                        total_input_tokens += final_message.usage.input_tokens
                        total_output_tokens += final_message.usage.output_tokens

                final_text = "".join(final_text_parts)

                conversation.add_assistant_message(final_text)

                # Compute final context info with actual token counts
                final_context_info = self._compute_context_info(
                    system_context,
                    conversation.messages,
                    actual_input_tokens=total_input_tokens,
                    tools=tools_to_use,
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
