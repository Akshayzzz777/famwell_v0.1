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
6. Return STRICT JSON (no markdown, no code fences).

CRITICAL: You MUST use these EXACT metric key names in the "metrics" object.
Include ALL of the following keys even if the value is not found in the report
(use null for value if not available):

  "heart_rate"       - resting heart rate / pulse (bpm)
  "systolic_bp"      - systolic blood pressure (mmHg)
  "diastolic_bp"     - diastolic blood pressure (mmHg)
  "blood_pressure"   - combined BP string like "120/80" (mmHg)
  "glucose"          - fasting blood glucose (mg/dL)
  "cholesterol"      - total cholesterol (mg/dL)
  "hemoglobin"       - hemoglobin (g/dL)

You may add additional metrics from the report, but the above keys are REQUIRED.

Return this exact structure:
{{
  "health_score": <number 0-100>,
  "stress_score": <number 0-100>,
  "metrics": {{
    "heart_rate": {{
      "value": "<measured value or null>",
      "unit": "bpm",
      "normal_range": "60-100",
      "status": "normal|borderline|abnormal"
    }},
    "systolic_bp": {{
      "value": "<measured value or null>",
      "unit": "mmHg",
      "normal_range": "90-120",
      "status": "normal|borderline|abnormal"
    }},
    "diastolic_bp": {{
      "value": "<measured value or null>",
      "unit": "mmHg",
      "normal_range": "60-80",
      "status": "normal|borderline|abnormal"
    }},
    "blood_pressure": {{
      "value": "<systolic/diastolic or null>",
      "unit": "mmHg",
      "normal_range": "90/60-120/80",
      "status": "normal|borderline|abnormal"
    }},
    "glucose": {{
      "value": "<measured value or null>",
      "unit": "mg/dL",
      "normal_range": "70-100",
      "status": "normal|borderline|abnormal"
    }},
    "cholesterol": {{
      "value": "<measured value or null>",
      "unit": "mg/dL",
      "normal_range": "<200",
      "status": "normal|borderline|abnormal"
    }},
    "hemoglobin": {{
      "value": "<measured value or null>",
      "unit": "g/dL",
      "normal_range": "12-17",
      "status": "normal|borderline|abnormal"
    }}
  }},
  "risks": ["<risk1>", "<risk2>"],
  "insights": [
    {{
      "id": "<unique_snake_case_id e.g. elevated_glucose>",
      "title": "<short title, max 50 chars>",
      "description": "<detailed explanation>",
      "category": "<one of: heart_rate, blood_pressure, glucose, cholesterol, hemoglobin, stress_score, health_score, or the metric key it relates to>"
    }}
  ],
  "recommendations": [
    {{
      "id": "<unique_snake_case_id e.g. reduce_sodium>",
      "title": "<short title, max 50 chars>",
      "description": "<detailed recommendation>",
      "category": "<same category options as insights>"
    }}
  ]
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
    """Upload a medical record PDF to local storage and store metadata in DB.

    If the user has Google Drive connected, also uploads to their Drive folder
    and stores the drive_file_id.
    """
    from shared.gcs_client import get_gcs_client

    storage = get_gcs_client()
    record_id = _generate_medical_record_id()
    storage_path = f"medical-records/{user_id}/{record_id}/{file_name}"

    logger.info("Uploading medical record: record_id=%s, user_id=%s, file=%s, size=%d bytes",
                record_id, user_id, file_name, len(file_content))

    uploaded = storage.upload_file(
        file_content=file_content,
        destination_path=storage_path,
        content_type="application/pdf",
        metadata={"user_id": user_id, "record_id": record_id},
    )
    if not uploaded:
        logger.error("Local storage upload failed: record_id=%s, path=%s", record_id, storage_path)
        raise RuntimeError("Failed to save file to local storage")

    # Store the local storage path directly as file_url
    file_url = storage_path
    logger.info("File saved locally: record_id=%s, path=%s", record_id, storage_path)

    # Attempt Google Drive upload (non-blocking — falls back gracefully)
    drive_file_id: Optional[str] = None
    try:
        from shared.google_drive import upload_to_user_drive

        drive_result = await upload_to_user_drive(prisma, user_id, file_content, file_name)
        if drive_result:
            drive_file_id = drive_result.get("id")
            logger.info("Drive upload successful: record_id=%s, drive_file_id=%s", record_id, drive_file_id)
    except Exception as drive_err:
        logger.warning("Drive upload failed (non-fatal): record_id=%s, error=%s", record_id, drive_err)

    rows = await prisma.query_raw(
        (
            "INSERT INTO medical_records (medical_record_id, user_id, file_url, file_name, record_type, drive_file_id) "
            "VALUES ($1, $2, $3, $4, $5, $6) "
            "RETURNING medical_record_id, user_id, file_url, file_name, record_type, upload_date, drive_file_id"
        ),
        record_id,
        user_id,
        file_url,
        file_name,
        record_type,
        drive_file_id,
    )
    logger.info("Medical record DB insert successful: record_id=%s", record_id)
    return rows[0]


async def list_medical_records(prisma, user_id: str) -> List[Dict[str, Any]]:
    """List all medical records for a user."""
    rows = await prisma.query_raw(
        (
            "SELECT medical_record_id, user_id, file_url, file_name, record_type, upload_date, drive_file_id "
            "FROM medical_records WHERE user_id = $1 ORDER BY upload_date DESC"
        ),
        user_id,
    )
    return rows


async def analyze_medical_record(prisma, record_id: str, user_id: str) -> Dict[str, Any]:
    """On-demand: fetch PDF, extract text, send to LLM for health analysis.

    Results are cached in the medical_records table so subsequent calls skip the
    expensive GCS download + LLM round-trip.
    """
    from shared.gcs_client import get_gcs_client

    logger.info("analyze_medical_record called: record_id=%s, user_id=%s", record_id, user_id)

    # ── Check for cached analysis first ──
    cached_rows = await prisma.query_raw(
        "SELECT analysis_json FROM medical_records WHERE medical_record_id = $1 AND user_id = $2 AND analysis_json IS NOT NULL LIMIT 1",
        record_id,
        user_id,
    )
    if cached_rows and cached_rows[0].get("analysis_json") is not None:
        cached = cached_rows[0]["analysis_json"]
        if isinstance(cached, str):
            try:
                parsed = json.loads(cached)
                logger.info("Cache HIT (string→dict): record_id=%s, health_score=%s, stress_score=%s",
                            record_id, parsed.get("health_score"), parsed.get("stress_score"))
                return parsed
            except json.JSONDecodeError:
                logger.warning("Cache HIT but JSON decode failed: record_id=%s", record_id)
        elif isinstance(cached, dict):
            logger.info("Cache HIT (dict): record_id=%s, health_score=%s, stress_score=%s",
                        record_id, cached.get("health_score"), cached.get("stress_score"))
            return cached

    logger.info("Cache MISS: record_id=%s — running full analysis pipeline", record_id)

    # ── Fetch record metadata ──
    rows = await prisma.query_raw(
        "SELECT medical_record_id, user_id, file_url, file_name FROM medical_records WHERE medical_record_id = $1 AND user_id = $2 LIMIT 1",
        record_id,
        user_id,
    )
    if not rows:
        raise ValueError("Medical record not found")

    record = rows[0]
    storage = get_gcs_client()

    # Determine storage path from file_url or reconstruct it
    storage_path = record.get('file_url', '') or f"medical-records/{user_id}/{record_id}/{record['file_name']}"
    # Strip leading /local-files/ prefix if present (legacy entries)
    if storage_path.startswith('/local-files/'):
        storage_path = storage_path[len('/local-files/'):]
    logger.info("Downloading PDF from local storage: record_id=%s, path=%s", record_id, storage_path)
    pdf_content = storage.download_file(storage_path)
    if not pdf_content:
        logger.error("Local storage download failed: record_id=%s, path=%s", record_id, storage_path)
        raise RuntimeError("Failed to download PDF from storage")

    try:
        raw_text = extract_text_from_pdf(pdf_content)
        logger.info("PDF text extracted: record_id=%s, text_length=%d chars", record_id, len(raw_text))
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
        logger.warning("PDF text empty after extraction: record_id=%s", record_id)
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
    logger.info("Sending to LLM: record_id=%s, cleaned_text_length=%d chars, prompt_length=%d chars",
                record_id, len(cleaned_text), len(prompt))

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
        logger.warning("LLM returned empty/null response: record_id=%s", record_id)
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
    logger.info("LLM raw response received: record_id=%s, length=%d chars", record_id, len(response_text))
    logger.debug("LLM raw response: record_id=%s, text=%s", record_id, response_text[:500])
    # Strip markdown code fences if present
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        response_text = "\n".join(lines)

    try:
        analysis = json.loads(response_text)
        logger.info("LLM JSON parsed: record_id=%s, health_score=%s, stress_score=%s, metric_keys=%s",
                     record_id, analysis.get("health_score"), analysis.get("stress_score"),
                     list(analysis.get("metrics", {}).keys()))
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

    # ── Cache analysis result in DB ──
    try:
        await prisma.execute_raw(
            "UPDATE medical_records SET analysis_json = $1::jsonb, analyzed_at = NOW() WHERE medical_record_id = $2",
            json.dumps(analysis),
            record_id,
        )
        logger.info("Analysis cached in DB: record_id=%s", record_id)
    except Exception as cache_err:
        logger.warning("Failed to cache analysis for %s: %s", record_id, cache_err)

    return analysis


async def get_health_insights_for_user(prisma, user_id: str, record_id: Optional[str] = None) -> Dict[str, Any]:
    """Get health insights — either for a specific record or the latest one.

    If record_id is provided, analyze that record.
    If no record_id, find the most recent medical record and analyze it.
    If no records exist, return a default response asking the user to upload.
    """
    if record_id:
        logger.info("get_health_insights_for_user: user_id=%s, record_id=%s", user_id, record_id)
        return await analyze_medical_record(prisma, record_id, user_id)

    # Find the most recent medical record
    logger.info("get_health_insights_for_user: user_id=%s, finding latest record", user_id)
    rows = await prisma.query_raw(
        (
            "SELECT medical_record_id FROM medical_records "
            "WHERE user_id = $1 ORDER BY upload_date DESC LIMIT 1"
        ),
        user_id,
    )

    if not rows:
        logger.info("No medical records found for user_id=%s", user_id)
        return {
            "health_score": None,
            "stress_score": None,
            "metrics": {},
            "risks": [],
            "insights": ["No medical records found. Upload a PDF to get AI-powered health insights."],
            "recommendations": ["Upload a medical report to receive personalized health analysis."],
        }

    logger.info("Latest record found: user_id=%s, record_id=%s", user_id, rows[0]["medical_record_id"])
    return await analyze_medical_record(prisma, rows[0]["medical_record_id"], user_id)


async def trigger_background_analysis(database_url: str, record_id: str, user_id: str) -> None:
    """Run analysis in background after upload so insights are pre-cached.

    Uses its own Prisma connection because FastAPI BackgroundTasks run after the
    response has already been sent.
    """
    from shared.database import get_prisma_client

    try:
        logger.info("Background analysis STARTED: record_id=%s, user_id=%s", record_id, user_id)
        prisma = get_prisma_client(database_url)
        await analyze_medical_record(prisma, record_id, user_id)
        logger.info("Background analysis COMPLETED: record_id=%s", record_id)
    except Exception as exc:
        logger.warning("Background analysis FAILED for %s: %s", record_id, exc)


async def get_health_insights_history(prisma, user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Return historical health analyses for a user, ordered newest-first.

    Each item includes the record id, upload date, and the cached analysis
    (health_score, stress_score, metrics, etc.).
    """
    logger.info("get_health_insights_history: user_id=%s, limit=%d", user_id, limit)

    rows = await prisma.query_raw(
        (
            "SELECT medical_record_id, file_name, upload_date, analysis_json, analyzed_at "
            "FROM medical_records "
            "WHERE user_id = $1 AND analysis_json IS NOT NULL "
            "ORDER BY upload_date DESC "
            "LIMIT $2"
        ),
        user_id,
        limit,
    )

    results: List[Dict[str, Any]] = []
    for row in rows:
        analysis = row.get("analysis_json")
        if isinstance(analysis, str):
            try:
                analysis = json.loads(analysis)
            except json.JSONDecodeError:
                analysis = {}
        elif not isinstance(analysis, dict):
            analysis = {}

        results.append({
            "record_id": row["medical_record_id"],
            "file_name": row.get("file_name"),
            "upload_date": row.get("upload_date"),
            "analyzed_at": row.get("analyzed_at"),
            "health_score": analysis.get("health_score"),
            "stress_score": analysis.get("stress_score"),
            "metrics": analysis.get("metrics", {}),
            "insights": analysis.get("insights", []),
            "recommendations": analysis.get("recommendations", []),
            "risks": analysis.get("risks", []),
        })

    logger.info("History returned %d records for user_id=%s", len(results), user_id)
    return results


CONTEXTUAL_INSIGHT_PROMPT = """You are FamWell AI, a medical health assistant.

The user wants a deeper analysis of a specific health parameter.

**Current Values (latest report):**
{current_data}

**Historical Values (past reports, newest first):**
{history_data}

**Parameter of interest:** {parameter}

Tasks:
1. Explain the current value in plain language (is it normal, borderline, or concerning?)
2. Analyze the trend across historical data (improving, worsening, stable)
3. Provide 3-5 actionable, personalized recommendations based on the trend
4. Flag any risks if the trend is concerning
5. Be empathetic, concise, and non-alarmist. Always recommend consulting a doctor for serious concerns.

Return STRICT JSON (no markdown, no code fences):
{{
  "explanation": "<plain language explanation of current value>",
  "trend": "improving|worsening|stable|insufficient_data",
  "trend_summary": "<1-2 sentence summary of how this parameter changed over time>",
  "recommendations": ["<rec1>", "<rec2>", "<rec3>"],
  "risks": ["<risk1>"] or [],
  "confidence": "high|medium|low"
}}
"""


async def ask_ai_contextual_insight(
    prisma,
    user_id: str,
    parameter: str,
    conversation_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Send current + historical data to LLM for a contextual insight on a parameter.

    Returns the structured AI response and optionally saves to chat history.
    """
    logger.info("ask_ai_contextual_insight: user_id=%s, parameter=%s", user_id, parameter)

    # Get current (latest) analysis
    current = await get_health_insights_for_user(prisma, user_id)
    # Get history
    history = await get_health_insights_history(prisma, user_id, limit=10)

    # Build current data summary
    current_metric = current.get("metrics", {}).get(parameter, {})
    current_data = json.dumps({
        "health_score": current.get("health_score"),
        "stress_score": current.get("stress_score"),
        parameter: current_metric,
    }, indent=2)

    # Build historical summary
    history_entries = []
    for entry in history:
        metric_val = entry.get("metrics", {}).get(parameter, {})
        history_entries.append({
            "date": str(entry.get("upload_date", "unknown")),
            "health_score": entry.get("health_score"),
            "stress_score": entry.get("stress_score"),
            parameter: metric_val,
        })
    history_data = json.dumps(history_entries, indent=2) if history_entries else "No historical data available."

    prompt = CONTEXTUAL_INSIGHT_PROMPT.format(
        current_data=current_data,
        history_data=history_data,
        parameter=parameter,
    )

    try:
        llm = get_llm_client()
        result = llm.send_prompt(
            system_prompt="You are FamWell AI, a helpful medical health assistant. Return valid JSON only.",
            user_prompt=prompt,
        )
    except Exception as exc:
        logger.warning("LLM contextual insight failed: %s", exc)
        return {
            "explanation": "AI analysis is temporarily unavailable. Please try again later.",
            "trend": "insufficient_data",
            "trend_summary": "",
            "recommendations": [],
            "risks": [],
            "confidence": "low",
            "parameter": parameter,
        }

    response_text = result.get("response", "") if result else ""
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        response_text = "\n".join(lines)

    try:
        parsed = json.loads(response_text)
    except json.JSONDecodeError:
        logger.warning("LLM contextual insight returned non-JSON: %s", response_text[:200])
        parsed = {
            "explanation": response_text[:500] if response_text else "Unable to parse AI response.",
            "trend": "insufficient_data",
            "trend_summary": "",
            "recommendations": [],
            "risks": [],
            "confidence": "low",
        }

    parsed["parameter"] = parameter

    # Optionally save to chat conversation for continuity
    if conversation_id:
        from shared.chat_service import save_message, get_or_create_conversation
        conv = await get_or_create_conversation(prisma, user_id, conversation_id)
        user_msg = f"Analyze my {parameter} data with historical trends."
        await save_message(prisma, conv["conversation_id"], "user", user_msg)
        await save_message(prisma, conv["conversation_id"], "assistant", json.dumps(parsed, indent=2))
        parsed["conversation_id"] = conv["conversation_id"]

    logger.info("Contextual insight returned: parameter=%s, trend=%s, confidence=%s",
                parameter, parsed.get("trend"), parsed.get("confidence"))
    return parsed
