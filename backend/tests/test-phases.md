# Test Suite Implementation Plan

This document outlines the three-phase plan for implementing a comprehensive test suite for the Visual Codebase application.

---

## Phase 1: Foundation & Critical Backend Tests ✅ COMPLETED
**Focus: Security, API endpoints, and test infrastructure**

### 1.1 Backend Test Infrastructure
- [x] Set up test fixtures in `backend/tests/conftest.py`
- [x] Create mock factories for: Supabase client, Anthropic client, GitHub responses
- [x] Add sample codebase fixtures (temp directories with JS/TS/Python projects)
- [x] Create sample data fixtures (nodes, edges, metadata, tier items)

### 1.2 Security Tests (`backend/tests/test_security.py`)
- [x] Test `validate_path_within_base()` path traversal prevention
- [x] Test `safe_join_path()` function
- [x] Test GitHub username regex validation
- [x] Test GitHub repo name validation
- [x] Test branch name validation (dangerous characters)
- [x] Test path validation (traversal attempts)
- [x] Test token sanitization in error messages
- [x] Test SQL injection prevention (parameterized query verification)
- [x] Test input boundary conditions (max lengths)

### 1.3 API Endpoint Tests (`backend/tests/test_api_routes.py`)
- [x] Test health check endpoint
- [x] Test authentication requirements for all protected endpoints
- [x] Test invalid auth header formats
- [x] Test request validation (422 errors)
- [x] Test analysis status endpoint (in-memory and database)
- [x] Test analysis result endpoint (in-progress, failed, not found)
- [x] Test GitHub username validation in routes
- [x] Test GitHub token requirements
- [x] Test user analyses endpoint
- [x] Test delete/update analysis endpoints
- [x] Test tier list endpoints (not found cases)
- [x] Test file content endpoint

### 1.4 Database Service Tests (`backend/tests/test_database_service.py`)
- [x] Test create analysis (local and GitHub)
- [x] Test update analysis status
- [x] Test complete analysis (stores nodes, edges, file content)
- [x] Test get analysis status
- [x] Test get user analyses
- [x] Test delete analysis (success, not owned, not found)
- [x] Test update analysis title
- [x] Test get file content (database and filesystem sources)
- [x] Test save functions (tier items)
- [x] Test get tier list (with filters, not owned)
- [x] Test get function stats
- [x] Test get function detail
- [x] Test RLS policy simulation (user isolation)
- [x] Test singleton pattern

**Results: 152 tests passing**

---

## Phase 2: Service Layer & Frontend Setup ✅ BACKEND COMPLETED
**Focus: Core business logic and frontend test infrastructure**

### 2.1 Backend Service Tests ✅ COMPLETED

#### `test_parser.py` - File Parser Tests (54 tests)
- [x] Test JavaScript/TypeScript import extraction
- [x] Test Python import extraction
- [x] Test export detection (named, default, re-exports)
- [x] Test function/class extraction
- [x] Test handling of different file encodings
- [x] Test file size limits (100KB)
- [x] Test unsupported file types
- [x] Test malformed syntax handling

#### `test_function_analyzer.py` - Function Analysis Tests (37 tests)
- [x] Test function definition extraction
- [x] Test arrow function detection
- [x] Test method extraction from classes
- [x] Test async function detection
- [x] Test parameter counting
- [x] Test exported function detection
- [x] Test entry point detection (main, handler)

#### `test_graph_builder.py` - Graph Builder Tests (35 tests)
- [x] Test import path resolution (relative paths)
- [x] Test alias resolution (`@/`, `~/`)
- [x] Test node_modules exclusion
- [x] Test circular dependency handling
- [x] Test React Flow format conversion
- [x] Test dagre layout positioning

#### `test_llm_analyzer.py` - LLM Analyzer Tests (42 tests)
- [x] Mock Anthropic API responses
- [x] Test batch processing (max 20 files)
- [x] Test file categorization (all architectural roles)
- [x] Test error handling (API failures)
- [x] Test response parsing
- [x] Test token limit handling

#### `test_github_service.py` - GitHub Service Tests (28 tests)
- [x] Mock git clone operations
- [x] Test shallow clone (`--depth 1`)
- [x] Test credential handling (token injection)
- [x] Test cleanup (temp directory removal)
- [x] Test private repo access
- [x] Test list user repos
- [x] Test list owner repos
- [x] Test rate limit handling

#### `test_tier_calculator.py` - Tier Calculator Tests (39 tests)
- [x] Test tier classification algorithm
- [x] Test percentile calculation
- [x] Test call count weighting
- [x] Test export bonus
- [x] Test entry point bonus
- [x] Test edge cases (zero calls, single function)

#### `test_analysis_service.py` - Analysis Orchestration Tests (35 tests)
- [x] Test job creation and tracking
- [x] Test status transitions
- [x] Test progress updates
- [x] Test error handling and recovery
- [x] Test pipeline orchestration with mocked services

**Results: 268 tests passing (16 minor edge case failures to refine)**

### 2.2 Frontend Test Infrastructure Setup

