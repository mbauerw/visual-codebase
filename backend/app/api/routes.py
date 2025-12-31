import asyncio
import re
from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException, Depends, Header
from pathlib import Path
from typing import Optional
import logging

from ..models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisStatus,
    AnalysisStatusResponse,
    ReactFlowGraph,
    GitHubRepoInfo,
    UpdateAnalysisRequest,
)
from ..services.analysis import get_analysis_service
from ..services.database import get_database_service
from ..services.github import GitHubService
from ..auth import get_current_user, get_optional_user
from ..security import validate_path_within_base, PathTraversalError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["analysis"])

# @router.post("/getdirectory") 


@router.post("/analyze", response_model=AnalyzeResponse)
async def start_analysis(
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_optional_user),
    x_github_token: Optional[str] = Header(None, alias="X-GitHub-Token"),
) -> AnalyzeResponse:
    """
    Start a codebase analysis.

    This endpoint initiates an asynchronous analysis of the specified directory
    or GitHub repository. Returns an analysis ID that can be used to check
    progress and retrieve results.
    """
    service = get_analysis_service()
    db_service = get_database_service()

    # Determine the analysis path
    if request.github_repo:
        # GitHub repository analysis
        logger.info(f"Starting GitHub repository analysis: {request.github_repo.owner}/{request.github_repo.repo}")

        # Create analysis ID with GitHub repo info
        analysis_id = service.create_job(
            f"github:{request.github_repo.owner}/{request.github_repo.repo}"
        )

        # If user is authenticated, store in database with GitHub info
        if current_user:
            await db_service.create_analysis(
                analysis_id=analysis_id,
                user_id=current_user.id,
                directory_path=request.directory_path or '/',
                github_repo=request.github_repo,
            )

        # Start GitHub analysis in background
        background_tasks.add_task(
            _run_github_analysis,
            service,
            analysis_id,
            request.github_repo,
            request.include_node_modules,
            request.max_depth,
            current_user.id if current_user else None,
            x_github_token,
        )

        return AnalyzeResponse(
            analysis_id=analysis_id,
            status=AnalysisStatus.PENDING,
            message="GitHub repository analysis started. Use the status endpoint to track progress.",
        )
    else:
        # Local directory analysis
        logger.info(f"Starting local directory analysis: {request.directory_path}")

        analysis_id = service.create_job(request.directory_path)

        # If user is authenticated, store in database
        if current_user:
            await db_service.create_analysis(
                analysis_id=analysis_id,
                user_id=current_user.id,
                directory_path=request.directory_path,
            )

        # Start the analysis in the background
        background_tasks.add_task(
            service.run_analysis,
            analysis_id,
            request.include_node_modules,
            request.max_depth,
            current_user.id if current_user else None,
        )

        return AnalyzeResponse(
            analysis_id=analysis_id,
            status=AnalysisStatus.PENDING,
            message="Analysis started. Use the status endpoint to track progress.",
        )


async def _run_github_analysis(
    service,
    analysis_id: str,
    repo_info: GitHubRepoInfo,
    include_node_modules: bool,
    max_depth: Optional[int],
    user_id: Optional[str],
    github_token: Optional[str],
):
    """Run analysis for a GitHub repository."""
    temp_dir = None
    try:
        # Update status to cloning
        job = service.get_job(analysis_id)
        if job:
            job.status = AnalysisStatus.CLONING
            job.progress = 5.0
            job.current_step = "Cloning repository from GitHub..."

        # Clone the repository
        github_service = GitHubService(access_token=github_token)
        temp_dir = await github_service.clone_repository(repo_info)

        logger.info(f"Repository cloned to {temp_dir}")

        # Update job's directory_path to the cloned location
        if job:
            job.directory_path = str(temp_dir)

        # Run analysis on the cloned directory
        # is_github_analysis=True ensures file contents are stored (repo is deleted after)
        await service.run_analysis(
            analysis_id,
            include_node_modules,
            max_depth,
            user_id,
            is_github_analysis=True,
        )

    except Exception as e:
        logger.error(f"GitHub analysis failed: {str(e)}")
        job = service.get_job(analysis_id)
        if job:
            job.status = AnalysisStatus.FAILED
            job.progress = 0.0
            job.error = str(e)
    finally:
        # Clean up temporary directory
        if temp_dir:
            GitHubService.cleanup(temp_dir)


