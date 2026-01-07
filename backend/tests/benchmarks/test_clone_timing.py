"""
Benchmark tests for GitHub repository clone times.

This module measures how long it takes to clone repositories of various sizes
using shallow clones (--depth 1). Results are stored in a JSON file that can
be used to estimate clone times for users.

Run with: pytest tests/benchmarks/test_clone_timing.py -v -s
Or for specific size: pytest tests/benchmarks/test_clone_timing.py -v -s -k "medium"

Note: These tests require network access and may take several minutes to complete.
"""

import asyncio
import json
import os
import shutil
import tempfile
import time
from dataclasses import dataclass, asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import pytest

# Add parent to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "app"))

from services.github import GitHubService
from models.schemas import GitHubRepoInfo


# Output file for benchmark results
RESULTS_FILE = Path(__file__).parent / "clone_timing_results.json"


@dataclass
class CloneResult:
    """Result of a single clone benchmark."""
    owner: str
    repo: str
    branch: str
    size_kb: int  # GitHub API reported size in KB
    clone_time_seconds: float
    cloned_size_bytes: int  # Actual size on disk after clone
    success: bool
    error: Optional[str] = None
    timestamp: str = ""

    def __post_init__(self):
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()


@dataclass
class BenchmarkRepo:
    """A repository to benchmark."""
    owner: str
    repo: str
    size_kb: int  # Approximate size from GitHub API
    category: str  # tiny, small, medium, large, huge
    description: str
    branch: str = "main"


# Curated list of public repositories of various sizes
# Sizes are approximate and may change over time
BENCHMARK_REPOS = [
    # Tiny (< 100 KB)
    BenchmarkRepo("chalk", "chalk", 90, "tiny", "Terminal string styling"),
    BenchmarkRepo("sindresorhus", "ora", 80, "tiny", "Terminal spinner"),

    # Small (100 KB - 1 MB)
    BenchmarkRepo("expressjs", "express", 600, "small", "Node.js web framework", branch="master"),
    BenchmarkRepo("jestjs", "jest", 900, "small", "JavaScript testing", branch="main"),

    # Medium (1 MB - 10 MB)
    BenchmarkRepo("facebook", "react", 5000, "medium", "React library", branch="main"),
    BenchmarkRepo("vuejs", "core", 4000, "medium", "Vue.js 3 core", branch="main"),
    BenchmarkRepo("pallets", "flask", 2500, "medium", "Python web framework", branch="main"),

    # Large (10 MB - 100 MB)
    BenchmarkRepo("microsoft", "vscode", 80000, "large", "VS Code editor", branch="main"),
    BenchmarkRepo("golang", "go", 70000, "large", "Go language", branch="master"),

    # Huge (100 MB - 500 MB)
    BenchmarkRepo("torvalds", "linux", 400000, "huge", "Linux kernel", branch="master"),

    # Very Huge (500 MB+) - Skip by default, very slow
    # BenchmarkRepo("chromium", "chromium", 2000000, "very_huge", "Chromium browser", branch="main"),
]


def get_directory_size(path: str) -> int:
    """Calculate total size of a directory in bytes."""
    total = 0
    for dirpath, dirnames, filenames in os.walk(path):
        # Skip .git directory for a more accurate "source code" size
        if '.git' in dirpath:
            continue
        for filename in filenames:
            filepath = os.path.join(dirpath, filename)
            try:
                total += os.path.getsize(filepath)
            except (OSError, FileNotFoundError):
                pass
    return total


async def clone_and_measure(repo: BenchmarkRepo, github_token: Optional[str] = None) -> CloneResult:
    """Clone a repository and measure the time taken."""
    service = GitHubService(access_token=github_token)
    repo_info = GitHubRepoInfo(
        owner=repo.owner,
        repo=repo.repo,
        branch=repo.branch
    )

    temp_dir = None
    start_time = time.perf_counter()

    try:
        # Clone the repository
        temp_dir = await service.clone_repository(repo_info)
        end_time = time.perf_counter()

        # Measure cloned size
        cloned_size = get_directory_size(temp_dir)

        return CloneResult(
            owner=repo.owner,
            repo=repo.repo,
            branch=repo.branch,
            size_kb=repo.size_kb,
            clone_time_seconds=round(end_time - start_time, 3),
            cloned_size_bytes=cloned_size,
            success=True
        )

    except Exception as e:
        end_time = time.perf_counter()
        return CloneResult(
            owner=repo.owner,
            repo=repo.repo,
            branch=repo.branch,
            size_kb=repo.size_kb,
            clone_time_seconds=round(end_time - start_time, 3),
            cloned_size_bytes=0,
            success=False,
            error=str(e)
        )

    finally:
        # Clean up
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)


