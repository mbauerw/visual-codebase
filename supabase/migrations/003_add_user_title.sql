-- Add user_title column for custom analysis display names
ALTER TABLE analyses ADD COLUMN user_title TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN analyses.user_title IS 'User-customizable display name for the analysis. Falls back to auto-generated title when NULL.';