@router.get("/analysis/{analysis_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(
    analysis_id: str, 
    current_user = Depends(get_optional_user)
) -> AnalysisStatusResponse:
    """
    Get the status of an analysis job.

    Returns the current progress and status of the analysis.
    """
    service = get_analysis_service()
    db_service = get_database_service()
    
    # Try to get status from database first if user is authenticated
    if current_user:
        status = await db_service.get_analysis_status(analysis_id)
        if status:
            return status
    
    # Fallback to in-memory status
    status = service.get_status(analysis_id)

    if not status:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return status


@router.get("/analysis/{analysis_id}", response_model=ReactFlowGraph)
async def get_analysis_result(
    analysis_id: str,
    current_user = Depends(get_optional_user)
) -> ReactFlowGraph:
    """
    Get the result of a completed analysis.

    Returns the dependency graph in React Flow format.
    """
    service = get_analysis_service()
    db_service = get_database_service()

    # Try to get result from database first if user is authenticated
    if current_user:
        result = await db_service.get_analysis_result(analysis_id)
        if result:
            return result

    # Fallback to in-memory result
    # First check the status
    status = service.get_status(analysis_id)
    if not status:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if status.status == AnalysisStatus.FAILED:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {status.error}",
        )

    if status.status != AnalysisStatus.COMPLETED:
        raise HTTPException(
            status_code=202,
            detail="Analysis still in progress",
            headers={"Retry-After": "2"},
        )

    result = service.get_result(analysis_id)
    if not result:
        raise HTTPException(status_code=500, detail="Result not available")

    return result


@router.get("/user/analyses")
async def get_user_analyses(current_user = Depends(get_current_user)):
    """Get all analyses for the authenticated user."""
    db_service = get_database_service()
    analyses = await db_service.get_user_analyses(current_user.id)
    return {"analyses": analyses}


@router.delete("/analysis/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user = Depends(get_current_user)
):
    """Delete an analysis (authenticated users only)."""
    db_service = get_database_service()
    success = await db_service.delete_analysis(analysis_id, current_user.id)

    if not success:
        raise HTTPException(status_code=404, detail="Analysis not found or not owned by user")

    return {"message": "Analysis deleted successfully"}


@router.patch("/analysis/{analysis_id}")
async def update_analysis(
    analysis_id: str,
    request: UpdateAnalysisRequest,
    current_user = Depends(get_current_user)
):
    """Update analysis metadata (authenticated users only)."""
    db_service = get_database_service()
    success = await db_service.update_analysis_title(
        analysis_id=analysis_id,
        user_id=current_user.id,
        user_title=request.user_title,
    )

    if not success:
        raise HTTPException(status_code=404, detail="Analysis not found or not owned by user")

    return {"message": "Analysis updated successfully"}


@router.get("/analysis/{analysis_id}/file/{node_id:path}/content")
async def get_file_content(
    analysis_id: str,
    node_id: str,
    current_user = Depends(get_current_user),
):
    """
    Get file content for a specific node in an analysis.

    For GitHub analyses: Returns stored content from database.
    For local analyses: Returns info about filesystem path (content not stored).
    """
    db_service = get_database_service()
    result = await db_service.get_file_content(
        analysis_id=analysis_id,
        node_id=node_id,
        user_id=current_user.id,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    if not result.get("available"):
        if result.get("source") == "filesystem":
            # For local analyses, try to read from filesystem
            import os
            directory_path = result.get("directory_path")
            relative_path = result.get("file_path")  # The actual relative path from the node
            if directory_path and relative_path:
                # Validate path to prevent path traversal attacks
                try:
                    validated_path = validate_path_within_base(
                        directory_path,
                        relative_path,
                        error_message="Invalid file path: path traversal detected"
                    )
                except PathTraversalError:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid file path: path traversal detected"
                    )

                if validated_path.exists() and validated_path.is_file():
                    try:
                        with open(validated_path, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                        return {
                            "content": content,
                            "source": "filesystem",
                            "available": True,
                        }
                    except Exception as e:
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to read file: {str(e)}"
                        )
            raise HTTPException(
                status_code=404,
                detail="File not found on filesystem. The original directory may have been moved or deleted."
            )
        else:
            raise HTTPException(
                status_code=404,
                detail=result.get("error", "Content not available")
            )

    return result


