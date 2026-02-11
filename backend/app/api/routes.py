import re
import time
import asyncio
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Header
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
    TierListResponse,
    FunctionDetailResponse,
    FunctionStats,
)
from ..services.analysis import get_analysis_service
from ..services.database import get_database_service
from ..services.github import GitHubService
from ..services.network_logger import log_clone
from ..auth import get_current_user, get_optional_user
from ..security import validate_path_within_base, PathTraversalError
from ..settings import get_settings

logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    filename='app.log',  # Write to this file
    filemode='a'  # 'a' = append, 'w' = overwrite
)

# Silence noisy third-party loggers
logging.getLogger("hpack").setLevel(logging.WARNING)
logging.getLogger("hpack.hpack").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpcore.http11").setLevel(logging.WARNING)
logging.getLogger("httpcore.connection").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("anthropic").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)

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


def _get_directory_size(path) -> int:
    """Get total size of a directory in bytes."""
    import os
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            try:
                total += os.path.getsize(fp)
            except (OSError, IOError):
                pass
    return total


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
    clone_start = None

    try:
        # Update status to cloning
        job = service.get_job(analysis_id)
        logger.info(f"[DEBUG] GitHub analysis started. Job found: {job is not None}, analysis_id: {analysis_id}")
        if job:
            job.set_status(AnalysisStatus.CLONING, "Cloning repository from GitHub...")
            logger.info(f"[DEBUG] Set status to CLONING, progress: {job.progress}")

        # Clone the repository with timing
        clone_start = time.perf_counter()
        github_service = GitHubService(access_token=github_token)
        temp_dir = await github_service.clone_repository(repo_info)
        clone_duration = time.perf_counter() - clone_start

        # Calculate cloned size and log
        clone_size = _get_directory_size(temp_dir) if temp_dir else 0
        log_clone(
            duration_seconds=clone_duration,
            success=True,
            repo=f"{repo_info.owner}/{repo_info.repo}",
            branch=repo_info.branch,
            size_bytes=clone_size,
        )

        if job:
            job.current_step = "Repository cloned successfully"
            job.directory_path = str(temp_dir)
            logger.info(f"[DEBUG] Clone complete. Job status: {job.status}, progress: {job.progress}")

        logger.info(f"Repository cloned to {temp_dir} in {clone_duration:.2f}s")

        # Run analysis on the cloned directory
        logger.info(f"[DEBUG] About to call run_analysis for {analysis_id}")
        await service.run_analysis(
            analysis_id,
            include_node_modules,
            max_depth,
            user_id,
            is_github_analysis=True,
        )

    except Exception as e:
        logger.error(f"GitHub analysis failed: {str(e)}")

        # Log clone failure if clone didn't complete
        if temp_dir is None and clone_start is not None:
            clone_duration = time.perf_counter() - clone_start
            log_clone(
                duration_seconds=clone_duration,
                success=False,
                repo=f"{repo_info.owner}/{repo_info.repo}",
                branch=repo_info.branch,
                error_message=str(e),
            )

        job = service.get_job(analysis_id)
        if job:
            job.status = AnalysisStatus.FAILED
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

    # Prefer in-memory status during active analysis (more up-to-date)
    in_memory_status = service.get_status(analysis_id)

    if in_memory_status:
        # Log status being returned (only log non-completed to avoid spam)
        if in_memory_status.status not in ['completed', 'failed']:
            logger.debug(f"[STATUS] Returning: {in_memory_status.status}, progress: {in_memory_status.progress}, step: {in_memory_status.current_step}")
        # In-memory status is available - use it for real-time progress
        return in_memory_status

    # Fall back to database for completed/historical analyses
    if current_user:
        db_status = await db_service.get_analysis_status(analysis_id)
        if db_status:
            return db_status

    raise HTTPException(status_code=404, detail="Analysis not found")


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

    # Try to get result from database first
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
    current_user = Depends(get_optional_user),
):
    """
    Get file content for a specific node in an analysis.

    For GitHub analyses: Returns stored content from database.
    For local analyses: Returns info about filesystem path (content not stored).
    """
    settings = get_settings()
    if not current_user and analysis_id != settings.demo_analysis_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db_service = get_database_service()
    result = await db_service.get_file_content(
        analysis_id=analysis_id,
        node_id=node_id,
        user_id=current_user.id if current_user else None,
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


# ==================== Function Tier List Endpoints ====================

@router.get("/analysis/{analysis_id}/functions/tier-list", response_model=TierListResponse)
async def get_function_tier_list(
    analysis_id: str,
    tier: Optional[str] = None,
    file: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "call_count",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 50,
    current_user = Depends(get_optional_user),
):
    """
    Get paginated function tier list for an analysis.

    Query Parameters:
        tier: Filter by tier (S/A/B/C/D/F)
        file: Filter by file path (partial match)
        type: Filter by function type (function, method, arrow_function, etc.)
        search: Search function names
        sort_by: Sort field - call_count, name, file, tier (default: call_count)
        sort_order: Sort order - asc, desc (default: desc)
        page: Page number (default: 1)
        per_page: Items per page, max 100 (default: 50)
    """
    settings = get_settings()
    if not current_user and analysis_id != settings.demo_analysis_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db_service = get_database_service()

    result = await db_service.get_tier_list(
        analysis_id=analysis_id,
        user_id=current_user.id if current_user else None,
        tier=tier,
        file_filter=file,
        function_type=type,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        per_page=per_page,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    return result


@router.get("/analysis/{analysis_id}/functions/stats", response_model=FunctionStats)
async def get_function_stats(
    analysis_id: str,
    current_user = Depends(get_optional_user),
):
    """
    Get aggregate statistics for function analysis.

    Returns total counts, tier distribution, and top functions.
    """
    settings = get_settings()
    if not current_user and analysis_id != settings.demo_analysis_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db_service = get_database_service()

    result = await db_service.get_function_stats(
        analysis_id=analysis_id,
        user_id=current_user.id if current_user else None,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found or not owned by user"
        )

    return result


@router.get("/analysis/{analysis_id}/functions/{function_id}", response_model=FunctionDetailResponse)
async def get_function_detail(
    analysis_id: str,
    function_id: str,
    current_user = Depends(get_optional_user),
):
    """
    Get detailed information about a specific function.

    Returns the function details along with its callers and callees.
    """
    settings = get_settings()
    if not current_user and analysis_id != settings.demo_analysis_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    db_service = get_database_service()

    result = await db_service.get_function_detail(
        analysis_id=analysis_id,
        function_id=function_id,
        user_id=current_user.id if current_user else None,
    )

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Function not found or analysis not owned by user"
        )

    return result


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


# ==================== Rundown Endpoints ====================

@router.post("/analysis/{analysis_id}/rundown")
async def generate_rundown(
    analysis_id: str,
    current_user = Depends(get_optional_user),
):
    """
    Trigger on-demand rundown generation for a completed analysis.

    Runs asynchronously in the background. Poll GET endpoint for status.
    """
    print(f"[Rundown POST] Endpoint hit for {analysis_id}")
    db_service = get_database_service()

    # Check current status first
    current = await db_service.get_rundown_status(analysis_id)
    print(f"[Rundown POST] Current status: {current}")
    if current is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # If already completed, return the existing rundown
    if current["status"] == "completed":
        return current

    # If currently generating and not stale, don't re-launch
    if current["status"] == "generating":
        stale = await db_service.is_rundown_stale(analysis_id, max_age_seconds=120)
        if not stale:
            print(f"[Rundown POST] Already generating (not stale), returning current")
            return current
        print(f"[Rundown POST] Stale 'generating' status, restarting...")

    # Set status to 'generating'
    was_set = await db_service.set_rundown_status(analysis_id, "generating")
    print(f"[Rundown POST] set_rundown_status returned {was_set}")
    if not was_set:
        print(f"[Rundown POST] WARNING: update returned no rows — analysis_id may not exist")
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Launch background task via asyncio.create_task (not BackgroundTasks)
    print(f"[Rundown POST] Launching asyncio.create_task for {analysis_id}")
    logger.info(f"Rundown: launching background task for {analysis_id}")
    asyncio.create_task(_run_rundown_generation(analysis_id))

    return {"status": "generating", "analysis_id": analysis_id}


@router.get("/analysis/{analysis_id}/rundown")
async def get_rundown(
    analysis_id: str,
    current_user = Depends(get_optional_user),
):
    """
    Get rundown status and data for an analysis.

    Returns status: 'not_started' | 'generating' | 'completed' | 'failed'
    When completed, includes the full rundown data.
    """
    db_service = get_database_service()
    result = await db_service.get_rundown_status(analysis_id)

    if result is None:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return result


async def _run_rundown_generation(analysis_id: str):
    """Background task to generate rundown from stored analysis data."""
    print(f"[Rundown] Background task started for {analysis_id}")
    logger.info(f"Rundown: background task started for {analysis_id}")

    try:
        db_service = get_database_service()

        # Fetch stored nodes, edges, languages
        print(f"[Rundown] Fetching analysis data from DB...")
        data = await db_service.get_analysis_nodes_and_edges(analysis_id)
        if not data:
            msg = f"[Rundown] No analysis data found for {analysis_id}"
            print(msg)
            logger.error(msg)
            await db_service.set_rundown_status(analysis_id, "failed")
            return

        nodes, edges, language_distribution = data
        msg = f"[Rundown] Fetched {len(nodes)} nodes, {len(edges)} edges for {analysis_id}"
        print(msg)
        logger.info(msg)

        # Generate rundown
        print(f"[Rundown] Calling RundownGenerator...")
        from ..services.rundown_generator import get_rundown_generator
        rundown_generator = get_rundown_generator()
        rundown = await rundown_generator.generate_rundown(
            nodes=nodes,
            edges=edges,
            language_distribution=language_distribution,
        )

        if rundown is None:
            msg = f"[Rundown] Generator returned None for {analysis_id} (too few files or LLM failure)"
            print(msg)
            logger.warning(msg)
            await db_service.set_rundown_status(analysis_id, "failed")
            return

        # Save result
        print(f"[Rundown] Saving rundown to DB...")
        logger.info(f"Rundown: saving result for {analysis_id}")
        await db_service.save_rundown(analysis_id, rundown)
        print(f"[Rundown] Completed for {analysis_id}")
        logger.info(f"Rundown: completed for {analysis_id}")

    except Exception as e:
        msg = f"[Rundown] EXCEPTION for {analysis_id}: {type(e).__name__}: {e}"
        print(msg)
        logger.error(msg, exc_info=True)
        try:
            db_service = get_database_service()
            await db_service.set_rundown_status(analysis_id, "failed")
        except Exception as inner_e:
            print(f"[Rundown] Failed to set failed status: {inner_e}")
            logger.error(f"Rundown: failed to set failed status for {analysis_id}: {inner_e}")


# ==================== Profile Management Endpoints ====================

from ..models.schemas import (
    ProfileResponse,
    ProfileUpdateRequest,
    PasswordPolicy,
    PasswordValidationRequest,
    PasswordValidationResult,
    PasswordChangeRequest,
    PasswordUpdateResponse,
    AccountDeletionRequest,
    AccountDeletionResponse,
    AccountDeletionStatusResponse,
    CancelDeletionResponse,
    DataExportRequest,
    DataExportResponse,
    DataExportStatusResponse,
)
from ..services.profile import ProfileService, PasswordService
from ..services.account_deletion import AccountDeletionService, DataExportService


@router.get("/user/profile", response_model=ProfileResponse)
async def get_user_profile(current_user = Depends(get_current_user)):
    """Get current user's profile."""
    profile_service = ProfileService()
    profile = await profile_service.get_profile(current_user.id)

    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    return ProfileResponse(
        id=profile["id"],
        email=profile["email"],
        display_name=profile.get("display_name"),
        full_name=profile.get("full_name"),
        avatar_url=profile.get("avatar_url"),
        preferences=profile.get("preferences", {}),
        auth_provider=profile.get("auth_provider", "email"),
        created_at=profile["created_at"],
        updated_at=profile["updated_at"],
    )


@router.patch("/user/profile", response_model=ProfileResponse)
async def update_user_profile(
    request: ProfileUpdateRequest,
    current_user = Depends(get_current_user),
):
    """Update current user's profile."""
    profile_service = ProfileService()

    await profile_service.update_profile(
        user_id=current_user.id,
        display_name=request.display_name,
        avatar_url=request.avatar_url,
        preferences=request.preferences.model_dump() if request.preferences else None,
    )

    # Get updated profile
    profile = await profile_service.get_profile(current_user.id)

    return ProfileResponse(
        id=profile["id"],
        email=profile["email"],
        display_name=profile.get("display_name"),
        full_name=profile.get("full_name"),
        avatar_url=profile.get("avatar_url"),
        preferences=profile.get("preferences", {}),
        auth_provider=profile.get("auth_provider", "email"),
        created_at=profile["created_at"],
        updated_at=profile["updated_at"],
    )


@router.post("/user/profile/password", response_model=PasswordUpdateResponse)
async def change_user_password(
    request: PasswordChangeRequest,
    current_user = Depends(get_current_user),
):
    """Change user password (email/password users only)."""
    # First validate the new password strength
    password_service = PasswordService()
    validation = await password_service.validate_strength(request.new_password)

    if not validation.valid:
        raise HTTPException(
            status_code=400,
            detail="New password does not meet strength requirements"
        )

    # Check password history
    is_safe = await password_service.check_history(current_user.id, request.new_password)
    if not is_safe:
        raise HTTPException(
            status_code=400,
            detail="This password was recently used. Please choose a different password."
        )

    # Change the password
    profile_service = ProfileService()
    result = await profile_service.change_password(current_user.id, request.new_password)

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message", "Failed to update password"))

    return PasswordUpdateResponse(
        success=True,
        message="Password updated successfully."
    )


# ==================== Password Validation Endpoints ====================

@router.get("/auth/password-policy", response_model=PasswordPolicy)
async def get_password_policy():
    """Get current password policy requirements (public endpoint)."""
    password_service = PasswordService()
    return await password_service.get_policy()


@router.post("/auth/validate-password", response_model=PasswordValidationResult)
async def validate_password(request: PasswordValidationRequest):
    """Validate password strength (public endpoint for real-time validation)."""
    password_service = PasswordService()
    return await password_service.validate_strength(request.password)


# ==================== Account Deletion Endpoints ====================

@router.post("/user/account/delete", response_model=AccountDeletionResponse)
async def request_account_deletion(
    request: AccountDeletionRequest,
    current_user = Depends(get_current_user),
):
    """Request account deletion with 30-day grace period."""
    deletion_service = AccountDeletionService()
    result = await deletion_service.request_deletion(
        user_id=current_user.id,
        reason=request.reason,
        export_data=request.export_data,
    )

    if result.get("error"):
        raise HTTPException(status_code=400, detail=result.get("message"))

    return AccountDeletionResponse(
        deletion_id=result["deletion_id"],
        scheduled_deletion_at=result["scheduled_deletion_at"],
        status=result["status"],
        export_requested=result["export_requested"],
        export_id=result.get("export_id"),
        message=result["message"],
    )


@router.get("/user/account/deletion-status", response_model=AccountDeletionStatusResponse)
async def get_deletion_status(current_user = Depends(get_current_user)):
    """Get current deletion request status."""
    deletion_service = AccountDeletionService()
    result = await deletion_service.get_deletion_status(current_user.id)

    if not result:
        raise HTTPException(status_code=404, detail="No pending deletion request")

    return AccountDeletionStatusResponse(
        deletion_id=result["deletion_id"],
        scheduled_deletion_at=result["scheduled_deletion_at"],
        status=result["status"],
        days_remaining=result["days_remaining"],
        can_cancel=result["can_cancel"],
    )


@router.post("/user/account/cancel-deletion", response_model=CancelDeletionResponse)
async def cancel_account_deletion(current_user = Depends(get_current_user)):
    """Cancel pending account deletion."""
    deletion_service = AccountDeletionService()
    result = await deletion_service.cancel_deletion(current_user.id)

    return CancelDeletionResponse(
        message=result["message"],
        account_restored=result["account_restored"],
    )


# ==================== Data Export Endpoints ====================

@router.post("/user/data/export", response_model=DataExportResponse)
async def request_data_export(
    request: DataExportRequest,
    current_user = Depends(get_current_user),
):
    """Request user data export (async generation)."""
    export_service = DataExportService()
    result = await export_service.create_export(
        user_id=current_user.id,
        export_type=request.export_type,
    )

    return DataExportResponse(
        export_id=result["export_id"],
        status=result["status"],
        estimated_time_seconds=result.get("estimated_time_seconds"),
    )


@router.get("/user/data/export/{export_id}", response_model=DataExportStatusResponse)
async def get_export_status(
    export_id: str,
    current_user = Depends(get_current_user),
):
    """Get data export status and download URL if ready."""
    export_service = DataExportService()
    result = await export_service.get_export_status(current_user.id, export_id)

    if not result:
        raise HTTPException(status_code=404, detail="Export not found")

    return DataExportStatusResponse(
        export_id=result["export_id"],
        status=result["status"],
        download_url=result.get("download_url"),
        expires_at=result.get("expires_at"),
        file_size_bytes=result.get("file_size_bytes"),
    )
