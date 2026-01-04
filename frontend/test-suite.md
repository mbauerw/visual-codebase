Please help me build a comprehensive test suite for my Visual Codebase application. Here's what I need:

## Backend Tests (Python/FastAPI)

1. **API Endpoint Tests** (`backend/tests/test_api_routes.py`):
   - Test all routes in `backend/app/api/routes.py`
   - Test authentication with valid/invalid tokens
   - Test GitHub OAuth flow
   - Test analysis creation, status polling, and result retrieval
   - Test tier list endpoints with various filters
   - Test error handling (404s, 401s, validation errors)
   - Test rate limiting behavior

2. **Service Layer Tests**:
   - `test_analysis_service.py`: Test the analysis orchestration pipeline
   - `test_parser.py`: Test file parsing for JS/TS/Python files
   - `test_function_analyzer.py`: Test function extraction and call resolution
   - `test_llm_analyzer.py`: Mock Anthropic API calls, test batch processing
   - `test_github_service.py`: Test repo cloning, credential handling, cleanup
   - `test_tier_calculator.py`: Test tier classification logic

3. **Database Tests** (`test_database_service.py`):
   - Test CRUD operations for analyses, nodes, edges
   - Test RLS policies (ensure users can only access their own data)
   - Test file content storage for GitHub repos
   - Test function tier list queries with pagination

4. **Security Tests** (`test_security.py`):
   - Test path traversal prevention in `validate_path_within_base()`
   - Test GitHub username/repo validation
   - Test SQL injection prevention
   - Test token sanitization in error messages

## Frontend Tests (React/TypeScript)

5. **Component Tests** (using React Testing Library):
   - Test `UploadPage` form submission
   - Test `GitHubRepoForm` with various input states
   - Test `AnalysisProgressBar` animation
   - Test `AuthModal` login/signup flows
   - Test `UserDashboard` analysis list and deletion

6. **Hook Tests**:
   - `useAnalysis.test.ts`: Test polling, error handling, state management
   - `useAuth.test.ts`: Test auth state, sign in/out, GitHub OAuth
   - `useGitHubRepos.test.ts`: Test repo fetching with React Query
   - `useTierList.test.ts`: Test filtering, pagination, sorting

7. **API Client Tests** (`test_client.ts`):
   - Mock axios responses
   - Test authentication header injection
   - Test error handling and retries

## Integration Tests

8. **End-to-End Flow Tests**:
   - Test complete analysis flow: upload → parse → analyze → visualize
   - Test GitHub repo analysis flow
   - Test user registration → login → analysis → view results
   - Test tier list generation and filtering

## Test Data & Fixtures

9. Create realistic test fixtures:
   - Sample codebases (small JS/TS/Python projects)
   - Mock parsed file data
   - Mock GitHub API responses
   - Sample function definitions and call graphs

## Requirements

- Use pytest for backend tests
- Use Jest + React Testing Library for frontend
- Aim for >80% code coverage on critical paths
- Include both unit and integration tests
- Mock external dependencies (Anthropic API, GitHub API, Supabase)
- Test edge cases and error conditions
- Include performance tests for large codebases (>1000 files)

Please prioritize tests for:
1. Authentication and authorization
2. GitHub integration security
3. Analysis pipeline correctness
4. Function tier list accuracy
5. RLS policy enforcement

Start with the most critical backend API tests and security tests first.