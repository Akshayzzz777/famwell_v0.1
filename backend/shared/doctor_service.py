"""Doctor recommendation service — maps health risks/metrics to specialists."""

import logging
from typing import Any, Dict, List, Optional

from prisma import Prisma

logger = logging.getLogger(__name__)

# Risk/metric keywords → specializations
RISK_SPECIALIZATION_MAP: List[tuple[list[str], str]] = [
    (["cholesterol", "ldl", "hdl", "lipid", "triglyceride", "heart", "cardiac", "cardio", "bp", "blood pressure", "hypertension", "systolic", "diastolic"], "Cardiologist"),
    (["liver", "hepat", "ast", "alt", "bilirubin", "jaundice", "fatty liver"], "Hepatologist"),
    (["kidney", "renal", "creatinine", "urea", "nephro", "gfr"], "Nephrologist"),
    (["stress", "anxiety", "depression", "mental", "sleep", "psych", "cortisol"], "Psychologist"),
    (["diabetes", "glucose", "sugar", "hba1c", "insulin", "glyc"], "Endocrinologist"),
    (["thyroid", "tsh", "t3", "t4"], "Endocrinologist"),
    (["anemia", "hemoglobin", "iron", "ferritin", "blood count", "hematocrit", "platelet"], "Hematologist"),
    (["lung", "respiratory", "asthma", "pulmonary", "oxygen"], "Pulmonologist"),
    (["bone", "calcium", "vitamin d", "joint", "arthritis", "osteo"], "Orthopedist"),
    (["neuro", "brain", "seizure", "headache", "migraine"], "Neurologist"),
]


def _detect_specializations(analysis: Dict[str, Any]) -> List[str]:
    """Extract recommended specializations from health analysis data."""
    specs: set[str] = set()
    search_texts: list[str] = []

    # Gather text from risks
    for risk in analysis.get("risks", []):
        if isinstance(risk, str):
            search_texts.append(risk.lower())

    # Gather text from insights
    for insight in analysis.get("insights", []):
        if isinstance(insight, str):
            search_texts.append(insight.lower())
        elif isinstance(insight, dict):
            search_texts.append(insight.get("description", "").lower())
            search_texts.append(insight.get("title", "").lower())

    # Gather text from recommendations
    for rec in analysis.get("recommendations", []):
        if isinstance(rec, str):
            search_texts.append(rec.lower())
        elif isinstance(rec, dict):
            search_texts.append(rec.get("description", "").lower())

    # Check metrics for abnormal values
    metrics = analysis.get("metrics", {})
    for key, val in metrics.items():
        if isinstance(val, dict) and val.get("status") in ("abnormal", "borderline"):
            search_texts.append(key.lower())
            search_texts.append(val.get("unit", "").lower())

    combined = " ".join(search_texts)

    for keywords, spec in RISK_SPECIALIZATION_MAP:
        if any(kw in combined for kw in keywords):
            specs.add(spec)

    return list(specs) if specs else ["General Physician"]


