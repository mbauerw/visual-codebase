import { useState, useEffect, useCallback } from 'react';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeItem, TreeItemProps } from '@mui/x-tree-view/TreeItem';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import AddBoxIcon from '@mui/icons-material/AddBox';
import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
import SvgIcon, { SvgIconProps } from '@mui/material/SvgIcon';


// Icons
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';

// --- Types ---

interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  type: 'file' | 'dir';
  url: string;
}

// We extend the Base Item to include the data we need for rendering
type ExtendedTreeItem = TreeViewBaseItem & {
  type: 'file' | 'dir';
  lastCommitMsg?: string; // Placeholder: API doesn't return this in content endpoint
  lastCommitDate?: string; // Placeholder
};

interface GithubEmbedProps {
  owner: string;
  repo: string;
  initialPath?: string;
}

// --- GitHub Theme Constants ---
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

function CloseSquare(props: SvgIconProps) {
  return (
    <SvgIcon
      className="close"
      fontSize="inherit"
      style={{ width: 14, height: 14 }}
      {...props}
    >
      {/* tslint:disable-next-line: max-line-length */}
      <path d="M17.485 17.512q-.281.281-.682.281t-.696-.268l-4.12-4.147-4.12 4.147q-.294.268-.696.268t-.682-.281-.281-.682.294-.669l4.12-4.147-4.12-4.147q-.294-.268-.294-.669t.281-.682.682-.281.696 .268l4.12 4.147 4.12-4.147q.294-.268.696-.268t.682.281 .281.669-.294.682l-4.12 4.147 4.12 4.147q.294.268 .294.669t-.281.682zM22.047 22.074v0 0-20.147 0h-20.12v0 20.147 0h20.12zM22.047 24h-20.12q-.803 0-1.365-.562t-.562-1.365v-20.147q0-.776.562-1.351t1.365-.575h20.147q.776 0 1.351.575t.575 1.351v20.147q0 .803-.575 1.365t-1.378.562v0z" />
    </SvgIcon>
  );
}
// --- Custom Tree Item Component ---
// This component renders the "Row" look (Icon | Name | ... | Msg | Date)
const GithubTreeItem = (props: TreeItemProps & { fileType?: 'file' | 'dir', commitMsg?: string, date?: string }) => {
  const { fileType, commitMsg, date, ...other } = props;

  // We use this to detect if we should render a folder or file icon
  const Icon = fileType === 'dir' ? FolderIcon : InsertDriveFileIcon;
  const iconColor = fileType === 'dir' ? GH_COLORS.iconDir : GH_COLORS.iconFile;

  return (
    <TreeItem
      {...other}
      // Custom styling for the Item Root
      sx={{
        '& .MuiTreeItem-content': {
          padding: '8px 16px',
          borderTop: `1px solid ${GH_COLORS.border}`,
          borderRadius: 0,
          gap: 1.5,
          '&:hover': {
            backgroundColor: GH_COLORS.rowHover,
          },
          '&.Mui-selected': {
            backgroundColor: 'rgba(56, 139, 253, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(56, 139, 253, 0.15)',
            },
          },
        },
        // Hide the default expansion icon, we will rely on folder icon logic or add it back if preferred
        '& .MuiTreeItem-iconContainer': {
          display: 'none',
        },
      }}
      // Customizing the Label to include columns
      label={
        <Box display="flex" alignItems="center" width="100%" justifyContent="space-between">
          {/* Left: Icon and Name */}
          <Box display="flex" alignItems="center" gap={1.5} minWidth={200}>
            <Icon sx={{ color: iconColor, fontSize: 20 }} />
            <Typography
              variant="body2"
              sx={{
                color: GH_COLORS.textMain,
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
                fontWeight: fileType === 'dir' ? 600 : 400,
                fontSize: '14px'
              }}
            >
              {other.label}
            </Typography>
          </Box>

          {/* Middle: Commit Message (Hidden on small screens) */}
          <Box flex={1} mx={2} sx={{ display: { xs: 'none', md: 'block' } }}>
            <Typography variant="body2" sx={{ color: GH_COLORS.textMuted, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 300 }}>
              {commitMsg || 'update ' + other.label}
            </Typography>
          </Box>

          {/* Right: Date */}
          <Box sx={{ display: { xs: 'none', sm: 'block' }, minWidth: 80, textAlign: 'right' }}>
            <Typography variant="body2" sx={{ color: GH_COLORS.textMuted, fontSize: '13px' }}>
              {date || '2 mo ago'}
            </Typography>
          </Box>
        </Box>
      }
    />
  );
};

// --- Main Component ---

