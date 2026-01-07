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
    app_name: str = "Visual Codebase API"
    debug: bool = False

    # Analysis settings
    max_files_per_batch: int = 20
    max_file_size_bytes: int = 100000  # 100KB max per file
    supported_extensions: list[str] = [".js", ".jsx", ".ts", ".tsx", ".py"]

    # LLM settings
    llm_model: str = "claude-sonnet-4-20250514"
    llm_max_tokens: int = 4096
    llm_parallel_batches: int = 4  # Number of batches to process concurrently

    # Github settings
    github_token: str = Field(..., description="GitHub API token")
    github_secret: str = Field(..., description="GitHub Secret")


    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
