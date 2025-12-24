"""Supabase configuration and client setup."""
import os
from supabase import create_client, Client
from typing import Optional

class SupabaseConfig:
    """Configuration for Supabase client."""
    
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL")
        self.anon_key = os.getenv("SUPABASE_ANON_KEY")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.url or not self.anon_key:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
    
    def create_client(self, use_service_role: bool = False) -> Client:
        """Create a Supabase client.
        
        Args:
            use_service_role: If True, use service role key for admin operations
        """
        key = self.service_role_key if use_service_role else self.anon_key
        if use_service_role and not self.service_role_key:
            raise ValueError("SUPABASE_SERVICE_ROLE_KEY must be set for admin operations")
        
        return create_client(self.url, key)

# Global instances
_config: Optional[SupabaseConfig] = None
_client: Optional[Client] = None
_admin_client: Optional[Client] = None

def get_supabase_config() -> SupabaseConfig:
    """Get or create the Supabase configuration."""
    global _config
    if _config is None:
        _config = SupabaseConfig()
    return _config

def get_supabase_client() -> Client:
    """Get or create the Supabase client (user-level operations)."""
    global _client
    if _client is None:
        config = get_supabase_config()
        _client = config.create_client(use_service_role=False)
    return _client

def get_supabase_admin_client() -> Client:
    """Get or create the Supabase admin client (service role operations)."""
    global _admin_client
    if _admin_client is None:
        config = get_supabase_config()
        _admin_client = config.create_client(use_service_role=True)
    return _admin_client