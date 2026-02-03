"""Configuration settings for the backend application."""
import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Keys
    anthropic_api_key: str = ""

    # Supabase settings
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Application settings
    app_name: str = "Codebase Remap API"
    debug: bool = False

    # Analysis settings
    max_files_per_batch: int = 20
    max_file_size_bytes: int = 100000  # 100KB max per file
    supported_extensions: list[str] = [".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".cs", ".go", ".rs", ".swift"]

    # LLM settings
    llm_model: str = "claude-sonnet-4-20250514"
    llm_max_tokens: int = 4096
    llm_parallel_batches: int = 4  # Number of batches to process concurrently

    # Redis settings (optional, for distributed rate limiting)
    redis_url: str = ""  # e.g., "redis://localhost:6379/0"

    # Rate limiting settings
    rate_limit_requests: int = 20  # Max requests per window
    rate_limit_window: int = 60  # Window in seconds

    # Github settings
    github_token: str = Field(..., description="GitHub API token")
    github_secret: str = Field(..., description="GitHub Secret")

    # Demo analysis (publicly accessible without authentication)
    demo_analysis_id: str = "6475bbb4-4362-495a-81de-346128526055"


    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
