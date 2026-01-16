-- Migration: User Auth Phase 1
-- Adds profile management, account deletion, and password features

-- =============================================
-- 1. Profile Management Enhancements
-- =============================================

-- Add new columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deletion_scheduled_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'email';

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);

-- Create index for scheduled deletions (background job query)
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_scheduled ON public.profiles(deletion_scheduled_at)
  WHERE deletion_scheduled_at IS NOT NULL;

-- =============================================
-- 2. Account Deletion Tracking
-- =============================================

-- Create account deletion requests table
CREATE TABLE IF NOT EXISTS public.account_deletion_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  scheduled_deletion_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'cancelled', 'completed')),
  completed_at TIMESTAMPTZ,
  data_exported BOOLEAN DEFAULT FALSE,
  export_url TEXT,
  export_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_user_id ON public.account_deletion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.account_deletion_requests(status);

-- Enable RLS for deletion requests
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Policies for deletion requests
CREATE POLICY "Users can view their own deletion requests"
  ON public.account_deletion_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deletion requests"
  ON public.account_deletion_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending deletion requests"
  ON public.account_deletion_requests FOR UPDATE
  USING (auth.uid() = user_id AND status = 'pending');

-- =============================================
-- 3. Data Exports
-- =============================================

-- Create data exports table
CREATE TABLE IF NOT EXISTS public.data_exports (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  export_type TEXT NOT NULL CHECK (export_type IN ('full', 'analyses_only', 'profile_only')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired')),
  file_path TEXT,
  file_size_bytes BIGINT,
  download_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_data_exports_user_id ON public.data_exports(user_id);
CREATE INDEX IF NOT EXISTS idx_data_exports_status ON public.data_exports(status);

-- Enable RLS for data exports
ALTER TABLE public.data_exports ENABLE ROW LEVEL SECURITY;

-- Policies for data exports
CREATE POLICY "Users can view their own exports"
  ON public.data_exports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own exports"
  ON public.data_exports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- 4. Password History (for password reset improvements)
-- =============================================

-- Create password history table
CREATE TABLE IF NOT EXISTS public.password_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_history_user_id ON public.password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_created_at ON public.password_history(created_at);

-- Enable RLS (service role only - users cannot query this directly)
ALTER TABLE public.password_history ENABLE ROW LEVEL SECURITY;

-- No user-facing policies - this table is only accessed via backend service role

-- =============================================
-- 5. Password Policy Configuration
-- =============================================

-- Create password policy table
CREATE TABLE IF NOT EXISTS public.password_policy (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  min_length INTEGER DEFAULT 8,
  require_uppercase BOOLEAN DEFAULT TRUE,
  require_lowercase BOOLEAN DEFAULT TRUE,
  require_number BOOLEAN DEFAULT TRUE,
  require_special BOOLEAN DEFAULT TRUE,
  history_count INTEGER DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default policy
INSERT INTO public.password_policy (min_length, require_uppercase, require_lowercase, require_number, require_special, history_count)
VALUES (8, TRUE, TRUE, TRUE, TRUE, 5)
ON CONFLICT DO NOTHING;

-- Enable RLS for password policy (read-only for all authenticated users)
ALTER TABLE public.password_policy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read password policy"
  ON public.password_policy FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- 6. Update User Profile Trigger
-- =============================================

-- Update the handle_new_user function to capture auth provider
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, auth_provider)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_app_meta_data->>'provider', 'email')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- 7. Security Audit Log (optional but useful)
-- =============================================

-- Create security events table for audit logging
CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON public.security_events(created_at);

-- Enable RLS for security events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own security events"
  ON public.security_events FOR SELECT
  USING (auth.uid() = user_id);

-- =============================================
-- 8. Triggers for updated_at
-- =============================================

-- Create trigger for account_deletion_requests
CREATE TRIGGER set_updated_at_deletion_requests
  BEFORE UPDATE ON public.account_deletion_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create trigger for data_exports
CREATE TRIGGER set_updated_at_data_exports
  BEFORE UPDATE ON public.data_exports
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
