# Chatbot Token Efficiency Improvement Strategy

## Executive Summary

This document presents a comprehensive strategy to reduce the AI chatbot's token consumption and associated costs. Based on analysis of the codebase, the current implementation sends **5,000-7,000+ tokens** per request regardless of question type. Individual questions can cost up to $0.25 due to:

1. Unnecessary context provided for simple questions
2. Inefficient highlighted text handling requiring multiple tool calls
3. All 11 tools (~4,500 tokens) sent on every request
4. No differentiation between codebase-specific and general questions

**Projected Savings:** 30-70% reduction in input tokens depending on question type.

---

## Strategy 1: Reduce Context by Providing Upfront Information

### Problem

When a user highlights text (like a function in SourceCodePanel.tsx), the model searches through ALL files to find it. This is inefficient and produces uncertain responses like "I think the user wants to know about *function name* in *likely file*" instead of definitive answers.

### Root Cause Analysis

**Current Flow:**
1. `useTextSelection.ts` captures raw text only - no metadata about source
2. `ChatRequest` only includes `highlighted_text?: string`
3. Backend receives `[Highlighted: sendMessage]` with no context
4. Model must call `explain_highlighted` tool which fuzzy-matches across ALL files
5. Often results in multiple candidates and uncertain responses

**Wasted Opportunity:** `VisualizationPage.tsx` already tracks rich context that is NOT passed to the chatbot:
```typescript
// Available but unused context:
sourceCodeFile: { nodeId, fileName, language, lineCount }
selectedNode: ReactFlowNodeData
selectionSource: 'node' | 'tierlist' | null
```

### Solution: Rich Selection Context

#### Schema Extension

**Frontend Type (`frontend/src/types/chat.ts`):**
```typescript
export interface SelectionContext {
  source: 'source_code_panel' | 'graph_node' | 'tier_list' | 'file_tree' | 'unknown';

  current_file?: {
    node_id: string;
    file_path: string;
    file_name: string;
    language: string;
    role?: string;
    category?: string;
  };

  selected_node?: {
    node_id: string;
    file_path: string;
    role?: string;
  };

  line_range?: { start: number; end: number };
  selection_type?: 'function_name' | 'variable' | 'import' | 'code_block' | 'unknown';
}

export interface ChatRequest {
  message: string;
  highlighted_text?: string;
  selection_context?: SelectionContext;  // NEW
  conversation_id?: string;
}
```

#### Backend Processing

**Update `chat_context.py`:**
```python
def format_user_message(
    message: str,
    highlighted_text: Optional[str] = None,
    selection_context: Optional[SelectionContext] = None
) -> str:
    if not highlighted_text:
        return message

    context_parts = []
    if selection_context:
        if selection_context.current_file:
            context_parts.append(f"File: {selection_context.current_file['file_path']}")
        if selection_context.selection_type:
            context_parts.append(f"Type: {selection_context.selection_type}")

    if context_parts:
        return f"[Context: {' | '.join(context_parts)}]\n[Highlighted: {highlighted_text}]\n\n{message}"
    return f"[Highlighted: {highlighted_text}]\n\n{message}"
```

### Token Savings Estimate

| Scenario | Current | With Context | Savings |
|----------|---------|--------------|---------|
| Highlighted "sendMessage" from source panel | ~5,220 tokens (3 tool calls) | ~3,950 tokens (0-1 tool calls) | **24-40%** |

### Files to Modify

| File | Change |
|------|--------|
| `frontend/src/types/chat.ts` | Add SelectionContext interface |
| `frontend/src/hooks/useTextSelection.ts` | Capture line numbers, detect selection type |
| `frontend/src/hooks/useChat.ts` | Accept and transmit context |
| `frontend/src/components/chat/ChatPanel.tsx` | Receive context props |
| `frontend/src/pages/VisualizationPage.tsx` | Pass context to ChatPanel |
| `backend/app/models/chat_schemas.py` | Add SelectionContext model |
| `backend/app/services/chat_context.py` | Process context in formatting |
| `backend/app/services/chat_tools.py` | Context-aware tool execution |

---

## Strategy 2: Optional Codebase Analysis Context

### Problem

Full codebase context (system prompt + all tools) is always included, even for general questions like "What is TypeScript?" that don't need any codebase information.

### Current Token Cost Per Request

| Component | Estimated Tokens |
|-----------|-----------------|
| System context (codebase info) | 400-800 |
| Tool definitions (11 tools) | 1,800-2,500 |
| Base overhead | ~200 |
| **Total Base Context** | **2,400-3,500** |

