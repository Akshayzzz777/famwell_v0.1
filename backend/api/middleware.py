"""Request/response handling middleware."""

import time
import logging
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Middleware to add request context."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Add request context.

        Args:
            request: Request object
            call_next: Next middleware/handler

        Returns:
            Response object
        """
        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Record start time
        start_time = time.time()

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        request.state.client_ip = client_ip

        # Call next handler
        response = await call_next(request)

        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000

        # Add headers
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Process-Time"] = str(duration_ms)

        # Log request
        logger.info(
            f"{request.method} {request.url.path} - {response.status_code} "
            f"({duration_ms:.2f}ms) - {client_ip}"
        )

        return response


class ErrorHandlingMiddleware(BaseHTTPMiddleware):
    """Middleware for error handling."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Handle errors.

        Args:
            request: Request object
            call_next: Next middleware/handler

        Returns:
            Response object
        """
        try:
            response = await call_next(request)
            return response
        except Exception as e:
            logger.error(
                f"Unhandled error: {e}",
                exc_info=True,
                extra={"request_id": getattr(request.state, "request_id", "unknown")}
            )
            raise