# GitHub username validation: alphanumeric and hyphens, 1-39 chars, cannot start/end with hyphen
GITHUB_USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9]([a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$|^[a-zA-Z0-9]$')


def validate_github_username(username: str) -> bool:
    """Validate GitHub username format.

    GitHub username rules:
    - 1-39 characters
    - Alphanumeric characters or hyphens
    - Cannot start or end with a hyphen
    - Cannot have consecutive hyphens
    """
    if not username or len(username) > 39:
        return False
    if '--' in username:
        return False
    return bool(GITHUB_USERNAME_PATTERN.match(username))


@router.get("/github/repos")
async def get_github_repositories(
    page: int = 1,
    per_page: int = 30,
    sort: str = "updated",
    direction: str = "desc",
    type: str = "all",
    current_user = Depends(get_current_user),
    x_github_token: Optional[str] = Header(None, alias="X-GitHub-Token"),
):
    """
    Get GitHub repositories for the authenticated user.

    Requires GitHub OAuth token in X-GitHub-Token header.
    """
    if not x_github_token:
        raise HTTPException(
            status_code=401,
            detail="GitHub token required. Please authenticate with GitHub.",
        )

    try:
        github_service = GitHubService(access_token=x_github_token)
        result = await github_service.list_user_repos(
            page=page,
            per_page=per_page,
            sort=sort,
            direction=direction,
            repo_type=type,
        )
        return result
    except Exception as e:
        logger.error(f"Failed to fetch GitHub repositories: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch repositories: {str(e)}",
        )


@router.get("/github/users/{owner}/repos")
async def get_owner_repositories(
    owner: str,
    page: int = 1,
    per_page: int = 30,
    sort: str = "updated",
    direction: str = "desc",
    current_user = Depends(get_current_user),
    x_github_token: Optional[str] = Header(None, alias="X-GitHub-Token"),
):
    """
    Get public repositories for a specific GitHub user or organization.

    This endpoint returns only public repositories. Private repositories
    are not accessible via this endpoint.

    Args:
        owner: GitHub username or organization name
        page: Page number (default: 1)
        per_page: Results per page (default: 30, max: 100)
        sort: Sort field - created, updated, pushed, full_name (default: updated)
        direction: Sort direction - asc or desc (default: desc)
    """
    # Validate owner username format
    if not validate_github_username(owner):
        raise HTTPException(
            status_code=400,
            detail="Invalid GitHub username format. Usernames must be 1-39 characters, "
                   "alphanumeric or hyphens, and cannot start/end with a hyphen.",
        )

    try:
        # Use GitHub token if available (for rate limits), but not required
        github_service = GitHubService(access_token=x_github_token)
        result = await github_service.list_owner_repos(
            owner=owner,
            page=page,
            per_page=per_page,
            sort=sort,
            direction=direction,
        )
        return result
    except RuntimeError as e:
        error_msg = str(e)
        if "not found" in error_msg.lower():
            raise HTTPException(status_code=404, detail=error_msg)
        logger.error(f"Failed to fetch repositories for {owner}: {error_msg}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch repositories: {error_msg}",
        )
    except Exception as e:
        logger.error(f"Failed to fetch repositories for {owner}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch repositories: {str(e)}",
        )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
