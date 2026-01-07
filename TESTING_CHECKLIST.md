# Visual Codebase Testing Checklist

Run these tests when adding new features or making changes to ensure nothing breaks.

---

## Quick Smoke Tests

Run these first to catch obvious issues:

```bash
# Backend health check
curl http://localhost:8000/api/health

# Frontend builds without errors
cd frontend && npm run build

# Backend starts without errors
cd backend && uvicorn app.main:app --reload --port 8000
```

---

## Backend Unit Tests

### 1. File Parser (`backend/app/services/parser.py`)

| Test | Command/Check | Expected |
|------|---------------|----------|
| Parse JS file | Parse a `.js` file with imports | Returns ImportInfo list |
| Parse TS file | Parse a `.ts` file with type imports | Handles `import type` |
| Parse Python file | Parse a `.py` file with imports | Handles `from x import y` |
| Parse TSX/JSX | Parse React component | Extracts component functions |
| Large file handling | Parse file > 100KB | Skips file gracefully |
| Invalid syntax | Parse malformed file | Returns None or partial result |
| Relative imports | `./utils`, `../lib` | Correctly identified as relative |
| Alias imports | `@/components`, `~/utils` | Import path captured |
| Dynamic imports | `import('module')` | Detected as dynamic_import |

### 2. Graph Builder (`backend/app/services/graph_builder.py`)

| Test | Command/Check | Expected |
|------|---------------|----------|
| Resolve relative imports | `./utils` from `src/index.ts` | Resolves to `src/utils.ts` |
| Resolve alias imports | `@/components/Button` | Resolves to `src/components/Button` |
| Handle missing files | Import to non-existent file | No edge created, no error |
| Skip node_modules | `import lodash` | No edge to external package |
| Circular dependencies | A imports B, B imports A | Both edges created |
| Index file resolution | `./components` | Tries `/index.ts`, `/index.js` |

### 3. LLM Analyzer (`backend/app/services/llm_analyzer.py`)

| Test | Command/Check | Expected |
|------|---------------|----------|
| Batch splitting | 50 files | Split into 3 batches (20, 20, 10) |
| Role classification | React component file | Returns `react_component` |
| Category classification | API service file | Returns `backend` |
| Malformed response | LLM returns invalid JSON | Falls back to `unknown` |
| Empty batch | No files to analyze | Returns empty list |

### 4. Analysis Service (`backend/app/services/analysis.py`)

| Test | Command/Check | Expected |
|------|---------------|----------|
| Job creation | `create_job()` | Returns unique UUID |
| Status progression | Run full analysis | pending → parsing → analyzing → building_graph → completed |
| Error handling | Invalid directory | Status = failed, error message set |
| Progress updates | During analysis | Progress 0-100 updates |

### 5. GitHub Service (`backend/app/services/github.py`)

| Test | Command/Check | Expected |
|------|---------------|----------|
| Clone public repo | Small public repo | Cloned to temp directory |
| Clone with branch | Specify non-default branch | Correct branch cloned |
| Clone private repo | With valid token | Successfully clones |
| Invalid repo URL | Non-existent repo | Clean error message |
| Token sanitization | Error with token in URL | Token removed from error |
| Cleanup on failure | Clone fails | Temp directory deleted |

### 6. Database Service (`backend/app/services/database.py`)

| Test | Command/Check | Expected |
|------|---------------|----------|
| Create analysis | `create_analysis()` | Record in `analyses` table |
| Save nodes/edges | `complete_analysis()` | Data in `analysis_nodes`, `analysis_edges` |
| Get user analyses | `get_user_analyses()` | Only returns user's records |
| Delete cascade | `delete_analysis()` | Removes analysis + nodes + edges |
| Update title | `update_analysis_title()` | Title updated |

---

## API Endpoint Tests

### Analysis Endpoints

| Endpoint | Test | Expected |
|----------|------|----------|
| `POST /api/analyze` | Valid local path | Returns `analysis_id` |
| `POST /api/analyze` | Valid GitHub URL | Returns `analysis_id` |
| `POST /api/analyze` | Invalid path | 400 error |
| `GET /api/analysis/{id}/status` | Valid ID | Returns status object |
| `GET /api/analysis/{id}/status` | Invalid ID | 404 error |
| `GET /api/analysis/{id}` | Completed analysis | Returns full graph |
| `GET /api/analysis/{id}` | Incomplete analysis | 400 error |
| `DELETE /api/analysis/{id}` | With auth | Deletes analysis |
| `DELETE /api/analysis/{id}` | Without auth | 401 error |
| `DELETE /api/analysis/{id}` | Other user's analysis | 403/404 error |

### GitHub Endpoints

| Endpoint | Test | Expected |
|----------|------|----------|
| `GET /api/github/repos` | With GitHub token | Returns repo list |
| `GET /api/github/repos` | Without token | 401 error |
| `GET /api/github/users/{owner}/repos` | Valid username | Returns public repos |
| `GET /api/github/users/{owner}/repos` | Invalid username format | 400 error |

### Function Tier Endpoints

