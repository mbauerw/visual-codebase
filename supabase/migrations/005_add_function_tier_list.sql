-- Migration: 005_add_function_tier_list
-- Description: Add tables for function-level analysis and tier list feature

-- Update analysis status enum
ALTER TABLE public.analyses
DROP CONSTRAINT IF EXISTS analyses_status_check;

ALTER TABLE public.analyses
ADD CONSTRAINT analyses_status_check
CHECK (status IN (
  'pending',
  'cloning',
  'parsing',
  'analyzing',
  'analyzing_functions',
  'building_graph',
  'generating_summary',
  'completed',
  'failed'
));

-- Add function stats to analyses table
ALTER TABLE public.analyses
ADD COLUMN IF NOT EXISTS function_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS function_call_count integer DEFAULT 0;

-- Main functions table
CREATE TABLE IF NOT EXISTS public.analysis_functions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,
  node_id text NOT NULL,

  -- Function identification
  function_name text NOT NULL,
  qualified_name text NOT NULL,
  function_type text NOT NULL CHECK (function_type IN (
    'function', 'method', 'arrow_function', 'constructor', 'hook', 'callback'
  )),

  -- Location
  start_line integer NOT NULL,
  end_line integer,

  -- Metrics
  internal_call_count integer DEFAULT 0,
  external_call_count integer DEFAULT 0,
  is_exported boolean DEFAULT false,
  is_entry_point boolean DEFAULT false,

  -- Tier classification
  tier text CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'F')),
  tier_percentile float,

  -- Metadata
  language text NOT NULL,
  is_async boolean DEFAULT false,
  parameters_count integer DEFAULT 0,

  created_at timestamptz DEFAULT now(),

  UNIQUE(analysis_id, node_id, qualified_name, start_line)
);

-- Function call graph table
CREATE TABLE IF NOT EXISTS public.analysis_function_calls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_id uuid NOT NULL REFERENCES public.analyses(id) ON DELETE CASCADE,

  -- Caller
  caller_function_id uuid REFERENCES public.analysis_functions(id) ON DELETE CASCADE,
  caller_node_id text NOT NULL,
  call_line integer,

  -- Callee
  callee_qualified_name text NOT NULL,
  callee_node_id text,
  callee_function_id uuid REFERENCES public.analysis_functions(id) ON DELETE SET NULL,

  -- Call context
  call_type text CHECK (call_type IN (
    'function', 'method', 'constructor', 'static_method', 'iife'
  )),

  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_functions_analysis ON public.analysis_functions(analysis_id);
CREATE INDEX IF NOT EXISTS idx_functions_node ON public.analysis_functions(analysis_id, node_id);
CREATE INDEX IF NOT EXISTS idx_functions_tier ON public.analysis_functions(analysis_id, tier);
CREATE INDEX IF NOT EXISTS idx_functions_call_count ON public.analysis_functions(analysis_id, internal_call_count DESC);
CREATE INDEX IF NOT EXISTS idx_functions_name ON public.analysis_functions(analysis_id, function_name);

-- Full text search for function names
CREATE INDEX IF NOT EXISTS idx_functions_name_search ON public.analysis_functions
  USING gin(to_tsvector('english', function_name));

CREATE INDEX IF NOT EXISTS idx_function_calls_analysis ON public.analysis_function_calls(analysis_id);
CREATE INDEX IF NOT EXISTS idx_function_calls_caller ON public.analysis_function_calls(caller_function_id);
CREATE INDEX IF NOT EXISTS idx_function_calls_callee ON public.analysis_function_calls(callee_function_id);

-- Covering index for common tier list query
CREATE INDEX IF NOT EXISTS idx_functions_tier_list ON public.analysis_functions(
  analysis_id, tier, internal_call_count DESC
) INCLUDE (function_name, qualified_name, node_id);

-- RLS Policies
ALTER TABLE public.analysis_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_function_calls ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view functions from their analyses" ON public.analysis_functions;
DROP POLICY IF EXISTS "Users can view function calls from their analyses" ON public.analysis_function_calls;
DROP POLICY IF EXISTS "Service can insert functions" ON public.analysis_functions;
DROP POLICY IF EXISTS "Service can insert function calls" ON public.analysis_function_calls;

CREATE POLICY "Users can view functions from their analyses"
  ON public.analysis_functions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = analysis_functions.analysis_id
      AND analyses.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view function calls from their analyses"
  ON public.analysis_function_calls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.analyses
      WHERE analyses.id = analysis_function_calls.analysis_id
      AND analyses.user_id = auth.uid()
    )
  );

-- Service role policies for insert
CREATE POLICY "Service can insert functions"
  ON public.analysis_functions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service can insert function calls"
  ON public.analysis_function_calls FOR INSERT
  WITH CHECK (true);
