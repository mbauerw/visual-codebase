import { useState, useEffect } from 'react';
import { RichTreeView } from '@mui/x-tree-view/RichTreeView';
import { TreeViewBaseItem } from '@mui/x-tree-view/models';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { File } from 'lucide-react';

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


// --- Custom Tree Item Component ---
// This component renders the "Row" look (Icon | Name | ... | Msg | Date)

// --- Main Component ---

const GithubEmbed = ({ owner, repo, initialPath = '' }: GithubEmbedProps) => {
  const [items, setItems] = useState<ExtendedTreeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [activeOwner, setActiveOwner] = useState(owner);
  const [activeRepo, setActiveRepo] = useState(repo);


  // Track which folders have actually fetched their data
  const [fetchedFolders, setFetchedFolders] = useState<Set<string>>(new Set());

  // --- Helpers ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const query = formData.get('search') as string;
  
    try {
      setLoading(true);
      setError(null);
      
      // Reset tree states for the new repository
      setExpandedItems([]);
      setFetchedFolders(new Set()); 
  
      const data = await fetchDirectory(query);
      // data.forEach(item => {
      //   console.log("The Item Type is:", item.type);
      //   if (item.type === 'dir') {
      //     console.log('Directory name:', item.name);
      //     console.log('Directory path:', item.path);
      //     item.array.forEach(element => {
            
      //     });
      //   }
      //   if (item.type === 'file') {
      //     console.log('File url:', item.url);
      //     console.log('File type:', item.type);
      //   }
        
      // });  

      const treeItems = sortItems(data);
    //   treeItems.forEach(item => {
    //     if (item.type === 'dir') {
    //       console.log('Directory found:', item.id);
    //       console.log('Directory children:', item.children);
    //     }
    //     if (item.type === 'file') {
    //       console.log('File found:', item.id);
    //       console.log('File type:', item.type);
    //     }
    
    // });
      setItems(treeItems);
      
      // Mark the new root as fetched
      setFetchedFolders(new Set([''])); 
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
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
  // const mergeChildren = useCallback((currentItems: ExtendedTreeItem[], parentId: string, newChildren: ExtendedTreeItem[]): string[] => {
  //   return currentItems.map((item) => {
  //     if (item.id === parentId) {
  //       return { ...item, children: newChildren };
  //     }
  //     if (item.children) {
  //       return {
  //         ...item,
  //         children: mergeChildren(item.children as string[], parentId, newChildren)
  //       };
  //     }
  //     return item;
  //   });
  // }, []);

  // Sort: Folders first, then files, alphabetical
  const sortItems = (data: GitHubContent[]): ExtendedTreeItem[] => {
    const sorted = [...data].sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });

    return sorted.map((file) => ({
      id: file.path,
      label: file.name,
      children: file.type === 'dir'
        ? [{ id: `loading-${file.path}`, label: 'Loading...', type: 'file' } as ExtendedTreeItem]
        : undefined,
      type: file.type,
    }));
  };

  // --- API ---

  const fetchDirectory = async (path: string): Promise<GitHubContent[]> => {
    // Use let so we can override them if a URL is provided
    let targetOwner = activeOwner;
    let targetRepo = activeRepo;
    let subPath = path;
  
    const cleanPathData = extractGithubData(path);
    
    if (cleanPathData) {
      // 1. We found a new Repo URL! Update our local variables for this fetch...
      targetOwner = cleanPathData.owner;
      targetRepo = cleanPathData.repo;
      subPath = ''; 
      
      // ...and update State so future folder clicks use this new repo
      setActiveOwner(targetOwner);
      setActiveRepo(targetRepo);
    }
  
    // 2. Build the endpoint using the resolved owner/repo
    const endpoint = `/api/github/repo-content/${targetOwner}/${targetRepo}/${subPath}`;
  
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`Status ${response.status} for ${endpoint}`);
    
    const data = await response.json();
    console.log("Fetched GitHub data:", data);

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

  // Update Tree
  // Helper to recursively update children in the tree structure
  const updateTreeItems = (
    currentItems: ExtendedTreeItem[],
    parentId: string,
    newChildren: ExtendedTreeItem[]
  ): ExtendedTreeItem[] => {
    return currentItems.map((item) => {
      if (item.id === parentId) {
        return { ...item, children: newChildren };
      }
      if (item.children) {
        return {
          ...item,
          children: updateTreeItems(item.children as ExtendedTreeItem[], parentId, newChildren),
        };
      }
      return item;
    });
  };

  // Handle Expansion
  const handleItemExpansion = async (
    _event: React.SyntheticEvent | null,
    itemId: string,
    isExpanded: boolean
  ) => {
    // 1. Handle the visual expansion (Controlled state)
    setExpandedItems((prev) =>
      isExpanded ? [...prev, itemId] : prev.filter((id) => id !== itemId)
    );

    // 2. Handle lazy loading
    // Only fetch if we are expanding and haven't fetched this folder yet
    if (isExpanded && !fetchedFolders.has(itemId)) {
      try {
        const data = await fetchDirectory(itemId);
        const newChildren = sortItems(data);

        // Update the tree structure
        setItems((prevItems) => updateTreeItems(prevItems, itemId, newChildren));

        // Mark as fetched so we don't call the API again
        setFetchedFolders((prev) => new Set(prev).add(itemId));
      } catch (err) {
        console.error("Failed to load subfolder", err);
      }
    }
  };

  if (loading && items.length === 0) return <Box p={3} display="flex" justifyContent="center"><CircularProgress /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Box
      sx={{
        maxWidth: 1200,
        minHeight: '100%',
        height: '100%',
        border: `2px solid ${GH_COLORS.border}`,
        borderRadius: '12px',
        bgcolor: GH_COLORS.bg,
        overflow: 'auto',
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
            src={`https://github.com/${activeOwner}.png`}
            sx={{ width: 20, height: 20, borderRadius: '50%' }}
          />
          <Typography variant="body2" sx={{ fontWeight: 600, color: GH_COLORS.textMain }}>
            {activeOwner}/{activeRepo}
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
          expandedItems={expandedItems}
          onItemExpansionToggle={handleItemExpansion}
          onExpandedItemsChange={(_event, itemIds) => setExpandedItems(itemIds)}
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
                '&:hover': { backgroundColor: 'rgba(56, 139, 253, 0.2)' }
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
          slots={{
            collapseIcon: ExpandMoreIcon,
            expandIcon: ChevronRightIcon,
            endIcon: File
          }}
        />
      </Box>
    </Box>
  );
};

export default GithubEmbed;