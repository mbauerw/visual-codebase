> tsc && vite build

src/components/CategoryNode.tsx:88:9 - error TS6133: 'handleHeaderClick' is declared but its value is never read.

88   const handleHeaderClick = () => {
           ~~~~~~~~~~~~~~~~~

src/components/CategoryNode.tsx:90:11 - error TS6133: 'roleData' is declared but its value is never read.

90     const roleData: CategoryRoleData = {
             ~~~~~~~~

src/components/CateogoryDetailPanel.tsx:1:31 - error TS6133: 'ArrowRight' is declared but its value is never read.

1 import { X, FileCode, Folder, ArrowRight, Hash, Code, Layers, ChevronsLeftRight } from 'lucide-react';
                                ~~~~~~~~~~

src/components/CateogoryDetailPanel.tsx:2:1 - error TS6133: 'ReactFlowNodeData' is declared but its value is never read.

2 import type { ReactFlowNodeData } from '../types';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/CateogoryDetailPanel.tsx:3:22 - error TS6133: 'languageColors' is declared but its value is never read.

3 import { roleColors, languageColors, roleLabels, categoryColors } from '../types';
                       ~~~~~~~~~~~~~~

src/components/CateogoryDetailPanel.tsx:3:50 - error TS6133: 'categoryColors' is declared but its value is never read.

3 import { roleColors, languageColors, roleLabels, categoryColors } from '../types';
                                                   ~~~~~~~~~~~~~~

src/components/CateogoryDetailPanel.tsx:68:9 - error TS6133: 'formatBytes' is declared but its value is never read.

68   const formatBytes = (bytes: number): string => {
           ~~~~~~~~~~~

src/components/GithubEmbed.tsx:1:31 - error TS6133: 'useCallback' is declared but its value is never read.

1 import { useState, useEffect, useCallback } from 'react';
                                ~~~~~~~~~~~

src/components/GithubEmbed.tsx:3:1 - error TS6192: All imports in import declaration are unused.

3 import { TreeItem, TreeItemProps } from '@mui/x-tree-view/TreeItem';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/GithubEmbed.tsx:5:1 - error TS6133: 'AddBoxIcon' is declared but its value is never read.

5 import AddBoxIcon from '@mui/icons-material/AddBox';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/GithubEmbed.tsx:6:1 - error TS6133: 'IndeterminateCheckBoxIcon' is declared but its value is never read.

6 import IndeterminateCheckBoxIcon from '@mui/icons-material/IndeterminateCheckBox';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/GithubEmbed.tsx:7:1 - error TS6192: All imports in import declaration are unused.

7 import SvgIcon, { SvgIconProps } from '@mui/material/SvgIcon';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/GithubEmbed.tsx:13:1 - error TS6133: 'FolderIcon' is declared but its value is never read.

13 import FolderIcon from '@mui/icons-material/Folder';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/GithubEmbed.tsx:14:1 - error TS6133: 'InsertDriveFileIcon' is declared but its value is never read.

14 import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/GithubEmbed.tsx:19:1 - error TS6133: 'Stack' is declared but its value is never read.

19 import Stack from '@mui/material/Stack';
   ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/GithubEmbed.tsx:67:10 - error TS6133: 'newOwner' is declared but its value is never read.

67   const [newOwner, setNewOwner] = useState(owner);
            ~~~~~~~~

src/components/GithubEmbed.tsx:67:20 - error TS6133: 'setNewOwner' is declared but its value is never read.

67   const [newOwner, setNewOwner] = useState(owner);
                      ~~~~~~~~~~~

src/components/GithubEmbed.tsx:254:5 - error TS6133: 'event' is declared but its value is never read.

254     event: React.SyntheticEvent | null,
        ~~~~~

src/components/GithubEmbed.tsx:401:35 - error TS6133: 'event' is declared but its value is never read.

401           onExpandedItemsChange={(event, itemIds) => setExpandedItems(itemIds)}
                                      ~~~~~

src/components/HowItWorksSection.tsx:2:1 - error TS6192: All imports in import declaration are unused.

2 import { Play, Pause } from 'lucide-react';
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/components/NodeDetailPanel.tsx:1:63 - error TS6133: 'ChevronsLeftRight' is declared but its value is never read.

1 import { X, FileCode, Folder, ArrowRight, Hash, Code, Layers, ChevronsLeftRight } from 'lucide-react';
                                                                ~~~~~~~~~~~~~~~~~

src/components/NodeDetailPanel.tsx:13:9 - error TS6133: 'handleExpandToggle' is declared but its value is never read.

13   const handleExpandToggle = () => {
           ~~~~~~~~~~~~~~~~~~

src/components/progress/AnalysisProgressBar.tsx:4:10 - error TS6133: 'useEffect' is declared but its value is never read.

4 import { useEffect, useState } from 'react';
           ~~~~~~~~~

src/components/progress/AnalysisProgressBar.tsx:35:10 - error TS6133: 'fakeProgress' is declared but its value is never read.

35   const [fakeProgress, setFakeProgress] = useState(0);
            ~~~~~~~~~~~~

src/components/progress/AnalysisProgressBar.tsx:35:24 - error TS6133: 'setFakeProgress' is declared but its value is never read.

35   const [fakeProgress, setFakeProgress] = useState(0);
                          ~~~~~~~~~~~~~~~

src/pages/VisualizationPage.tsx:242:11 - error TS6133: 'averageRoleWidth' is declared but its value is never read.

242     const averageRoleWidth = roleDimensions.reduce((sum, d) => sum + d.width, 0) / roleDimensions.length;
              ~~~~~~~~~~~~~~~~

src/pages/VisualizationPage.tsx:243:11 - error TS6133: 'averageRoleHeight' is declared but its value is never read.

243     const averageRoleHeight = roleDimensions.reduce((sum, d) => sum + d.height, 0) / roleDimensions.length;
              ~~~~~~~~~~~~~~~~~

src/pages/VisualizationPage.tsx:628:10 - error TS6133: 'getDependencyHierarchyLayout' is declared but its value is never read.

628 function getDependencyHierarchyLayout(
             ~~~~~~~~~~~~~~~~~~~~~~~~~~~~

src/pages/VisualizationPage.tsx:745:28 - error TS6133: 'index' is declared but its value is never read.

745   fileNodes.forEach((node, index) => {
                               ~~~~~


Found 29 errors in 7 files.

Errors  Files
     2  src/components/CategoryNode.tsx:88
     5  src/components/CateogoryDetailPanel.tsx:1
    12  src/components/GithubEmbed.tsx:1
     1  src/components/HowItWorksSection.tsx:2
     2  src/components/NodeDetailPanel.tsx:1
     3  src/components/progress/AnalysisProgressBar.tsx:4
     4  src/pages/VisualizationPage.tsx:242
maxbauer@Mac frontend % 
