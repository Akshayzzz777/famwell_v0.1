"""Redis queue management for job processing."""

import json
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import redis
from redis import Redis

from config.settings import settings

logger = logging.getLogger(__name__)


class JobQueue:
    """Redis-based job queue manager."""

    def __init__(self, redis_url: str = None):
        """Initialize job queue.

        Args:
            redis_url: Redis connection URL
        """
        self.redis_url = redis_url or settings.redis_url
        self.queue_name = settings.redis_queue_name
        self.dlq_name = settings.redis_dlq_name

        # Connect to Redis
        self.redis_client = redis.from_url(self.redis_url, decode_responses=True)

        # Verify connection
        try:
            self.redis_client.ping()
            logger.info("Connected to Redis")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise

    def enqueue_job(
        self,
        job_id: str,
        file_id: str,
        user_id: str,
        gcs_path: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Add job to processing queue.

        Args:
            job_id: Unique job ID
            file_id: File ID
            user_id: User ID
            gcs_path: GCS path to PDF
            metadata: Optional metadata

        Returns:
            True if successful
        """
        try:
            job_data = {
                "job_id": job_id,
                "file_id": file_id,
                "user_id": user_id,
                "gcs_path": gcs_path,
                "created_at": datetime.utcnow().isoformat(),
                "status": "pending",
                "retry_count": 0,
            }

            if metadata:
                job_data["metadata"] = metadata

            # Push to queue
            self.redis_client.rpush(self.queue_name, json.dumps(job_data))

            # Set TTL
            self.redis_client.expire(self.queue_name, settings.redis_ttl_seconds)

            logger.info(f"Enqueued job: {job_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to enqueue job {job_id}: {e}")
            return False

    def dequeue_job(self) -> Optional[Dict[str, Any]]:
        """Dequeue next job from processing queue.

        Returns:
            Job data dict or None if queue is empty
        """
        try:
            job_data_str = self.redis_client.lpop(self.queue_name)
            if job_data_str:
                job_data = json.loads(job_data_str)
                logger.info(f"Dequeued job: {job_data.get('job_id')}")
                return job_data
            return None
        except Exception as e:
            logger.error(f"Failed to dequeue job: {e}")
            return None

    def push_to_dlq(self, job_data: Dict[str, Any], error_message: str) -> bool:
        """Push failed job to dead letter queue.

        Args:
            job_data: Job data dict
            error_message: Error message

        Returns:
            True if successful
        """
        try:
            dlq_entry = {
                "job_id": job_data.get("job_id"),
                "job_data": job_data,
                "error_message": error_message,
                "failed_at": datetime.utcnow().isoformat(),
                "retry_count": job_data.get("retry_count", 0),
            }

            self.redis_client.rpush(self.dlq_name, json.dumps(dlq_entry))
            logger.info(f"Pushed job to DLQ: {job_data.get('job_id')}")
            return True
        except Exception as e:
            logger.error(f"Failed to push to DLQ: {e}")
            return False

    def get_queue_size(self) -> int:
        """Get number of jobs in processing queue.

        Returns:
            Number of jobs
        """
        try:
            return self.redis_client.llen(self.queue_name)
        except Exception as e:
            logger.error(f"Failed to get queue size: {e}")
            return 0

    def get_dlq_size(self) -> int:
        """Get number of jobs in dead letter queue.

        Returns:
            Number of jobs
        """
        try:
            return self.redis_client.llen(self.dlq_name)
        except Exception as e:
            logger.error(f"Failed to get DLQ size: {e}")
            return 0

    def get_dlq_jobs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get jobs from dead letter queue.

        Args:
            limit: Maximum number of jobs to retrieve

        Returns:
            List of DLQ entries
        """
        try:
            dlq_data = self.redis_client.lrange(self.dlq_name, 0, limit - 1)
            return [json.loads(entry) for entry in dlq_data]
        except Exception as e:
            logger.error(f"Failed to get DLQ jobs: {e}")
            return []

    def retry_dlq_job(self, job_id: str) -> bool:
        """Retry a job from the dead letter queue.

        Args:
            job_id: Job ID to retry

        Returns:
            True if successful
        """
        try:
            dlq_jobs = self.get_dlq_jobs(limit=1000)
            for dlq_entry in dlq_jobs:
                if dlq_entry.get("job_id") == job_id:
                    job_data = dlq_entry.get("job_data", {})
                    job_data["retry_count"] = job_data.get("retry_count", 0) + 1

                    # Remove from DLQ
                    self.redis_client.lrem(self.dlq_name, 1, json.dumps(dlq_entry))

                    # Add back to queue
                    self.redis_client.rpush(self.queue_name, json.dumps(job_data))

                    logger.info(f"Retried job from DLQ: {job_id}")
                    return True

            return False
        except Exception as e:
            logger.error(f"Failed to retry DLQ job {job_id}: {e}")
            return False

    def set_job_status(self, job_id: str, status: str, ttl_seconds: int = 3600) -> bool:
        """Store job status in Redis cache.

        Args:
            job_id: Job ID
            status: Job status
            ttl_seconds: TTL for status cache

        Returns:
            True if successful
        """
        try:
            key = f"job_status:{job_id}"
            self.redis_client.setex(key, ttl_seconds, status)
            return True
        except Exception as e:
            logger.error(f"Failed to set job status: {e}")
            return False

    def get_job_status(self, job_id: str) -> Optional[str]:
        """Get cached job status.

        Args:
            job_id: Job ID

        Returns:
            Job status or None
        """
        try:
            key = f"job_status:{job_id}"
            return self.redis_client.get(key)
        except Exception as e:
            logger.error(f"Failed to get job status: {e}")
            return None

    def close(self):
        """Close Redis connection."""
        try:
            self.redis_client.close()
            logger.info("Closed Redis connection")
        except Exception as e:
            logger.error(f"Error closing Redis connection: {e}")


# Global queue instance
_queue: Optional[JobQueue] = None


def get_queue() -> JobQueue:
    """Get or initialize job queue (singleton)."""
    global _queue
    if _queue is None:
        _queue = JobQueue()
    return _queue
