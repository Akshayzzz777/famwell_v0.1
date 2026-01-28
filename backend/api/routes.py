"""API routes for file upload and job management using Prisma ORM."""

import logging
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, status, Depends
from fastapi.responses import JSONResponse

from config.settings import settings
from shared.security import (
    validate_pdf_magic_bytes, validate_file_size, sanitize_filename,
    calculate_file_hash, generate_job_id, generate_file_id, validate_filename
)
from shared.database import get_prisma_client
from shared.gcs_client import get_gcs_client
from shared.job_queue import get_queue
from shared.models import JobStatus
from shared.schemas import UploadResponse, ErrorResponse
from shared.logger import get_logger
from api.auth import get_current_user
from api.rate_limit import check_rate_limit

logger = get_logger(__name__)
router = APIRouter(prefix="/api", tags=["uploads"])


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
    _: bool = Depends(check_rate_limit),
) -> UploadResponse:
    """Upload a PDF file for processing.

    Args:
        file: PDF file to upload
        current_user: Authenticated user object
        _: Rate limit check

    Returns:
        Upload response with job ID and signed URL

    Raises:
        HTTPException: If validation fails
    """
    prisma = get_prisma_client(settings.database_url)

    try:
        user_id = current_user.get("user_id")

        logger.info_with_context(
            "Processing file upload",
            user_id=user_id,
            filename=file.filename
        )

        # Validate filename
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Filename is required",
            )

        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are allowed",
            )

        # Sanitize filename
        sanitized_filename = sanitize_filename(file.filename)

        # Read file content
        file_content = await file.read()

        if not file_content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is empty",
            )

        # Validate file type (PDF magic bytes)
        if not validate_pdf_magic_bytes(file_content):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File is not a valid PDF",
            )

        # Validate file size
        if not validate_file_size(len(file_content)):
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File size exceeds maximum of {settings.max_file_size_mb}MB",
            )

        # Calculate file hash (for deduplication)
        file_hash = calculate_file_hash(file_content)

        # Check for duplicate files using Prisma
        existing_file = await prisma.file.find_first(
            where={"file_hash": file_hash}
        )

        if existing_file and existing_file.user_id == user_id:
            logger.warning_with_context(
                "Duplicate file upload attempt",
                user_id=user_id,
                filename=sanitized_filename
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This file has already been uploaded",
            )

        # Generate IDs
        file_id = generate_file_id()
        job_id = generate_job_id()

        # Build GCS path
        today = date.today()
        gcs_path = f"documents/{user_id}/{today.year}/{today.month:02d}/{today.day:02d}/{file_id}.pdf"

        # Upload to GCS
        gcs_client = get_gcs_client()
        upload_success = gcs_client.upload_file(
            file_content,
            gcs_path,
            content_type="application/pdf",
            metadata={
                "user_id": user_id,
                "file_id": file_id,
                "original_filename": sanitized_filename,
            }
        )

        if not upload_success:
            logger.error_with_context(
                "GCS upload failed",
                user_id=user_id,
                file_id=file_id
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to upload file to storage",
            )

        logger.info_with_context(
            "File uploaded to GCS",
            user_id=user_id,
            file_id=file_id,
            gcs_path=gcs_path
        )

        # Create File and Job records using Prisma
        file_record = await prisma.file.create(
            data={
                "file_id": file_id,
                "user_id": user_id,
                "filename": sanitized_filename,
                "file_size_bytes": len(file_content),
                "file_hash": file_hash,
                "gcs_path": gcs_path,
                "scan_status": "pending",
            }
        )

        job_record = await prisma.job.create(
            data={
                "job_id": job_id,
                "file_id": file_id,
                "user_id": user_id,
                "status": JobStatus.PENDING.value,
                "created_at": datetime.utcnow(),
            }
        )

        logger.info_with_context(
            "File and job records created",
            user_id=user_id,
            file_id=file_id,
            job_id=job_id
        )

        # Enqueue job
        queue = get_queue()
        queue_success = queue.enqueue_job(
            job_id=job_id,
            file_id=file_id,
            user_id=user_id,
            gcs_path=gcs_path,
            metadata={"filename": sanitized_filename}
        )

        if not queue_success:
            logger.error_with_context(
                "Failed to enqueue job",
                user_id=user_id,
                job_id=job_id
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to queue job for processing",
            )

        logger.info_with_context(
            "Job enqueued successfully",
            user_id=user_id,
            job_id=job_id
        )

        # Generate signed URL for download (for user reference)
        signed_url = gcs_client.generate_signed_url(gcs_path, expiration_hours=24)

        if not signed_url:
            signed_url = "N/A"

        return UploadResponse(
            file_id=file_id,
            job_id=job_id,
            upload_url=signed_url,
            expires_in_seconds=24 * 3600,
            filename=sanitized_filename,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error_with_context(
            f"Upload error: {e}",
            user_id=current_user.get("user_id"),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during file upload",
        )


@router.get("/status/{job_id}")
async def get_job_status(
    job_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get status of a processing job.

    Args:
        job_id: Job ID
        current_user: Authenticated user object

    Returns:
        Job status information

    Raises:
        HTTPException: If job not found
    """
    prisma = get_prisma_client(settings.database_url)

    try:
        # Get job using Prisma
        job = await prisma.job.find_unique(where={"job_id": job_id})

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found",
            )

        # Verify ownership
        if job.user_id != current_user.get("user_id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this job",
            )

        logger.info_with_context(
            "Job status retrieved",
            user_id=current_user.get("user_id"),
            job_id=job_id
        )

        # Calculate progress
        progress = 0
        if job.status == JobStatus.PENDING.value:
            progress = 0
        elif job.status == JobStatus.PROCESSING.value:
            progress = 50
        elif job.status == JobStatus.COMPLETED.value:
            progress = 100
        elif job.status == JobStatus.FAILED.value:
            progress = 0

        return {
            "job_id": job.job_id,
            "file_id": job.file_id,
            "status": job.status,
            "created_at": job.created_at.isoformat() if job.created_at else None,
            "started_at": job.started_at.isoformat() if job.started_at else None,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "progress": progress,
            "retry_count": job.retry_count,
            "error_message": job.error_message,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error_with_context(
            f"Status check error: {e}",
            user_id=current_user.get("user_id"),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while checking job status",
        )


@router.get("/result/{job_id}")
async def get_job_result(
    job_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get processing result of a completed job.

    Args:
        job_id: Job ID
        current_user: Authenticated user object

    Returns:
        Job result data

    Raises:
        HTTPException: If job not found or not completed
    """
    prisma = get_prisma_client(settings.database_url)

    try:
        # Get job with related data using Prisma
        job = await prisma.job.find_unique(
            where={"job_id": job_id},
            include={
                "extracted_json": True,
                "llm_result": True,
            }
        )

        if not job:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found",
            )

        # Verify ownership
        if job.user_id != current_user.get("user_id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this job",
            )

        if job.status != JobStatus.COMPLETED.value:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Job is not completed. Current status: {job.status}",
            )

        logger.info_with_context(
            "Job result retrieved",
            user_id=current_user.get("user_id"),
            job_id=job_id
        )

        # Build result response
        result = {
            "job_id": job.job_id,
            "file_id": job.file_id,
            "status": job.status,
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        }

        if job.extracted_json:
            result["extracted_data"] = {
                "extraction_id": job.extracted_json.extraction_id,
                "data": job.extracted_json.extracted_data,
                "validation_status": job.extracted_json.validation_status,
                "extracted_at": job.extracted_json.created_at.isoformat(),
            }

        if job.llm_result:
            result["llm_result"] = {
                "result_id": job.llm_result.result_id,
                "response": job.llm_result.llm_response,
                "structured_output": job.llm_result.structured_output,
                "processing_time_seconds": job.llm_result.processing_time_seconds,
                "model_used": job.llm_result.model_used,
                "created_at": job.llm_result.created_at.isoformat(),
            }

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error_with_context(
            f"Result retrieval error: {e}",
            user_id=current_user.get("user_id"),
            exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while retrieving job result",
        )
