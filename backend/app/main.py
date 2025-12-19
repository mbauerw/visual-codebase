"""Main FastAPI application for Visual Codebase."""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
from dotenv import load_dotenv

from .api.routes import router
from .config import get_settings

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


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health",
    }

@app.get("/api/github/repo-content/{owner}/{repo}/{path:path}")
async def get_github_repo_content(owner: str, repo: str, path: str = ""):
    """
    Fetches file or folder content from GitHub.
    """
    github_url = f"https://api.github.com/repos/{owner}/{repo}/contents/{path}"

    async with httpx.AsyncClient() as client:
        response = await client.get(github_url, headers=HEADERS)

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code, 
            detail=response.json().get("message", "GitHub API error")
        )
    
    return response.json()

