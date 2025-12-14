# Visual Codebase

A codebase visualization tool that analyzes code repositories and generates interactive dependency graphs. This MVP focuses on file-level dependencies for JavaScript/TypeScript and Python projects.

## Features

- **Multi-language support**: Analyzes JavaScript (.js, .jsx), TypeScript (.ts, .tsx), and Python (.py) files
- **AST-based parsing**: Uses Tree-sitter for accurate import/dependency extraction
- **AI-powered analysis**: Leverages Claude (Sonnet 4.5) to understand and categorize files by architectural role
- **Interactive visualization**: React Flow-based graph with zoom, pan, and node selection
- **Smart filtering**: Filter by language, role, or search for specific files
- **Automatic layout**: Uses Dagre for hierarchical graph layout

## Project Structure

```
visual-codebase/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── models/         # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   │   ├── parser.py       # Tree-sitter file parser
│   │   │   ├── llm_analyzer.py # Claude integration
│   │   │   ├── graph_builder.py # Graph construction
│   │   │   └── analysis.py     # Analysis orchestration
│   │   ├── config.py       # Configuration
│   │   └── main.py         # FastAPI app
│   ├── requirements.txt
│   └── .env.example
├── frontend/               # React application
│   ├── src/
│   │   ├── api/           # API client
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── pages/         # Page components
│   │   ├── types/         # TypeScript types
│   │   └── App.tsx        # Main app
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- Anthropic API key (for Claude)

## Setup

### 1. Clone and set up the backend

```bash
# Navigate to the backend directory
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy the environment example and add your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

### 2. Set up the frontend

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install
```

### 3. Configure environment

Edit `backend/.env` and add your Anthropic API key:

```env
ANTHROPIC_API_KEY=your_api_key_here
```

## Running the Application

### Start the backend

```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

The API will be available at http://localhost:8000

### Start the frontend

```bash
cd frontend
npm run dev
```

The frontend will be available at http://localhost:5173

## Usage

1. Open http://localhost:5173 in your browser
2. Enter the absolute path to a directory you want to analyze (e.g., `/home/user/my-project`)
3. Click "Analyze Codebase"
4. Wait for the analysis to complete (progress is shown)
5. Explore the interactive dependency graph:
   - Click on nodes to see file details
   - Use the search box to find specific files
   - Filter by language or architectural role
   - Zoom, pan, and drag nodes as needed

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Start a codebase analysis |
| `/api/analysis/{id}/status` | GET | Check analysis progress |
| `/api/analysis/{id}` | GET | Get analysis results |
| `/api/health` | GET | Health check |

### Example API Usage

```bash
# Start an analysis
curl -X POST http://localhost:8000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"directory_path": "/path/to/project"}'

# Check status
curl http://localhost:8000/api/analysis/{analysis_id}/status

# Get results
curl http://localhost:8000/api/analysis/{analysis_id}
```

## Architecture

### Backend Services

1. **FileParser**: Uses Tree-sitter to parse source files and extract import statements
2. **LLMAnalyzer**: Sends file information to Claude for semantic analysis (role, description, category)
3. **GraphBuilder**: Constructs the dependency graph from parsed files and LLM analysis
4. **AnalysisService**: Orchestrates the analysis pipeline with progress tracking

### Frontend Components

1. **UploadPage**: Input form for directory path and analysis options
2. **VisualizationPage**: Interactive graph visualization with React Flow
3. **CustomNode**: Custom node component showing file info
4. **NodeDetailPanel**: Side panel with detailed file information

## File Categorization

The LLM categorizes files into these architectural roles:
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

## Limitations (MVP)

- File-level dependencies only (no function-level analysis)
- In-memory storage (no database persistence)
- No user authentication
- No GitHub integration
- No real-time collaboration
- No export functionality
- Maximum file size: 100KB per file
- Processes up to 20 files per LLM batch

## Development

### Backend

```bash
cd backend
pip install pytest pytest-asyncio httpx
pytest
```

### Frontend

```bash
cd frontend
npm run lint
npm run build
```

## License

MIT
