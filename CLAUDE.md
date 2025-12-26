# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Visual Codebase is an AI-powered codebase visualization tool that analyzes repositories and generates interactive dependency graphs. It uses AST parsing (Tree-sitter) and Claude AI to understand code structure and architectural roles, then visualizes file-level dependencies using React Flow.

**Stack**: FastAPI (Python) backend + React (TypeScript) frontend + Supabase (PostgreSQL + Auth)

## Development Commands

### Backend

```bash
# Setup (first time)
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # Add ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_KEY

# Run development server
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --port 8000

# Run tests (if available)
pytest
```

### Frontend

```bash
# Setup (first time)
cd frontend
npm install

# Run development server
npm run dev  # Runs on http://localhost:5173

# Build for production
npm run build

# Lint
npm run lint
```

### Database

Supabase migrations are in `supabase/migrations/`. Apply them through the Supabase dashboard or CLI.

## Architecture Overview

### Analysis Pipeline

The core analysis flow is orchestrated by `AnalysisService` (backend/app/services/analysis.py):

1. **Parsing** (`FileParser` in parser.py): Uses Tree-sitter to extract imports/exports from JS/TS/Python files
2. **LLM Analysis** (`LLMAnalyzer` in llm_analyzer.py): Claude Sonnet 4.5 categorizes files by architectural role (react_component, utility, api_service, etc.)
3. **Graph Building** (`GraphBuilder` in graph_builder.py): Resolves dependencies and creates React Flow graph structure
4. **Persistence** (`DatabaseService` in database.py): Stores results in Supabase (if authenticated)

### Key Services

- **backend/app/services/analysis.py**: Orchestrates the analysis pipeline with background tasks and progress tracking via `AnalysisJob` state objects
- **backend/app/services/parser.py**: AST parsing using Tree-sitter for import extraction
- **backend/app/services/llm_analyzer.py**: Batches files (max 20) and sends to Claude for semantic analysis
- **backend/app/services/graph_builder.py**: Resolves import paths (handles @/ and ~/ aliases) and builds dependency graph
- **backend/app/services/github.py**: Clones GitHub repos (shallow clones with --depth 1) to temp directories
- **backend/app/services/database.py**: Supabase integration for storing analyses, nodes, and edges

### Frontend Architecture

- **Pages** (frontend/src/pages/):
  - `UploadPage.tsx`: Entry point with local/GitHub input modes
  - `VisualizationPage.tsx`: Interactive React Flow graph with search/filter
  - `UserDashboard.tsx`: User's analysis history (requires auth)
  - `AuthCallback.tsx`: GitHub OAuth callback handler

- **Hooks** (frontend/src/hooks/):
  - `useAnalysis.ts`: Analysis orchestration with polling (checks status every 1 second)
  - `useAuth.ts`: Supabase authentication with GitHub OAuth support
  - `useGitHubRepos.ts`: React Query integration for fetching user's GitHub repos

- **Components** (frontend/src/components/):
  - `GitHubRepoSelector.tsx`: Browse and search repositories with pagination
  - `CustomNode.tsx`: React Flow node component with file metadata
  - `NodeDetailPanel.tsx`: Side panel showing detailed file information

### Data Flow

**Local/GitHub Analysis**:
1. User submits path/GitHub URL via `UploadPage`
2. Frontend calls POST `/api/analyze` with `AnalyzeRequest`
3. Backend creates background task, returns `analysis_id`
4. Frontend polls GET `/api/analysis/{id}/status` every 1 second via `useAnalysis` hook
5. Backend runs pipeline: parse → LLM analyze → build graph → save to DB (if authenticated)
6. When complete, frontend fetches GET `/api/analysis/{id}` and navigates to visualization

**Authentication**:
- Supabase handles auth (email/password + GitHub OAuth)
- GitHub OAuth token stored in `provider_token`, sent to backend via `X-GitHub-Token` header
- Row-Level Security (RLS) policies enforce user-based access to analyses

### Database Schema

**Supabase tables** (see supabase/migrations/001_initial_schema.sql):
- `profiles`: User data linked to auth.users
- `analyses`: Analysis metadata (status, progress, file_count, etc.)
- `analysis_nodes`: Graph nodes with file details (path, role, imports, line_count)
- `analysis_edges`: Dependencies between nodes

Cascading deletes: analyses → nodes/edges when analysis is deleted.

## Important Patterns

### Import Resolution
- The graph builder resolves imports using a `resolve_import_path()` function that handles:
  - Relative imports (./file, ../file)
  - Absolute imports (@/components, ~/utils)
  - Node module imports (excluded from graph)
- Common path aliases: `@/` maps to `src/`, `~/` maps to project root

### Error Handling
- Analysis errors are captured in `AnalysisJob.error` and stored in DB
- Frontend displays errors from `AnalysisStatusResponse.error`
- File size limit: 100KB per file (larger files skipped)
- LLM batch size: 20 files per request

### Progress Tracking
- `AnalysisJob` tracks status: pending → parsing → analyzing → building_graph → completed/failed
- Progress percentage (0-100) updated at each stage
- `current_step` field shows human-readable status

### Authentication Flow
- Frontend uses Supabase client for auth (`frontend/src/config/supabase.ts`)
- Backend verifies JWT tokens via `get_current_user()` dependency (backend/app/auth.py)
- GitHub token passed via `X-GitHub-Token` header for private repo access

## API Endpoints

- POST `/api/analyze` - Start analysis (local directory or GitHub repo)
- GET `/api/analysis/{id}/status` - Check progress
- GET `/api/analysis/{id}` - Get results (React Flow graph)
- GET `/api/user/analyses` - Get user's past analyses (auth required)
- DELETE `/api/analysis/{id}` - Delete analysis (auth required)
- GET `/api/github/repos` - List user's GitHub repos (auth required)
- GET `/api/health` - Health check

## File Categorization Roles

LLM categorizes files into these architectural roles:
- `react_component` - React/UI components
- `utility` - Helper/utility functions
- `api_service` - API clients and services
- `model` - Data models and types
- `config` - Configuration files
- `test` - Test files
- `hook` - React hooks
- `context` - React context providers
- `store` - State management
- `middleware` - Middleware functions
- `controller` - Controllers
- `router` - Routing definitions
- `schema` - Schema definitions

## Environment Variables

### Backend (.env)
```
ANTHROPIC_API_KEY=sk-...
SUPABASE_URL=https://...supabase.co
SUPABASE_KEY=eyJ...
GITHUB_TOKEN=ghp_... (optional, for GitHub API rate limits)
```

### Frontend
Vite env vars are in .env.local (if needed), but Supabase config is hardcoded in frontend/src/config/supabase.ts

## Common Tasks

### Adding Support for a New Language
1. Add Tree-sitter parser in backend/requirements.txt
2. Update `FileParser` in parser.py to handle new file extensions
3. Add language-specific import extraction logic
4. Test with sample files

### Modifying Graph Layout
- Layout algorithm is in `GraphBuilder.build_graph()` using dagre
- Node positioning: `dagre.layout()` computes coordinates
- Customize spacing by adjusting dagre graph config (rankdir, nodesep, ranksep)

### Changing LLM Analysis Prompt
- Prompt is in `LLMAnalyzer.analyze_files()` method
- Modify the system prompt to change categorization behavior
- Adjust max batch size if hitting token limits

### Adding New Architectural Roles
1. Update role enum in backend/app/models/schemas.py
2. Update LLM prompt in llm_analyzer.py to recognize new role
3. Update frontend filtering in VisualizationPage.tsx
4. Update database schema if storing role metadata differently
