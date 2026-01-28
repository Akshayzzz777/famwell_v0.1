"""Main FastAPI application using Prisma ORM."""

import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import settings
from shared.logger import setup_logging
from shared.database import get_db_manager, get_prisma_client
from api.middleware import RequestContextMiddleware, ErrorHandlingMiddleware
from api.routes import router as api_router

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown events.

    Args:
        app: FastAPI application instance

    Yields:
        None
    """
    # Startup
    logger.info("Starting up...")
    
    # Initialize Prisma client
    prisma = get_prisma_client(settings.database_url)
    await prisma.connect()

    # Check database health
    try:
        health_result = await prisma.user.find_first()
        logger.info("Database connected successfully")
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        raise RuntimeError("Failed to connect to database")

    yield

    # Shutdown
    logger.info("Shutting down...")
    await prisma.disconnect()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    """Create and configure FastAPI application.

    Returns:
        Configured FastAPI application
    """
    app = FastAPI(
        title="Document Processing Pipeline",
        description="Production-ready backend for AI document processing",
        version="1.0.0",
        openapi_url="/api/docs/openapi.json" if settings.api_env == "development" else None,
        docs_url="/api/docs" if settings.api_env == "development" else None,
        redoc_url="/api/redoc" if settings.api_env == "development" else None,
        lifespan=lifespan,
    )

    # Add middleware
    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(RequestContextMiddleware)

    # Add CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routes
    app.include_router(api_router)

    # Health check endpoint
    @app.get("/health")
    async def health_check():
        """Health check endpoint."""
        return {
            "status": "healthy",
            "environment": settings.api_env,
            "api_version": "1.0.0",
        }

    # Root endpoint
    @app.get("/")
    async def root():
        """Root endpoint."""
        return {
            "service": "Document Processing Pipeline",
            "version": "1.0.0",
            "status": "running",
            "docs": "/api/docs" if settings.api_env == "development" else "Not available",
        }

    # Exception handlers
    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        """Handle 404 errors."""
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error_code": "NOT_FOUND", "message": "Resource not found"},
        )

    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc):
        """Handle 500 errors."""
        logger.error(f"Internal server error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error_code": "INTERNAL_ERROR", "message": "Internal server error"},
        )

    logger.info("FastAPI application created and configured")

    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting server on {settings.api_host}:{settings.api_port}")

    uvicorn.run(
        app,
        host=settings.api_host,
        port=settings.api_port,
        log_level=settings.api_log_level.lower(),
        access_log=True,
        reload=settings.api_env == "development",
    )