async def get_recommended_doctors(
    prisma: Prisma,
    user_id: str,
    record_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Return doctors recommended based on the user's latest health analysis."""

    # Get the analysis
    if record_id:
        record = await prisma.medicalrecord.find_first(
            where={"medical_record_id": record_id, "user_id": user_id},
        )
    else:
        # Prisma Python: use raw query to find latest record with non-null analysis
        rows = await prisma.query_raw(
            """
            SELECT medical_record_id, user_id, analysis_json
            FROM medical_records
            WHERE user_id = $1 AND analysis_json IS NOT NULL
            ORDER BY upload_date DESC
            LIMIT 1
            """,
            user_id,
        )
        record = None
        if rows:
            row = rows[0]
            # Build a minimal object with .analysis_json
            class _Rec:
                analysis_json = row.get("analysis_json")
            record = _Rec()

    analysis: Dict[str, Any] = {}
    if record and record.analysis_json:
        analysis = record.analysis_json if isinstance(record.analysis_json, dict) else {}

    specializations = _detect_specializations(analysis)

    # Query doctors matching recommended specializations
    doctors = await prisma.doctor.find_many(
        where={"specialization": {"in": specializations}},
        order={"rating": "desc"},
    )

    # Build reason map: specialization → why recommended
    reason_map: Dict[str, str] = {}
    risks = analysis.get("risks", [])
    for spec in specializations:
        for keywords, mapped_spec in RISK_SPECIALIZATION_MAP:
            if mapped_spec == spec:
                for risk in risks:
                    risk_text = risk if isinstance(risk, str) else str(risk)
                    if any(kw in risk_text.lower() for kw in keywords):
                        reason_map[spec] = f"Recommended for {risk_text}"
                        break
                if spec not in reason_map:
                    reason_map[spec] = f"Recommended based on your health analysis"
                break

    # If no matching doctors, return all doctors ordered by rating
    if not doctors:
        doctors = await prisma.doctor.find_many(order={"rating": "desc"}, take=10)

    result = []
    for doc in doctors:
        result.append({
            "id": doc.doctor_id,
            "name": doc.name,
            "specialization": doc.specialization,
            "experience": doc.experience,
            "rating": doc.rating,
            "health_id": doc.health_id,
            "avatar_url": doc.avatar_url,
            "reason": reason_map.get(doc.specialization, ""),
        })

    return {
        "doctors": result,
        "matched_specializations": specializations,
    }


async def search_doctors(
    prisma: Prisma,
    query: str,
) -> List[Dict[str, Any]]:
    """Search doctors by name, specialization, or health_id."""
    q = query.strip()
    if not q:
        doctors = await prisma.doctor.find_many(order={"rating": "desc"}, take=20)
    else:
        # Use raw query for case-insensitive LIKE search
        doctors = await prisma.query_raw(
            """
            SELECT doctor_id, name, specialization, experience, rating, health_id, avatar_url
            FROM doctors
            WHERE LOWER(name) LIKE $1
               OR LOWER(specialization) LIKE $1
               OR LOWER(health_id) LIKE $1
            ORDER BY rating DESC
            LIMIT 20
            """,
            f"%{q.lower()}%",
        )

    result = []
    for doc in doctors:
        if isinstance(doc, dict):
            result.append({
                "id": doc.get("doctor_id", ""),
                "name": doc.get("name", ""),
                "specialization": doc.get("specialization", ""),
                "experience": doc.get("experience", ""),
                "rating": doc.get("rating", 0),
                "health_id": doc.get("health_id", ""),
                "avatar_url": doc.get("avatar_url"),
            })
        else:
            result.append({
                "id": doc.doctor_id,
                "name": doc.name,
                "specialization": doc.specialization,
                "experience": doc.experience,
                "rating": doc.rating,
                "health_id": doc.health_id,
                "avatar_url": doc.avatar_url,
            })

    return result


async def seed_doctors(prisma: Prisma) -> int:
    """Seed the doctors table with mock data. Returns count of inserted doctors."""
    MOCK_DOCTORS = [
        {"doctor_id": "doc_1", "name": "Dr. Amit Verma", "specialization": "Cardiologist", "experience": "12 years", "rating": 4.5, "health_id": "DOC101"},
        {"doctor_id": "doc_2", "name": "Dr. Neha Sharma", "specialization": "Hepatologist", "experience": "10 years", "rating": 4.3, "health_id": "DOC102"},
        {"doctor_id": "doc_3", "name": "Dr. Raj Mehta", "specialization": "Nephrologist", "experience": "8 years", "rating": 4.2, "health_id": "DOC103"},
        {"doctor_id": "doc_4", "name": "Dr. Priya Singh", "specialization": "Psychologist", "experience": "7 years", "rating": 4.6, "health_id": "DOC104"},
        {"doctor_id": "doc_5", "name": "Dr. Julian Thorne", "specialization": "Cardiologist", "experience": "15 years", "rating": 4.8, "health_id": "DOC105"},
        {"doctor_id": "doc_6", "name": "Dr. Sarah Jenkins", "specialization": "Endocrinologist", "experience": "9 years", "rating": 5.0, "health_id": "DOC106"},
        {"doctor_id": "doc_7", "name": "Dr. Michael Chen", "specialization": "Neurologist", "experience": "14 years", "rating": 4.9, "health_id": "DOC107"},
        {"doctor_id": "doc_8", "name": "Dr. Aisha Patel", "specialization": "Hematologist", "experience": "11 years", "rating": 4.4, "health_id": "DOC108"},
        {"doctor_id": "doc_9", "name": "Dr. Vikram Roy", "specialization": "Pulmonologist", "experience": "6 years", "rating": 4.1, "health_id": "DOC109"},
        {"doctor_id": "doc_10", "name": "Dr. Ananya Gupta", "specialization": "General Physician", "experience": "5 years", "rating": 4.0, "health_id": "DOC110"},
    ]

    count = 0
    for doc in MOCK_DOCTORS:
        existing = await prisma.doctor.find_unique(where={"health_id": doc["health_id"]})
        if not existing:
            await prisma.doctor.create(data=doc)
            count += 1

    logger.info("Seeded %d doctors (skipped %d existing)", count, len(MOCK_DOCTORS) - count)
    return count
