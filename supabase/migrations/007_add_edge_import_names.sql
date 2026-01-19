-- Add columns to analysis_edges for storing actual import symbol names
-- This enables edge labels to show "useState, useEffect" instead of "../hooks"

-- Add imported_names column (array of symbol names imported via this edge)
ALTER TABLE public.analysis_edges
ADD COLUMN imported_names jsonb DEFAULT '[]';

-- Add module_path column (original import path from the source code)
ALTER TABLE public.analysis_edges
ADD COLUMN module_path text;

-- Add comment for documentation
COMMENT ON COLUMN public.analysis_edges.imported_names IS 'Array of symbol names imported (e.g., ["useState", "useEffect"])';
COMMENT ON COLUMN public.analysis_edges.module_path IS 'Original module path from import statement (e.g., "../hooks" or "@/utils")';
