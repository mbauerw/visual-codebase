Response:
       Excellent. I now have a complete picture of the codebase architecture. Let me provide a comprehensive integration strategy.

       ---
       Source Code Viewer Integration Strategy

       Executive Summary

       Based on my analysis of the existing codebase, I recommend implementing source code viewing as a new collapsible panel below the React Flow 
       visualization, with the code viewer triggered by node selection and integrated through a dedicated hook for fetching and caching source code
       content.

       ---
       1. Current Architecture Analysis

       1.1 VisualizationPage Structure

       The page (/Users/maxbauer/Documents/visual-codebase/frontend/src/pages/VisualizationPage.tsx) uses a two-column grid layout:

       +----------------------------------------------------------+
       |                      Header (h-14, fixed)                |
       +----------------------------------------------------------+
       |                                        |                 |
       |    Main Content (scrollable)           |  Right Panel    |
       |    - Overview Section                  |  (NodeDetail    |
       |    - React Flow Container              |   Panel or      |
       |    - GithubEmbed (already exists)      |   Category      |
       |                                        |   Panel)        |
       |                                        |                 |
       +----------------------------------------------------------+

       Key observations:
       - Lines 1299-1302: Grid layout with responsive columns (xl:grid-cols-[5fr_minmax(400px,1fr)])
       - Lines 1539-1550: Right panel conditionally renders NodeDetailPanel or CategoryRolePanel
       - Lines 1529-1535: There is already a GithubEmbed component rendered below the React Flow container (though it appears hardcoded to
       "facebook/react")

       1.2 Node Selection Flow

       Current flow (lines 1119-1138 in VisualizationPage.tsx):

       1. User clicks a node in React Flow
       2. onNodeClick handler fires
       3. For custom nodes (file nodes): sets selectedNode state with ReactFlowNodeData
       4. For category nodes: sets selectedCategory state
       5. NodeDetailPanel receives the selectedNode data and renders file details

       State variables involved:
       - selectedNode: ReactFlowNodeData | null (line 876)
       - selectedNodeId: string | null (line 877)
       - selectedCategory: CategoryRoleData | null (line 878)

       1.3 NodeDetailPanel Architecture

       The panel (/Users/maxbauer/Documents/visual-codebase/frontend/src/components/NodeDetailPanel.tsx):
       - Receives data: ReactFlowNodeData | null (includes path, label, language, etc.)
       - Has expand/collapse functionality via expanded prop and setExpand callback
       - Uses a clean section-based layout with badges, path display, stats, and imports list
       - Does NOT currently display source code content

       1.4 Existing Source Code Fetching

       The app already has infrastructure for fetching GitHub content:
       - Backend endpoint: GET /api/github/repo-content/{owner}/{repo}/{path:path} (main.py, lines 57-73)
       - GithubEmbed component already uses this to fetch directory listings
       - No existing endpoint for fetching file content with syntax highlighting

       ---
       2. Integration Approach Recommendation

       2.1 Panel Location Decision

       Recommended: New panel BELOW the React Flow visualization (within Main Content area)

       Rationale:
       1. The right panel (NodeDetailPanel) is designed for metadata/overview - adding full source code would make it unwieldy
       2. Source code needs horizontal space for readability - the right panel is constrained to minmax(400px, 1fr)
       3. The pattern already exists: GithubEmbed is rendered below React Flow in the main content area
       4. Allows independent scrolling of code vs. graph
       5. Maintains separation of concerns: metadata on right, source content below

       Alternative considered but rejected:
       - Tabs in NodeDetailPanel: Would require horizontal scrolling for code, poor UX
       - Modal/overlay: Breaks the flow of exploration, hides context
       - Replace GithubEmbed: That component serves a different purpose (directory navigation)

       2.2 Recommended Layout Architecture

       +----------------------------------------------------------+
       |                        Header                             |
       +----------------------------------------------------------+
       |                                          |               |
       |   Main Content Area (scrollable)         | NodeDetail    |
       |   +----------------------------------+   | Panel         |
       |   |  Overview Section                |   | (metadata)    |
       |   +----------------------------------+   |               |
       |   |  React Flow Container (900px h)  |   |               |
       |   +----------------------------------+   |               |
       |   |  Source Code Panel (collapsible) | <-- NEW          |
       |   |  - Header with file name/close   |   |               |
       |   |  - Syntax-highlighted code       |   |               |
       |   |  - Resizable height              |   |               |
       |   +----------------------------------+   |               |
       |   |  GithubEmbed (optional, lower)   |   |               |
       |   +----------------------------------+   |               |
       +----------------------------------------------------------+

       ---
       3. Component Architecture Design

       3.1 New Components

       SourceCodePanel

       Location: /frontend/src/components/SourceCodePanel.tsx

       Responsibilities:
       - Display syntax-highlighted source code
       - Show loading/error states
       - Provide close/minimize controls
       - Handle scroll position preservation

       Props Interface:
       interface SourceCodePanelProps {
         filePath: string | null;       // Path of file to display
         analysisId: string;            // For constructing fetch URL
         language: Language;            // For syntax highlighting
         onClose: () => void;           // Close handler
         isOpen: boolean;               // Visibility control
         metadata?: {                   // Optional file info
           label: string;
           lineCount: number;
           sizeBytes: number;
         };
       }

       Internal State:
       - sourceCode: string | null
       - isLoading: boolean
       - error: string | null
       - panelHeight: number (for resizable behavior)

       3.2 New Custom Hook

       useSourceCode

       Location: /frontend/src/hooks/useSourceCode.ts

       Responsibilities:
       - Fetch source code from backend
       - Cache fetched content (by file path + analysis ID)
       - Handle loading and error states
       - Support abort for stale requests

       Interface:
       interface UseSourceCodeOptions {
         analysisId: string;
         filePath: string | null;
         enabled?: boolean;
       }

       interface UseSourceCodeReturn {
         sourceCode: string | null;
         isLoading: boolean;
         error: string | null;
         refetch: () => Promise<void>;
       }

       Caching Strategy:
       - Use React Query (already installed: @tanstack/react-query) for automatic caching
       - Cache key: ['sourceCode', analysisId, filePath]
       - Stale time: 5 minutes (source code rarely changes during a session)

       3.3 State Management Approach

       Lift state to VisualizationPage:

       Add to existing state in VisualizationPage:
       const [sourceCodeFile, setSourceCodeFile] = useState<{
         path: string;
         language: Language;
         label: string;
       } | null>(null);
       const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(false);

       Trigger mechanism:
       - When selectedNode changes and is not null, automatically set sourceCodeFile
       - The panel visibility (isSourcePanelOpen) can be controlled independently

       ---
       4. Data Flow Design

       4.1 Source Code Fetching Flow

       User clicks node
             |
             v
       onNodeClick handler
             |
             +---> setSelectedNode(nodeData)      ---> NodeDetailPanel updates
             |
             +---> setSourceCodeFile({            ---> SourceCodePanel receives
                     path: nodeData.path,               new file info
                     language: nodeData.language,
                     label: nodeData.label
                   })
             |
             +---> setIsSourcePanelOpen(true)     ---> Panel becomes visible
             |
             v
       useSourceCode hook (in SourceCodePanel)
             |
             v
       React Query fetches: GET /api/analysis/{id}/file-content?path={path}
             |
             v
       Backend reads file from stored analysis data or original source
             |
             v
       Returns raw text content
             |
             v
       SourceCodePanel renders with syntax highlighting

       4.2 Backend Endpoint Design

       New endpoint needed:
       GET /api/analysis/{analysis_id}/file-content
       Query params:
         - path: string (relative file path)
       Response:
         - content: string (raw source code)
         - language: string
         - line_count: number
         - error?: string

       Implementation considerations:
       1. For local analyses: Read directly from filesystem (if still available) or return error
       2. For GitHub analyses: The temp directory is cleaned up after analysis, so you need to either:
         - Option A: Store file contents in database during analysis (increases storage)
         - Option B: Re-fetch from GitHub API on demand (simpler, may have rate limits)
         - Recommendation: Option B with caching - use GitHub's raw content API

       GitHub raw content approach:
       # For GitHub repos, construct raw URL:
       # https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}

       ---
       5. UX Design Considerations

       5.1 Panel Behavior

       Auto-open behavior:
       - Panel SHOULD auto-open when a node is clicked (reduces friction)
       - First click on any node: panel slides open with animation
       - Subsequent clicks: panel updates content, stays open

       Close/minimize options:
       1. Close button (X) in panel header - closes completely
       2. Minimize button - collapses to a thin bar showing "Source: filename.ts"
       3. Escape key - closes the panel
       4. Clicking on pane (background) - should NOT close source panel (different from node selection)

       5.2 Responsive Considerations

       Desktop (>1024px):
       - Full panel below React Flow
       - Resizable height (drag handle at top)
       - Default height: 400px, min: 200px, max: 600px

       Tablet/Mobile (<1024px):
       - Consider a bottom sheet pattern that slides up
       - Touch-friendly close gesture (swipe down)
       - Limit default height to 50% of viewport

       5.3 Loading States

       States to handle:
       1. No file selected      -> Show placeholder: "Select a file to view source"
       2. Loading               -> Skeleton loader with animated lines
       3. Loaded successfully   -> Display code with syntax highlighting
       4. Error (file too large)-> "File too large to display (>100KB)"
       5. Error (not available) -> "Source code not available for this analysis"
       6. Error (network)       -> "Failed to load source code. Retry?"

       5.4 Keyboard Navigation

       | Key          | Action                              |
       |--------------|-------------------------------------|
       | Escape       | Close source panel (if open)        |
       | Ctrl/Cmd + / | Toggle source panel visibility      |
       | Up/Down      | Navigate lines (when panel focused) |
       | Ctrl/Cmd + G | Go to line dialog                   |

       ---
       6. Syntax Highlighting Strategy

       6.1 Library Recommendation

       Primary recommendation: Prism.js with prism-react-renderer

       Rationale:
       - Lightweight (~5KB gzipped)
       - React-specific integration available
       - Good language support for JS/TS/Python
       - Customizable themes that can match existing dark slate design

       Alternative considered: Monaco Editor
       - Overkill for read-only viewing
       - Heavy bundle size (~2MB)
       - Better suited if editing is needed in future

       6.2 Theme Alignment

       The existing app uses a dark slate theme. Create a custom Prism theme that matches:
       --bg: #1e293b        /* slate-800 */
       --text: #e2e8f0      /* slate-200 */
       --comment: #64748b   /* slate-500 */
       --keyword: #38bdf8   /* sky-400 */
       --string: #4ade80    /* green-400 */
       --function: #a78bfa  /* violet-400 */

       ---
       7. Implementation Phases

       Phase 1: Backend Infrastructure

       1. Add new endpoint GET /api/analysis/{id}/file-content
       2. Implement GitHub raw content fetching with caching
       3. Handle local file reading for development

       Phase 2: Core Component

       1. Create useSourceCode hook with React Query integration
       2. Build SourceCodePanel component with loading/error states
       3. Add Prism.js dependency and configure syntax highlighting

       Phase 3: Integration

       1. Add state management to VisualizationPage
       2. Wire up node click to trigger source panel
       3. Implement auto-open behavior

       Phase 4: Polish

       1. Add keyboard shortcuts
       2. Implement resizable panel height
       3. Add line number clicking/highlighting
       4. Mobile responsive adjustments

       ---
       8. Technical Risks and Mitigations

       | Risk                                      | Mitigation                                                                |
       |-------------------------------------------|---------------------------------------------------------------------------|
       | Large files cause performance issues      | Implement virtualized scrolling (react-window) for files >1000 lines      |
       | GitHub rate limits                        | Cache aggressively, use authenticated requests, show graceful degradation |
       | Local files may not exist                 | Check file existence, show clear error message with explanation           |
       | Memory usage with many files open         | Only keep one file in memory, clear on deselection                        |
       | Syntax highlighting for unknown languages | Fall back to plain text with line numbers                                 |

       ---
       9. File Structure

       frontend/src/
         components/
           SourceCodePanel.tsx       # NEW - Main source viewer component
           SourceCodeSkeleton.tsx    # NEW - Loading state skeleton
         hooks/
           useSourceCode.ts          # NEW - Source fetching hook
         config/
           prismTheme.ts            # NEW - Custom Prism theme

       backend/app/
         api/
           routes.py                 # ADD - /file-content endpoint
         services/
           source_reader.py          # NEW - File content reading service

       ---
       10. Success Metrics

       1. Performance: Source code loads within 500ms for files under 50KB
       2. Usability: 90% of users can view source within 2 clicks of seeing the graph
       3. Reliability: Error states are shown within 3 seconds of failure
       4. Accessibility: Panel is fully keyboard navigable

       ---
       Summary of Key Decisions

       1. Location: New panel below React Flow (not in NodeDetailPanel)
       2. Trigger: Auto-opens on node click
       3. Data fetching: React Query hook with caching
       4. Backend: New endpoint fetching from GitHub raw content API
       5. Syntax highlighting: Prism.js with custom dark theme
       6. Responsiveness: Collapsible panel with resizable height

       This architecture maintains separation of concerns, leverages existing patterns in the codebase (React Query, the GithubEmbed precedent), and
        provides a clean user experience for exploring source code alongside the dependency visualization.

  ⎿  Done (17 tool uses · 65.3k tokens · 2m 36s)

