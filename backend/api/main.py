"""Main FastAPI application using Prisma ORM."""

import os
import sys
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import settings
from shared.logger import setup_logging
from shared.database import get_prisma_client
from shared.feature_store import ensure_supporting_schema, fetch_user_profile
from api.auth import get_optional_current_user
from api.middleware import RequestContextMiddleware, ErrorHandlingMiddleware
from api.routes import router as api_router
from api.feature_routes import router as feature_router

setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up...")

    prisma = get_prisma_client(settings.database_url)
    await prisma.connect()

    try:
        await ensure_supporting_schema(prisma)
        await prisma.user.find_first()
        logger.info("Database connected successfully")
    except Exception as error:
        logger.error(f"Database health check failed: {error}")
        raise RuntimeError("Failed to connect to database")

    yield

    logger.info("Shutting down...")
    await prisma.disconnect()
    logger.info("Shutdown complete")


def create_app() -> FastAPI:
    app = FastAPI(
        title="FamWell Backend",
        description="Production-ready backend for AI document processing",
        version="1.0.0",
        openapi_url="/api/docs/openapi.json" if settings.api_env == "development" else None,
        docs_url="/api/docs" if settings.api_env == "development" else None,
        redoc_url="/api/redoc" if settings.api_env == "development" else None,
        lifespan=lifespan,
    )

    app.add_middleware(ErrorHandlingMiddleware)
    app.add_middleware(RequestContextMiddleware)
    cors_origins = settings.cors_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials="*" not in cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)
    app.include_router(feature_router)

    @app.get("/health")
    async def health_check(current_user: dict | None = Depends(get_optional_current_user)):
        prisma = get_prisma_client(settings.database_url)

        try:
            await prisma.query_raw("SELECT 1 AS ok")
            profile = None
            if current_user:
                profile = await fetch_user_profile(prisma, current_user["user_id"])

            payload = {
                "status": "healthy",
                "environment": settings.api_env,
                "api_version": "1.0.0",
                "database": "connected",
                "authenticated": bool(current_user),
                "role": current_user.get("role") if current_user else None,
                "user": {
                    "user_id": profile.get("user_id") if profile else None,
                    "email": profile.get("email") if profile else None,
                    "role": profile.get("role") if profile else None,
                    "health_id": profile.get("health_id") if profile else None,
                    "full_name": profile.get("full_name") if profile else None,
                } if profile else None,
            }
            return {"success": True, "data": payload, **payload}
        except Exception as error:
            logger.error(f"Health check failed: {error}", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "success": False,
                    "message": "Database connectivity check failed.",
                    "status": "unhealthy",
                    "database": "disconnected",
                },
            )

    @app.get("/")
    async def root():
        return {
            "service": "FamWell Backend",
            "version": "1.0.0",
            "status": "running",
            "docs": "/api/docs" if settings.api_env == "development" else "Not available",
        }

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"error_code": "NOT_FOUND", "message": "Resource not found"},
        )

    @app.exception_handler(500)
    async def internal_error_handler(request: Request, exc):
        logger.error(f"Internal server error: {exc}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error_code": "INTERNAL_ERROR", "message": "Internal server error"},
        )

    logger.info("FastAPI application created and configured")
    return app


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
