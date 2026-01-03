# Function Tier List - Implementation Phases

> Condensed from the detailed implementation plan into three actionable phases.

---

## Phase 1: Backend Core (Parsing, Resolution & Tier Calculation)

**Goal**: Extract function definitions and call sites from source code, resolve calls to their definitions, and calculate tier rankings.

### 1.1 Schema & Type Definitions

Add to `backend/app/models/schemas.py`:
- `CallType` enum: function, method, constructor, static_method, iife
- `CallOrigin` enum: local, internal, external
- `FunctionType` enum: function, method, arrow_function, constructor, hook, callback
- `TierLevel` enum: S, A, B, C, D, F
- `FunctionCallInfo` model: callee_name, call_type, origin, source_file, line_number, etc.
- `FunctionInfo` model: name, qualified_name, function_type, start_line, is_exported, etc.
- `FunctionTierItem` model: function details + tier + call counts

### 1.2 Parser Enhancement

Modify `backend/app/services/parser.py`:
- Add `_extract_js_ts_calls()` method using Tree-sitter queries
- Add `_extract_python_calls()` method
- Add feature flag: `extract_calls: bool = False` parameter
- Handle call expressions: direct calls `foo()`, method calls `obj.method()`, chained calls

### 1.3 New Backend Services

Create three new service files:

**`backend/app/services/function_analyzer.py`**
- `FunctionAnalyzer.analyze()`: Extract all functions and calls from parsed files
- `_extract_functions()`: Get function definitions with metadata
- `_extract_calls()`: Get call sites with location info

**`backend/app/services/call_resolver.py`**
- `CallResolver.__init__()`: Build function index and import map
- `resolve_all()`: Resolve all calls to their definitions
- `_resolve_call()`: Check local scope → imports → heuristic matching
- Categorize resolved calls as local, internal, or external

**`backend/app/services/tier_calculator.py`**
- `TierCalculator.classify()`: Main classification method
- `_aggregate_calls()`: Group calls by function
- `_calculate_weighted_score()`: Apply weighting factors (exported +2, entry_point +5, hooks ×1.2)
- `_assign_tiers()`: Percentile-based tier assignment (S: top 5%, A: 6-20%, B: 21-50%, C: 51-80%, D: 81-95%, F: bottom 5%)

### 1.4 Database Migration

Create `supabase/migrations/005_add_function_tier_list.sql`:
- Add `analyzing_functions` status to analyses table
- Add `function_count`, `function_call_count` columns to analyses
- Create `analysis_functions` table (function definitions with tier info)
- Create `analysis_function_calls` table (call graph edges)
- Add indexes for tier queries and full-text search
- Add RLS policies for user access control

### 1.5 Pipeline Integration

Modify `backend/app/services/analysis.py`:
- Add `analyzing_functions` step after parsing
- Call `FunctionAnalyzer` → `CallResolver` → `TierCalculator`
- Store results via `DatabaseService`

### Deliverables
- [ ] Schema types in `schemas.py`
- [ ] Call extraction in `parser.py`
- [ ] `function_analyzer.py` service
- [ ] `call_resolver.py` service
- [ ] `tier_calculator.py` service
- [ ] Database migration `005_add_function_tier_list.sql`
- [ ] Integration in `analysis.py` pipeline

---

## Phase 2: API Layer

**Goal**: Expose function tier data through REST endpoints with filtering, pagination, and search.

### 2.1 New Endpoints

Add to `backend/app/api/routes.py`:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analysis/{id}/functions/tier-list` | Paginated tier list with filters |
| GET | `/api/analysis/{id}/functions/{func_id}` | Single function with callers/callees |
| GET | `/api/analysis/{id}/functions/{func_id}/callers` | Paginated list of callers |
| GET | `/api/analysis/{id}/functions/{func_id}/callees` | Paginated list of callees |
| GET | `/api/analysis/{id}/functions/stats` | Aggregate statistics |

### 2.2 Tier List Endpoint Details

**Query Parameters:**
- `tier`: Filter by tier (S/A/B/C/D/F)
- `file`: Filter by file path (partial match)
- `type`: Filter by function_type
- `search`: Search function names (full-text)
- `sort_by`: call_count | name | file | tier
- `sort_order`: asc | desc
- `page`: Page number (default: 1)
- `per_page`: Items per page (default: 50, max: 100)

**Response Structure:**
```json
{
  "analysis_id": "uuid",
  "total_functions": 245,
  "tier_summary": {"S": 12, "A": 25, "B": 48, "C": 72, "D": 63, "F": 25},
  "functions": [...],
  "page": 1,
  "per_page": 50,
  "total_pages": 5,
  "has_next": true
}
```

### 2.3 Database Service Extension

Add to `backend/app/services/database.py`:
- `save_functions()`: Batch insert function definitions
- `save_function_calls()`: Batch insert call graph edges
- `get_tier_list()`: Query with filtering, sorting, pagination
- `get_function_details()`: Single function with caller/callee counts
- `get_function_callers()`: Paginated callers query
- `get_function_callees()`: Paginated callees query
- `get_function_stats()`: Aggregate tier counts

### 2.4 Extend Analysis Metadata

Add `FunctionStats` to existing graph response:
```python
class FunctionStats(BaseModel):
    total_functions: int
    total_calls: int
    tier_counts: dict[str, int]  # {"S": 5, "A": 12, ...}
    top_functions: list[str]     # Top 5 function names
