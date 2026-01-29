import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { useTreeViewApiRef } from '@mui/x-tree-view/hooks';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import {
  File,
  Folder,
  FileCode,
  FileJson,
  FileText,
  Settings,
  TestTube,
  Component,
  Database,
  Network,
  Cog,
} from 'lucide-react';

import {
  ReactFlowNode,
  ReactFlowNodeData,
  Language,
  ArchitecturalRole,
  roleLabels,
} from '../types';

// --- Types ---

interface AnalysisFileTreeProps {
  nodes: ReactFlowNode[];
  onFileSelect?: (nodeId: string, nodeData: ReactFlowNodeData) => void;
  selectedFileId?: string | null;
}

// Extended tree item to hold file metadata
type ExtendedTreeItem = TreeViewBaseItem & {
  type: 'file' | 'dir';
  nodeId?: string; // Original node ID for files
  nodeData?: ReactFlowNodeData; // Full node data for files
};

// --- GitHub Theme Constants (matching GithubEmbed.tsx) ---
const GH_COLORS = {
  bg: '#0d1117',
  border: '#30363d',
  rowHover: '#161b22',
  textMain: '#c9d1d9',
  textMuted: '#8b949e',
  link: '#58a6ff',
  iconDir: '#54aeff', // GitHub Blue Folder
  iconFile: '#8b949e',
};

// --- File Icon Mapping ---
const getFileIcon = (language: Language, role: ArchitecturalRole) => {
  // Role-based icons take priority
  switch (role) {
    case 'react_component':
      return <Component size={16} color="#61dafb" />;
    case 'test':
      return <TestTube size={16} color="#ef4444" />;
    case 'config':
      return <Settings size={16} color="#6b7280" />;
    case 'api_service':
      return <Network size={16} color="#8b5cf6" />;
    case 'model':
    case 'schema':
      return <Database size={16} color="#f59e0b" />;
    case 'hook':
      return <Cog size={16} color="#06b6d4" />;
    default:
      break;
  }

  // Language-based icons
  switch (language) {
    case 'typescript':
      return <FileCode size={16} color="#3178c6" />;
    case 'javascript':
      return <FileCode size={16} color="#f7df1e" />;
    case 'python':
      return <FileCode size={16} color="#3776ab" />;
    default:
      return <File size={16} color={GH_COLORS.iconFile} />;
  }
};

// Get icon based on file extension for files without full node data
const getIconByExtension = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return <FileCode size={16} color="#3178c6" />;
    case 'js':
    case 'jsx':
      return <FileCode size={16} color="#f7df1e" />;
    case 'py':
      return <FileCode size={16} color="#3776ab" />;
    case 'json':
      return <FileJson size={16} color="#f59e0b" />;
    case 'md':
    case 'txt':
      return <FileText size={16} color={GH_COLORS.textMuted} />;
    default:
      return <File size={16} color={GH_COLORS.iconFile} />;
  }
};

// --- Tree Building Logic ---

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  children: Map<string, TreeNode>;
  nodeId?: string;
  nodeData?: ReactFlowNodeData;
}

const buildTreeFromPaths = (nodes: ReactFlowNode[]): ExtendedTreeItem[] => {
  // Build a tree structure from file paths
  const root: TreeNode = {
    name: '',
    path: '',
    type: 'dir',
    children: new Map(),
  };

  // Insert each file path into the tree
  for (const node of nodes) {
    const path = node.data.path;
    const parts = path.split('/').filter(Boolean);

    let current = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isFile = i === parts.length - 1;

      if (!current.children.has(part)) {
        current.children.set(part, {
          name: part,
          path: currentPath,
          type: isFile ? 'file' : 'dir',
          children: new Map(),
          nodeId: isFile ? node.id : undefined,
          nodeData: isFile ? node.data : undefined,
        });
      }

      current = current.children.get(part)!;
    }
  }

  // Convert tree to ExtendedTreeItem array with sorting
  const convertToTreeItems = (node: TreeNode): ExtendedTreeItem[] => {
    const items: ExtendedTreeItem[] = [];

    // Sort children: directories first, then files, alphabetically
    const sortedChildren = Array.from(node.children.values()).sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });

    for (const child of sortedChildren) {
      const childItems = convertToTreeItems(child);

      items.push({
        id: child.path,
        label: child.name,
        type: child.type,
        nodeId: child.nodeId,
        nodeData: child.nodeData,
        children: child.type === 'dir' ? childItems : undefined,
      });
    }

    return items;
  };

  return convertToTreeItems(root);
};

