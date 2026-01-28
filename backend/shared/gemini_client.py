"""Gemini LLM API client."""

import logging
import time
from typing import Optional, Dict, Any
import google.generativeai as genai
from google.api_core.exceptions import GoogleAPIError, DeadlineExceeded

from config.settings import settings

logger = logging.getLogger(__name__)


class GeminiClient:
    """Gemini API client wrapper."""

    def __init__(self):
        """Initialize Gemini client."""
        self.api_key = settings.gemini_api_key
        self.model_name = settings.gemini_model
        self.timeout_seconds = settings.gemini_timeout_seconds
        self.max_retries = settings.gemini_max_retries
        self.retry_delay = settings.gemini_retry_delay_seconds

        # Configure API
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel(self.model_name)

    def send_prompt(
        self,
        system_prompt: str,
        user_prompt: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Send prompt to Gemini API.

        Args:
            system_prompt: System/business logic prompt
            user_prompt: User-specific prompt (merged with extracted JSON)
            metadata: Optional metadata for tracking

        Returns:
            Dict with response and metadata, or None if fails
        """
        start_time = time.time()

        for attempt in range(self.max_retries):
            try:
                # Combine prompts
                full_prompt = f"{system_prompt}\n\n{user_prompt}"

                # Call Gemini API with timeout
                response = self.model.generate_content(
                    full_prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.7,
                        top_p=0.9,
                        top_k=40,
                        max_output_tokens=2048,
                    ),
                    request_options={"timeout": self.timeout_seconds},
                )

                processing_time = time.time() - start_time

                # Parse response
                if response and response.text:
                    result = {
                        "response": response.text,
                        "model": self.model_name,
                        "processing_time_seconds": processing_time,
                        "tokens_used": self._estimate_tokens(response.text),
                        "attempt": attempt + 1,
                    }

                    if metadata:
                        result["metadata"] = metadata

                    logger.info(
                        f"Successfully received response from Gemini "
                        f"(attempt {attempt + 1}, time: {processing_time:.2f}s)"
                    )
                    return result
                else:
                    logger.warning(f"Empty response from Gemini (attempt {attempt + 1})")
                    if attempt < self.max_retries - 1:
                        time.sleep(self.retry_delay)
                        continue
                    return None

            except DeadlineExceeded as e:
                logger.warning(
                    f"Gemini request timeout (attempt {attempt + 1}): {e}"
                )
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                    continue
                else:
                    logger.error("Max retries exceeded for Gemini request timeout")
                    return None

            except GoogleAPIError as e:
                logger.error(
                    f"Gemini API error (attempt {attempt + 1}): {e}",
                    exc_info=True
                )
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                    continue
                else:
                    return None

            except Exception as e:
                logger.error(
                    f"Unexpected error calling Gemini (attempt {attempt + 1}): {e}",
                    exc_info=True
                )
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)
                    continue
                else:
                    return None

        logger.error("Failed to get response from Gemini after all retries")
        return None

    def _estimate_tokens(self, text: str) -> int:
        """Estimate token count for response.

        Args:
            text: Response text

        Returns:
            Estimated token count
        """
        # Simple estimation: ~4 characters per token on average
        return len(text) // 4

    def validate_api_key(self) -> bool:
        """Validate Gemini API key.

        Returns:
            True if API key is valid
        """
        try:
            # Try a simple request to validate
            response = self.model.generate_content("Hello")
            return response is not None
        except Exception as e:
            logger.error(f"Failed to validate Gemini API key: {e}")
            return False


# Global Gemini client instance
_gemini_client: Optional[GeminiClient] = None


def get_gemini_client() -> GeminiClient:
    """Get or initialize Gemini client (singleton)."""
    global _gemini_client
    if _gemini_client is None:
        _gemini_client = GeminiClient()
    return _gemini_client
