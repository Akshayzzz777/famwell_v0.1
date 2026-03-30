"""Structured logging configuration."""

import logging
import json
from datetime import datetime
from typing import Any, Dict, Optional
import sys

from config.settings import settings


class JSONFormatter(logging.Formatter):
    """JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        """Format log record as JSON."""
        log_obj = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add extra fields
        if hasattr(record, "user_id"):
            log_obj["user_id"] = record.user_id
        if hasattr(record, "job_id"):
            log_obj["job_id"] = record.job_id
        if hasattr(record, "request_id"):
            log_obj["request_id"] = record.request_id
        if hasattr(record, "duration_ms"):
            log_obj["duration_ms"] = record.duration_ms

        # Add exception info
        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj, default=str)


def setup_logging():
    """Configure structured logging."""
    root_logger = logging.getLogger()
    root_logger.setLevel(settings.api_log_level)

    # Console handler with JSON formatter
    console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(console_handler)

    # Suppress noisy Prisma engine logs (httpx requests to localhost query engine)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    return root_logger


def get_logger(name: str) -> logging.LoggerAdapter:
    """Get configured logger with context support."""
    logger = logging.getLogger(name)
    return LoggerAdapter(logger)


class LoggerAdapter(logging.LoggerAdapter):
    """Custom logger adapter for context injection."""

    def process(self, msg: str, kwargs: Dict[str, Any]) -> tuple:
        """Process log message with context."""
        return msg, kwargs

    def with_context(self, **context) -> "LoggerAdapter":
        """Add context to logger."""
        return LoggerAdapter(self.logger, context)

    def info_with_context(self, msg: str, **context):
        """Log info with context."""
        self.extra = {**self.extra, **context}
        self.info(msg)

    def error_with_context(self, msg: str, **context):
        """Log error with context."""
        self.extra = {**self.extra, **context}
        self.error(msg)

    def warning_with_context(self, msg: str, **context):
        """Log warning with context."""
        self.extra = {**self.extra, **context}
        self.warning(msg)

    def debug_with_context(self, msg: str, **context):
        """Log debug with context."""
        self.extra = {**self.extra, **context}
        self.debug(msg)