For a simple "What is TypeScript?" question, this is 100% waste.

### Solution: Dual-Mode Chatbot

#### Mode Definitions

| Aspect | Codebase Mode | General Mode |
|--------|--------------|--------------|
| System Prompt | Full codebase context | Generic programming assistant |
| Tools | All 11 codebase tools | None |
| Token Cost | ~2,500-3,500 base | ~100-200 base |
| Use Cases | "What does auth.ts do?" | "What is TypeScript?" |

#### Implementation

**Backend Schema (`backend/app/models/chat_schemas.py`):**
```python
class ContextMode(str, Enum):
    CODEBASE = "codebase"  # Full context + tools
    GENERAL = "general"    # Minimal context, no tools

class ChatRequest(BaseModel):
    message: str
    highlighted_text: Optional[str] = None
    conversation_id: Optional[str] = None
    context_mode: ContextMode = ContextMode.CODEBASE
```

**Minimal System Prompt (`backend/app/services/chat_context.py`):**
```python
GENERAL_CONTEXT_TEMPLATE = """You are a helpful programming assistant.

Answer programming questions directly. If the user wants specific information about their codebase, suggest they enable "Codebase Mode".
"""
```

**Modified ChatbotService (`backend/app/services/chatbot.py`):**
```python
async def chat_stream(self, ..., context_mode: str = "codebase"):
    if context_mode == "general":
        system_context = build_general_context()
        tools_to_use = None  # No tools
    else:
        system_context = conversation.get_system_context(graph)
        tools_to_use = CHAT_TOOLS

    response = await self.client.messages.create(
        model=self.settings.llm_model,
        max_tokens=MAX_RESPONSE_TOKENS,
        system=system_context,
        tools=tools_to_use,
        messages=conversation.messages
    )
```

#### UI Component

**ChatPanel.tsx toggle:**
```tsx
<div className="flex items-center gap-1 bg-slate-800 rounded-lg p-0.5">
  <button
    onClick={() => setContextMode('codebase')}
    className={contextMode === 'codebase' ? 'active' : ''}
  >
    Codebase
  </button>
  <button
    onClick={() => setContextMode('general')}
    className={contextMode === 'general' ? 'active' : ''}
  >
    General
  </button>
</div>
```

### Token Savings Estimate

| Question Type | Current | General Mode | Savings |
|--------------|---------|--------------|---------|
| "What is TypeScript?" | ~3,200 | ~150 | **95%** |
| "How to use async/await?" | ~3,200 | ~150 | **95%** |
| "Best practices for React" | ~3,200 | ~150 | **95%** |

Assuming 40% of questions are general: **~38% overall cost reduction**

### Files to Modify

| File | Change |
|------|--------|
| `backend/app/models/chat_schemas.py` | Add ContextMode enum |
| `backend/app/services/chat_context.py` | Add build_general_context() |
| `backend/app/services/chatbot.py` | Conditional context/tools |
| `backend/app/api/chat.py` | Pass context_mode through |
| `frontend/src/types/chat.ts` | Add ContextMode type |
| `frontend/src/hooks/useChat.ts` | Add contextMode state |
| `frontend/src/components/chat/ChatPanel.tsx` | Add mode toggle UI |

---

## Strategy 3: Reduce Tool Calling and Optimize Prompts

### Problem

- All 11 tools (~4,500 tokens) are sent on every request
- No intent classification to determine if tools are needed
- Verbose tool descriptions waste tokens
- System prompt doesn't guide when NOT to use tools

### Solution: Intent-Based Tool Loading

#### Question Intent Classification

**New file: `backend/app/services/intent_classifier.py`**
```python
class QuestionIntent(str, Enum):
    CODEBASE_SPECIFIC = "codebase_specific"  # About specific files/functions
    CODEBASE_GENERAL = "codebase_general"    # About architecture/patterns
    GENERAL_KNOWLEDGE = "general_knowledge"  # About tech concepts
    HIGHLIGHTED_TEXT = "highlighted_text"    # User highlighted something

class IntentClassifier:
    CODEBASE_KEYWORDS = {"file", "function", "import", "dependency", "circular", ...}
    GENERAL_KEYWORDS = {"what is", "explain", "how does", "best practice", ...}

    @classmethod
    def classify(cls, message: str, highlighted_text: Optional[str]) -> QuestionIntent:
        if highlighted_text:
            return QuestionIntent.HIGHLIGHTED_TEXT
        # ... keyword matching logic
```

#### Tool Subsets by Intent

