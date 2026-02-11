-- Add rundown_status column for on-demand rundown generation
ALTER TABLE public.analyses
ADD COLUMN rundown_status text DEFAULT NULL;

-- Allowed values: 'generating', 'completed', 'failed'
-- NULL means rundown has not been requested yet
