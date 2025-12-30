-- Add file contents storage for source code viewing
-- Migration: 004_add_file_contents
-- Strategy: Store content for GitHub repos (temp clone deleted after analysis)
-- Local directories can fetch on-demand from filesystem

-- Create table for storing file contents
CREATE TABLE public.analysis_file_contents (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  node_id text NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),

  -- Ensure unique content per file per analysis
  UNIQUE(analysis_id, node_id)
);

-- Index for efficient lookups by analysis and node
CREATE INDEX idx_file_contents_analysis_node
ON public.analysis_file_contents(analysis_id, node_id);

-- Enable RLS
ALTER TABLE public.analysis_file_contents ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only read file contents for their own analyses
CREATE POLICY "Users can read own file contents"
ON public.analysis_file_contents
FOR SELECT
USING (
  analysis_id IN (
    SELECT id FROM public.analyses WHERE user_id = auth.uid()
  )
);

-- RLS Policy: Service role can insert file contents (used by backend)
CREATE POLICY "Service role can insert file contents"
ON public.analysis_file_contents
FOR INSERT
WITH CHECK (true);

-- Add comment explaining the table
COMMENT ON TABLE public.analysis_file_contents IS
'Stores source code content for files in analyses.
Only populated for GitHub repository analyses since the temp clone is deleted after analysis.
Local directory analyses can fetch content on-demand from the filesystem.';

COMMENT ON COLUMN public.analysis_file_contents.node_id IS
'Matches the node_id in analysis_nodes table - typically the relative file path';

COMMENT ON COLUMN public.analysis_file_contents.content IS
'Raw source code content of the file';
