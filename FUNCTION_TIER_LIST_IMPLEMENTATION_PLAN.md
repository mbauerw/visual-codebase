# Function Tier List - Implementation Plan

> **Purpose**: Track how many times each function is called throughout a codebase (static analysis) to help developers quickly identify the most critical functions when approaching an unfamiliar project.

---

## Executive Summary

| Aspect | Details |
|--------|---------|
| **Feature** | Function Tier List - ranks functions by call frequency |
| **Analysis Type** | Static (source code), not runtime execution |
| **Performance Impact** | ~30-50% increase in parse time per file |
| **Estimated Effort** | 5-6 weeks total |
| **Key Benefit** | Users can identify top functions within 10 seconds |

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Backend Implementation](#2-backend-implementation)
3. [Database Schema](#3-database-schema)
4. [API Design](#4-api-design)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Tier Classification Algorithm](#6-tier-classification-algorithm)
7. [Implementation Phases](#7-implementation-phases)
8. [Risk Analysis](#8-risk-analysis)

---

## 1. Architecture Overview

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Function Tier List Pipeline                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. PARSE PHASE (per file)                                                  │
│     ├─ Tree-sitter parses AST (already happening)                           │
│     ├─ Extract function definitions → {name, file, line, exported}          │
│     └─ Extract call sites → {callee, file, line, type}                      │
│                                                                              │
│  2. RESOLUTION PHASE (cross-file)                                           │
│     ├─ Build import alias map per file                                      │
│     ├─ Resolve each call to its definition                                  │
│     └─ Categorize: local | internal | external                              │
│                                                                              │
│  3. AGGREGATION PHASE (global)                                              │
│     ├─ Group calls by (function_name, defined_in_file)                      │
│     ├─ Count total calls per function                                       │
│     └─ Calculate weighted importance score                                  │
│                                                                              │
│  4. TIER ASSIGNMENT                                                          │
│     ├─ Sort by importance score                                             │
│     ├─ Assign tiers: S/A/B/C/D/F based on percentiles                       │
│     └─ Store in database                                                    │
│                                                                              │
│  5. API & FRONTEND                                                           │
│     ├─ Expose via /api/analysis/{id}/functions/tier-list                    │
│     └─ Display in tabbed right panel                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parsing approach | Separate pass initially | Lower risk, can feature-flag |
| Database storage | New dedicated tables | Separation of concerns, better query performance |
| API structure | Separate endpoints | Lazy loading, independent caching |
| Frontend placement | Tabbed right panel | Non-disruptive, preserves graph context |
| Tier system | Percentile-based | Adapts to codebase size |

---

## 2. Backend Implementation

### 2.1 Tree-sitter Query Patterns

#### JavaScript/TypeScript Call Expressions

```
# Direct function calls: foo()
(call_expression
  function: (identifier) @function_name)

# Method calls: obj.method()
(call_expression
  function: (member_expression
    property: (property_identifier) @method_name))

# Chained method calls: obj.foo().bar()
(call_expression
  function: (member_expression
    object: (call_expression) @chained_call
    property: (property_identifier) @method_name))
```

#### Python Call Expressions

```
# Direct function calls: foo()
(call
  function: (identifier) @function_name)

# Method calls: obj.method()
(call
  function: (attribute
    attribute: (identifier) @method_name))
```

### 2.2 New Schema Types

Add to `backend/app/models/schemas.py`:

```python
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional

class CallType(str, Enum):
    """Types of function/method calls."""
    FUNCTION = "function"           # foo()
    METHOD = "method"               # obj.foo()
    CONSTRUCTOR = "constructor"     # new Foo()
    STATIC_METHOD = "static_method" # Class.foo()
    IIFE = "iife"                   # (() => {})()

class CallOrigin(str, Enum):
    """Origin of the called function."""
    LOCAL = "local"           # Defined in same file
    INTERNAL = "internal"     # From another file in codebase
    EXTERNAL = "external"     # From node_modules/stdlib

class FunctionType(str, Enum):
    """Types of function definitions."""
    FUNCTION = "function"
    METHOD = "method"
    ARROW_FUNCTION = "arrow_function"
    CONSTRUCTOR = "constructor"
    HOOK = "hook"             # React hooks (useX pattern)
    CALLBACK = "callback"

class TierLevel(str, Enum):
    """Function importance tiers."""
    S = "S"  # Critical path
    A = "A"  # Core utility
    B = "B"  # Supporting
    C = "C"  # Specialized
    D = "D"  # Minor
    F = "F"  # Unused/dead code

class FunctionCallInfo(BaseModel):
    """Information about a function call site."""
    callee_name: str
    qualified_name: Optional[str] = None  # obj.method or Class.method
    call_type: CallType
    origin: CallOrigin
    source_file: str
    line_number: int
    column: int
    resolved_target: Optional[str] = None  # File path if internal
    original_name: Optional[str] = None    # If aliased import

class FunctionInfo(BaseModel):
    """Detailed function information from parsing."""
    name: str
    qualified_name: str              # "FileName.ClassName?.FunctionName"
    function_type: FunctionType
    start_line: int
    end_line: Optional[int] = None
    is_exported: bool = False
    is_async: bool = False
    is_entry_point: bool = False     # main, handlers, route functions
    parameters_count: int = 0
    parent_class: Optional[str] = None

class FunctionTierItem(BaseModel):
    """Single function in the tier list."""
    id: str
    function_name: str
    qualified_name: str
    function_type: FunctionType
    file_path: str
    file_name: str

    # Metrics
    internal_call_count: int
    external_call_count: int = 0
    is_exported: bool
    is_entry_point: bool

    # Tier information
    tier: TierLevel
    tier_percentile: float  # 0.0-100.0

    # Location
    start_line: int
    end_line: Optional[int] = None
    async_function: bool = False
    parameters_count: int = 0
```

### 2.3 Parser Enhancement

Add to `backend/app/services/parser.py`:

```python
def _extract_js_ts_calls(self, tree, content: str) -> list[FunctionCallInfo]:
    """Extract function call sites from JS/TS AST."""
    calls = []

    def traverse(node):
        if node.type == "call_expression":
            callee = node.child_by_field_name("function")
            if callee:
                call_info = self._parse_call_expression(callee, node, content)
                if call_info:
                    calls.append(call_info)

        for child in node.children:
            traverse(child)

    traverse(tree.root_node)
    return calls

def _parse_call_expression(self, callee, call_node, content: str) -> Optional[FunctionCallInfo]:
    """Parse a call expression node into FunctionCallInfo."""
    line = call_node.start_point[0] + 1
    column = call_node.start_point[1]

    if callee.type == "identifier":
        # Direct function call: foo()
        return FunctionCallInfo(
            callee_name=self._get_node_text(callee, content),
            call_type=CallType.FUNCTION,
            origin=CallOrigin.LOCAL,  # Will be resolved later
            source_file="",  # Set by caller
            line_number=line,
            column=column
        )

    elif callee.type == "member_expression":
        # Method call: obj.method()
        prop = callee.child_by_field_name("property")
        obj = callee.child_by_field_name("object")
        if prop:
            method_name = self._get_node_text(prop, content)
            obj_name = self._get_node_text(obj, content) if obj else None
            return FunctionCallInfo(
                callee_name=method_name,
                qualified_name=f"{obj_name}.{method_name}" if obj_name else method_name,
                call_type=CallType.METHOD,
                origin=CallOrigin.LOCAL,
                source_file="",
                line_number=line,
                column=column
            )

    return None
```

### 2.4 New Services

#### `backend/app/services/function_analyzer.py`

```python
class FunctionAnalyzer:
    """Extracts and analyzes function definitions and calls."""

    def analyze(self, parsed_files: list[ParsedFile]) -> tuple[list[FunctionInfo], list[FunctionCallInfo]]:
        """Extract all functions and calls from parsed files."""
        all_functions = []
        all_calls = []

        for pf in parsed_files:
            functions = self._extract_functions(pf)
            calls = self._extract_calls(pf)
            all_functions.extend(functions)
            all_calls.extend(calls)

        return all_functions, all_calls
```

#### `backend/app/services/call_resolver.py`

```python
class CallResolver:
    """Resolves function calls to their definitions."""

    def __init__(self, parsed_files: list[ParsedFile]):
        self.file_map = {pf.relative_path: pf for pf in parsed_files}
        self.function_index = self._build_function_index()
        self.import_map = self._build_import_map()

    def resolve_all(self, calls: list[FunctionCallInfo]) -> list[FunctionCallInfo]:
        """Resolve all calls to their definitions."""
        resolved = []
        for call in calls:
            resolved_call = self._resolve_call(call)
            resolved.append(resolved_call)
        return resolved

    def _resolve_call(self, call: FunctionCallInfo) -> FunctionCallInfo:
        """Attempt to resolve a single call."""
        # 1. Check local scope
        # 2. Check imports
        # 3. Heuristic matching
        # 4. Mark as unresolved
        ...
```

#### `backend/app/services/tier_calculator.py`

```python
class TierCalculator:
    """Calculates function importance tiers."""

    DEFAULT_THRESHOLDS = {
        TierLevel.S: {"percentile_min": 95},  # Top 5%
        TierLevel.A: {"percentile_min": 80},  # Top 6-20%
        TierLevel.B: {"percentile_min": 50},  # Top 21-50%
        TierLevel.C: {"percentile_min": 20},  # Top 51-80%
        TierLevel.D: {"percentile_min": 5},   # Top 81-95%
        TierLevel.F: {"percentile_min": 0},   # Bottom 5%
    }

    def classify(
        self,
        functions: list[FunctionInfo],
        calls: list[FunctionCallInfo]
    ) -> list[FunctionTierItem]:
        """Classify functions into tiers based on call counts."""
        # Aggregate call counts
        call_counts = self._aggregate_calls(calls)

        # Calculate weighted scores
        scored = self._calculate_scores(functions, call_counts)

        # Assign tiers based on percentiles
        return self._assign_tiers(scored)

    def _calculate_weighted_score(self, func: FunctionInfo, call_count: int) -> float:
        """Calculate importance score with weighting factors."""
        base_score = call_count

        # Exported functions get a boost (API surface)
        if func.is_exported:
            base_score += 2

        # Entry points are inherently important
        if func.is_entry_point:
            base_score += 5

        # Hooks and handlers are architecturally significant
        if func.function_type in (FunctionType.HOOK, FunctionType.CALLBACK):
            base_score *= 1.2

        return base_score
```

---

## 3. Database Schema

### 3.1 Migration: `005_add_function_tier_list.sql`

```sql
-- Migration: 005_add_function_tier_list
-- Description: Add tables for function-level analysis and tier list feature

-- Update analysis status enum
ALTER TABLE public.analyses
DROP CONSTRAINT IF EXISTS analyses_status_check;

ALTER TABLE public.analyses
ADD CONSTRAINT analyses_status_check
CHECK (status IN (
  'pending',
  'cloning',
  'parsing',
  'analyzing',
  'analyzing_functions',  -- NEW
  'building_graph',
  'generating_summary',
  'completed',
  'failed'
));

-- Add function stats to analyses table
ALTER TABLE public.analyses
ADD COLUMN IF NOT EXISTS function_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS function_call_count integer DEFAULT 0;

-- Main functions table
CREATE TABLE public.analysis_functions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  node_id text NOT NULL,  -- Links to analysis_nodes

  -- Function identification
  function_name text NOT NULL,
  qualified_name text NOT NULL,  -- "FileName.ClassName?.FunctionName"
  function_type text NOT NULL CHECK (function_type IN (
    'function', 'method', 'arrow_function', 'constructor', 'hook', 'callback'
  )),

  -- Location
  start_line integer NOT NULL,
  end_line integer,

  -- Metrics
  internal_call_count integer DEFAULT 0,
  external_call_count integer DEFAULT 0,
  is_exported boolean DEFAULT false,
  is_entry_point boolean DEFAULT false,

  -- Tier classification
  tier text CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'F')),
  tier_percentile float,

  -- Metadata
  language text NOT NULL,
  async boolean DEFAULT false,
  parameters_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),

  UNIQUE(analysis_id, node_id, qualified_name, start_line)
);

-- Function call graph table
CREATE TABLE public.analysis_function_calls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,

  -- Caller
  caller_function_id uuid REFERENCES public.analysis_functions(id) ON DELETE CASCADE,
  caller_node_id text NOT NULL,
  call_line integer,

  -- Callee
  callee_qualified_name text NOT NULL,
  callee_node_id text,
  callee_function_id uuid REFERENCES public.analysis_functions(id) ON DELETE SET NULL,

  -- Call context
  call_type text CHECK (call_type IN (
    'direct', 'method', 'chained', 'callback', 'jsx', 'dynamic'
  )),

  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_functions_analysis ON public.analysis_functions(analysis_id);
CREATE INDEX idx_functions_node ON public.analysis_functions(analysis_id, node_id);
CREATE INDEX idx_functions_tier ON public.analysis_functions(analysis_id, tier);
CREATE INDEX idx_functions_call_count ON public.analysis_functions(analysis_id, internal_call_count DESC);
CREATE INDEX idx_functions_name ON public.analysis_functions(analysis_id, function_name);

-- Full text search for function names
CREATE INDEX idx_functions_name_search ON public.analysis_functions
  USING gin(to_tsvector('english', function_name));

CREATE INDEX idx_function_calls_analysis ON public.analysis_function_calls(analysis_id);
CREATE INDEX idx_function_calls_caller ON public.analysis_function_calls(caller_function_id);
CREATE INDEX idx_function_calls_callee ON public.analysis_function_calls(callee_function_id);

-- Covering index for common tier list query
CREATE INDEX idx_functions_tier_list ON public.analysis_functions(
  analysis_id, tier, internal_call_count DESC
) INCLUDE (function_name, qualified_name, node_id);

-- RLS Policies
ALTER TABLE public.analysis_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_function_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view functions from their analyses"
  ON public.analysis_functions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = analysis_functions.analysis_id
      AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view function calls from their analyses"
  ON public.analysis_function_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = analysis_function_calls.analysis_id
      AND analyses.user_id = auth.uid()
    )
  );

-- Service role policies
CREATE POLICY "Service can insert functions"
  ON public.analysis_functions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can insert function calls"
  ON public.analysis_function_calls FOR INSERT
  WITH CHECK (true);
```

### 3.2 Storage Estimates

| Codebase Size | Est. Functions | Est. Calls | Functions Table | Calls Table |
|---------------|----------------|------------|-----------------|-------------|
| Small (100 files) | ~500 | ~2,000 | ~100 KB | ~400 KB |
| Medium (500 files) | ~2,500 | ~15,000 | ~500 KB | ~3 MB |
| Large (2,000 files) | ~10,000 | ~80,000 | ~2 MB | ~16 MB |

---

## 4. API Design

### 4.1 Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analysis/{id}/functions/tier-list` | Paginated tier list |
| GET | `/api/analysis/{id}/functions/{func_id}` | Function details with callers/callees |
| GET | `/api/analysis/{id}/functions/{func_id}/callers` | Paginated callers |
| GET | `/api/analysis/{id}/functions/{func_id}/callees` | Paginated callees |
| GET | `/api/analysis/{id}/functions/stats` | Aggregate statistics |

### 4.2 Tier List Endpoint

```
GET /api/analysis/{analysis_id}/functions/tier-list
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tier` | string | null | Filter by tier (S/A/B/C/D/F) |
| `file` | string | null | Filter by file path (partial match) |
| `type` | string | null | Filter by function_type |
| `search` | string | null | Search function names |
| `sort_by` | string | "call_count" | Sort: call_count, name, file, tier |
| `sort_order` | string | "desc" | Sort order: asc, desc |
| `page` | int | 1 | Page number |
| `per_page` | int | 50 | Items per page (max 100) |

**Response:**

```json
{
  "analysis_id": "uuid",
  "total_functions": 245,
  "tier_summary": {
    "S": 12,
    "A": 25,
    "B": 48,
    "C": 72,
    "D": 63,
    "F": 25
  },
  "functions": [
    {
      "id": "uuid",
      "function_name": "useAuth",
      "qualified_name": "hooks.useAuth",
      "function_type": "hook",
      "file_path": "src/hooks/useAuth.ts",
      "internal_call_count": 47,
      "tier": "S",
      "tier_percentile": 98.5,
      "is_exported": true,
      "start_line": 15
    }
  ],
  "page": 1,
  "per_page": 50,
  "total_pages": 5,
  "has_next": true
}
```

### 4.3 Add Summary to Existing Metadata

Extend `AnalysisMetadata` in the existing graph response:

```python
class FunctionStats(BaseModel):
    """Summary statistics for function analysis."""
    total_functions: int
    total_calls: int
    tier_counts: dict[str, int]  # {"S": 5, "A": 12, ...}
    top_functions: list[str]     # Top 5 function names

class AnalysisMetadata(BaseModel):
    # ... existing fields ...
    function_stats: Optional[FunctionStats] = None
```

---

## 5. Frontend Implementation

### 5.1 Component Architecture

```
frontend/src/components/TierList/
├── FunctionTierList.tsx      # Main container component
├── TierSection.tsx           # Collapsible tier group (S/A/B/C/D/F)
├── FunctionRow.tsx           # Individual function item
├── FunctionTooltip.tsx       # Hover tooltip with details
├── TierListSearch.tsx        # Search input
├── TierListFilters.tsx       # Filter dropdowns
└── index.ts                  # Barrel export

frontend/src/types/tierList.ts   # Type definitions
frontend/src/hooks/useTierList.ts # Data fetching hook
```

### 5.2 Type Definitions

Create `frontend/src/types/tierList.ts`:

```typescript
export type TierLevel = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface FunctionInfo {
  id: string;
  name: string;
  qualifiedName: string;
  filePath: string;
  fileNodeId: string;
  callCount: number;
  tier: TierLevel;
  tierPercentile: number;
  functionType: string;
  isExported: boolean;
  isEntryPoint: boolean;
  startLine: number;
}

export interface TierGroup {
  tier: TierLevel;
  label: string;
  functions: FunctionInfo[];
  color: string;
}

export const tierColors: Record<TierLevel, string> = {
  S: '#fbbf24', // amber-400 (gold)
  A: '#f472b6', // pink-400
  B: '#a78bfa', // violet-400
  C: '#38bdf8', // sky-400
  D: '#64748b', // slate-500
  F: '#ef4444', // red-500
};

export const tierLabels: Record<TierLevel, string> = {
  S: 'Critical Functions',
  A: 'Core Functions',
  B: 'Supporting Functions',
  C: 'Specialized Functions',
  D: 'Minor Functions',
  F: 'Unused/Dead Code',
};
```

### 5.3 UI Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [Files] [Tier List]  ← Tab Navigation                       │
├──────────────────────────────────────────────────────────────┤
│  FUNCTION TIER LIST                         [Search...]  X   │
├──────────────────────────────────────────────────────────────┤
│  [S] Critical Functions ─────────────────────────────── (12) │
│    ┌───────────────────────────────────────────────────────┐ │
│    │ useAuth           │ 47 calls │ hook   │ useAuth.ts   │ │
│    │ apiClient         │ 42 calls │ util   │ api.ts       │ │
│    │ formatDate        │ 38 calls │ util   │ helpers.ts   │ │
│    └───────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  [A] Core Functions ─────────────────────────────────── (25) │
│    ┌───────────────────────────────────────────────────────┐ │
│    │ validateInput     │ 24 calls │ util   │ validate.ts  │ │
│    │ handleError       │ 22 calls │ util   │ errors.ts    │ │
│    │ ... (click to expand)                                 │ │
│    └───────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────┤
│  [B] Supporting Functions ──────────────────────────── (48)  │
│    › Collapsed (click to expand)                             │
├──────────────────────────────────────────────────────────────┤
│  [C] Specialized Functions ─────────────────────────── (72)  │
│    › Collapsed                                               │
├──────────────────────────────────────────────────────────────┤
│  [D] Minor Functions ───────────────────────────────── (63)  │
│    › Collapsed                                               │
├──────────────────────────────────────────────────────────────┤
│  [F] Unused/Dead Code ──────────────────────────────── (25)  │
│    › Collapsed                                               │
└──────────────────────────────────────────────────────────────┘
```

### 5.4 Interaction Design

| Interaction | Behavior |
|-------------|----------|
| Click function row | Highlight node in graph, pan to file |
| Hover function row | Show tooltip with callers/callees |
| Click tier header | Expand/collapse section |
| Search | Real-time filter by function name |
| Click "Locate" button | Pan graph to function's file |

### 5.5 Integration with VisualizationPage

Modify `frontend/src/pages/VisualizationPage.tsx`:

```typescript
// Add tab state
const [rightPanelTab, setRightPanelTab] = useState<'details' | 'tierlist'>('details');

// In the right panel section:
{expanded && (
  <div className="h-full bg-slate-900 overflow-hidden">
    {/* Tab Navigation */}
    <div className="flex border-b border-slate-700">
      <button
        onClick={() => setRightPanelTab('details')}
        className={`px-4 py-2 text-sm ${rightPanelTab === 'details' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
      >
        Files
      </button>
      <button
        onClick={() => setRightPanelTab('tierlist')}
        className={`px-4 py-2 text-sm ${rightPanelTab === 'tierlist' ? 'bg-slate-800 text-white' : 'text-slate-400'}`}
      >
        Tier List
      </button>
    </div>

    {/* Tab Content */}
    {rightPanelTab === 'details' ? (
      <NodeDetailPanel ... />
    ) : (
      <FunctionTierList
        analysisId={analysisId}
        onFunctionSelect={handleFunctionSelect}
      />
    )}
  </div>
)}
```

---

## 6. Tier Classification Algorithm

### 6.1 Percentile-Based Classification

```python
DEFAULT_THRESHOLDS = {
    "S": {"percentile_min": 95},    # Top 5%
    "A": {"percentile_min": 80},    # Top 6-20%
    "B": {"percentile_min": 50},    # Top 21-50%
    "C": {"percentile_min": 20},    # Top 51-80%
    "D": {"percentile_min": 5},     # Top 81-95%
    "F": {"percentile_min": 0},     # Bottom 5%
}
```

### 6.2 Weighted Scoring

```python
def calculate_weighted_score(func: FunctionInfo, call_count: int) -> float:
    """
    Factors:
    - Call count (primary)
    - Export status (API surface)
    - Entry point status (main, handlers)
    - Function type (hooks, callbacks)
    """
    base_score = call_count

    if func.is_exported:
        base_score += 2

    if func.is_entry_point:
        base_score += 5

    if func.function_type in ('hook', 'callback'):
        base_score *= 1.2

    return base_score
```

### 6.3 Edge Cases

| Scenario | Treatment |
|----------|-----------|
| Exported, 0 internal calls | B-C tier (API surface) |
| Not exported, 0 calls | F tier (dead code candidate) |
| Entry point (main, handler) | A-S tier boost |
| React hook (useX) | Weighted boost |
| Test helpers | Exclude or F tier |

---

## 7. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Backend:**
- [ ] Add `FunctionCallInfo`, `FunctionInfo` schemas
- [ ] Add `_extract_js_ts_calls()` to FileParser
- [ ] Add `_extract_python_calls()` to FileParser
- [ ] Feature flag: `extract_calls: bool = False`

**Database:**
- [ ] Create migration `005_add_function_tier_list.sql`
- [ ] Add RLS policies

**Files to modify:**
- `backend/app/models/schemas.py`
- `backend/app/services/parser.py`
- `supabase/migrations/005_add_function_tier_list.sql`

### Phase 2: Resolution & Aggregation (Week 2-3)

**Backend:**
- [ ] Enhance import parsing for aliases
- [ ] Create `CallResolver` service
- [ ] Create `TierCalculator` service
- [ ] Integrate into analysis pipeline

**New files:**
- `backend/app/services/function_analyzer.py`
- `backend/app/services/call_resolver.py`
- `backend/app/services/tier_calculator.py`

### Phase 3: API (Week 3-4)

**Backend:**
- [ ] Add tier list endpoint
- [ ] Add function detail endpoint
- [ ] Add pagination and filtering
- [ ] Extend database service

**Files to modify:**
- `backend/app/api/routes.py`
- `backend/app/services/database.py`

### Phase 4: Frontend Foundation (Week 4-5)

**Frontend:**
- [ ] Create type definitions
- [ ] Create `useTierList` hook
- [ ] Create `FunctionTierList` component
- [ ] Create `TierSection` component
- [ ] Create `FunctionRow` component
- [ ] Add tab navigation to right panel

**New files:**
- `frontend/src/types/tierList.ts`
- `frontend/src/hooks/useTierList.ts`
- `frontend/src/components/TierList/*.tsx`

### Phase 5: Integration & Polish (Week 5-6)

**Frontend:**
- [ ] Graph integration (click → highlight)
- [ ] Bidirectional sync (select node → update list)
- [ ] Tooltip with callers/callees
- [ ] Search and filters
- [ ] Keyboard navigation
- [ ] Persist preferences in localStorage

**Performance:**
- [ ] Virtualize long lists
- [ ] Debounce search
- [ ] Lazy load collapsed sections

---

## 8. Risk Analysis

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance regression | Medium | High | Feature flag, monitoring, pagination |
| Call resolution accuracy | Medium | Medium | Confidence scores, ~75% target resolution |
| Dynamic calls unresolvable | High | Low | Accept limitation, mark as "dynamic" |
| Storage costs | Low | Medium | Lazy compute, optional call graph |
| Breaking existing analyses | Low | High | Additive migration, backward compatible |
| Large codebase performance | Medium | High | Virtualization, batch processing |

---

## 9. Success Metrics

**Performance:**
- Tier list renders in < 200ms for 100-file codebase
- Search filters update in < 50ms
- API response time < 500ms for 95th percentile

**Accuracy:**
- > 75% of function calls resolved to definitions
- > 90% correct tier assignments for top 20 functions

**User Engagement:**
- Users access tier list on > 50% of analysis views
- Users can identify top 5 functions within 10 seconds

---

## 10. File Summary

### New Files

| Path | Purpose |
|------|---------|
| `supabase/migrations/005_add_function_tier_list.sql` | Database schema |
| `backend/app/services/function_analyzer.py` | Function extraction |
| `backend/app/services/call_resolver.py` | Call resolution |
| `backend/app/services/tier_calculator.py` | Tier classification |
| `frontend/src/types/tierList.ts` | Type definitions |
| `frontend/src/hooks/useTierList.ts` | Data fetching hook |
| `frontend/src/components/TierList/FunctionTierList.tsx` | Main component |
| `frontend/src/components/TierList/TierSection.tsx` | Tier group |
| `frontend/src/components/TierList/FunctionRow.tsx` | Function item |
| `frontend/src/components/TierList/FunctionTooltip.tsx` | Hover details |
| `frontend/src/components/TierList/TierListSearch.tsx` | Search input |
| `frontend/src/components/TierList/TierListFilters.tsx` | Filters |

### Files to Modify

| Path | Changes |
|------|---------|
| `backend/app/models/schemas.py` | Add function/call types |
| `backend/app/services/parser.py` | Add call extraction methods |
| `backend/app/services/analysis.py` | Integrate function analysis step |
| `backend/app/services/database.py` | Add function storage methods |
| `backend/app/api/routes.py` | Add tier list endpoints |
| `frontend/src/pages/VisualizationPage.tsx` | Add tab navigation, integrate tier list |
| `frontend/src/types/index.ts` | Export tier list types |
