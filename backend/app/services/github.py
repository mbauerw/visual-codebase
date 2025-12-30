"""GitHub service for cloning and managing repositories."""
import asyncio
import logging
import shutil
import tempfile
from pathlib import Path
from typing import Optional
import httpx

from app.models.schemas import GitHubRepoInfo
from app.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GitHubService:
    """Service for GitHub repository operations."""

    def __init__(self, access_token: Optional[str] = None):
        """Initialize GitHub service.

        Args:
            access_token: Optional GitHub OAuth token for private repos
        """
        self.access_token = access_token or settings.github_token
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }

    async def clone_repository(
        self,
        repo_info: GitHubRepoInfo,
        temp_dir: Optional[Path] = None
    ) -> Path:
        """Clone a GitHub repository to a temporary directory.

        Args:
            repo_info: Repository information
            temp_dir: Optional temporary directory to use

        Returns:
            Path to the cloned repository

        Raises:
            RuntimeError: If cloning fails
        """
        # Create temp directory if not provided
        if temp_dir is None:
            temp_dir = Path(tempfile.mkdtemp(prefix="github_repo_"))

        # Build clone URL
        clone_url = f"https://github.com/{repo_info.owner}/{repo_info.repo}.git"

        # Use authenticated URL if token is available
        if self.access_token and self.access_token != "":
            clone_url = f"https://{self.access_token}@github.com/{repo_info.owner}/{repo_info.repo}.git"

        # Build git clone command
        branch = repo_info.branch or "main"
        cmd = [
            "git",
            "clone",
            "--depth", "1",  # Shallow clone
            "--single-branch",
            "--branch", branch,
            clone_url,
            str(temp_dir)
        ]

        logger.info(f"Cloning repository {repo_info.owner}/{repo_info.repo} (branch: {branch})")

        try:
            # Run git clone
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )

            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                logger.error(f"Git clone failed: {error_msg}")
                raise RuntimeError(f"Failed to clone repository: {error_msg}")

            logger.info(f"Successfully cloned to {temp_dir}")

            # If a subdirectory path is specified, return that path
            if repo_info.path:
                repo_path = temp_dir / repo_info.path
                if not repo_path.exists():
                    raise RuntimeError(f"Subdirectory {repo_info.path} does not exist in repository")
                return repo_path

            return temp_dir

        except Exception as e:
            # Clean up on failure
            if temp_dir.exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
            raise RuntimeError(f"Failed to clone repository: {str(e)}")

    async def get_default_branch(self, owner: str, repo: str) -> str:
        """Get the default branch of a repository.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Default branch name

        Raises:
            RuntimeError: If API request fails
        """
        url = f"https://api.github.com/repos/{owner}/{repo}"

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers)
                response.raise_for_status()
                data = response.json()
                return data.get("default_branch", "main")
            except httpx.HTTPError as e:
                logger.error(f"Failed to get default branch: {e}")
                return "main"  # Fallback to main

    @staticmethod
    def cleanup(temp_dir: Path) -> None:
        """Clean up a temporary directory.

        Args:
            temp_dir: Directory to remove
        """
        if temp_dir.exists():
            logger.info(f"Cleaning up temporary directory: {temp_dir}")
            shutil.rmtree(temp_dir, ignore_errors=True)

    async def list_user_repos(
        self,
        page: int = 1,
        per_page: int = 30,
        sort: str = "updated",
        direction: str = "desc",
        repo_type: str = "all"
    ) -> dict:
        """List repositories for the authenticated user.

        Args:
            page: Page number
            per_page: Results per page (max 100)
            sort: Sort by created, updated, pushed, full_name
            direction: Sort direction (asc or desc)
            repo_type: Type filter (all, owner, public, private, member)

        Returns:
            Dictionary with repositories and pagination info

        Raises:
            RuntimeError: If API request fails
        """
        url = "https://api.github.com/user/repos"
        params = {
            "page": page,
            "per_page": min(per_page, 100),
            "sort": sort,
            "direction": direction,
            "type": repo_type
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=self.headers, params=params)
                response.raise_for_status()

                repositories = response.json()

                # Check for next page
                link_header = response.headers.get("Link", "")
                has_next = 'rel="next"' in link_header

                return {
                    "repositories": repositories,
                    "total_count": len(repositories),
                    "has_next_page": has_next,
                    "next_page": page + 1 if has_next else None
                }

            except httpx.HTTPError as e:
                logger.error(f"Failed to list repositories: {e}")
                raise RuntimeError(f"Failed to fetch repositories: {str(e)}")

    async def list_owner_repos(
        self,
        owner: str,
        page: int = 1,
        per_page: int = 30,
        sort: str = "updated",
        direction: str = "desc",
    ) -> dict:
        """List public repositories for a specific GitHub user or organization.

        Args:
            owner: GitHub username or organization name
            page: Page number
            per_page: Results per page (max 100)
            sort: Sort by created, updated, pushed, full_name
            direction: Sort direction (asc or desc)

        Returns:
            Dictionary with repositories and pagination info

        Raises:
            RuntimeError: If API request fails or user not found
        """
        url = f"https://api.github.com/users/{owner}/repos"
        params = {
            "page": page,
            "per_page": min(per_page, 100),
            "sort": sort,
            "direction": direction,
            "type": "all",  # For other users, this returns only public repos
        }

        # Use authenticated headers if token available (for rate limits),
        # but this endpoint works without authentication
        headers = self.headers if self.access_token else {
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28"
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(url, headers=headers, params=params)
                response.raise_for_status()

                repositories = response.json()

                # Check for next page
                link_header = response.headers.get("Link", "")
                has_next = 'rel="next"' in link_header

                return {
                    "repositories": repositories,
                    "total_count": len(repositories),
                    "has_next_page": has_next,
                    "next_page": page + 1 if has_next else None,
                    "owner": owner,
                    "is_own_repos": False,
                }

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 404:
                    logger.error(f"GitHub user '{owner}' not found")
                    raise RuntimeError(f"GitHub user '{owner}' not found")
                logger.error(f"Failed to list repositories for {owner}: {e}")
                raise RuntimeError(f"Failed to fetch repositories: {str(e)}")
            except httpx.HTTPError as e:
                logger.error(f"Failed to list repositories for {owner}: {e}")
                raise RuntimeError(f"Failed to fetch repositories: {str(e)}")
