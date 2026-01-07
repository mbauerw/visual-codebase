"""
Pytest configuration and fixtures for backend tests.
"""

import pytest


def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "benchmark: marks tests as benchmarks"
    )


@pytest.fixture(scope="session")
def event_loop_policy():
    """Use the default event loop policy for async tests."""
    import asyncio
    return asyncio.DefaultEventLoopPolicy()