// --- Tooltip Content Component ---
const FileTooltipContent = ({ data }: { data: ReactFlowNodeData }) => (
  <Box sx={{ p: 1, maxWidth: 280 }}>
    <Typography variant="subtitle2" sx={{ color: GH_COLORS.textMain, mb: 0.5 }}>
      {data.label}
    </Typography>
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" sx={{ color: GH_COLORS.textMuted }}>
        <strong>Language:</strong> {data.language}
      </Typography>
      <Typography variant="caption" sx={{ color: GH_COLORS.textMuted }}>
        <strong>Role:</strong> {roleLabels[data.role] || data.role}
      </Typography>
      <Typography variant="caption" sx={{ color: GH_COLORS.textMuted }}>
        <strong>Lines:</strong> {data.line_count.toLocaleString()}
      </Typography>
      <Typography variant="caption" sx={{ color: GH_COLORS.textMuted }}>
        <strong>Size:</strong> {(data.size_bytes / 1024).toFixed(1)} KB
      </Typography>
      {data.description && (
        <Typography
          variant="caption"
          sx={{
            color: GH_COLORS.textMuted,
            mt: 0.5,
            fontStyle: 'italic',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {data.description}
        </Typography>
      )}
    </Box>
  </Box>
);

// --- Custom Tree Item Content Component ---
const CustomTreeItemContent = ({ item, isSelected }: { item: ExtendedTreeItem; isSelected: boolean }) => {
  const icon =
    item.type === 'dir' ? (
      <Folder size={16} color={GH_COLORS.iconDir} />
    ) : item.nodeData ? (
      getFileIcon(item.nodeData.language, item.nodeData.role)
    ) : (
      getIconByExtension(item.label as string)
    );

  const content = (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        py: 0.25,
        flex: 1,
        minWidth: 0,
      }}
    >
      {icon}
      <Typography
        variant="body2"
        sx={{
          color: isSelected ? GH_COLORS.link : GH_COLORS.textMain,
          fontSize: '14px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {item.label}
      </Typography>
      {item.type === 'file' && item.nodeData && (
        <Typography
          variant="caption"
          sx={{
            color: GH_COLORS.textMuted,
            ml: 'auto',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}
        >
          {item.nodeData.line_count} lines
        </Typography>
      )}
    </Box>
  );

  // Wrap file items with tooltip
  if (item.type === 'file' && item.nodeData) {
    return (
      <Tooltip
        title={<FileTooltipContent data={item.nodeData} />}
        placement="right"
        arrow
        enterDelay={500}
        leaveDelay={100}
        slotProps={{
          tooltip: {
            sx: {
              bgcolor: '#161b22',
              border: `1px solid ${GH_COLORS.border}`,
              borderRadius: '6px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              '& .MuiTooltip-arrow': {
                color: '#161b22',
                '&::before': {
                  border: `1px solid ${GH_COLORS.border}`,
                },
              },
            },
          },
        }}
      >
        {content}
      </Tooltip>
    );
  }

  return content;
};

// --- Main Component ---

const AnalysisFileTree = ({
  nodes,
  onFileSelect,
  selectedFileId,
}: AnalysisFileTreeProps) => {
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const apiRef = useTreeViewApiRef();

  // Build tree structure from nodes
  const treeItems = useMemo(() => buildTreeFromPaths(nodes), [nodes]);

  // Create a map for quick lookup of node data by path
  const nodeDataByPath = useMemo(() => {
    const map = new Map<string, { nodeId: string; nodeData: ReactFlowNodeData }>();
    for (const node of nodes) {
      map.set(node.data.path, { nodeId: node.id, nodeData: node.data });
    }
    return map;
  }, [nodes]);

  // Reverse lookup: nodeId -> file path (for external selection sync)
  const nodeIdToPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const node of nodes) {
      map.set(node.id, node.data.path);
    }
    return map;
  }, [nodes]);

  // Track last externally processed selection to prevent redundant processing
  const lastExternalSelectionRef = useRef<string | null>(null);

  // Utility function to get all parent directory paths for a file
  const getParentPaths = useCallback((filePath: string): string[] => {
    const parts = filePath.split('/').filter(Boolean);
    const paths: string[] = [];
    let current = '';
    for (let i = 0; i < parts.length - 1; i++) {
      current = current ? `${current}/${parts[i]}` : parts[i];
      paths.push(current);
    }
    return paths;
  }, []);

  // Auto-expand parent directories and scroll to file when selected externally (from graph or tier list)
  useEffect(() => {
    if (!selectedFileId || selectedFileId === lastExternalSelectionRef.current) {
      return;
    }

    const filePath = nodeIdToPath.get(selectedFileId);
    if (!filePath) return;

    // Mark this selection as processed
    lastExternalSelectionRef.current = selectedFileId;

    // Expand all parent directories to reveal the selected file
    const parentPaths = getParentPaths(filePath);
    setExpandedItems(prev => {
      const newExpanded = new Set(prev);
      parentPaths.forEach(p => newExpanded.add(p));
      return Array.from(newExpanded);
    });

    // Scroll the selected file into view after DOM updates
    requestAnimationFrame(() => {
      const element = apiRef.current?.getItemDOMElement(filePath);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, [selectedFileId, nodeIdToPath, getParentPaths, apiRef]);

  // Create a flat map of all items for quick lookup
  const itemsById = useMemo(() => {
    const map = new Map<string, ExtendedTreeItem>();
    const traverse = (items: ExtendedTreeItem[]) => {
      for (const item of items) {
        map.set(item.id, item);
        if (item.children) {
          traverse(item.children as ExtendedTreeItem[]);
        }
      }
    };
    traverse(treeItems);
    return map;
  }, [treeItems]);

  // Handle item selection
  const handleItemClick = useCallback(
    (_event: React.SyntheticEvent, itemId: string) => {
      const nodeInfo = nodeDataByPath.get(itemId);
      if (nodeInfo && onFileSelect) {
        // Mark this as the current selection so the external selection effect doesn't re-process it
        lastExternalSelectionRef.current = nodeInfo.nodeId;
        onFileSelect(nodeInfo.nodeId, nodeInfo.nodeData);
      }
    },
    [nodeDataByPath, onFileSelect]
  );

  // Handle expansion toggle
  const handleItemExpansionToggle = useCallback(
    (_event: React.SyntheticEvent | null, itemId: string, isExpanded: boolean) => {
      setExpandedItems((prev) =>
        isExpanded ? [...prev, itemId] : prev.filter((id) => id !== itemId)
      );
    },
    []
  );

  // Count files and folders
  const stats = useMemo(() => {
    const folders = new Set<string>();
    for (const node of nodes) {
      const parts = node.data.path.split('/');
      let path = '';
      for (let i = 0; i < parts.length - 1; i++) {
        path = path ? `${path}/${parts[i]}` : parts[i];
        folders.add(path);
      }
    }
    return {
      files: nodes.length,
      folders: folders.size,
    };
  }, [nodes]);

  // Custom slot component for tree items
  const CustomTreeItem = useMemo(() => {
    const Component = (props: { itemId: string; label: React.ReactNode; children?: React.ReactNode }) => {
      const item = itemsById.get(props.itemId);
      const isSelected = item?.nodeId === selectedFileId;

      return (
        <TreeItem
          {...props}
          label={
            item ? (
              <CustomTreeItemContent item={item} isSelected={isSelected} />
            ) : (
              props.label
            )
          }
        />
      );
    };
    return Component;
  }, [itemsById, selectedFileId]);

  if (nodes.length === 0) {
    return (
      <Box
        sx={{
          p: 3,
          textAlign: 'center',
          color: GH_COLORS.textMuted,
          bgcolor: GH_COLORS.bg,
          borderRadius: '12px',
          border: `1px solid ${GH_COLORS.border}`,
        }}
      >
        <Typography variant="body2">No files to display</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        maxWidth: 1200,
        minHeight: '100%',
        height: '100%',
        width: '100%',
        border: `2px solid ${GH_COLORS.border}`,
        borderRadius: '12px',
        bgcolor: GH_COLORS.bg,
        overflow: 'auto',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          bgcolor: '#161b22',
          p: '16px',
          borderBottom: `1px solid ${GH_COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Folder size={18} color={GH_COLORS.iconDir} />
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, color: GH_COLORS.textMain }}
          >
            Project Files
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: GH_COLORS.textMuted }}>
          {stats.folders} folders, {stats.files} files
        </Typography>
      </Box>

      {/* Tree View */}
      <Box sx={{ minHeight: 200 }}>
        <RichTreeView
          apiRef={apiRef}
          items={treeItems}
          expandedItems={expandedItems}
          onItemExpansionToggle={handleItemExpansionToggle}
          onExpandedItemsChange={(_event, itemIds) => setExpandedItems(itemIds)}
          onItemClick={handleItemClick}
          slots={{
            item: CustomTreeItem,
            collapseIcon: ExpandMoreIcon,
            expandIcon: ChevronRightIcon,
          }}
          sx={{
            width: '100%',
            color: GH_COLORS.textMain,
            // Target every item row
            '& .MuiTreeItem-content': {
              padding: '6px 12px',
              borderTop: `1px solid ${GH_COLORS.border}`,
              gap: '8px',
              '&:hover': {
                backgroundColor: GH_COLORS.rowHover,
              },
              '&.Mui-selected': {
                backgroundColor: 'rgba(56, 139, 253, 0.1)',
                '&:hover': { backgroundColor: 'rgba(56, 139, 253, 0.2)' },
              },
            },
            // Target the vertical lines for subfolders
            '& .MuiTreeItem-groupTransition': {
              marginLeft: '15px',
              paddingLeft: '10px',
            },
            // Fix the expansion icon color
            '& .MuiTreeItem-iconContainer': {
              color: GH_COLORS.textMuted,
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default AnalysisFileTree;
