import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  ArrowLeft,
  FileCode,
  GitBranch,
  Clock,
  LayoutGrid,
  User,
  ChevronsLeftRight,
  MessageSquare,
  Layers,
  ChevronDown
} from 'lucide-react';

import { type CategoryRoleData } from '../components/CategoryNode';
import EdgeDetailPopover from '../components/EdgeDetailPopover';
import NodeDetailPanel from '../components/NodeDetailPanel';
import CategoryRolePanel from '../components/CateogoryDetailPanel';
import UserDashboard from './UserDashboard';
import ProfileSettingsPage from './ProfileSettingsPage';
import SummaryDisplay from '../components/SummaryDisplay';
import type { FunctionTierItem } from '../types/tierList';
import { BarChart3, FileText } from 'lucide-react';
import type {
  ReactFlowGraph,
  ReactFlowNodeData,
  Language,
  ArchitecturalRole,
  AnalysisMetadata,
} from '../types';
import { useAuth } from '../hooks/useAuth';
import { AuthModal } from '../components/AuthModal';
import { getAnalysisResult } from '../api/client';
import SourceCodePanel from '../components/SourceCodePanel';
import { useSourceCode } from '../hooks/useSourceCode';
import { ProfessionalDesign } from '../components/TierList/designs/ProfessionalDesign';
import { ChatPanel } from '../components/chat';
import AnalysisFileTree from '../components/AnalysisFileTree';
import { RundownSection } from '../components/rundown';
import type { SelectionContext } from '../types/chat';
import { DraggableModal } from '../components/DraggableModal';
import { RoleLayoutGraph, NestedLayoutGraph } from '../components/graphs';

// Simplified LayoutType for two layouts only
type SimplifiedLayoutType = 'role' | 'nested';

