"""JSON validation and extraction utilities."""

import json
import logging
import re
from typing import Dict, Any, Tuple, Optional
from jsonschema import validate, ValidationError, Draft7Validator

from shared.schemas import EXTRACTED_JSON_SCHEMA, ExtractedJSONValidator
from shared.security import sanitize_json_for_injection

logger = logging.getLogger(__name__)


class JSONValidator:
    """Validator for extracted JSON data."""

    def __init__(self):
        """Initialize validator."""
        self.schema = EXTRACTED_JSON_SCHEMA
        self.validator = Draft7Validator(self.schema)

    def validate_extracted_json(
        self,
        data: Dict[str, Any],
    ) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """Validate extracted JSON against schema.

        Args:
            data: Extracted JSON data

        Returns:
            Tuple of (is_valid, error_message, sanitized_data)
        """
        try:
            # First attempt: Direct validation
            validate(instance=data, schema=self.schema)
            logger.info("Extracted JSON passed schema validation")

            # Sanitize against injection
            sanitized = sanitize_json_for_injection(data)

            return True, None, sanitized

        except ValidationError as e:
            error_msg = f"Validation error: {e.message}"
            logger.warning(f"JSON validation failed: {error_msg}")

            # Try to sanitize and re-validate
            try:
                sanitized = sanitize_json_for_injection(data)

                # Attempt Pydantic validation for stricter type checking
                validated_obj = ExtractedJSONValidator(**sanitized)
                sanitized = validated_obj.dict()

                logger.info("Extracted JSON passed sanitization and Pydantic validation")
                return True, "Sanitized", sanitized

            except Exception as sanitize_error:
                logger.error(f"Failed to sanitize JSON: {sanitize_error}")
                return False, str(sanitize_error), {}

    def validate_llm_response(
        self,
        response_text: str,
    ) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
        """Validate LLM response text.

        Args:
            response_text: Raw response from LLM

        Returns:
            Tuple of (is_valid, error_message, parsed_json)
        """
        try:
            # Attempt to parse as JSON
            parsed = json.loads(response_text)
            logger.info("LLM response parsed as valid JSON")
            return True, None, parsed

        except json.JSONDecodeError as e:
            logger.warning(f"Failed to parse LLM response as JSON: {e}")

            # Try to extract JSON from text
            extracted = self._extract_json_from_text(response_text)
            if extracted:
                logger.info("Extracted JSON from LLM response text")
                return True, None, extracted
            else:
                return False, "Response is not valid JSON", None

    def _extract_json_from_text(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract JSON object from text.

        Args:
            text: Text containing JSON

        Returns:
            Parsed JSON object or None
        """
        try:
            # Find JSON object in text
            # Look for pattern: {... }
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                json_str = match.group(0)
                return json.loads(json_str)
        except Exception as e:
            logger.debug(f"Could not extract JSON from text: {e}")

        return None

    def merge_extraction_and_system_prompt(
        self,
        extracted_json: Dict[str, Any],
        system_prompt: str,
    ) -> str:
        """Merge extracted JSON and system prompt.

        Args:
            extracted_json: Extracted document data
            system_prompt: Fixed system prompt

        Returns:
            Combined prompt for LLM
        """
        # Format extracted data as readable text
        json_text = json.dumps(extracted_json, indent=2)

        merged_prompt = f"""{system_prompt}

EXTRACTED DOCUMENT DATA:
{json_text}

Please process the above extracted document data according to the instructions above."""

        return merged_prompt


# Global validator instance
_validator: Optional[JSONValidator] = None


def get_json_validator() -> JSONValidator:
    """Get or initialize JSON validator (singleton)."""
    global _validator
    if _validator is None:
        _validator = JSONValidator()
    return _validator
