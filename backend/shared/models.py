"""
Database models for the document processing system.

This module defines Pydantic models for API validation.
ORM models are defined in prisma/schema.prisma (Prisma Schema Language).

Import Prisma-generated models from prisma.models after running: prisma generate
"""

from datetime import datetime
from enum import Enum
from typing import Optional, Dict, Any


class JobStatus(str, Enum):
    """Job status enumeration."""
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ScanStatus(str, Enum):
    """File scan status enumeration."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class ValidationStatus(str, Enum):
    """JSON validation status enumeration."""
    PENDING = "pending"
    VALID = "valid"
    INVALID = "invalid"


# Prisma-generated models are imported at runtime
# from prisma.models import User, File, Job, ExtractedJSON, LLMResult, ProcessingMetric
# These will be available after running: prisma generate
