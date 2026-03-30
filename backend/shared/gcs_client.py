"""Cloud storage integration — GCS or local-filesystem fallback."""

import io
import os
from pathlib import Path
from typing import Optional, BinaryIO
import logging

from config.settings import settings

logger = logging.getLogger(__name__)


class LocalStorageClient:
    """Local filesystem storage fallback for development (no GCS credentials)."""

    def __init__(self):
        self._root = Path(settings.local_upload_dir)
        self._root.mkdir(parents=True, exist_ok=True)
        logger.info("Using LOCAL file storage at %s", self._root.resolve())

    def _resolve(self, path: str) -> Path:
        dest = self._root / path
        dest.parent.mkdir(parents=True, exist_ok=True)
        return dest

    def upload_file(self, file_content: bytes, destination_path: str,
                    content_type: str = "application/pdf",
                    metadata: Optional[dict] = None) -> bool:
        try:
            self._resolve(destination_path).write_bytes(file_content)
            logger.info("Saved file locally: %s", destination_path)
            return True
        except Exception:
            logger.error("Local save failed: %s", destination_path, exc_info=True)
            return False

    def download_file(self, source_path: str) -> Optional[bytes]:
        p = self._resolve(source_path)
        if p.exists():
            return p.read_bytes()
        logger.error("Local file not found: %s", source_path)
        return None

    def delete_file(self, path: str) -> bool:
        p = self._resolve(path)
        if p.exists():
            p.unlink()
            return True
        return False

    def file_exists(self, path: str) -> bool:
        return self._resolve(path).exists()

    def generate_signed_url(self, path: str, expiration_hours: int = 24,
                            method: str = "GET") -> Optional[str]:
        return f"/local-files/{path}"

    def get_file_metadata(self, path: str) -> Optional[dict]:
        p = self._resolve(path)
        if not p.exists():
            return None
        stat = p.stat()
        return {"size_bytes": stat.st_size, "content_type": "application/pdf",
                "updated": None, "metadata": {}}


class GCSClient:
    """Google Cloud Storage client wrapper."""

    def __init__(self):
        """Initialize GCS client."""
        self.project_id = settings.gcs_project_id
        self.bucket_name = settings.gcs_bucket_name

        # Initialize storage client
        if settings.gcs_credentials_path and settings.gcs_credentials_path != "/secrets/gcs-key.json":
            credentials = service_account.Credentials.from_service_account_file(
                settings.gcs_credentials_path
            )
            self.client = storage.Client(project=self.project_id, credentials=credentials)
        else:
            # Use default credentials (useful for local dev with gcloud auth)
            self.client = storage.Client(project=self.project_id)

        self.bucket = self.client.bucket(self.bucket_name)

    def upload_file(
        self,
        file_content: bytes,
        destination_path: str,
        content_type: str = "application/pdf",
        metadata: Optional[dict] = None,
    ) -> bool:
        """Upload file to GCS.

        Args:
            file_content: File content as bytes
            destination_path: Path in GCS (e.g., users/user_id/file_id.pdf)
            content_type: MIME type of the file
            metadata: Optional metadata to store with the file

        Returns:
            True if successful, False otherwise
        """
        try:
            blob = self.bucket.blob(destination_path)
            blob.content_type = content_type

            if metadata:
                blob.metadata = metadata

            blob.upload_from_string(file_content, content_type=content_type)
            logger.info(f"Successfully uploaded file to GCS: {destination_path}")
            return True
        except Exception as e:
            logger.error(f"Failed to upload file to GCS: {destination_path}", exc_info=True)
            return False

    def download_file(self, source_path: str) -> Optional[bytes]:
        """Download file from GCS.

        Args:
            source_path: Path in GCS (e.g., users/user_id/file_id.pdf)

        Returns:
            File content as bytes, or None if download fails
        """
        try:
            blob = self.bucket.blob(source_path)
            file_content = blob.download_as_bytes()
            logger.info(f"Successfully downloaded file from GCS: {source_path}")
            return file_content
        except Exception as e:
            logger.error(f"Failed to download file from GCS: {source_path}", exc_info=True)
            return None

    def delete_file(self, path: str) -> bool:
        """Delete file from GCS.

        Args:
            path: Path in GCS

        Returns:
            True if successful, False otherwise
        """
        try:
            blob = self.bucket.blob(path)
            blob.delete()
            logger.info(f"Successfully deleted file from GCS: {path}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete file from GCS: {path}", exc_info=True)
            return False

    def file_exists(self, path: str) -> bool:
        """Check if file exists in GCS.

        Args:
            path: Path in GCS

        Returns:
            True if file exists, False otherwise
        """
        try:
            blob = self.bucket.blob(path)
            return blob.exists()
        except Exception as e:
            logger.error(f"Error checking file existence in GCS: {path}", exc_info=True)
            return False

    def generate_signed_url(
        self,
        path: str,
        expiration_hours: int = 24,
        method: str = "GET",
    ) -> Optional[str]:
        """Generate signed URL for temporary file access.

        Args:
            path: Path in GCS
            expiration_hours: URL expiration time in hours
            method: HTTP method (GET, PUT, DELETE)

        Returns:
            Signed URL string, or None if generation fails
        """
        try:
            from datetime import timedelta

            blob = self.bucket.blob(path)
            signed_url = blob.generate_signed_url(
                version="v4",
                expiration=timedelta(hours=expiration_hours),
                method=method,
            )
            logger.info(f"Generated signed URL for: {path}")
            return signed_url
        except Exception as e:
            logger.error(f"Failed to generate signed URL for: {path}", exc_info=True)
            return None

    def get_file_metadata(self, path: str) -> Optional[dict]:
        """Get file metadata from GCS.

        Args:
            path: Path in GCS

        Returns:
            Metadata dictionary or None if retrieval fails
        """
        try:
            blob = self.bucket.blob(path)
            blob.reload()
            return {
                "size_bytes": blob.size,
                "content_type": blob.content_type,
                "updated": blob.updated.isoformat() if blob.updated else None,
                "metadata": blob.metadata,
            }
        except Exception as e:
            logger.error(f"Failed to get metadata for: {path}", exc_info=True)
            return None


# Global storage client instance
_gcs_client = None


def get_gcs_client():
    """Get or initialize storage client — always uses local filesystem."""
    global _gcs_client
    if _gcs_client is None:
        _gcs_client = LocalStorageClient()
    return _gcs_client