```

### Deliverables
- [ ] Tier list endpoint with filtering/pagination
- [ ] Function detail endpoint
- [ ] Callers/callees endpoints
- [ ] Stats endpoint
- [ ] Database query methods
- [ ] `FunctionStats` in analysis metadata

---

## Phase 3: Frontend Implementation

**Goal**: Build the tier list UI with graph integration, search, and interactive features.

### 3.1 Type Definitions

Create `frontend/src/types/tierList.ts`:
- `TierLevel` type: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'
- `FunctionInfo` interface: id, name, qualifiedName, filePath, callCount, tier, etc.
- `TierGroup` interface: tier, label, functions, color
- `tierColors` constant: color mapping for each tier
- `tierLabels` constant: human-readable tier descriptions

### 3.2 Data Fetching Hook

Create `frontend/src/hooks/useTierList.ts`:
- Fetch tier list data from API
- Handle pagination state
- Handle filter/search state
- Debounced search (300ms)
- Cache results with React Query

### 3.3 Component Architecture

Create `frontend/src/components/TierList/`:

**`FunctionTierList.tsx`** (main container)
- Manages expanded/collapsed tier sections
- Coordinates search and filter state
- Handles function selection callback

**`TierSection.tsx`** (collapsible tier group)
- Expandable header with tier badge and count
- Lists functions within the tier
- S and A tiers expanded by default

**`FunctionRow.tsx`** (individual function item)
- Display: name, call count, type badge, file name
- Click handler for graph navigation
- Hover state for tooltip trigger

**`FunctionTooltip.tsx`** (hover details)
- Show top 3 callers and callees
- Display file path and line number
- Quick stats (exported, async, params)

**`TierListSearch.tsx`** (search input)
- Debounced input
- Clear button
- Result count display

**`TierListFilters.tsx`** (filter dropdowns)
- Tier filter (multi-select)
- Function type filter
- File path filter

### 3.4 VisualizationPage Integration

Modify `frontend/src/pages/VisualizationPage.tsx`:
- Add tab state: `'details' | 'tierlist'`
- Add tab navigation in right panel header
- Conditionally render `NodeDetailPanel` or `FunctionTierList`
- Add `handleFunctionSelect` callback to pan graph to file

### 3.5 Graph Integration

- Click function row → highlight corresponding node in graph
- Click function row → pan/zoom to the file's node
- Select node in graph → scroll tier list to show functions in that file
- Bidirectional selection sync

### 3.6 Performance Optimizations

- Virtualize long function lists (react-window or similar)
- Lazy load collapsed tier sections
- Debounce search input (300ms)
- Memoize tier groupings
- Persist expanded/collapsed state in localStorage

### 3.7 Polish & UX

- Keyboard navigation (arrow keys, enter to select)
- Loading skeletons during fetch
- Empty states for no results
- Error handling with retry
- Responsive layout for smaller screens

### Deliverables
- [ ] `tierList.ts` type definitions
- [ ] `useTierList.ts` hook
- [ ] `FunctionTierList.tsx` component
- [ ] `TierSection.tsx` component
- [ ] `FunctionRow.tsx` component
- [ ] `FunctionTooltip.tsx` component
- [ ] `TierListSearch.tsx` component
- [ ] `TierListFilters.tsx` component
- [ ] Tab navigation in `VisualizationPage.tsx`
- [ ] Graph integration (click → highlight/pan)
- [ ] Virtualization for long lists
- [ ] localStorage persistence

---

## Summary

| Phase | Focus | Key Files |
|-------|-------|-----------|
| **1** | Backend parsing, resolution, tier calculation | `schemas.py`, `parser.py`, `function_analyzer.py`, `call_resolver.py`, `tier_calculator.py`, `005_*.sql` |
| **2** | REST API endpoints and database queries | `routes.py`, `database.py` |
| **3** | Frontend components and graph integration | `tierList.ts`, `useTierList.ts`, `TierList/*.tsx`, `VisualizationPage.tsx` |