def load_existing_results() -> list[dict]:
    """Load existing benchmark results from JSON file."""
    if RESULTS_FILE.exists():
        with open(RESULTS_FILE) as f:
            return json.load(f)
    return []


def save_results(results: list[dict]):
    """Save benchmark results to JSON file."""
    with open(RESULTS_FILE, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nResults saved to: {RESULTS_FILE}")


def print_result(result: CloneResult, repo: BenchmarkRepo):
    """Print a formatted result."""
    if result.success:
        cloned_mb = result.cloned_size_bytes / (1024 * 1024)
        print(f"  {repo.owner}/{repo.repo} ({repo.category})")
        print(f"    GitHub size: {repo.size_kb} KB")
        print(f"    Cloned size: {cloned_mb:.2f} MB")
        print(f"    Clone time:  {result.clone_time_seconds:.2f}s")
        print(f"    Speed:       {cloned_mb / result.clone_time_seconds:.2f} MB/s")
    else:
        print(f"  {repo.owner}/{repo.repo} - FAILED: {result.error}")


class TestCloneBenchmarks:
    """Benchmark tests for clone timing."""

    @pytest.fixture
    def github_token(self) -> Optional[str]:
        """Get GitHub token from environment if available."""
        return os.environ.get("GITHUB_TOKEN")

    @pytest.mark.asyncio
    @pytest.mark.parametrize("repo", [r for r in BENCHMARK_REPOS if r.category == "tiny"])
    async def test_clone_tiny_repos(self, repo: BenchmarkRepo, github_token):
        """Benchmark cloning tiny repositories (< 100 KB)."""
        print(f"\n--- Cloning {repo.owner}/{repo.repo} ---")
        result = await clone_and_measure(repo, github_token)
        print_result(result, repo)

        # Save result
        results = load_existing_results()
        results.append(asdict(result))
        save_results(results)

        assert result.success, f"Clone failed: {result.error}"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("repo", [r for r in BENCHMARK_REPOS if r.category == "small"])
    async def test_clone_small_repos(self, repo: BenchmarkRepo, github_token):
        """Benchmark cloning small repositories (100 KB - 1 MB)."""
        print(f"\n--- Cloning {repo.owner}/{repo.repo} ---")
        result = await clone_and_measure(repo, github_token)
        print_result(result, repo)

        results = load_existing_results()
        results.append(asdict(result))
        save_results(results)

        assert result.success, f"Clone failed: {result.error}"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("repo", [r for r in BENCHMARK_REPOS if r.category == "medium"])
    async def test_clone_medium_repos(self, repo: BenchmarkRepo, github_token):
        """Benchmark cloning medium repositories (1 MB - 10 MB)."""
        print(f"\n--- Cloning {repo.owner}/{repo.repo} ---")
        result = await clone_and_measure(repo, github_token)
        print_result(result, repo)

        results = load_existing_results()
        results.append(asdict(result))
        save_results(results)

        assert result.success, f"Clone failed: {result.error}"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("repo", [r for r in BENCHMARK_REPOS if r.category == "large"])
    async def test_clone_large_repos(self, repo: BenchmarkRepo, github_token):
        """Benchmark cloning large repositories (10 MB - 100 MB)."""
        print(f"\n--- Cloning {repo.owner}/{repo.repo} ---")
        result = await clone_and_measure(repo, github_token)
        print_result(result, repo)

        results = load_existing_results()
        results.append(asdict(result))
        save_results(results)

        assert result.success, f"Clone failed: {result.error}"

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.parametrize("repo", [r for r in BENCHMARK_REPOS if r.category == "huge"])
    async def test_clone_huge_repos(self, repo: BenchmarkRepo, github_token):
        """Benchmark cloning huge repositories (100 MB - 500 MB).

        WARNING: These tests may take several minutes each.
        Run with: pytest -m slow
        """
        print(f"\n--- Cloning {repo.owner}/{repo.repo} (this may take a while) ---")
        result = await clone_and_measure(repo, github_token)
        print_result(result, repo)

        results = load_existing_results()
        results.append(asdict(result))
        save_results(results)

        assert result.success, f"Clone failed: {result.error}"

    @pytest.mark.asyncio
    @pytest.mark.slow
    @pytest.mark.parametrize("repo", [r for r in BENCHMARK_REPOS if r.category == "very_huge"])
    async def test_clone_very_huge_repos(self, repo: BenchmarkRepo, github_token):
        """Benchmark cloning very huge repositories (500 MB+).

        WARNING: These tests may take 10+ minutes each.
        """
        print(f"\n--- Cloning {repo.owner}/{repo.repo} (this will take a LONG time) ---")
        result = await clone_and_measure(repo, github_token)
        print_result(result, repo)

        results = load_existing_results()
        results.append(asdict(result))
        save_results(results)

        assert result.success, f"Clone failed: {result.error}"


@pytest.mark.asyncio
async def test_run_all_benchmarks():
    """Run all benchmarks in sequence and generate a summary report.

    This is a convenience test that runs all benchmarks and generates
    a summary with timing estimates.

    Run with: pytest tests/benchmarks/test_clone_timing.py::test_run_all_benchmarks -v -s
    """
    github_token = os.environ.get("GITHUB_TOKEN")
    results: list[CloneResult] = []

    # Clear existing results for a fresh run
    if RESULTS_FILE.exists():
        RESULTS_FILE.unlink()

    print("\n" + "=" * 60)
    print("CLONE TIMING BENCHMARK")
    print("=" * 60)

    for repo in BENCHMARK_REPOS:
        print(f"\n[{repo.category.upper()}] {repo.owner}/{repo.repo}")
        print(f"  Expected size: ~{repo.size_kb} KB ({repo.description})")

        result = await clone_and_measure(repo, github_token)
        results.append(result)
        print_result(result, repo)

    # Save all results
    save_results([asdict(r) for r in results])

    # Generate summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    successful = [r for r in results if r.success]
    failed = [r for r in results if not r.success]

    print(f"\nSuccessful: {len(successful)}/{len(results)}")
    if failed:
        print(f"Failed: {[f'{r.owner}/{r.repo}' for r in failed]}")

    # Calculate timing estimates by size bucket
    print("\n--- Timing Estimates by Size ---")

    size_buckets = [
        ("< 1 MB", 0, 1024),
        ("1-10 MB", 1024, 10 * 1024),
        ("10-50 MB", 10 * 1024, 50 * 1024),
        ("50-100 MB", 50 * 1024, 100 * 1024),
        ("100-500 MB", 100 * 1024, 500 * 1024),
        ("> 500 MB", 500 * 1024, float('inf')),
    ]

    for bucket_name, min_kb, max_kb in size_buckets:
        bucket_results = [
            r for r in successful
            if min_kb <= r.size_kb < max_kb
        ]
        if bucket_results:
            avg_time = sum(r.clone_time_seconds for r in bucket_results) / len(bucket_results)
            print(f"  {bucket_name}: ~{avg_time:.1f}s average ({len(bucket_results)} samples)")

    # Linear regression for time estimation
    if len(successful) >= 3:
        print("\n--- Linear Regression Model ---")
        sizes = [r.size_kb for r in successful]
        times = [r.clone_time_seconds for r in successful]

        # Simple linear regression: time = a * size_kb + b
        n = len(sizes)
        sum_x = sum(sizes)
        sum_y = sum(times)
        sum_xy = sum(x * y for x, y in zip(sizes, times))
        sum_xx = sum(x * x for x in sizes)

        # Avoid division by zero
        denom = n * sum_xx - sum_x * sum_x
        if denom != 0:
            a = (n * sum_xy - sum_x * sum_y) / denom
            b = (sum_y - a * sum_x) / n

            print(f"  Formula: time_seconds = {a:.6f} * size_kb + {b:.2f}")
            print(f"  Example estimates:")
            for test_size in [1000, 10000, 50000, 100000, 500000]:
                est_time = a * test_size + b
                print(f"    {test_size} KB ({test_size/1024:.0f} MB): ~{max(0, est_time):.1f}s")


# Standalone runner for quick testing
if __name__ == "__main__":
    print("Running clone timing benchmarks...")
    print("Use 'pytest tests/benchmarks/test_clone_timing.py -v -s' for full output")
    asyncio.run(test_run_all_benchmarks())
