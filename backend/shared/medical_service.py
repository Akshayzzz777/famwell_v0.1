"""Medical record management and on-demand PDF health analysis."""

import json
import logging
import uuid
from typing import Any, Dict, List, Optional

import pdfplumber

from config.settings import settings
from shared.llm_client import get_llm_client

logger = logging.getLogger(__name__)

HEALTH_ANALYSIS_PROMPT = """You are a medical AI assistant.

Here is a patient's medical report text:
{extracted_text}

Tasks:
1. Identify key health metrics (BP, glucose, cholesterol, hemoglobin, etc.)
2. Evaluate them using general clinical ranges (WHO guidelines)
3. Compute a Health Score (0–100):
   - Start from 100
   - Deduct points for abnormal values
   - More deviation = higher penalty
4. Compute a Stress Score (0–100) inspired by the Perceived Stress Scale (PSS):
   - 0 = no stress indicators, 100 = extreme stress indicators
   - Use available biomarkers: elevated cortisol, high resting heart rate (>80 bpm),
     elevated blood pressure, abnormal glucose, poor sleep markers, high BMI
   - Each abnormal stress-related marker adds 10-20 points
   - If no stress-related biomarkers are available, estimate from overall health:
     stress_score ≈ 100 - health_score (capped at 0-100)
5. Detect early disease risks
6. Return STRICT JSON (no markdown, no code fences):
{{
  "health_score": <number 0-100>,
  "stress_score": <number 0-100>,
  "metrics": {{
    "<metric_name>": {{
      "value": "<measured value>",
      "unit": "<unit>",
      "normal_range": "<range>",
      "status": "normal|borderline|abnormal"
    }}
  }},
  "risks": ["<risk1>", "<risk2>"],
  "insights": ["<insight1>", "<insight2>"],
  "recommendations": ["<rec1>", "<rec2>"]
}}
"""


def _generate_medical_record_id() -> str:
    return f"medrec_{uuid.uuid4().hex}"


