-- Add rundown columns to analyses table
ALTER TABLE public.analyses
ADD COLUMN rundown jsonb DEFAULT NULL,
ADD COLUMN rundown_generated_at timestamptz DEFAULT NULL;

-- Update status check constraint to include new generating_rundown step
ALTER TABLE public.analyses DROP CONSTRAINT IF EXISTS analyses_status_check;
ALTER TABLE public.analyses ADD CONSTRAINT analyses_status_check
CHECK (status IN (
  'pending', 'cloning', 'parsing', 'analyzing',
  'analyzing_functions', 'building_graph', 'generating_summary',
  'generating_rundown', 'completed', 'failed'
));

-- Add index for querying analyses with rundowns
CREATE INDEX idx_analyses_rundown_exists
ON public.analyses ((rundown IS NOT NULL));