// Main visualization page component
export default function VisualizationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signOut } = useAuth();
  const [graphData, setGraphData] = useState<ReactFlowGraph | null>(null);
  const [selectedNode, setSelectedNode] = useState<ReactFlowNodeData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectionSource, setSelectionSource] = useState<'node' | 'tierlist' | null>(null);
  const [selectedCateogry, setSelectedCategory] = useState<CategoryRoleData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState<Language | 'all'>('all');
  const [roleFilter, setRoleFilter] = useState<ArchitecturalRole | 'all'>('all');
  const [layoutType, setLayoutType] = useState<SimplifiedLayoutType>('role');
  const [expanded, setExpanded] = useState<boolean>(true);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState(0);
  const [chatModalOpen, setChatModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edge popover state
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [edgePopoverPosition, setEdgePopoverPosition] = useState<{ x: number; y: number } | null>(null);

  // Highlighted lines state for source code panel (used when selecting functions from tier list)
  const [highlightedLines, setHighlightedLines] = useState<{
    startLine: number;
    endLine: number | null;
  } | null>(null);

  // Right panel tab state
  type RightPanelTab = 'details' | 'tierlist';
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>('details');

  // Resize state for right panel
  const [panelWidth, setPanelWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const visualizationRef = useRef<HTMLDivElement>(null);

  // Graph Constants
  const MIN_PANEL_WIDTH = 50; // Minimum when resizing (before auto-collapse)
  const COLLAPSE_THRESHOLD = 80; // Auto-collapse when dragged below this
  const TAB_WIDTH = 40; // Width of the expand tab when collapsed

  const getMaxPanelWidth = useCallback(() => {
    return Math.floor(window.innerWidth / 2);
  }, []);

  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const maxWidth = getMaxPanelWidth();
      const newWidth = window.innerWidth - e.clientX;

      // If dragged below collapse threshold, collapse the panel
      if (newWidth < COLLAPSE_THRESHOLD) {
        setExpanded(false);
        setIsResizing(false);
        return;
      }

      const clampedWidth = Math.max(MIN_PANEL_WIDTH, Math.min(maxWidth, newWidth));
      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, getMaxPanelWidth, setExpanded]);

  // Clamp panel width on window resize
  useEffect(() => {
    const handleWindowResize = () => {
      const maxWidth = getMaxPanelWidth();
      if (panelWidth > maxWidth) {
        setPanelWidth(maxWidth);
      }
    };
    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [panelWidth, getMaxPanelWidth]);

  // Source code panel state
  const [isSourcePanelOpen, setIsSourcePanelOpen] = useState(true);
  const [sourceCodeFile, setSourceCodeFile] = useState<{
    nodeId: string;
    fileName: string;
    language: Language;
    lineCount: number;
  } | null>(null);

  // Ref to track the current analysis ID for detecting project changes
  const currentAnalysisIdRef = useRef<string | null>(null);

  // Get analysis ID from URL or from loaded graph data
  const analysisIdFromUrl = searchParams.get('analysis');
  const analysisId = analysisIdFromUrl || graphData?.metadata?.analysis_id || null;

  // Fetch source code using the hook
  const {
    sourceCode,
    isLoading: isSourceCodeLoading,
    error: sourceCodeError,
  } = useSourceCode({
    analysisId,
    nodeId: sourceCodeFile?.nodeId || null,
    enabled: isSourcePanelOpen && !!sourceCodeFile,
  });

  const handleOpenAuthModal = (tab: number) => {
    setAuthModalTab(tab);
    setAuthModalOpen(true);
  };

  // Load data from URL query parameter or session storage
  useEffect(() => {
    const analysisId = searchParams.get('analysis');

    const loadData = async () => {
      setLoading(true);

      try {
        // If analysis ID is provided in URL, fetch from API
        if (analysisId) {
          console.log('Loading analysis from API:', analysisId);
          const data = await getAnalysisResult(analysisId);
          console.log('Loaded analysis data:', data);
          setGraphData(data);
        } else {
          // Otherwise, try to load from session storage (for new analyses)
          const storedData = sessionStorage.getItem('analysisResult');

          if (storedData) {
            console.log('Loading analysis from sessionStorage');
            const data: ReactFlowGraph = JSON.parse(storedData);
            setGraphData(data);
          } else {
            console.error('No analysis ID in URL and no data in sessionStorage');
            navigate('/');
          }
        }
      } catch (error) {
        console.error('Failed to load analysis:', error);
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [navigate, searchParams]);

  // Auto-open source panel with main file when graphData loads or project changes
  useEffect(() => {
    if (!graphData) return;

    const newAnalysisId = graphData.metadata.analysis_id;
    const analysisChanged = currentAnalysisIdRef.current !== null && currentAnalysisIdRef.current !== newAnalysisId;

    // Update the ref
    currentAnalysisIdRef.current = newAnalysisId;

    // Reset to main file if this is a new project, or if no file is currently selected
    if (analysisChanged || !sourceCodeFile) {
      // Clear selection state when switching projects
      if (analysisChanged) {
        setSelectedNode(null);
        setSelectedNodeId(null);
        setSelectionSource(null);
        setSelectedCategory(null);
        setHighlightedLines(null);
      }

      const mainFile = findMainFile(graphData.nodes);
      if (mainFile) {
        setSourceCodeFile({
          nodeId: mainFile.id,
          fileName: mainFile.data.label,
          language: mainFile.data.language,
          lineCount: mainFile.data.line_count,
        });
        setIsSourcePanelOpen(true);
      }
    }
  }, [graphData, sourceCodeFile]);

  // Note: Layout and highlighting logic is now handled by RoleLayoutGraph and NestedLayoutGraph

  // Handle node selection from graph components
  const handleNodeSelect = useCallback((nodeId: string, nodeData: ReactFlowNodeData) => {
    // Close edge popover when selecting a file
    setSelectedEdge(null);
    setEdgePopoverPosition(null);

    setSelectedCategory(null);
    setSelectedNode(nodeData);
    setSelectedNodeId(nodeId);
    setSelectionSource('node');

    // Also open source code panel with this file
    setSourceCodeFile({
      nodeId: nodeId,
      fileName: nodeData.label,
      language: nodeData.language,
      lineCount: nodeData.line_count,
    });
    setIsSourcePanelOpen(true);

    // Clear highlighted lines when selecting via node click (not function selection)
    setHighlightedLines(null);
  }, []);

  // Handle category selection from RoleLayoutGraph
  const handleCategorySelect = useCallback((categoryData: CategoryRoleData) => {
    setSelectedNode(null);
    setSelectedNodeId(null);
    setSelectedCategory(categoryData);
  }, []);

  // Handle pane click from graph components
  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedNodeId(null);
    setSelectionSource(null);
    // Close edge popover on pane click
    setSelectedEdge(null);
    setEdgePopoverPosition(null);
  }, []);

  // Handle edge click from graph components
  const handleEdgeClick = useCallback((edge: Edge, position: { x: number; y: number }) => {
    setSelectedEdge(edge);
    setEdgePopoverPosition(position);
    // Clear node selection when clicking edge
    setSelectedNode(null);
    setSelectedNodeId(null);
    setSelectionSource(null);
  }, []);

  // Close edge popover
  const closeEdgePopover = useCallback(() => {
    setSelectedEdge(null);
    setEdgePopoverPosition(null);
  }, []);

  // Rundown Expand/Collapse Handler


  // Handle function selection from tier list
  const handleFunctionSelect = useCallback((func: FunctionTierItem) => {
    // Find the node that corresponds to this function's file from graphData
    // Try to find by node_id first, then fallback to file_path for non-exported functions
    let targetNode = graphData?.nodes.find(node => node.id === func.node_id);
    if (!targetNode && func.file_path) {
      targetNode = graphData?.nodes.find(node => node.data.path === func.file_path);
    }

    if (targetNode) {
      // Set the selected node
      const nodeData = targetNode.data;
      setSelectedNode(nodeData);
      setSelectedNodeId(targetNode.id);
      setSelectionSource('tierlist');
      setSelectedCategory(null);

      // Open source code panel
      setSourceCodeFile({
        nodeId: targetNode.id,
        fileName: nodeData.label,
        language: nodeData.language,
        lineCount: nodeData.line_count,
      });
      setIsSourcePanelOpen(true);

      // Set highlighted lines for source code panel
      setHighlightedLines({
        startLine: func.start_line,
        endLine: func.end_line,
      });
    }
  }, [graphData]);

  // Handle file selection from AnalysisFileTree
  const handleFileTreeSelect = useCallback((nodeId: string, nodeData: ReactFlowNodeData) => {
    // Close edge popover when selecting a file
    setSelectedEdge(null);
    setEdgePopoverPosition(null);

    // Set the selected node
    setSelectedCategory(null);
    setSelectedNode(nodeData);
    setSelectedNodeId(nodeId);
    setSelectionSource('node');

    // Open source code panel with this file
    setSourceCodeFile({
      nodeId: nodeId,
      fileName: nodeData.label,
      language: nodeData.language,
      lineCount: nodeData.line_count,
    });
    setIsSourcePanelOpen(true);

    // Clear highlighted lines when selecting via file tree (not function selection)
    setHighlightedLines(null);
  }, []);

  // Handle file click from rundown section
  const handleRundownFileClick = useCallback((filePath: string) => {
    const targetNode = graphData?.nodes.find(node => node.data.path === filePath);
    if (targetNode) {
      handleFileTreeSelect(targetNode.id, targetNode.data);
    }
  }, [graphData, handleFileTreeSelect]);

  // Handle layer click from rundown section — scroll to visualization and apply role filter
  const handleLayerClick = useCallback((roles: string[]) => {
    if (roles.length > 0) {
      setRoleFilter(roles[0] as ArchitecturalRole);
    }
    visualizationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Build list of valid file paths for narrative keyword highlighting
  const validFilePaths = useMemo(
    () => graphData?.nodes.map((n) => n.data.path) ?? [],
    [graphData],
  );

  // Build selection context for the chat panel
  const selectionContextForChat = useMemo((): SelectionContext | null => {
    if (!sourceCodeFile && !selectedNode) {
      return null;
    }

    // Determine the source based on how the selection was made
    const source = selectionSource === 'tierlist' ? 'tier_list' as const
      : selectionSource === 'node' ? 'graph_node' as const
        : 'source_code_panel' as const;

    const context: SelectionContext = {
      source,
    };

    // Add current file context if a file is open in the source code panel
    if (sourceCodeFile) {
      context.current_file = {
        node_id: sourceCodeFile.nodeId,
        file_path: selectedNode?.path || sourceCodeFile.fileName,
        file_name: sourceCodeFile.fileName,
        language: sourceCodeFile.language,
        role: selectedNode?.role,
        category: selectedNode?.category,
      };
    }

    // Add selected node context if different from current file
    if (selectedNode && selectedNodeId) {
      context.selected_node = {
        node_id: selectedNodeId,
        file_path: selectedNode.path,
        role: selectedNode.role,
        category: selectedNode.category,
      };
    }

    return context;
  }, [sourceCodeFile, selectedNode, selectedNodeId, selectionSource]);

  if (loading || !graphData) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">Loading analysis...</div>
      </div>
    );
  }

  const mainSectionGap = 'gap-[100px]';


  return (
    <div className="min-h-screen max-h-screen w-screen bg-gray-100 flex flex-col overflow-hidden ">
      {/* <div className="min-h-screen h-[100%] w-[100%] min-w-screen absolute top-0 left-0 blur-lg z-10 " /> */}
      {/* Header */}
      <div className="h-14 fixed top-0 left-0 w-full bg-slate-800 flex items-center justify-between px-4 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-sm">Back</span>
          </button>

          <div className="h-6 w-px bg-slate-700" />

          <h1 className="text-white font-semibold">
            {getAnalysisDisplayName(graphData.metadata)}
          </h1>
        </div>
        <button
          onClick={() => user ? setChatModalOpen(prev => !prev) : handleOpenAuthModal(0)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${chatModalOpen
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600'
            }`}
          title={user ? 'AI Assistant' : 'Sign in to use AI Assistant'}
        >
          <MessageSquare size={16} />
          <span className="text-sm font-medium">AI Assistant</span>
        </button>

        {/* Desktop Stats and Auth */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <FileCode size={16} />
              <span>{graphData.metadata.file_count} files</span>
            </div>
            <div className="flex items-center gap-2">
              <GitBranch size={16} />
              <span>{graphData.metadata.edge_count} dependencies</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{graphData.metadata.analysis_time_seconds.toFixed(1)}s</span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-700" />

          {/* <button
            onClick={() => setChatModalOpen(prev => !prev)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
              chatModalOpen
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400 hover:text-white hover:bg-slate-600'
            }`}
          >
            <MessageSquare size={16} />
            <span className="text-sm font-medium">AI Chat</span>
          </button> */}

          <div className="h-6 w-px bg-slate-700" />

          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setDashboardOpen(true)}
                className="text-slate-400 hover:text-white transition-colors text-sm font-medium px-3 py-1.5 rounded hover:bg-slate-700"
              >
                My Analyses
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 rounded hover:bg-slate-600 transition-colors cursor-pointer"
                title="Account Settings"
              >
                <User size={14} className="text-slate-400" />
                <span className="text-sm text-slate-300">{user.email?.split('@')[0]}</span>
              </button>
              <button
                onClick={signOut}
                className="text-slate-400 hover:text-white transition-colors text-sm font-medium px-3 py-1.5 rounded hover:bg-slate-700"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleOpenAuthModal(0)}
                className="text-slate-400 hover:text-white transition-colors text-sm font-medium px-3 py-1.5 rounded hover:bg-slate-700"
              >
                Log In
              </button>
              <button
                onClick={() => handleOpenAuthModal(1)}
                className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded transition-colors"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>

        {/* Mobile Stats Only */}
        <div className="flex md:hidden items-center gap-3 text-xs text-slate-400">
          <button
            onClick={() => user ? setChatModalOpen(prev => !prev) : handleOpenAuthModal(0)}
            className={`p-1.5 rounded transition-colors ${chatModalOpen
                ? 'bg-blue-600 text-white'
                : 'bg-slate-700 text-slate-400'
              }`}
            title={user ? 'AI Assistant' : 'Sign in to use AI Assistant'}
          >
            <MessageSquare size={14} />
          </button>
          <div className="flex items-center gap-1">
            <FileCode size={14} />
            <span>{graphData.metadata.file_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <GitBranch size={14} />
            <span>{graphData.metadata.edge_count}</span>
          </div>
        </div>
      </div>

      {/* Main grid layout */}
      <div
        ref={containerRef}
        className="flex mt-14 h-[calc(100vh-3.5rem)] relative overflow-hidden"
      >
        {/* Main content */}
        <div
          id="left-content"
          className={`min-h-full overflow-y-auto pb-4 flex flex-col space-y-[10px] ${mainSectionGap} items-center flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [scrollbar-width:thin] [scrollbar-color:transparent_transparent] hover:[scrollbar-color:rgb(203,213,225)_transparent]`}
          style={{ width: expanded ? `calc(100% - ${panelWidth}px)` : '100%' }}
        >

          {/* Overview Section */}
          <div className='max-w-[1000px] w-full pt-12 px-8 '>
            <div className='rounded-2xl p-8 '>
              <div className='flex flex-col gap-6'>
                {/* Header */}
                <div className='text-center'>
                  <h2 className='text-2xl text-red-500 font-semibold mb-4'>PROJECT OVERVIEW</h2>
                  <h1 className='text-7xl font-bold text-slate-900 mb-3 tracking-tight'>
                    {getAnalysisDisplayName(graphData.metadata)}
                  </h1>
                </div>

                {/* Summary or Fallback */}
                {graphData.metadata.summary ? (
                  <SummaryDisplay summary={graphData.metadata.summary} />
                ) : (
                  <>
                    <p className='text-slate-600 text-lg leading-relaxed text-center'>
                      A comprehensive visualization of your codebase architecture. Explore {graphData.metadata.file_count} files
                      with {graphData.metadata.edge_count} dependencies across your project structure.
                    </p>
                    <div className='flex flex-wrap justify-center gap-3'>
                      <div className='flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-200'>
                        <FileCode size={16} className='text-indigo-600' />
                        <span className='text-indigo-900 text-sm font-medium'>{graphData.metadata.file_count} Files</span>
                      </div>
                      <div className='flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full border border-emerald-200'>
                        <GitBranch size={16} className='text-emerald-600' />
                        <span className='text-emerald-900 text-sm font-medium'>{graphData.metadata.edge_count} Dependencies</span>
                      </div>
                      <div className='flex items-center gap-2 bg-amber-50 px-4 py-2 rounded-full border border-amber-200'>
                        <Clock size={16} className='text-amber-600' />
                        <span className='text-amber-900 text-sm font-medium'>Analyzed in {graphData.metadata.analysis_time_seconds.toFixed(1)}s</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* The Rundown Section */}
          <RundownSection
            analysisId={graphData.metadata.analysis_id}
            existingRundown={graphData.metadata.rundown}
            fileCount={graphData.metadata.file_count}
            graphNodes={graphData.nodes}
            onFileClick={handleRundownFileClick}
            onLayerClick={handleLayerClick}
            validFilePaths={validFilePaths}
          />

          {/* Files Section */}
          <div className='h-[1000px] w-full flex items-center justify-start px-8'>
            <div className='flex flex-col w-2/5 h-full items-start justify-center px-2'>
              <div className='flex w-full items-center justify-center relative h-16'>

                <h2 className='text-3xl text-red-500 text-center '>FILES</h2>
              </div>
              <div className='h-[900px] w-full p-8 flex items-start justify-start rounded-2xl overflow-hidden'>
                <AnalysisFileTree
                  nodes={graphData.nodes}
                  onFileSelect={handleFileTreeSelect}
                  selectedFileId={selectedNodeId}
                  selectionSource={selectionSource}
                />
              </div>
            </div>

            {/* Source Code Panel */}
            <div className="w-3/5 h-full flex flex-col items-start justify-center">
              <div className='flex w-full items-center justify-center relative h-16'>

                <h2 className='text-3xl text-red-500 text-center '>SOURCE CODE</h2>
              </div>
              <div className='h-[900px] w-full py-8 overflow-hidden'>
                {isSourcePanelOpen && sourceCodeFile && (
                  <SourceCodePanel
                    sourceCode={sourceCode}
                    fileName={sourceCodeFile.fileName}
                    language={sourceCodeFile.language}
                    lineCount={sourceCodeFile.lineCount}
                    isLoading={isSourceCodeLoading}
                    error={sourceCodeError}
                    isOpen={isSourcePanelOpen}
                    onClose={() => {
                      setIsSourcePanelOpen(false);
                      setSourceCodeFile(null);
                      setHighlightedLines(null);
                    }}
                    highlightedLines={highlightedLines}
                    onHighlightClear={() => setHighlightedLines(null)}
                  />

                )}
              </div>
            </div>
          </div>

          {/* Graph Visualization Container */}
          <div ref={visualizationRef} className='w-full px-8 pb-12 justify-center flex flex-col gap-10 items-center'>
            <div className='flex w-full items-center justify-center relative h-12'>
              <h2 className='text-3xl text-red-500 text-center '>VISUALIZATION</h2>
            </div>

            {/* Graph container with manila folder tabs */}
            <div className='max-w-[1200px] w-full'>
              {/* Manila folder tabs - attached to top of container */}
              <div className="flex items-end pl-4">
                <button
                  onClick={() => setLayoutType('role')}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all relative ${layoutType === 'role'
                      ? 'bg-slate-800 text-white z-10 -mb-[2px] border-t-2 border-x-2 border-neutral-600'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white -mb-[2px] border-t border-x border-neutral-500'
                    }`}
                >
                  <LayoutGrid size={16} />
                  Role Layout
                </button>
                <button
                  onClick={() => setLayoutType('nested')}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg transition-all relative ml-1 ${layoutType === 'nested'
                      ? 'bg-amber-100 text-amber-900 z-10 -mb-[2px] border-t-2 border-x-2 border-amber-400'
                      : 'bg-amber-200/60 text-amber-800 hover:bg-amber-200 hover:text-amber-900 -mb-[2px] border-t border-x border-amber-300'
                    }`}
                >
                  <Layers size={16} />
                  Folder Layout
                </button>
              </div>

              {/* Graph container */}
              <div className={`h-[900px] w-full rounded-2xl rounded-tl-none overflow-hidden border-4 shadow-2xl shadow-black relative ${layoutType === 'role'
                  ? 'border-neutral-600 bg-slate-800'
                  : 'border-amber-400 bg-amber-50'
                }`}>
                {/* Render the appropriate graph component based on layout type */}
                {layoutType === 'role' ? (
                  <RoleLayoutGraph
                    graphData={graphData}
                    searchQuery={searchQuery}
                    languageFilter={languageFilter}
                    roleFilter={roleFilter}
                    onNodeSelect={handleNodeSelect}
                    onCategorySelect={handleCategorySelect}
                    onEdgeClick={handleEdgeClick}
                    onPaneClick={handlePaneClick}
                    selectedNodeId={selectedNodeId}
                    selectionSource={selectionSource}
                    onLanguageFilterChange={setLanguageFilter}
                    onRoleFilterChange={setRoleFilter}
                    onSearchChange={setSearchQuery}
                  />
                ) : (
                  <NestedLayoutGraph
                    graphData={graphData}
                    searchQuery={searchQuery}
                    languageFilter={languageFilter}
                    roleFilter={roleFilter}
                    onNodeSelect={handleNodeSelect}
                    onEdgeClick={handleEdgeClick}
                    onPaneClick={handlePaneClick}
                    onLanguageFilterChange={setLanguageFilter}
                    onRoleFilterChange={setRoleFilter}
                    selectedNodeId={selectedNodeId}
                    selectionSource={selectionSource}
                    onSearchChange={setSearchQuery}
                  />
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Resize Handle - only show when expanded */}
        {expanded && (
          <div
            onMouseDown={handleResizeMouseDown}
            className="w-[2px] hover:bg-gray-600 cursor-ew-resize transition-colors z-10"
          />
        )}

        {/* Right Panel / NodeDetailPanel */}
        <div
          id="right-content"
          className="h-full bg-slate-900  border-slate-800 flex-shrink-0 transition-[width] duration-200 flex flex-col"
          style={{ width: expanded ? panelWidth : 0 }}
        >
          {expanded && (
            <>
              {/* Tab Navigation */}
              <div className="flex border-b border-slate-700 flex-shrink-0">
                <button
                  onClick={() => setRightPanelTab('details')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${rightPanelTab === 'details'
                    ? 'bg-slate-800 text-white border-b-2 border-blue-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                  <FileText size={16} />
                  Files
                </button>
                <button
                  onClick={() => setRightPanelTab('tierlist')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${rightPanelTab === 'tierlist'
                    ? 'bg-slate-800 text-white border-b-2 border-amber-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                    }`}
                >
                  <BarChart3 size={16} />
                  Functions
                </button>
                <div className='absolute top-2 right-2 flex items-center cursor-pointer gap-2 text-slate-400 z-50 ' >
                  <ChevronsLeftRight size={26} onMouseDown={() => setExpanded(prev => !prev)} className='z-50 pointer-events-all' />
                </div>
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden">
                {rightPanelTab === 'details' && (
                  <>
                    {selectedNode && (
                      <NodeDetailPanel data={selectedNode} onClose={() => setSelectedNode(null)} setExpand={setExpanded} expanded={expanded} />
                    )}
                    {selectedCateogry && (
                      <CategoryRolePanel data={selectedCateogry} onClose={() => setSelectedCategory(null)} setExpand={setExpanded} expanded={expanded} />
                    )}
                    {!selectedNode && !selectedCateogry && (
                      <NodeDetailPanel data={null} onClose={() => setSelectedNode(null)} setExpand={setExpanded} expanded={expanded} />
                    )}
                  </>
                )}
                {rightPanelTab === 'tierlist' && (
                  <ProfessionalDesign
                    analysisId={analysisId}
                    onFunctionSelect={handleFunctionSelect}
                  />
                )}
              </div>
            </>
          )}
        </div>

        {/* Collapsed tab - absolutely positioned, independent of right-content */}
        {!expanded && (
          <div
            className="absolute right-0 top-0 h-[40px] bg-slate-300/40 group flex flex-col items-center justify-center cursor-pointer hover:bg-slate-300 rounded-l-lg transition-colors z-20"
            style={{ width: TAB_WIDTH }}
            onClick={() => setExpanded(true)}
          >
            <div className='flex h-10 w-8 items-center justify-center'>
              <ChevronsLeftRight size={24} className="text-slate-400 group-hover:text-white transition-colors" />
            </div>
          </div>
        )}

      </div>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalTab}
      />

      {/* User Dashboard Modal */}
      <UserDashboard
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />

      {/* Profile Settings Modal */}
      <ProfileSettingsPage
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Edge Detail Popover */}
      <EdgeDetailPopover
        edge={selectedEdge}
        position={edgePopoverPosition}
        onClose={closeEdgePopover}
        nodes={graphData?.nodes || []}
      />

      {/* AI Chat Modal */}
      <DraggableModal
        title=""
        isOpen={chatModalOpen}
        onClose={() => setChatModalOpen(false)}
        width={450}
        height={650}
      >
        <ChatPanel
          analysisId={analysisId}
          expanded={true}
          selectionContext={selectionContextForChat}
        />
      </DraggableModal>
    </div>
  );
}

// Helper function to find the "main" entry file from graph nodes
// Prioritizes: App.tsx/jsx/js > main.ts/tsx/js/py > index files > first file
function findMainFile(nodes: ReactFlowGraph['nodes']): ReactFlowGraph['nodes'][0] | null {
  if (nodes.length === 0) return null;

  // Priority patterns for main files (case-insensitive basename matching)
  const mainPatterns = [
    /^App\.(tsx|jsx|ts|js)$/i,
    /^main\.(tsx|ts|js|py)$/i,
    /^index\.(tsx|ts|js)$/i,
  ];

  for (const pattern of mainPatterns) {
    const match = nodes.find(node => pattern.test(node.data.label));
    if (match) return match;
  }

  // Fallback to first file
  return nodes[0];
}

// Helper function to get display name for the analysis
function getAnalysisDisplayName(metadata: AnalysisMetadata): string {
  // Prioritize user-defined title if available
  if (metadata.user_title) {
    return metadata.user_title;
  }

  if (metadata.github_repo) {
    // For GitHub repos, show "owner/repo" or just "repo" if path is specified
    const { owner, repo, path } = metadata.github_repo;
    if (path) {
      return `${owner}/${repo}/${path}`;
    }
    return `${owner}/${repo}`;
  }

  if (metadata.directory_path) {
    // For local directories, show the last part of the path
    return metadata.directory_path.split('/').pop() || metadata.directory_path;
  }

  // Fallback
  return 'Unknown Project';
}

