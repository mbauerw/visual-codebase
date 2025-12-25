import asyncio
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
)
from ..services.analysis import get_analysis_service
from ..services.database import get_database_service
from ..services.github import GitHubService
from ..auth import get_current_user, get_optional_user

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
                directory_path=None,
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
        service.update_status(
            analysis_id,
            AnalysisStatus.CLONING,
            progress=5.0,
            current_step="Cloning repository from GitHub...",
        )

        # Clone the repository
        github_service = GitHubService(access_token=github_token)
        temp_dir = await github_service.clone_repository(repo_info)

        logger.info(f"Repository cloned to {temp_dir}")

        # Run analysis on the cloned directory
        await service.run_analysis(
            analysis_id,
            include_node_modules,
            max_depth,
            user_id,
            directory_path=str(temp_dir),
        )

    except Exception as e:
        logger.error(f"GitHub analysis failed: {str(e)}")
        service.update_status(
            analysis_id,
            AnalysisStatus.FAILED,
            progress=0.0,
            error=str(e),
        )
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


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