def extract_text_from_pdf(pdf_content: bytes) -> str:
    """Extract text from PDF bytes using pdfplumber."""
    import io

    text_parts: List[str] = []
    with pdfplumber.open(io.BytesIO(pdf_content)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    return "\n".join(text_parts)


def clean_extracted_text(raw_text: str) -> str:
    """Remove noise and keep medical values + headings."""
    lines = raw_text.split("\n")
    cleaned: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        # Skip lines that are just page numbers or decorative
        if stripped.isdigit() and len(stripped) <= 3:
            continue
        if len(stripped) < 3 and not any(c.isalpha() for c in stripped):
            continue
        cleaned.append(stripped)
    return "\n".join(cleaned)


async def upload_medical_record(
    prisma,
    *,
    user_id: str,
    file_name: str,
    file_content: bytes,
    record_type: str = "general",
) -> Dict[str, Any]:
    """Upload a medical record PDF to cloud storage and store metadata in DB."""
    from shared.gcs_client import get_gcs_client

    gcs = get_gcs_client()
    record_id = _generate_medical_record_id()
    gcs_path = f"medical-records/{user_id}/{record_id}/{file_name}"

    uploaded = gcs.upload_file(
        file_content=file_content,
        destination_path=gcs_path,
        content_type="application/pdf",
        metadata={"user_id": user_id, "record_id": record_id},
    )
    if not uploaded:
        raise RuntimeError("Failed to upload file to cloud storage")

    signed_url = gcs.generate_signed_url(gcs_path, expiration_hours=24 * 365)
    file_url = signed_url or gcs_path

    rows = await prisma.query_raw(
        (
            "INSERT INTO medical_records (medical_record_id, user_id, file_url, file_name, record_type) "
            "VALUES ($1, $2, $3, $4, $5) "
            "RETURNING medical_record_id, user_id, file_url, file_name, record_type, upload_date"
        ),
        record_id,
        user_id,
        file_url,
        file_name,
        record_type,
    )
    return rows[0]


async def list_medical_records(prisma, user_id: str) -> List[Dict[str, Any]]:
    """List all medical records for a user."""
    rows = await prisma.query_raw(
        (
            "SELECT medical_record_id, user_id, file_url, file_name, record_type, upload_date "
            "FROM medical_records WHERE user_id = $1 ORDER BY upload_date DESC"
        ),
        user_id,
    )
    return rows


async def analyze_medical_record(prisma, record_id: str, user_id: str) -> Dict[str, Any]:
    """On-demand: fetch PDF, extract text, send to LLM for health analysis."""
    from shared.gcs_client import get_gcs_client

    rows = await prisma.query_raw(
        "SELECT medical_record_id, user_id, file_url, file_name FROM medical_records WHERE medical_record_id = $1 AND user_id = $2 LIMIT 1",
        record_id,
        user_id,
    )
    if not rows:
        raise ValueError("Medical record not found")

    record = rows[0]
    gcs = get_gcs_client()

    # Determine GCS path from file_url
    gcs_path = f"medical-records/{user_id}/{record_id}/{record['file_name']}"
    pdf_content = gcs.download_file(gcs_path)
    if not pdf_content:
        raise RuntimeError("Failed to download PDF from storage")

    try:
        raw_text = extract_text_from_pdf(pdf_content)
    except Exception as exc:
        logger.warning("PDF text extraction failed for %s: %s", record_id, exc)
        return {
            "health_score": None,
            "stress_score": None,
            "metrics": {},
            "risks": [],
            "insights": ["Could not extract text from this PDF. The file may be corrupted or not a valid PDF."],
            "recommendations": ["Please upload a valid medical report PDF."],
        }

    if not raw_text.strip():
        return {
            "health_score": None,
            "stress_score": None,
            "metrics": {},
            "risks": [],
            "insights": ["Could not extract text from this PDF. It may be a scanned image."],
            "recommendations": ["Please upload a text-based PDF or a clearer scan."],
        }

    cleaned_text = clean_extracted_text(raw_text)
    prompt = HEALTH_ANALYSIS_PROMPT.format(extracted_text=cleaned_text[:8000])

    try:
        llm = get_llm_client()
        result = llm.send_prompt(
            system_prompt="You are a medical AI assistant. Always return valid JSON only.",
            user_prompt=prompt,
        )
    except Exception as exc:
        logger.warning("LLM analysis failed for %s: %s", record_id, exc)
        result = None

    if not result or not result.get("response"):
        return {
            "health_score": None,
            "stress_score": None,
            "metrics": {},
            "risks": [],
            "insights": ["AI analysis is temporarily unavailable."],
            "recommendations": ["Please try again later."],
        }

    # Parse the LLM response as JSON
    response_text = result["response"]
    # Strip markdown code fences if present
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        response_text = "\n".join(lines)

    try:
        analysis = json.loads(response_text)
    except json.JSONDecodeError:
        logger.warning("LLM returned non-JSON response for health analysis")
        analysis = {
            "health_score": None,
            "stress_score": None,
            "metrics": {},
            "risks": [],
            "insights": [response_text[:500]],
            "recommendations": [],
        }

    return analysis


async def get_health_insights_for_user(prisma, user_id: str, record_id: Optional[str] = None) -> Dict[str, Any]:
    """Get health insights — either for a specific record or the latest one.

    If record_id is provided, analyze that record.
    If no record_id, find the most recent medical record and analyze it.
    If no records exist, return a default response asking the user to upload.
    """
    if record_id:
        return await analyze_medical_record(prisma, record_id, user_id)

    # Find the most recent medical record
    rows = await prisma.query_raw(
        (
            "SELECT medical_record_id FROM medical_records "
            "WHERE user_id = $1 ORDER BY upload_date DESC LIMIT 1"
        ),
        user_id,
    )

    if not rows:
        return {
            "health_score": None,
            "stress_score": None,
            "metrics": {},
            "risks": [],
            "insights": ["No medical records found. Upload a PDF to get AI-powered health insights."],
            "recommendations": ["Upload a medical report to receive personalized health analysis."],
        }

    return await analyze_medical_record(prisma, rows[0]["medical_record_id"], user_id)