const GithubEmbed = ({ owner, repo, initialPath = '' }: GithubEmbedProps) => {
  const [items, setItems] = useState<ExtendedTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track which folders have actually fetched their data
  const [fetchedFolders, setFetchedFolders] = useState<Set<string>>(new Set());

  // --- Helpers ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const query = formData.get('search') as string;
    console.log("query:", query);

    try {
      const data = await fetchDirectory(query)
      const treeItems = sortItems(data);
      setItems(treeItems);
      // Mark root as fetched
      setFetchedFolders(new Set([query || 'root']));
    }
    catch (err) {
      console.error("Search failed", err);
    }
  };

  const extractGithubData = (url: string) => {
    
    const regex = /github\.com[:/]([\w-]+)\/([\w-.]+)/;
    
    const match = url.match(regex);
    
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, '') // Remove .git if present
      };
    }
    
    return null;
  };

  // Merge new children into the existing tree structure recursively
  const mergeChildren = useCallback((currentItems: ExtendedTreeItem[], parentId: string, newChildren: ExtendedTreeItem[]): ExtendedTreeItem[] => {
    return currentItems.map((item) => {
      if (item.id === parentId) {
        return { ...item, children: newChildren };
      }
      if (item.children) {
        return {
          ...item,
          children: mergeChildren(item.children as ExtendedTreeItem[], parentId, newChildren)
        };
      }
      return item;
    });
  }, []);

  // Sort: Folders first, then files, alphabetical
  const sortItems = (data: GitHubContent[]): ExtendedTreeItem[] => {
    const sorted = [...data].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });

    return sorted.map((file) => ({
      id: file.path,
      label: file.name, // Add the missing label property
      children: file.type === 'dir' ? [{ id: `${file.path}-loading`, label: 'Loading...', type: 'file' } as ExtendedTreeItem] : undefined,
      type: file.type,
    }));
  };

  // --- API ---

  const fetchDirectory = async (path: string): Promise<GitHubContent[]> => {
    const cleanPath = extractGithubData(path);
    if (cleanPath) {
      owner = cleanPath.owner;
      repo = cleanPath.repo;
    }
  
    // Call your FastAPI backend
    const endpoint = `/api/github/repo-content/${owner}/${repo}/`;
  
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    console.log("Fetched data:", data);
    return Array.isArray(data) ? data : [data];
  };

  // Initial Load
  useEffect(() => {
    const loadRoot = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchDirectory(initialPath);
        const treeItems = sortItems(data);
        setItems(treeItems);
        // Mark root as fetched
        setFetchedFolders(new Set([initialPath || 'root']));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    loadRoot();
  }, [owner, repo, initialPath]);

  // Handle Expansion
  const handleItemExpansion = (event: React.SyntheticEvent | null, itemId: string, isExpanded: boolean) => {
    // If collapsing or if we already fetched this folder, do nothing
    if (!isExpanded || fetchedFolders.has(itemId)) return;

    // Find the item to see if it is a directory
    // (In a real scenario, you might want a faster lookup than searching the tree, but for UI size it's fine)
    (async () => {
      try {
        const data = await fetchDirectory(itemId);
        const newChildren = sortItems(data);

        setItems((prev) => mergeChildren(prev, itemId, newChildren));
        setFetchedFolders((prev) => new Set(prev).add(itemId));
      } catch (err) {
        console.error("Failed to load subfolder", err);
      }
    })();
  };

  if (loading && items.length === 0) return <Box p={3} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box
      sx={{
        maxWidth: 1200,
        border: `2px solid ${GH_COLORS.border}`,
        borderRadius: '12px',
        bgcolor: GH_COLORS.bg,
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <Box
        sx={{
          bgcolor: '#161b22',
          p: '16px',
          borderBottom: `1px solid ${GH_COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <form method="post" onSubmit={handleSubmit} className='w-full flex flex-row gap-2'>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              gap: '8px',       // Adds space between text and input
              cursor: 'text'
            }}
          >
            {/* 1. Prevent wrapping */}
            <span style={{ whiteSpace: 'nowrap', color: GH_COLORS.textMain, fontSize: '14px' }}>
              Repo Search:
            </span>

            <input
              name="search"
              type="text"
              placeholder="Find a file..."
              style={{
                // 2. Allow input to fill remaining space instead of forcing 100%
                flex: 1,
                minWidth: 0,

                padding: '6px 12px',
                borderRadius: '6px',
                border: `1px solid ${GH_COLORS.border}`,
                backgroundColor: '#0d1117',
                color: GH_COLORS.textMain,
                fontSize: '14px',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
                outline: 'none'
              }}
            />
          </label>
          <Box
            component="button"
            type="submit"
            className="whitespace-nowrap px-2 rounded-md border-2" // Tailwind classes work fine here too
            sx={{
              // Default State
              borderColor: GH_COLORS.border,
              color: GH_COLORS.textMuted,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',

              // Hover State
              '&:hover': {
                backgroundColor: GH_COLORS.border, // Darker background on hover
                color: GH_COLORS.textMain,         // Lighter text on hover
                borderColor: GH_COLORS.textMain    // Lighter border on hover
              }
            }}
          >
            Submit form
          </Box>
        </form>
      </Box>
      {/* GitHub-style Header */}
      <Box
        sx={{
          bgcolor: '#161b22',
          p: '16px',
          borderBottom: `1px solid ${GH_COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Box display="flex" alignItems="center" gap={1}>
          <Box
            component="img"
            src={`https://github.com/${owner}.png`}
            sx={{ width: 20, height: 20, borderRadius: '50%' }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600, color: GH_COLORS.textMain }}>
            {owner}
          </Typography>
          <Typography variant="body2" sx={{ color: GH_COLORS.textMuted }}>
            git ignore changes
          </Typography>
        </Box>
        <Typography variant="caption" sx={{ color: GH_COLORS.textMuted }}>
          c00500c • last month
        </Typography>
      </Box>

      {/* Tree View */}
      <Box sx={{ minHeight: 200 }}>
        <RichTreeView
          items={items}
          onItemExpansionToggle={handleItemExpansion}
          defaultExpandedItems={['grid']}
          slots={{
            item: GithubTreeItem,
            expandIcon: AddBoxIcon,
            collapseIcon: IndeterminateCheckBoxIcon,
            endIcon: CloseSquare,
          }}
        />
      </Box>
    </Box>
  );
};

export default GithubEmbed;