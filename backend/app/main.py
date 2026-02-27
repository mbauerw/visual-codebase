"""Main FastAPI application for Codebase Remap."""
import re
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv

from .api.routes import router
from .api.chat import router as chat_router
from .auth import get_current_user
from .settings import get_settings

load_dotenv()

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="API for analyzing codebases and generating dependency graphs",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router)
app.include_router(chat_router)


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }

# Validation pattern for GitHub owner/repo names
_GITHUB_NAME_PATTERN = re.compile(r'^[a-zA-Z0-9\-_.]+$')

@app.get("/api/github/repo-content/{owner}/{repo}/{path:path}")
async def get_github_repo_content(
    owner: str,
    repo: str,
    path: str = "",
    current_user=Depends(get_current_user),
):
    """
    Fetches file or folder content from GitHub.
    Requires authentication to prevent abuse of server's GitHub token.
    """
    # Validate owner and repo to prevent path injection
    if not _GITHUB_NAME_PATTERN.match(owner) or not _GITHUB_NAME_PATTERN.match(repo):
        raise HTTPException(status_code=400, detail="Invalid owner or repo name")

    # Reject path traversal attempts
    if ".." in path:
        raise HTTPException(status_code=400, detail="Invalid path")

    github_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"

    async with httpx.AsyncClient() as client:
        response = await client.get(github_url, headers=HEADERS)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail="GitHub API error"
        )

    return response.json()

