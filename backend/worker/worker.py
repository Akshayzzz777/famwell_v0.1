"""Main worker service for processing jobs."""

import os
import sys
import logging
import time
import signal
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.settings import settings
from shared.logger import setup_logging
from shared.job_queue import get_queue
from shared.database import get_db_manager, get_db_session
from shared.gcs_client import get_gcs_client
from shared.json_validator import get_json_validator
from shared.llm_client import get_llm_client
from shared.models import Job, ExtractedJSON, LLMResult, JobStatus
from shared.schemas import ExtractedJSONValidator
from shared.security import generate_extraction_id, generate_result_id
from worker.pdf_processor import process_pdf

# Setup logging
setup_logging()
logger = logging.getLogger(__name__)


class Worker:
    """Background worker for processing jobs."""

    def __init__(self, worker_id: str = "worker-1"):
        """Initialize worker.

        Args:
            worker_id: Worker identifier
        """
        self.worker_id = worker_id
        self.is_running = False
        self.processed_count = 0
        self.failed_count = 0

        # Initialize components
        self.queue = get_queue()
        self.db_manager = get_db_manager()
        self.gcs_client = get_gcs_client()
        self.validator = get_json_validator()
        self.llm_client = get_llm_client()

        # System prompt (fixed business logic)
        self.system_prompt = """You are a document analysis assistant specialized in extracting and 
processing structured information from business documents. 

Your tasks:
1. Analyze the provided extracted document data
2. Identify key information and entities
3. Perform any business logic processing required
4. Return structured insights and findings
5. Flag any anomalies or items requiring human review

Ensure your responses are accurate, concise, and actionable."""

        # Register signal handlers
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals."""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.is_running = False

    def start(self):
        """Start worker loop."""
        self.is_running = True
        logger.info(f"Worker {self.worker_id} started")

        while self.is_running:
            try:
                # Get next job from queue
                job_data = self.queue.dequeue_job()

                if job_data:
                    job_id = job_data.get("job_id")
                    logger.info_with_context(
                        f"Processing job",
                        job_id=job_id
                    )

                    # Process the job
                    success = self.process_job(job_data)

                    if success:
                        self.processed_count += 1
                    else:
                        self.failed_count += 1
                else:
                    # Queue is empty, wait before checking again
                    time.sleep(5)

            except Exception as e:
                logger.error(f"Error in worker loop: {e}", exc_info=True)
                time.sleep(5)

        logger.info(
            f"Worker {self.worker_id} stopped. "
            f"Processed: {self.processed_count}, Failed: {self.failed_count}"
        )

    def process_job(self, job_data: dict) -> bool:
        """Process a single job.

        Args:
            job_data: Job data from queue

        Returns:
            True if successful, False otherwise
        """
        job_id = job_data.get("job_id")
        file_id = job_data.get("file_id")
        user_id = job_data.get("user_id")
        gcs_path = job_data.get("gcs_path")
        retry_count = job_data.get("retry_count", 0)

        session = None

        try:
            # Update job status to processing
            session = self.db_manager.get_session()
            job = session.query(Job).filter(Job.job_id == job_id).first()

            if not job:
                logger.error(f"Job not found: {job_id}")
                self.queue.push_to_dlq(job_data, "Job record not found in database")
                return False

            job.status = JobStatus.PROCESSING
            job.started_at = datetime.utcnow()
            session.commit()

            logger.info_with_context(
                "Job status updated to processing",
                job_id=job_id
            )

            # 1. Download PDF from GCS
            logger.info_with_context("Downloading PDF from GCS", job_id=job_id)
            pdf_content = self.gcs_client.download_file(gcs_path)

            if not pdf_content:
                raise Exception("Failed to download PDF from GCS")

            logger.info_with_context(
                "PDF downloaded successfully",
                job_id=job_id,
                size_bytes=len(pdf_content)
            )

            # 2. Process PDF and extract JSON
            logger.info_with_context(
                "Processing PDF and extracting text",
                job_id=job_id
            )
            extracted_json = process_pdf(pdf_content, job_data.get("filename", "document.pdf"))

            # 3. Validate extracted JSON
            logger.info_with_context("Validating extracted JSON", job_id=job_id)
            is_valid, validation_msg, sanitized_json = self.validator.validate_extracted_json(
                extracted_json
            )

            if not is_valid:
                logger.warning_with_context(
                    f"JSON validation failed: {validation_msg}",
                    job_id=job_id
                )

            # Store extracted JSON
            extraction_id = generate_extraction_id()
            extracted_json_record = ExtractedJSON(
                extraction_id=extraction_id,
                job_id=job_id,
                extracted_data=sanitized_json,
                validation_status="valid" if is_valid else "sanitized",
                validation_errors=None if is_valid else {"message": validation_msg},
                extracted_at=datetime.utcnow(),
            )
            session.add(extracted_json_record)
            session.commit()

            logger.info_with_context(
                "Extracted JSON stored",
                job_id=job_id,
                extraction_id=extraction_id
            )

            # 4. Merge with system prompt and call Azure OpenAI
            logger.info_with_context(
                "Sending prompt to Azure OpenAI",
                job_id=job_id
            )

            user_prompt = self.validator.merge_extraction_and_system_prompt(
                sanitized_json,
                self.system_prompt
            )

            llm_result = self.llm_client.send_prompt(
                system_prompt=self.system_prompt,
                user_prompt=user_prompt,
                metadata={"job_id": job_id, "user_id": user_id}
            )

            if not llm_result:
                raise Exception("Failed to get response from Azure OpenAI")

            logger.info_with_context(
                "Received response from Azure OpenAI",
                job_id=job_id,
                time_seconds=llm_result.get("processing_time_seconds")
            )

            # 5. Validate LLM response
            logger.info_with_context("Validating LLM response", job_id=job_id)
            is_valid_response, response_msg, structured_output = self.validator.validate_llm_response(
                llm_result.get("response", "")
            )

            # Store LLM result
            result_id = generate_result_id()
            llm_record = LLMResult(
                result_id=result_id,
                job_id=job_id,
                prompt_sent=user_prompt[:5000],  # Store truncated prompt
                llm_response=llm_result.get("response", ""),
                structured_output=structured_output,
                processing_time_seconds=llm_result.get("processing_time_seconds", 0),
                tokens_used=llm_result.get("tokens_used"),
                model_used=llm_result.get("model", settings.azure_openai_deployment),
                created_at=datetime.utcnow(),
            )
            session.add(llm_record)

            # Mark job as completed
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            session.commit()

            logger.info_with_context(
                "Job completed successfully",
                job_id=job_id,
                result_id=result_id
            )

            return True

        except Exception as e:
            logger.error_with_context(
                f"Job processing failed: {e}",
                job_id=job_id,
                retry_count=retry_count,
                exc_info=True
            )

            # Update job status
            if session and job:
                job.status = JobStatus.FAILED
                job.error_message = str(e)[:500]
                job.retry_count = retry_count + 1
                session.commit()

            # Check if should retry
            if retry_count < settings.worker_retry_attempts:
                logger.info_with_context(
                    f"Retrying job (attempt {retry_count + 1})",
                    job_id=job_id
                )
                job_data["retry_count"] = retry_count + 1
                self.queue.enqueue_job(
                    job_data.get("job_id"),
                    job_data.get("file_id"),
                    job_data.get("user_id"),
                    job_data.get("gcs_path"),
                )
            else:
                logger.error_with_context(
                    "Job failed after max retries, pushing to DLQ",
                    job_id=job_id
                )
                self.queue.push_to_dlq(job_data, str(e))

            return False

        finally:
            if session:
                session.close()


def main():
    """Main entry point."""
    logger.info("Starting document processing worker...")

    # Initialize worker
    worker = Worker(worker_id=settings.worker_concurrency or 1)

    try:
        # Start processing
        worker.start()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt")
    except Exception as e:
        logger.error(f"Worker error: {e}", exc_info=True)
    finally:
        logger.info("Worker shutdown complete")


if __name__ == "__main__":
    main()
