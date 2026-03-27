"""Azure OpenAI LLM API client."""

import logging
import time
from typing import Optional, Dict, Any, List

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)


class AzureOpenAIClient:
    """Azure OpenAI API client wrapper."""

    def __init__(self):
        self.endpoint = settings.azure_openai_endpoint.rstrip("/")
        self.api_key = settings.azure_openai_api_key
        self.deployment = settings.azure_openai_deployment
        self.api_version = settings.azure_openai_api_version
        self.timeout_seconds = settings.azure_openai_timeout_seconds
        self.max_retries = settings.azure_openai_max_retries
        self.retry_delay = settings.azure_openai_retry_delay_seconds

        if not self.endpoint or not self.api_key:
            logger.warning("Azure OpenAI is not configured (missing endpoint or api_key)")

    @property
    def _url(self) -> str:
        return (
            f"{self.endpoint}/openai/deployments/{self.deployment}"
            f"/chat/completions?api-version={self.api_version}"
        )

    @property
    def _headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "api-key": self.api_key,
        }

    async def chat_async(
        self,
        messages: List[Dict[str, str]],
        *,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ) -> str:
        """Async chat completion via Azure OpenAI.

        Returns:
            The assistant message content string.
        """
        if not self.endpoint or not self.api_key:
            raise RuntimeError("Azure OpenAI is not configured")

        payload = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        last_err: Optional[Exception] = None
        for attempt in range(self.max_retries):
            try:
                async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
                    response = await client.post(self._url, json=payload, headers=self._headers)
                    response.raise_for_status()

                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    raise RuntimeError("No choices in Azure OpenAI response")

                return choices[0]["message"]["content"]

            except Exception as exc:
                last_err = exc
                logger.warning("Azure OpenAI attempt %d failed: %s", attempt + 1, exc)
                if attempt < self.max_retries - 1:
                    await _async_sleep(self.retry_delay)

        raise RuntimeError(f"Azure OpenAI failed after {self.max_retries} attempts: {last_err}")

    def send_prompt(
        self,
        system_prompt: str,
        user_prompt: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        """Synchronous prompt helper (matches old GeminiClient interface).

        Kept so the background worker can call it without async.
        """
        if not self.endpoint or not self.api_key:
            logger.error("Azure OpenAI is not configured — cannot send prompt")
            return None

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        payload = {
            "messages": messages,
            "temperature": 0.7,
            "max_tokens": 2048,
        }

        start_time = time.time()
        last_err: Optional[Exception] = None

        for attempt in range(self.max_retries):
            try:
                with httpx.Client(timeout=self.timeout_seconds) as client:
                    response = client.post(self._url, json=payload, headers=self._headers)
                    response.raise_for_status()

                data = response.json()
                choices = data.get("choices", [])
                if not choices:
                    logger.warning("Empty choices from Azure OpenAI (attempt %d)", attempt + 1)
                    if attempt < self.max_retries - 1:
                        time.sleep(self.retry_delay)
                        continue
                    return None

                processing_time = time.time() - start_time
                text = choices[0]["message"]["content"]
                usage = data.get("usage", {})

                result: Dict[str, Any] = {
                    "response": text,
                    "model": self.deployment,
                    "processing_time_seconds": processing_time,
                    "tokens_used": usage.get("total_tokens", len(text) // 4),
                    "attempt": attempt + 1,
                }
                if metadata:
                    result["metadata"] = metadata

                logger.info(
                    "Azure OpenAI response received (attempt %d, %.2fs)",
                    attempt + 1,
                    processing_time,
                )
                return result

            except Exception as exc:
                last_err = exc
                logger.warning("Azure OpenAI send_prompt attempt %d failed: %s", attempt + 1, exc)
                if attempt < self.max_retries - 1:
                    time.sleep(self.retry_delay)

        logger.error("Azure OpenAI send_prompt failed after %d retries: %s", self.max_retries, last_err)
        return None


async def _async_sleep(seconds: float) -> None:
    import asyncio
    await asyncio.sleep(seconds)


_llm_client: Optional[AzureOpenAIClient] = None


def get_llm_client() -> AzureOpenAIClient:
    """Get or initialize the Azure OpenAI client (singleton)."""
    global _llm_client
    if _llm_client is None:
        _llm_client = AzureOpenAIClient()
    return _llm_client