```python
TOOL_SETS = {
    QuestionIntent.HIGHLIGHTED_TEXT: [
        "explain_highlighted", "get_file_info", "get_function_info"
    ],
    QuestionIntent.CODEBASE_SPECIFIC: [
        "get_file_info", "search_files", "get_dependencies",
        "get_function_info", "list_functions", "detect_circular_dependencies",
        "find_dependency_path", "compare_files"
    ],
    QuestionIntent.CODEBASE_GENERAL: [
        "get_codebase_summary", "get_metrics", "search_files"
    ],
    QuestionIntent.GENERAL_KNOWLEDGE: [],  # No tools
}
```

### Solution: Compressed Tool Descriptions

**Current verbose (~120 tokens):**
```python
{
    "name": "get_file_info",
    "description": """Get comprehensive analysis of a specific file in the codebase.

Returns: path, name, folder, language, architectural role, AI-generated description...

When to use:
- User asks about a specific file's purpose...
- User wants to know what a file does...

Examples:
- "What does auth.ts do?" -> get_file_info(filename="auth.ts")
..."""
}
```

**Compressed (~30 tokens):**
```python
{
    "name": "get_file_info",
    "description": "Get file details: path, role, description, imports. Use for questions about specific files."
}
```

**Estimated savings:** 60-70% reduction per tool definition

### Solution: Optimized System Prompt

**Compressed template:**
```python
BASE_CONTEXT_TEMPLATE_COMPRESSED = """Code assistant for "{project_name}".

Stats: {file_count} files | {edge_count} deps | {languages}
{summary_compressed}

Tools: Query files, functions, dependencies when asked about specifics.
For highlighted text: use explain_highlighted tool.
Be concise. Reference specific names when relevant."""
```

### Token Savings Estimate

| Optimization | Token Reduction |
|--------------|----------------|
| Intent-based tool loading | 2,000-4,000 per request |
| Compressed tool descriptions | 2,500-3,500 per request |
| Compressed system prompt | 200-400 per request |
| **Combined for general questions** | **60-70%** |

### Files to Modify

| File | Change |
|------|--------|
| `backend/app/services/intent_classifier.py` | NEW - Intent classification |
| `backend/app/services/chat_tools.py` | Add compressed definitions, tool sets |
| `backend/app/services/chat_context.py` | Compressed templates |
| `backend/app/services/chatbot.py` | Integrate intent classification |

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1)
- [ ] Create ContextMode enum and API support
- [ ] Add mode toggle UI in ChatPanel
- [ ] Create lightweight system prompt for general mode
- [ ] **Expected savings: 30-40% for general questions**

### Phase 2: Tool Optimization (Week 2)
- [ ] Create compressed tool descriptions
- [ ] Implement intent classifier
- [ ] Add tool subset selection logic
- [ ] **Expected savings: Additional 20-30%**

### Phase 3: Rich Context (Week 3)
- [ ] Define SelectionContext schema
- [ ] Update frontend to capture file/node context
- [ ] Modify backend context processing
- [ ] **Expected savings: 20-40% for highlighted text queries**

### Phase 4: Polish (Week 4)
- [ ] Add auto-detection of question type
- [ ] Implement smart mode suggestions
- [ ] A/B testing and metrics collection
- [ ] Documentation updates

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Avg tokens (general questions) | ~6,000+ | ~1,500-2,000 |
| Avg tokens (codebase questions) | ~6,000+ | ~4,000-5,000 |
| Avg tokens (highlighted text) | ~5,000+ | ~3,000-4,000 |
| Cost per question | $0.10-0.25 | $0.02-0.08 |
| Tool calls per highlighted text | 2-3 | 0-1 |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Misclassifying codebase questions | Default to full context; user can override |
| Compressed descriptions reduce tool accuracy | A/B test; keep examples in descriptions |
| Context not passed correctly | Validate context matches highlighted text |
| User confusion about modes | Clear UI labels and tooltips |

---

## Conclusion

By implementing these three strategies, the chatbot's token efficiency can be improved by **30-70%** depending on question type:

1. **Strategy 1** (Upfront Context): Eliminates unnecessary tool calls for highlighted text by providing file context directly
2. **Strategy 2** (Optional Context): Reduces base token cost by 95% for general questions
3. **Strategy 3** (Smart Tools): Reduces tool definition overhead by 60-70% through intent-based loading

The combined effect addresses the core problem: users are paying for context they don't need. With these changes, a $0.25 question could cost $0.05-0.10, making the chatbot 3-5x more cost-efficient.