| Endpoint | Test | Expected |
|----------|------|----------|
| `GET /api/analysis/{id}/functions/tier-list` | Valid analysis | Paginated tier list |
| `GET /api/analysis/{id}/functions/tier-list?tier=S` | Filter by tier | Only S-tier functions |
| `GET /api/analysis/{id}/functions/stats` | Valid analysis | Aggregate stats |
| `GET /api/analysis/{id}/functions/{func_id}` | Valid function | Function detail + callers/callees |

---

## Frontend Tests

### Component Rendering

| Component | Test | Expected |
|-----------|------|----------|
| UploadPage | Renders | Form visible |
| UploadPage | Switch modes | Local/GitHub tabs work |
| VisualizationPage | With data | Graph renders |
| VisualizationPage | Empty state | Appropriate message |
| CustomNode | Renders | File info displayed |
| NodeDetailPanel | Selected node | Panel shows details |
| GitHubRepoSelector | With repos | Repo list displayed |

### Hook Tests

| Hook | Test | Expected |
|------|------|----------|
| useAnalysis | Start analysis | Loading state true |
| useAnalysis | Polling | Status updates received |
| useAnalysis | Completion | Result populated |
| useAnalysis | Error | Error state set |
| useAuth | Sign in | User/session populated |
| useAuth | Sign out | User/session cleared |
| useAuth | GitHub OAuth | GitHub token stored |
| useGitHubRepos | Fetch | Returns repo list |
| useGitHubRepos | No token | Query disabled |

### User Flows

| Flow | Steps | Expected |
|------|-------|----------|
| Local analysis | Enter path → Submit → Wait → View | Graph displayed |
| GitHub analysis | Enter URL → Submit → Wait → View | Graph displayed |
| Auth flow | Click login → Enter credentials → Submit | Authenticated |
| GitHub OAuth | Click GitHub → Authorize → Callback | Authenticated with token |
| Delete analysis | Dashboard → Delete → Confirm | Analysis removed |

---

## Integration Tests

### End-to-End Analysis

```bash
# 1. Start backend
cd backend && uvicorn app.main:app --port 8000

# 2. Start frontend
cd frontend && npm run dev

# 3. Test local analysis
# - Navigate to http://localhost:5173
# - Enter a local directory path
# - Click Analyze
# - Wait for completion
# - Verify graph renders

# 4. Test GitHub analysis (if authenticated)
# - Enter GitHub repo URL
# - Click Analyze
# - Wait for completion
# - Verify graph renders
```

### Database Integration

```bash
# Requires Supabase local or connection to test database
# Run after analysis completes

# Check analysis record exists
SELECT * FROM analyses WHERE id = '<analysis_id>';

# Check nodes created
SELECT COUNT(*) FROM analysis_nodes WHERE analysis_id = '<analysis_id>';

# Check edges created
SELECT COUNT(*) FROM analysis_edges WHERE analysis_id = '<analysis_id>';
```

---

## Security Tests

| Test | Check | Expected |
|------|-------|----------|
| Path traversal | `../../../etc/passwd` in path | Rejected with error |
| SQL injection | Special chars in analysis ID | No injection possible |
| XSS | Script tags in file names | Escaped in output |
| Token exposure | Check error messages | No tokens in logs/errors |
| CORS | Request from unauthorized origin | Blocked |
| Auth bypass | Access protected route without token | 401 error |
| Rate limiting | Many rapid requests | Throttled appropriately |

---

## Performance Benchmarks

| Test | Metric | Target |
|------|--------|--------|
| Parse 100 files | Time | < 5 seconds |
| LLM analysis 100 files | Time | < 30 seconds |
| Build graph 500 nodes | Time | < 2 seconds |
| Clone small repo (< 10MB) | Time | < 10 seconds |
| Clone medium repo (10-50MB) | Time | < 30 seconds |
| API response (status) | Time | < 100ms |
| Frontend initial load | Time | < 3 seconds |
| Graph render 500 nodes | Time | < 1 second |

---

## Regression Test Commands

```bash
# Backend tests (when implemented)
cd backend
pytest tests/ -v

# Backend tests with coverage
pytest tests/ --cov=app --cov-report=html

# Frontend tests (when implemented)
cd frontend
npm test

# Type checking
cd frontend && npm run lint
cd backend && mypy app/

# Build verification
cd frontend && npm run build
```

---

## Pre-Release Checklist

- [ ] All smoke tests pass
- [ ] Backend starts without errors
- [ ] Frontend builds without errors
- [ ] Local analysis completes successfully
- [ ] GitHub analysis completes successfully (if applicable)
- [ ] Authentication flow works
- [ ] Dashboard loads user's analyses
- [ ] Delete analysis works
- [ ] No console errors in browser
- [ ] No unhandled exceptions in backend logs
- [ ] Memory usage stable during analysis
- [ ] API responses are reasonable size

---

## Adding New Features Checklist

When adding a new feature:

1. **Before coding:**
   - [ ] Run existing smoke tests
   - [ ] Note current behavior

2. **During development:**
   - [ ] Add unit tests for new functions
   - [ ] Add API tests for new endpoints
   - [ ] Add UI tests for new components

3. **Before merging:**
   - [ ] Run full test suite
   - [ ] Run smoke tests
   - [ ] Test manually in browser
   - [ ] Check for console errors
   - [ ] Check for TypeScript errors
   - [ ] Review security implications

4. **After merging:**
   - [ ] Verify deployment successful
   - [ ] Run smoke tests on deployed version
