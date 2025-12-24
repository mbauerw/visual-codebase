import asyncio
from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException, Depends, Header
from pathlib import Path
from typing import Optional

from ..models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisStatus,
    AnalysisStatusResponse,
    ReactFlowGraph,
)
from ..services.analysis import get_analysis_service
from ..services.database import get_database_service
from ..auth import get_current_user, get_optional_user

router = APIRouter(prefix="/api", tags=["analysis"])

# @router.post("/getdirectory") 


@router.post("/analyze", response_model=AnalyzeResponse)
async def start_analysis(
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks,
    current_user = Depends(get_optional_user),
) -> AnalyzeResponse:
    """
    Start a codebase analysis.

    This endpoint initiates an asynchronous analysis of the specified directory.
    Returns an analysis ID that can be used to check progress and retrieve results.
    """
    service = get_analysis_service()
    db_service = get_database_service()

    # Create the analysis job
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


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
