import asyncio
from fastapi import FastAPI, APIRouter, BackgroundTasks, HTTPException
from pathlib import Path

from ..models.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    AnalysisStatus,
    AnalysisStatusResponse,
    ReactFlowGraph,
)
from ..services.analysis import get_analysis_service

router = APIRouter(prefix="/api", tags=["analysis"])

# @router.post("/getdirectory") 


@router.post("/analyze", response_model=AnalyzeResponse)
async def start_analysis(
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks,
) -> AnalyzeResponse:
    """
    Start a codebase analysis.

    This endpoint initiates an asynchronous analysis of the specified directory.
    Returns an analysis ID that can be used to check progress and retrieve results.
    """
    service = get_analysis_service()

    # Create the analysis job
    analysis_id = service.create_job(request.directory_path)

    # Start the analysis in the background
    background_tasks.add_task(
        service.run_analysis,
        analysis_id,
        request.include_node_modules,
        request.max_depth,
    )

    return AnalyzeResponse(
        analysis_id=analysis_id,
        status=AnalysisStatus.PENDING,
        message="Analysis started. Use the status endpoint to track progress.",
    )


@router.get("/analysis/{analysis_id}/status", response_model=AnalysisStatusResponse)
async def get_analysis_status(analysis_id: str) -> AnalysisStatusResponse:
    """
    Get the status of an analysis job.

    Returns the current progress and status of the analysis.
    """
    service = get_analysis_service()
    status = service.get_status(analysis_id)

    if not status:
        raise HTTPException(status_code=404, detail="Analysis not found")

    return status


@router.get("/analysis/{analysis_id}", response_model=ReactFlowGraph)
async def get_analysis_result(analysis_id: str) -> ReactFlowGraph:
    """
    Get the result of a completed analysis.

    Returns the dependency graph in React Flow format.
    """
    service = get_analysis_service()

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


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}
