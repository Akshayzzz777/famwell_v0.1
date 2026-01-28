"""Rate limiting middleware."""

import logging
from datetime import datetime, timedelta
from typing import Optional
from fastapi import HTTPException, status
from fastapi.requests import Request
import redis

from config.settings import settings
from shared.security import RateLimitKey

logger = logging.getLogger(__name__)


class RateLimiter:
    """Rate limiter using Redis."""

    def __init__(self):
        """Initialize rate limiter."""
        self.redis_client = redis.from_url(settings.redis_url, decode_responses=True)
        self.max_requests = settings.rate_limit_requests
        self.window_seconds = settings.rate_limit_window_seconds

    def is_rate_limited(self, key: str) -> bool:
        """Check if request is rate limited.

        Args:
            key: Rate limit key

        Returns:
            True if rate limited, False otherwise
        """
        try:
            current = self.redis_client.get(key)

            if current is None:
                # First request in window
                self.redis_client.setex(key, self.window_seconds, 1)
                return False

            count = int(current)

            if count >= self.max_requests:
                return True

            # Increment counter
            self.redis_client.incr(key)
            return False

        except Exception as e:
            logger.error(f"Rate limiter error: {e}")
            # On error, don't rate limit
            return False

    def check_user_rate_limit(self, user_id: str) -> bool:
        """Check if user is rate limited.

        Args:
            user_id: User ID

        Returns:
            True if rate limited
        """
        key = RateLimitKey.user_upload_key(user_id)
        return self.is_rate_limited(key)

    def check_ip_rate_limit(self, ip: str) -> bool:
        """Check if IP is rate limited.

        Args:
            ip: IP address

        Returns:
            True if rate limited
        """
        key = RateLimitKey.ip_request_key(ip)
        return self.is_rate_limited(key)


# Global rate limiter instance
_rate_limiter: Optional[RateLimiter] = None


def get_rate_limiter() -> RateLimiter:
    """Get or initialize rate limiter (singleton)."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


async def check_rate_limit(request: Request) -> bool:
    """Rate limit dependency for FastAPI.

    Args:
        request: Request object

    Returns:
        True if within limits

    Raises:
        HTTPException: If rate limited
    """
    rate_limiter = get_rate_limiter()

    # Get client IP
    client_ip = request.client.host

    if rate_limiter.check_ip_rate_limit(client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later.",
        )

    return True
