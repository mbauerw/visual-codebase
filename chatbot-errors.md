Question 3:

AI Assistant
Codebase Analysis



You
What is the overall architecture of this codebase?

Assistant
get_codebase_summary
Completed
1ms
## Overall Architecture

This## Overall Architecture

This is is a **complex full-stack web application** designed as a **codebase visualization tool** with a **complex full-stack web application** designed as a **codebase visualization tool** with the following architecture:

### **Core Purpose the following architecture:

### **Core Purpose****
Analyzes code repositories and generates interactive dependency graphs for JavaScript/TypeScript and Python projects,
Analyzes code repositories and generates interactive dependency graphs for JavaScript/TypeScript and Python projects, using AI-powered analysis to categorize files by their using AI-powered analysis to categorize files by their architectural roles.

### **Architecture Pattern architectural roles.

### **Architecture Pattern**
****
**Full-stack separationFull-stack separation** with clear** with clear backen backend/d/frontend boundariesfrontend boundaries:

**:

**Backend (FastAPI +Backend (FastAPI + Python Python)**)**
- Performs
- Performs AST-based code analysis using Tree-sitter
- Integrates with Claude AI for intelligent AST-based code analysis using Tree-sitter
- Integrates with Claude AI for intelligent architectural role classification
- Handles file architectural role classification
- Handles file parsing and dependency extraction
- Provides REST API endpoints parsing and dependency extraction
- Provides REST API endpoints

**Frontend (React + TypeScript)**

**Frontend (React + TypeScript)**
- Renders interactive dependency graphs using
- Renders interactive dependency graphs using React Flow
- Provides visualization controls, filtering React Flow
- Provides visualization controls, filtering, and user interactions, and user interactions
- Progressive
- Progressive Web App capabilities Web App capabilities
- Comprehensive
- Comprehensive testing infrastructure

### **Key Technologies testing infrastructure

### **Key Technologies**
- **Languages**
- **Languages:** TypeScript (:** TypeScript (67 files), Python (40 67 files), Python (40 files), JavaScript (2 files)files), JavaScript (2 files)
- **Frameworks:** React,
- **Frameworks:** React, FastAPI, React Flow, V FastAPI, React Flow, Vite
- **Keyite
- **Key Patterns:** AST parsing, Tree Patterns:** AST parsing, Tree-sitter, AI integration (Claude), REST API-sitter, AI integration (Claude), REST API

### **Critical

### **Critical Modules** Modules**

1

1. **`. **`backend/app/services`** -backend/app/services`** - Core business logic for parsing, AI analysis Core business logic for parsing, AI analysis, and graph construction
2. **, and graph construction
2. **`frontend/src/pages/`frontend/src/pages/VisualizationPage.tsx`VisualizationPage.tsx`** - Main visualization interface using React Flow** - Main visualization interface using React Flow
3. **`frontend/src
3. **`frontend/src/hooks`** - Custom React hooks/hooks`** - Custom React hooks for authentication and tier management for authentication and tier management
4. **`frontend/src
4. **`frontend/src/api/client.ts`**/api/client.ts`** - API client with - API client with Supabase integration
5. Supabase integration
5. **`frontend/src/test` **`frontend/src/test`** - Comprehensive testing with** - Comprehensive testing with MSW mocking

### **Data MSW mocking

### **Data Flow**
1. Backend analy Flow**
1. Backend analyzes cozes codebases using Tree-sitter ASdebases using Tree-sitter AST parsingT parsing
2. Claude
2. Claude AI class AI classifies filesifies files by by architectural role
3. Dependency architectural role
3. Dependency