∴ Thinking…

  All three agents have completed their analysis. Let me summarize the findings from each for the user:

  1. UI/Display Agent (ab1a013): Recommends a tiered approach with react-syntax-highlighter (PrismLight) as the default (~50KB bundle), with Monaco 
  Editor as an optional lazy-loaded upgrade for power users. Provided detailed comparison matrix and component architecture.
  2. Storage Strategy Agent (a8ceaea): Recommends a hybrid approach - store source code in database for GitHub repos (since the temp clone is deleted), 
  and fetch on-demand from filesystem for local directories. Estimated storage costs are negligible (~$0.001/100 analyses).
  3. React Flow Integration Agent (a69e874): Recommends a new collapsible panel below the React Flow visualization, auto-opening on node click. Detailed
   the component architecture, state management with lifted state in VisualizationPage, and a new useSourceCode hook using React Query.

  Let me provide a consolidated summary for the user.

⏺ All three implementation-strategist agents have completed their analysis. Here's a consolidated summary:

  ---
  Source Code Viewer Implementation Strategy

  1. UI/Display Component (Agent 1)

  Recommendation: Tiered approach
  | Tier     | Library                               | Bundle Size | Use Case                      |
  |----------|---------------------------------------|-------------|-------------------------------|
  | Default  | react-syntax-highlighter (PrismLight) | ~50KB lazy  | 90% of viewing                |
  | Advanced | Monaco Editor                         | ~5MB lazy   | Power users with search needs |

  - Why not Monaco as default? Overkill for read-only; 5-25MB bundle
  - Why not CodeMirror? Has syntax highlighting issues for files >500 lines
  - VS Code embed? Not feasible - no official embedding API

  ---
  2. Storage Strategy (Agent 2)

  Recommendation: Hybrid approach

  | Source Type       | Strategy                            | Reasoning                            |
  |-------------------|-------------------------------------|--------------------------------------|
  | GitHub repos      | Store content in DB during analysis | Temp clone is deleted after analysis |
  | Local directories | Fetch on-demand from filesystem     | Files still exist on user's machine  |

  Storage costs: Negligible (~$0.001/100 analyses @ 5KB avg file size)

  New database table:
  CREATE TABLE analysis_file_contents (
    id UUID PRIMARY KEY,
    analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    content TEXT NOT NULL
  );

  ---
  3. React Flow Integration (Agent 3)

  Recommended layout:
  +----------------------------------------------------------+
  | Header                                                    |
  +----------------------------------------------------------+
  |                                          | NodeDetail    |
  |   React Flow Container (900px)           | Panel         |
  |                                          | (metadata)    |
  +------------------------------------------+               |
  |   Source Code Panel (collapsible)  <NEW> |               |
  |   - Auto-opens on node click             |               |
  |   - Resizable height (200-600px)         |               |
  +----------------------------------------------------------+

  Key components:
  - SourceCodePanel.tsx - Main viewer with syntax highlighting
  - useSourceCode.ts - React Query hook for fetching/caching
  - New backend endpoint: GET /api/analysis/{id}/file-content?path={path}

  UX behavior:
  - Auto-opens when user clicks any file node
  - Close via X button, minimize button, or Escape key
  - Keyboard shortcut: Ctrl/Cmd + / to toggle

  ---
  Implementation Phases

  | Phase | Tasks                                            | Effort   |
  |-------|--------------------------------------------------|----------|
  | 1     | DB migration + backend endpoint                  | 2-3 days |
  | 2     | useSourceCode hook + SourceCodePanel component   | 2-3 days |
  | 3     | Wire into VisualizationPage, node click triggers | 1-2 days |
  | 4     | Polish: resizing, keyboard nav, mobile           | 1-2 days |

  Total: ~5-10 days

  ---
  Files to Create/Modify

  New files:
  - supabase/migrations/004_add_file_contents.sql
  - backend/app/services/source_reader.py
  - frontend/src/components/SourceCodePanel.tsx
  - frontend/src/hooks/useSourceCode.ts

  Modified files:
  - backend/app/api/routes.py - Add file content endpoint
  - backend/app/services/database.py - Store content for GitHub analyses
  - backend/app/services/parser.py - Pass content through during analysis
  - frontend/src/pages/VisualizationPage.tsx - Add panel + state management

  ---