-- Add codebase summary feature to analyses table
-- Migration: 002_add_codebase_summary

-- Add summary columns to analyses table
ALTER TABLE public.analyses
ADD COLUMN summary jsonb DEFAULT NULL,
ADD COLUMN readme_detected boolean DEFAULT false,
ADD COLUMN summary_generated_at timestamptz DEFAULT NULL;

-- Add index for querying analyses with summaries
CREATE INDEX idx_analyses_summary_exists
ON public.analyses ((summary IS NOT NULL));

-- Update status check constraint to include new summary generation step
ALTER TABLE public.analyses
DROP CONSTRAINT IF EXISTS analyses_status_check;

ALTER TABLE public.analyses
ADD CONSTRAINT analyses_status_check
CHECK (status IN (
  'pending',
  'cloning',
  'parsing',
  'analyzing',
  'building_graph',
  'generating_summary',
  'completed',
  'failed'
));

-- Add comment explaining the summary structure
COMMENT ON COLUMN public.analyses.summary IS
'AI-generated codebase summary with structure:
{
  "project_type": "web_app|api|library|cli|monorepo|mobile_app|unknown",
  "primary_purpose": "1-2 sentence description",
  "tech_stack": {
    "languages": ["TypeScript", "Python"],
    "frameworks": ["React", "FastAPI"],
    "key_patterns": ["Component-based", "RESTful API"]
  },
  "architecture_summary": "2-3 sentence architecture overview",
  "key_modules": [
    {"name": "module_name", "purpose": "brief description"}
  ],
  "complexity_assessment": {
    "level": "simple|moderate|complex",
    "reasoning": "1 sentence explanation"
  },
  "notable_aspects": ["interesting finding 1", "finding 2"]
}';

COMMENT ON COLUMN public.analyses.readme_detected IS
'Whether a README file was found and analyzed during summary generation';

COMMENT ON COLUMN public.analyses.summary_generated_at IS
'Timestamp when the summary was generated';
