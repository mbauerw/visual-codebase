"""Rate limiting service with Redis backend and in-memory fallback."""
import asyncio
import logging
import time
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    allowed: bool
    remaining: int
    retry_after: int  # Seconds until rate limit resets


class BaseRateLimiter(ABC):
    """Abstract base class for rate limiters."""

    @abstractmethod
    async def is_allowed(self, key: str) -> RateLimitResult:
        """
        Check if a request is allowed for the given key.

        Args:
            key: Unique identifier for the rate limit (e.g., user_id)

        Returns:
            RateLimitResult with allowed status and metadata
        """
        pass


class InMemoryRateLimiter(BaseRateLimiter):
    """Simple in-memory rate limiter using sliding window algorithm."""

    def __init__(self, max_requests: int = 20, window_seconds: int = 60):
        """
        Initialize the rate limiter.

        Args:
            max_requests: Maximum requests allowed per window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def is_allowed(self, key: str) -> RateLimitResult:
        """Check if a request is allowed using sliding window."""
        async with self._lock:
            now = time.time()
            window_start = now - self.window_seconds

            # Clean up old requests outside the window
            self.requests[key] = [
                req_time for req_time in self.requests[key]
                if req_time > window_start
            ]

            current_count = len(self.requests[key])

            if current_count >= self.max_requests:
                # Calculate retry_after from oldest request in window
                if self.requests[key]:
                    oldest = min(self.requests[key])
                    retry_after = int(oldest + self.window_seconds - now)
                else:
                    retry_after = self.window_seconds
                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    retry_after=max(0, retry_after)
                )

            # Record this request
            self.requests[key].append(now)
            return RateLimitResult(
                allowed=True,
                remaining=self.max_requests - current_count - 1,
                retry_after=0
            )


class RedisRateLimiter(BaseRateLimiter):
    """
    Redis-based rate limiter using sliding window with sorted sets.

    This implementation scales horizontally across multiple server instances
    by storing rate limit data in Redis.
    """

    def __init__(
        self,
        redis_url: str,
        max_requests: int = 20,
        window_seconds: int = 60,
        key_prefix: str = "ratelimit:chat"
    ):
        """
        Initialize the Redis rate limiter.

        Args:
            redis_url: Redis connection URL
            max_requests: Maximum requests allowed per window
            window_seconds: Time window in seconds
            key_prefix: Prefix for Redis keys
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.key_prefix = key_prefix
        self._redis_url = redis_url
        self._redis = None
        self._connection_attempted = False

    async def _get_redis(self):
        """Get or create Redis connection."""
        if self._redis is None and not self._connection_attempted:
            self._connection_attempted = True
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(
                    self._redis_url,
                    encoding="utf-8",
                    decode_responses=True
                )
                # Test connection
                await self._redis.ping()
                logger.info("Connected to Redis for rate limiting")
            except Exception as e:
                logger.warning(f"Failed to connect to Redis: {e}. Rate limiting may be degraded.")
                self._redis = None
        return self._redis

    async def is_allowed(self, key: str) -> RateLimitResult:
        """
        Check if a request is allowed using Redis sorted sets.

        Uses a sliding window algorithm:
        1. Remove entries outside the window
        2. Count remaining entries
        3. If under limit, add new entry
        """
        redis = await self._get_redis()
        if redis is None:
            # Fallback: allow request but log warning
            logger.warning("Redis unavailable, allowing request without rate limit")
            return RateLimitResult(allowed=True, remaining=self.max_requests, retry_after=0)

        redis_key = f"{self.key_prefix}:{key}"
        now = time.time()
        window_start = now - self.window_seconds

        try:
            # Use pipeline for atomicity
            async with redis.pipeline(transaction=True) as pipe:
                # Remove entries outside the window
                pipe.zremrangebyscore(redis_key, '-inf', window_start)
                # Count current entries
                pipe.zcard(redis_key)
                # Execute first batch
                results = await pipe.execute()
                current_count = results[1]

                if current_count >= self.max_requests:
                    # Get oldest entry to calculate retry_after
                    oldest_entries = await redis.zrange(redis_key, 0, 0, withscores=True)
                    if oldest_entries:
                        oldest_time = oldest_entries[0][1]
                        retry_after = int(oldest_time + self.window_seconds - now)
                    else:
                        retry_after = self.window_seconds
                    return RateLimitResult(
                        allowed=False,
                        remaining=0,
                        retry_after=max(0, retry_after)
                    )

                # Add this request
                async with redis.pipeline(transaction=True) as pipe:
                    pipe.zadd(redis_key, {str(now): now})
                    pipe.expire(redis_key, self.window_seconds + 1)
                    await pipe.execute()

                return RateLimitResult(
                    allowed=True,
                    remaining=self.max_requests - current_count - 1,
                    retry_after=0
                )

        except Exception as e:
            logger.error(f"Redis rate limit error: {e}")
            # On error, allow the request (fail open)
            return RateLimitResult(allowed=True, remaining=self.max_requests, retry_after=0)

    async def close(self):
        """Close the Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None


class HybridRateLimiter(BaseRateLimiter):
    """
    Hybrid rate limiter that uses Redis when available, falls back to in-memory.

    This provides the best of both worlds:
    - Distributed rate limiting when Redis is available
    - Graceful degradation to in-memory when Redis is unavailable
    """

    def __init__(
        self,
        redis_url: Optional[str] = None,
        max_requests: int = 20,
        window_seconds: int = 60
    ):
        """
        Initialize the hybrid rate limiter.

        Args:
            redis_url: Optional Redis connection URL
            max_requests: Maximum requests allowed per window
            window_seconds: Time window in seconds
        """
        self.max_requests = max_requests
        self.window_seconds = window_seconds

        # Create both limiters
        self._in_memory = InMemoryRateLimiter(max_requests, window_seconds)
        self._redis: Optional[RedisRateLimiter] = None
        self._use_redis = False

        if redis_url:
            self._redis = RedisRateLimiter(
                redis_url=redis_url,
                max_requests=max_requests,
                window_seconds=window_seconds
            )

    async def is_allowed(self, key: str) -> RateLimitResult:
        """Check rate limit using Redis if available, otherwise in-memory."""
        if self._redis:
            try:
                result = await self._redis.is_allowed(key)
                self._use_redis = True
                return result
            except Exception as e:
                logger.warning(f"Redis rate limiter failed, falling back to in-memory: {e}")
                self._use_redis = False

        return await self._in_memory.is_allowed(key)

    @property
    def is_distributed(self) -> bool:
        """Check if the limiter is using distributed (Redis) storage."""
        return self._use_redis

    async def close(self):
        """Close any connections."""
        if self._redis:
            await self._redis.close()


# Singleton instance
_rate_limiter: Optional[HybridRateLimiter] = None


def get_rate_limiter(
    redis_url: Optional[str] = None,
    max_requests: int = 20,
    window_seconds: int = 60
) -> HybridRateLimiter:
    """
    Get or create the rate limiter singleton.

    Args:
        redis_url: Optional Redis URL (only used on first call)
        max_requests: Max requests per window (only used on first call)
        window_seconds: Window size in seconds (only used on first call)

    Returns:
        HybridRateLimiter instance
    """
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = HybridRateLimiter(
            redis_url=redis_url,
            max_requests=max_requests,
            window_seconds=window_seconds
        )
    return _rate_limiter