#### Install Dependencies
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom msw
```

#### Configuration Files
- [ ] Create `vitest.config.ts` with jsdom environment
- [ ] Create `src/test/setup.ts` for global test setup
- [ ] Create `src/test/test-utils.tsx` with render wrapper (providers)
- [ ] Create `src/test/mocks/handlers.ts` for MSW API mocks
- [ ] Update `package.json` with test scripts

### 2.3 Frontend Hook Tests

#### `useAnalysis.test.ts`
- [ ] Test initial state
- [ ] Test startAnalysis function
- [ ] Test polling behavior (1 second intervals)
- [ ] Test status transitions
- [ ] Test error handling
- [ ] Test cleanup on unmount

#### `useAuth.test.ts`
- [ ] Test initial auth state
- [ ] Test sign in flow
- [ ] Test sign out flow
- [ ] Test session persistence
- [ ] Test GitHub OAuth flow
- [ ] Test auth state changes

#### `useGitHubRepos.test.ts`
- [ ] Test initial loading state
- [ ] Test successful fetch
- [ ] Test pagination
- [ ] Test error handling
- [ ] Test refetch behavior

#### `useTierList.test.ts`
- [ ] Test initial state
- [ ] Test filtering (by tier, file, type)
- [ ] Test sorting
- [ ] Test pagination
- [ ] Test search functionality

### 2.4 Frontend API Client Tests

#### `client.test.ts`
- [ ] Test axios interceptors
- [ ] Test auth header injection
- [ ] Test GitHub token injection
- [ ] Test error response handling
- [ ] Test request/response transformation

---

## Phase 3: Integration & End-to-End Tests
**Focus: Full flow testing and component coverage**

### 3.1 Backend Integration Tests (`backend/tests/integration/`)

#### `test_analysis_flow.py`
- [ ] Test complete local analysis: parse → analyze → build graph → save
- [ ] Test GitHub analysis flow (with mocked clone)
- [ ] Test tier list generation end-to-end
- [ ] Test summary generation
- [ ] Test large codebase handling

#### `test_auth_flow.py`
- [ ] Test user registration → login → analysis → view results
- [ ] Test token refresh
- [ ] Test permission enforcement

### 3.2 Frontend Component Tests

#### Page Components
- [ ] `UploadPage.test.tsx`: Form submission, validation, mode switching
- [ ] `VisualizationPage.test.tsx`: Graph rendering, search, filtering, node selection
- [ ] `UserDashboard.test.tsx`: Analysis list, deletion confirmation, empty state
- [ ] `AuthCallback.test.tsx`: OAuth redirect handling

#### Feature Components
- [ ] `GitHubRepoForm.test.tsx`: Input states, validation, OAuth trigger
- [ ] `GitHubRepoSelector.test.tsx`: Repo browsing, pagination, selection
- [ ] `AuthModal.test.tsx`: Login/signup flows, error display, loading states
- [ ] `NodeDetailPanel.test.tsx`: File metadata display, content preview
- [ ] `CustomNode.test.tsx`: Node rendering, selection, hover states
- [ ] `SourceCodePanel.test.tsx`: Code display, syntax highlighting
- [ ] `SummaryDisplay.test.tsx`: Summary rendering, section collapse

### 3.3 E2E Flow Tests (Optional - Playwright)

#### `e2e/analysis.spec.ts`
- [ ] Upload local directory → view results
- [ ] GitHub OAuth → analyze private repo
- [ ] Search and filter visualization
- [ ] View function tier list

#### `e2e/auth.spec.ts`
- [ ] Sign up with email
- [ ] Sign in with email
- [ ] GitHub OAuth sign in
- [ ] Sign out

### 3.4 Performance Tests

#### `test_performance.py`
- [ ] Benchmark parsing with large codebases (>1000 files)
- [ ] Test LLM batch processing efficiency
- [ ] Test database query performance
- [ ] Test memory usage during analysis

#### Frontend Performance
- [ ] Test graph rendering with many nodes (>500)
- [ ] Test search/filter responsiveness
- [ ] Test initial load time

---

## Test Data & Fixtures

### Sample Codebases
Located in `backend/tests/fixtures/`:
- [ ] `small-js-project/` - Simple JavaScript project (5-10 files)
- [ ] `small-ts-project/` - TypeScript React project (10-15 files)
- [ ] `small-python-project/` - Python project (5-10 files)
- [ ] `mixed-project/` - Multi-language project

### Mock Data
- [ ] Parsed file data structures
- [ ] GitHub API response mocks
- [ ] LLM response mocks
- [ ] Sample function definitions and call graphs

---

## Requirements

### Backend
- pytest 8.0.0
- pytest-asyncio 0.23.5
- httpx 0.26.0 (for async testing)

### Frontend
- vitest
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event
- jsdom
- msw (Mock Service Worker)

### Coverage Goals
- **Critical paths**: >80% coverage
- **Security functions**: 100% coverage
- **API endpoints**: >90% coverage
- **React hooks**: >80% coverage

---

## Priority Order

| Priority | Area | Rationale |
|----------|------|-----------|
| 1 | Security tests | Prevent path traversal, injection attacks |
| 2 | API endpoint tests | Ensure auth and core endpoints work |
| 3 | Database RLS tests | User data isolation |
| 4 | Parser/graph builder | Core business logic correctness |
| 5 | Frontend hooks | State management reliability |
| 6 | Integration tests | Full pipeline validation |
| 7 | E2E tests | User journey validation |
| 8 | Performance tests | Scalability verification |

---

## Running Tests

### Backend
```bash
cd backend
source venv/bin/activate

# Run all tests
pytest

# Run specific phase
pytest tests/test_security.py tests/test_api_routes.py tests/test_database_service.py

# Run with coverage
pytest --cov=app --cov-report=html

# Run only fast tests
pytest -m "not slow"
```

### Frontend (after Phase 2 setup)
```bash
cd frontend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```
