import { useState, useEffect, memo } from 'react';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';

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
  const [loadedPaths, setLoadedPaths] = useState<Set<string>>(new Set([initialPath]));

  // Fetch initial directory
  useEffect(() => {
    fetchDirectory(initialPath);
  }, [owner, repo, initialPath]);

  const fetchDirectory = async (path: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/github/repo-content/${owner}/${repo}/${path}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.statusText}`);
      }
      
      const data: GitHubContent[] = await response.json();
      setFiles(data);
      setLoadedPaths(prev => new Set(prev).add(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load repository');
      console.error('Failed to load repo:', err);
    } finally {
      setLoading(false);
    }
  };

  // Handle folder expansion - lazy load children
  const handleToggle = async (
    event: React.SyntheticEvent | null,
    itemId: string,
    isExpanded: boolean
  ) => {
    if (isExpanded && !loadedPaths.has(itemId)) {
      // Fetch children for this folder
      try {
        const response = await fetch(
          `/api/github/repo-content/${owner}/${repo}/${itemId}`
        );
        
        if (response.ok) {
          const children: GitHubContent[] = await response.json();
          
          // Update files state by adding children
          setFiles(prev => [...prev, ...children]);
          setLoadedPaths(prev => new Set(prev).add(itemId));
        }
      } catch (err) {
        console.error('Failed to load folder contents:', err);
      }
    }
  };

  // Build tree structure recursively
  const renderTree = (items: GitHubContent[], parentPath: string = '') => {
    const currentLevelItems = items.filter(item => {
      const itemParent = item.path.substring(0, item.path.lastIndexOf('/'));
      return itemParent === parentPath;
    });

    return currentLevelItems.map((item) => (
      <TreeItem
        key={item.sha}
        itemId={item.path}
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {item.type === 'dir' ? (
              <FolderIcon color="primary" fontSize="small" />
            ) : (
              <InsertDriveFileIcon color="action" fontSize="small" />
            )}
            <span>{item.name}</span>
          </Box>
        }
      >
        {item.type === 'dir' && renderTree(items, item.path)}
      </TreeItem>
    ));
  };

  if (loading && files.length === 0) {
    return (
      <Box display="flex" justifyContent="center" p={3}>
        <CircularProgress />
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
    <Box sx={{ minHeight: 400, flexGrow: 1, maxWidth: 600 }}>
      <SimpleTreeView
        expandedItems={expandedItems}
        onExpandedItemsChange={(event, itemIds) => setExpandedItems(itemIds)}
        onItemExpansionToggle={handleToggle}
      >
        {renderTree(files)}
      </SimpleTreeView>
    </Box>
  );
};

export default GithubEmbed;