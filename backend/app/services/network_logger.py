"""Centralized network operation logger for analysis phases."""
import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

# Log file path - relative to backend directory
LOG_FILE_PATH = Path(__file__).parent.parent.parent / "network-log.app"


def log_operation(
    operation: str,
    duration_seconds: float,
    success: bool,
    metrics: Optional[dict[str, Any]] = None,
    error_message: Optional[str] = None,
) -> None:
    """Append a structured log entry to network-log.app.

    Args:
        operation: The type of operation (clone, parse, llm_analyze, build_graph)
        duration_seconds: How long the operation took
        success: Whether the operation completed successfully
        metrics: Operation-specific metrics (file_count, batch_count, etc.)
        error_message: Error description if success is False
    """
    log_entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "operation": operation,
        "duration_seconds": round(duration_seconds, 3),
        "success": success,
    }

    if metrics:
        log_entry["metrics"] = metrics

    if error_message and not success:
        log_entry["error"] = error_message[:500]  # Truncate long errors

    try:
        with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(log_entry) + "\n")
    except Exception:
        pass  # Fail silently - logging should not break the application


def log_clone(
    duration_seconds: float,
    success: bool,
    repo: str,
    branch: Optional[str] = None,
    size_bytes: Optional[int] = None,
    error_message: Optional[str] = None,
) -> None:
    """Log a repository clone operation."""
    metrics = {"repo": repo}
    if branch:
        metrics["branch"] = branch
    if size_bytes is not None:
        metrics["size_bytes"] = size_bytes
        metrics["size_mb"] = round(size_bytes / (1024 * 1024), 2)

    log_operation("clone", duration_seconds, success, metrics, error_message)


def log_parse(
    duration_seconds: float,
    success: bool,
    file_count: int = 0,
    error_message: Optional[str] = None,
) -> None:
    """Log a file parsing operation."""
    metrics = {"file_count": file_count}
    log_operation("parse", duration_seconds, success, metrics, error_message)


def log_llm_analyze(
    duration_seconds: float,
    success: bool,
    file_count: int = 0,
    batch_count: int = 0,
    error_message: Optional[str] = None,
) -> None:
    """Log an LLM analysis operation."""
    metrics = {
        "file_count": file_count,
        "batch_count": batch_count,
    }
    log_operation("llm_analyze", duration_seconds, success, metrics, error_message)


def log_build_graph(
    duration_seconds: float,
    success: bool,
    node_count: int = 0,
    edge_count: int = 0,
    error_message: Optional[str] = None,
) -> None:
    """Log a graph building operation."""
    metrics = {
        "node_count": node_count,
        "edge_count": edge_count,
    }
    log_operation("build_graph", duration_seconds, success, metrics, error_message)


def log_analyze_functions(
    duration_seconds: float,
    success: bool,
    function_count: int = 0,
    call_count: int = 0,
    error_message: Optional[str] = None,
) -> None:
    """Log a function analysis operation."""
    metrics = {
        "function_count": function_count,
        "call_count": call_count,
    }
    log_operation("analyze_functions", duration_seconds, success, metrics, error_message)


def log_generate_summary(
    duration_seconds: float,
    success: bool,
    error_message: Optional[str] = None,
) -> None:
    """Log a summary generation operation."""
    log_operation("generate_summary", duration_seconds, success, None, error_message)


class PhaseTimer:
    """Context manager for timing and logging a phase."""

    def __init__(
        self,
        operation: str,
        log_func: callable,
        **metrics_kwargs,
    ):
        self.operation = operation
        self.log_func = log_func
        self.metrics_kwargs = metrics_kwargs
        self.start_time: float = 0

    def __enter__(self):
        self.start_time = time.perf_counter()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.perf_counter() - self.start_time
        success = exc_type is None
        error_msg = str(exc_val) if exc_val else None
        self.log_func(
            duration_seconds=duration,
            success=success,
            error_message=error_msg,
            **self.metrics_kwargs,
        )
        return False  # Don't suppress exceptions
