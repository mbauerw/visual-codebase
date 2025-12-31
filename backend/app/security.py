"""Security utilities for path validation and access control."""

import os
from pathlib import Path
from typing import Union


class PathTraversalError(Exception):
    """Exception raised when a path traversal attack is detected."""

    def __init__(self, message: str = "Path traversal detected"):
        self.message = message
        super().__init__(self.message)


def validate_path_within_base(
    base_path: Union[str, Path],
    target_path: Union[str, Path],
    error_message: str = "Invalid path: path traversal detected"
) -> Path:
    """
    Validate that a target path is contained within a base directory.

    This function prevents path traversal attacks by resolving both paths
    to their canonical form and verifying the target is within the base.

    Args:
        base_path: The base directory that should contain the target
        target_path: The path to validate (can be relative to base or absolute)
        error_message: Custom error message for the exception

    Returns:
        The resolved, validated Path object

    Raises:
        PathTraversalError: If the target path escapes the base directory

    Examples:
        >>> validate_path_within_base("/tmp/repo", "/tmp/repo/src/file.py")
        PosixPath('/tmp/repo/src/file.py')

        >>> validate_path_within_base("/tmp/repo", "../etc/passwd")
        PathTraversalError: Invalid path: path traversal detected
    """
    # Convert to Path objects and resolve to canonical paths
    base = Path(base_path).resolve()

    # If target_path is relative, join it with base first
    if not Path(target_path).is_absolute():
        target = (base / target_path).resolve()
    else:
        target = Path(target_path).resolve()

    # Check if target is within base directory
    # Using os.path.commonpath is more reliable than string comparison
    try:
        # This will raise ValueError if paths don't share a common prefix
        common = Path(os.path.commonpath([base, target]))
        if common != base:
            raise PathTraversalError(error_message)
    except ValueError:
        # Paths are on different drives (Windows) or have no common prefix
        raise PathTraversalError(error_message)

    return target


def safe_join_path(
    base_path: Union[str, Path],
    *parts: str,
    error_message: str = "Invalid path: path traversal detected"
) -> Path:
    """
    Safely join path components and validate the result is within base.

    This is a convenience function that combines path joining with
    traversal validation.

    Args:
        base_path: The base directory
        *parts: Path components to join
        error_message: Custom error message for the exception

    Returns:
        The resolved, validated Path object

    Raises:
        PathTraversalError: If the resulting path escapes the base directory

    Examples:
        >>> safe_join_path("/tmp/repo", "src", "file.py")
        PosixPath('/tmp/repo/src/file.py')

        >>> safe_join_path("/tmp/repo", "..", "etc", "passwd")
        PathTraversalError: Invalid path: path traversal detected
    """
    base = Path(base_path)
    target = base.joinpath(*parts)
    return validate_path_within_base(base, target, error_message)
