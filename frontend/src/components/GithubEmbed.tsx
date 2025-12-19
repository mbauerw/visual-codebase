import { useState, useEffect, useCallback } from 'react';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';

// GitHub API response type
interface GitHubContent {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir';
  _links: {
    self: string;
    git: string;
    html: string;
  };
}

interface GithubEmbedProps {
  owner: string;
  repo: string;
  initialPath?: string;
}

const GithubEmbed = ({ owner, repo, initialPath = '' }: GithubEmbedProps) => {
  const [files, setFiles] = useState<GitHubContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  
  // Track loaded paths to prevent refetching
  const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set());

  // Helper to ensure we don't duplicate files in state
  const addFiles = useCallback((newFiles: GitHubContent[]) => {
    setFiles((prev) => {
      const existingShas = new Set(prev.map((f) => f.sha));
      const uniqueNewFiles = newFiles.filter((f) => !existingShas.has(f.sha));
      return [...prev, ...uniqueNewFiles];
    });
  }, []);

  // Fetch initial directory
  useEffect(() => {
    // Reset state when props change
    setFiles([]);
    setLoadedPaths(new Set());
    // Ensure we handle the initial path logic correctly
    const path = initialPath.replace(/\/$/, ''); // Remove trailing slash
    fetchDirectory(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo, initialPath]);

  const fetchDirectory = async (path: string) => {
    setLoading(true);
    setError(null);

    try {
      // Handle root path fetching correctly (empty string vs actual path)
      const endpoint = path 
        ? `/api/github/repo-content/${owner}/${repo}/${path}`
        : `/api/github/repo-content/${owner}/${repo}`; // Adjust this URL to match your API route specifically for root

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }

      const data: GitHubContent[] = await response.json();
      
      // Safety check to ensure response is an array
      if (Array.isArray(data)) {
        addFiles(data);
        setLoadedPaths((prev) => new Set(prev).add(path));
      } else {
        console.error("API did not return an array", data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repository');
      console.error('Failed to load repo:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (
    event: React.SyntheticEvent | null,
    itemId: string,
    isExpanded: boolean
  ) => {
    // Only fetch if expanding and not already loaded
    if (isExpanded && !loadedPaths.has(itemId)) {
      try {
        const response = await fetch(
          `/api/github/repo-content/${owner}/${repo}/${itemId}`
        );

        if (response.ok) {
          const children: GitHubContent[] = await response.json();
          if (Array.isArray(children)) {
            addFiles(children);
            setLoadedPaths((prev) => new Set(prev).add(itemId));
          }
        }
      } catch (err) {
        console.error('Failed to load folder contents:', err);
      }
    }
  };

  const renderTree = (items: GitHubContent[], parentPath: string) => {
    // Filter items that belong to the current parentPath
    const currentLevelItems = items.filter((item) => {
      const lastSlashIndex = item.path.lastIndexOf('/');
      // If no slash, parent is root (''). If slash, parent is the substring before it.
      const itemParent = lastSlashIndex === -1 
        ? '' 
        : item.path.substring(0, lastSlashIndex);
      
      return itemParent === parentPath;
    });

    // Sort: Directories first, then files alphabetically
    currentLevelItems.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'dir' ? -1 : 1;
    });

    return currentLevelItems.map((item) => (
      <TreeItem
        key={item.sha} // SHA is more unique than path usually
        itemId={item.path}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
            {item.type === 'dir' ? (
              <FolderIcon color="primary" fontSize="small" />
            ) : (
              <InsertDriveFileIcon color="action" fontSize="small" />
            )}
            <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
              {item.name}
            </Typography>
          </Box>
        }
      >
        {/* Only recursively call if it is a directory */}
        {item.type === 'dir' ? renderTree(items, item.path) : null}
      </TreeItem>
    ));
  };

  if (loading && files.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ minHeight: 400, flexGrow: 1, maxWidth: '100%' }}>
      <SimpleTreeView
        expandedItems={expandedItems}
        onExpandedItemsChange={(event, itemIds) => setExpandedItems(itemIds)}
        onItemExpansionToggle={handleToggle}
      >
        {/* CRITICAL FIX: Pass initialPath here, otherwise it defaults to '' and finds nothing if initialPath is set */}
        {renderTree(files, initialPath)}
      </SimpleTreeView>
    </Box>
  );
};

export default GithubEmbed;