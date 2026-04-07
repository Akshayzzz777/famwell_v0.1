from __future__ import annotations

import json
import uuid
from typing import Any, Dict, Optional

from prisma import Prisma


class FeatureStoreError(Exception):
    pass


class ConflictError(FeatureStoreError):
    pass


class ForbiddenError(FeatureStoreError):
    pass


class NotFoundError(FeatureStoreError):
    pass


class ValidationError(FeatureStoreError):
    pass


def _generate_user_id() -> str:
    return f"user_{uuid.uuid4().hex[:31]}"


def _generate_record_id() -> str:
    return f"record_{uuid.uuid4().hex}"


def _generate_connection_id() -> str:
    return f"connection_{uuid.uuid4().hex}"


def _generate_health_id() -> str:
    return f"HW-{uuid.uuid4().hex[:8].upper()}"


async def ensure_supporting_schema(prisma: Prisma) -> None:
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS health_id TEXT",
        "CREATE UNIQUE INDEX IF NOT EXISTS users_health_id_unique ON users (health_id) WHERE health_id IS NOT NULL",
        (
            "CREATE TABLE IF NOT EXISTS records ("
            "record_id VARCHAR(64) PRIMARY KEY, "
            "user_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "record_type VARCHAR(100) NOT NULL, "
            "data JSONB NOT NULL, "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
            "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS records_user_id_idx ON records (user_id)",
        "CREATE INDEX IF NOT EXISTS records_record_type_idx ON records (record_type)",
        (
            "CREATE TABLE IF NOT EXISTS connections ("
            "connection_id VARCHAR(64) PRIMARY KEY, "
            "follower_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "following_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "status VARCHAR(20) NOT NULL DEFAULT 'pending', "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
            "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "ALTER TABLE connections ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'pending'",
        "ALTER TABLE connections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()",
        "CREATE UNIQUE INDEX IF NOT EXISTS connections_pair_unique ON connections (follower_id, following_id)",
        "CREATE INDEX IF NOT EXISTS connections_follower_idx ON connections (follower_id)",
        "CREATE INDEX IF NOT EXISTS connections_following_idx ON connections (following_id)",
        "CREATE INDEX IF NOT EXISTS connections_status_idx ON connections (status)",
        # Medical records table
        (
            "CREATE TABLE IF NOT EXISTS medical_records ("
            "medical_record_id VARCHAR(64) PRIMARY KEY, "
            "user_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "file_url VARCHAR(1024) NOT NULL, "
            "file_name VARCHAR(255) NOT NULL, "
            "record_type VARCHAR(100) NOT NULL DEFAULT 'general', "
            "upload_date TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS medical_records_user_id_idx ON medical_records (user_id)",
        "CREATE INDEX IF NOT EXISTS medical_records_record_type_idx ON medical_records (record_type)",
        # Analysis cache columns for medical records
        "ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS analysis_json JSONB",
        "ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS analyzed_at TIMESTAMPTZ",
        # Chat conversations table
        (
            "CREATE TABLE IF NOT EXISTS chat_conversations ("
            "conversation_id VARCHAR(64) PRIMARY KEY, "
            "user_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "title VARCHAR(255), "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
            "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS chat_conversations_user_id_idx ON chat_conversations (user_id)",
        # Chat messages table
        (
            "CREATE TABLE IF NOT EXISTS chat_messages ("
            "message_id VARCHAR(64) PRIMARY KEY, "
            "conversation_id VARCHAR(64) NOT NULL REFERENCES chat_conversations(conversation_id) ON DELETE CASCADE, "
            "role VARCHAR(20) NOT NULL, "
            "content TEXT NOT NULL, "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON chat_messages (conversation_id)",
        # Google Drive integration columns on users
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_drive_folder_id VARCHAR(128)",
        # Drive file ID on medical records
        "ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(256)",
    ]

    for statement in statements:
        try:
            await prisma.execute_raw(statement)
        except Exception:
            pass  # Ignore errors for already-existing columns/indexes

    missing_health_ids = await prisma.query_raw("SELECT user_id FROM users WHERE health_id IS NULL")
    for row in missing_health_ids:
        await ensure_user_health_id(prisma, row['user_id'])


async def fetch_user_by_email(prisma: Prisma, email: str) -> Optional[Dict[str, Any]]:
    rows = await prisma.query_raw(
        (
            "SELECT user_id, email, password, created_at, is_active, role, full_name, phone_number, health_id "
            "FROM users WHERE email = $1 LIMIT 1"
        ),
        email,
    )
    if not rows:
        return None
    return rows[0]


async def fetch_user_profile(prisma: Prisma, user_id: str) -> Optional[Dict[str, Any]]:
    rows = await prisma.query_raw(
        (
            "SELECT user_id, email, created_at, is_active, role, full_name, phone_number, health_id "
            "FROM users WHERE user_id = $1 LIMIT 1"
        ),
        user_id,
    )
    if not rows:
        return None
    return rows[0]


async def create_user(
    prisma: Prisma,
    *,
    email: str,
    password_hash: str,
    role: str,
    full_name: str,
    phone_number: str,
) -> Dict[str, Any]:
    rows = await prisma.query_raw(
        (
            "INSERT INTO users (user_id, email, password, role, full_name, phone_number) "
            "VALUES ($1, $2, $3, $4, $5, $6) "
            "RETURNING user_id, email, created_at, is_active, role, full_name, phone_number, health_id"
        ),
        _generate_user_id(),
        email,
        password_hash,
        role,
        full_name,
        phone_number,
    )
    created_user = rows[0]
    health_id = await ensure_user_health_id(prisma, created_user['user_id'])
    created_user['health_id'] = health_id
    return created_user


async def ensure_user_health_id(prisma: Prisma, user_id: str) -> str:
    user = await fetch_user_profile(prisma, user_id)
    if not user:
        raise NotFoundError('User not found.')

    if user.get('health_id'):
        return user['health_id']

    for _ in range(10):
        candidate = _generate_health_id()
        updated_rows = await prisma.query_raw(
            (
                "UPDATE users SET health_id = $1 "
                "WHERE user_id = $2 AND health_id IS NULL "
                "RETURNING health_id"
            ),
            candidate,
            user_id,
        )
        if updated_rows:
            return updated_rows[0]['health_id']

        refreshed = await fetch_user_profile(prisma, user_id)
        if refreshed and refreshed.get('health_id'):
            return refreshed['health_id']

    raise ValidationError('Unable to assign a Health ID at this time.')


async def _resolve_record_owner_id(prisma: Prisma, requester: Dict[str, Any], target_user_id: Optional[str]) -> str:
    requester_id = requester['user_id']
    requester_role = requester.get('role', 'USER')

    if not target_user_id or target_user_id == requester_id:
        return requester_id

    if requester_role != 'DOCTOR':
        raise ForbiddenError("Only doctors can access another user's records.")

    target_user = await fetch_user_profile(prisma, target_user_id)
    if not target_user:
        raise NotFoundError('Requested user was not found.')

    # Verify doctor has an accepted connection with this patient
    conn_rows = await prisma.query_raw(
        "SELECT connection_id FROM connections "
        "WHERE ((follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)) "
        "AND status = 'accepted' LIMIT 1",
        requester_id, target_user_id,
    )
    if not conn_rows:
        raise ForbiddenError('You do not have an accepted connection with this patient.')

    return target_user_id


async def list_records(
    prisma: Prisma,
    requester: Dict[str, Any],
    target_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    owner_id = await _resolve_record_owner_id(prisma, requester, target_user_id)

    # Fetch regular records
    rows = await prisma.query_raw(
        (
            "SELECT record_id, user_id, record_type, data, created_at, updated_at "
            "FROM records WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC"
        ),
        owner_id,
    )

    # Also fetch uploaded medical records (PDFs) so they appear in the records screen
    med_rows = await prisma.query_raw(
        (
            "SELECT medical_record_id, user_id, file_name, record_type, upload_date, "
            "analysis_json IS NOT NULL AS has_analysis "
            "FROM medical_records WHERE user_id = $1 ORDER BY upload_date DESC"
        ),
        owner_id,
    )

    # Convert medical_records into the same shape as regular records
    for mr in med_rows:
        rows.append({
            'record_id': mr['medical_record_id'],
            'user_id': mr['user_id'],
            'record_type': 'uploaded_pdf',
            'data': {
                'file_name': mr['file_name'],
                'original_type': mr['record_type'],
                'has_analysis': mr.get('has_analysis', False),
                'source': 'medical_record_upload',
            },
            'created_at': mr['upload_date'],
            'updated_at': mr['upload_date'],
        })

    # Sort combined list by date descending
    rows.sort(key=lambda r: r.get('updated_at') or r.get('created_at') or '', reverse=True)

    return {
        'records': rows,
        'owner_user_id': owner_id,
    }


async def create_record(
    prisma: Prisma,
    requester: Dict[str, Any],
    *,
    record_type: str,
    data: Dict[str, Any],
    target_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    owner_id = await _resolve_record_owner_id(prisma, requester, target_user_id)
    rows = await prisma.query_raw(
        (
            "INSERT INTO records (record_id, user_id, record_type, data) "
            "VALUES ($1, $2, $3, CAST($4 AS JSONB)) "
            "RETURNING record_id, user_id, record_type, data, created_at, updated_at"
        ),
        _generate_record_id(),
        owner_id,
        record_type,
        json.dumps(data),
    )
    return rows[0]


async def create_connection(prisma: Prisma, follower_id: str, health_id: str) -> Dict[str, Any]:
    target_rows = await prisma.query_raw(
        (
            "SELECT user_id, email, role, full_name, phone_number, health_id "
            "FROM users WHERE health_id = $1 LIMIT 1"
        ),
        health_id,
    )
    if not target_rows:
        raise NotFoundError('Health ID was not found.')

    target_user = target_rows[0]
    if target_user['user_id'] == follower_id:
        raise ValidationError('You cannot follow your own Health ID.')

    existing = await prisma.query_raw(
        "SELECT connection_id, status FROM connections WHERE follower_id = $1 AND following_id = $2 LIMIT 1",
        follower_id,
        target_user['user_id'],
    )
    if existing:
        if existing[0].get('status') == 'rejected':
            # Allow re-requesting after rejection
            await prisma.execute_raw(
                "UPDATE connections SET status = 'pending', updated_at = NOW() WHERE connection_id = $1",
                existing[0]['connection_id'],
            )
            return {
                'connection_id': existing[0]['connection_id'],
                'follower_id': follower_id,
                'following_id': target_user['user_id'],
                'status': 'pending',
                'user': target_user,
            }
        raise ConflictError('A connection request already exists for this Health ID.')

    rows = await prisma.query_raw(
        (
            "INSERT INTO connections (connection_id, follower_id, following_id, status) "
            "VALUES ($1, $2, $3, 'pending') "
            "RETURNING connection_id, follower_id, following_id, status, created_at"
        ),
        _generate_connection_id(),
        follower_id,
        target_user['user_id'],
    )
    connection = rows[0]
    connection['user'] = target_user
    return connection


async def action_connection(
    prisma: Prisma,
    user_id: str,
    connection_id: str,
    action: str,
) -> Dict[str, Any]:
    """Accept or reject a follow request (receiver action)."""
    if action not in ('accepted', 'rejected'):
        raise ValidationError("Action must be 'accepted' or 'rejected'.")

    rows = await prisma.query_raw(
        "SELECT connection_id, follower_id, following_id, status FROM connections WHERE connection_id = $1 AND following_id = $2 LIMIT 1",
        connection_id,
        user_id,
    )
    if not rows:
        raise NotFoundError('Connection request not found.')

    connection = rows[0]
    if connection['status'] != 'pending':
        raise ValidationError(f"Connection is already {connection['status']}.")

    await prisma.execute_raw(
        "UPDATE connections SET status = $1, updated_at = NOW() WHERE connection_id = $2",
        action,
        connection_id,
    )

    return {
        'connection_id': connection_id,
        'follower_id': connection['follower_id'],
        'following_id': connection['following_id'],
        'status': action,
    }


async def list_connections(prisma: Prisma, follower_id: str) -> Dict[str, Any]:
    rows = await prisma.query_raw(
        (
            "SELECT c.connection_id, c.follower_id, c.following_id, c.status, c.created_at, "
            "u.email, u.role, u.full_name, u.phone_number, u.health_id "
            "FROM connections c "
            "JOIN users u ON u.user_id = c.following_id "
            "WHERE c.follower_id = $1 "
            "ORDER BY c.created_at DESC"
        ),
        follower_id,
    )
    connections = []
    for row in rows:
        connections.append(
            {
                'connection_id': row['connection_id'],
                'follower_id': row['follower_id'],
                'following_id': row['following_id'],
                'status': row.get('status', 'accepted'),
                'created_at': row['created_at'],
                'user': {
                    'email': row['email'],
                    'role': row['role'],
                    'full_name': row.get('full_name'),
                    'phone_number': row.get('phone_number'),
                    'health_id': row.get('health_id'),
                },
            }
        )

    return {'connections': connections}


async def list_pending_requests(prisma: Prisma, user_id: str) -> Dict[str, Any]:
    """List incoming pending connection requests for a user."""
    rows = await prisma.query_raw(
        (
            "SELECT c.connection_id, c.follower_id, c.following_id, c.status, c.created_at, "
            "u.email, u.role, u.full_name, u.phone_number, u.health_id "
            "FROM connections c "
            "JOIN users u ON u.user_id = c.follower_id "
            "WHERE c.following_id = $1 AND c.status = 'pending' "
            "ORDER BY c.created_at DESC"
        ),
        user_id,
    )
    requests = []
    for row in rows:
        requests.append(
            {
                'connection_id': row['connection_id'],
                'follower_id': row['follower_id'],
                'following_id': row['following_id'],
                'status': row['status'],
                'created_at': row['created_at'],
                'user': {
                    'email': row['email'],
                    'role': row['role'],
                    'full_name': row.get('full_name'),
                    'phone_number': row.get('phone_number'),
                    'health_id': row.get('health_id'),
                },
            }
        )

    return {'requests': requests}


def get_insights_payload() -> Dict[str, Any]:
    return {
        'status': 'pending',
        'message': 'Insights will be available once the model is ready',
    }


# ── Doctor Feature Store Functions ──

def _generate_appointment_id() -> str:
    return f"appt_{uuid.uuid4().hex}"


def _generate_prescription_id() -> str:
    return f"rx_{uuid.uuid4().hex}"


async def ensure_doctor_schema(prisma: Prisma) -> None:
    """Ensure doctor-specific columns and tables exist."""
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization VARCHAR(100)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS experience VARCHAR(50)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS hospital_affiliation VARCHAR(255)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS education VARCHAR(512)",
        (
            "CREATE TABLE IF NOT EXISTS appointments ("
            "appointment_id VARCHAR(64) PRIMARY KEY, "
            "patient_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "doctor_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "date TIMESTAMPTZ NOT NULL, "
            "time VARCHAR(10) NOT NULL, "
            "type VARCHAR(30) NOT NULL DEFAULT 'In-Person', "
            "status VARCHAR(20) NOT NULL DEFAULT 'pending', "
            "notes TEXT, "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
            "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS appointments_patient_id_idx ON appointments (patient_id)",
        "CREATE INDEX IF NOT EXISTS appointments_doctor_id_idx ON appointments (doctor_id)",
        "CREATE INDEX IF NOT EXISTS appointments_status_idx ON appointments (status)",
        "CREATE INDEX IF NOT EXISTS appointments_date_idx ON appointments (date)",
        (
            "CREATE TABLE IF NOT EXISTS prescriptions ("
            "prescription_id VARCHAR(64) PRIMARY KEY, "
            "doctor_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "patient_id VARCHAR(36) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, "
            "medication VARCHAR(255) NOT NULL, "
            "dosage VARCHAR(100) NOT NULL, "
            "duration VARCHAR(100) NOT NULL, "
            "notes TEXT, "
            "status VARCHAR(20) NOT NULL DEFAULT 'Active', "
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), "
            "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE INDEX IF NOT EXISTS prescriptions_doctor_id_idx ON prescriptions (doctor_id)",
        "CREATE INDEX IF NOT EXISTS prescriptions_patient_id_idx ON prescriptions (patient_id)",
        "CREATE INDEX IF NOT EXISTS prescriptions_status_idx ON prescriptions (status)",
    ]
    for statement in statements:
        try:
            await prisma.execute_raw(statement)
        except Exception:
            pass


async def get_doctor_dashboard(prisma: Prisma, doctor_id: str) -> Dict[str, Any]:
    """Get aggregated dashboard data for a doctor."""
    # Upcoming appointments
    appointments = await prisma.query_raw(
        (
            "SELECT a.appointment_id, a.date, a.time, a.type, a.status, a.notes, "
            "u.full_name AS patient_name, u.health_id AS patient_health_id "
            "FROM appointments a "
            "JOIN users u ON u.user_id = a.patient_id "
            "WHERE a.doctor_id = $1 AND a.status IN ('pending', 'accepted') AND a.date >= NOW()::date "
            "ORDER BY a.date ASC, a.time ASC LIMIT 10"
        ),
        doctor_id,
    )

    # Connected patients (accepted connections where the other party is a USER)
    patients = await prisma.query_raw(
        (
            "SELECT c.connection_id, u.user_id, u.full_name, u.health_id, u.email, u.created_at "
            "FROM connections c "
            "JOIN users u ON (u.user_id = c.follower_id AND c.following_id = $1) "
            "   OR (u.user_id = c.following_id AND c.follower_id = $1) "
            "WHERE c.status = 'accepted' AND u.user_id != $1 AND u.role = 'USER' "
            "ORDER BY c.created_at DESC LIMIT 20"
        ),
        doctor_id,
    )

    # Stats
    total_patients_rows = await prisma.query_raw(
        (
            "SELECT COUNT(DISTINCT CASE WHEN c.follower_id = $1 THEN c.following_id ELSE c.follower_id END) AS cnt "
            "FROM connections c "
            "WHERE (c.follower_id = $1 OR c.following_id = $1) AND c.status = 'accepted'"
        ),
        doctor_id,
    )
    total_patients = total_patients_rows[0]['cnt'] if total_patients_rows else 0

    completed_rows = await prisma.query_raw(
        "SELECT COUNT(*) AS cnt FROM appointments WHERE doctor_id = $1 AND status = 'completed'",
        doctor_id,
    )
    completed_appointments = completed_rows[0]['cnt'] if completed_rows else 0

    return {
        'appointments': appointments,
        'patients': patients,
        'stats': {
            'total_patients': total_patients,
            'completed_appointments': completed_appointments,
        },
    }


async def list_doctor_patients(prisma: Prisma, doctor_id: str) -> Dict[str, Any]:
    """List all connected patients for a doctor."""
    patients = await prisma.query_raw(
        (
            "SELECT c.connection_id, c.status, c.created_at AS connected_at, "
            "u.user_id, u.full_name, u.health_id, u.email, u.phone_number "
            "FROM connections c "
            "JOIN users u ON (u.user_id = c.follower_id AND c.following_id = $1) "
            "   OR (u.user_id = c.following_id AND c.follower_id = $1) "
            "WHERE c.status = 'accepted' AND u.user_id != $1 AND u.role = 'USER' "
            "ORDER BY u.full_name ASC"
        ),
        doctor_id,
    )
    return {'patients': patients}


async def list_appointments(
    prisma: Prisma,
    user_id: str,
    role: str,
    status_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """List appointments for a user (doctor or patient)."""
    if role == 'DOCTOR':
        base = (
            "SELECT a.appointment_id, a.date, a.time, a.type, a.status, a.notes, a.created_at, "
            "u.full_name AS other_name, u.health_id AS other_health_id, u.user_id AS other_user_id "
            "FROM appointments a "
            "JOIN users u ON u.user_id = a.patient_id "
            "WHERE a.doctor_id = $1"
        )
    else:
        base = (
            "SELECT a.appointment_id, a.date, a.time, a.type, a.status, a.notes, a.created_at, "
            "u.full_name AS other_name, u.health_id AS other_health_id, u.user_id AS other_user_id "
            "FROM appointments a "
            "JOIN users u ON u.user_id = a.doctor_id "
            "WHERE a.patient_id = $1"
        )

    if status_filter:
        base += f" AND a.status = '{status_filter}'"
    base += " ORDER BY a.date DESC, a.time DESC"

    rows = await prisma.query_raw(base, user_id)
    return {'appointments': rows}


async def create_appointment(
    prisma: Prisma,
    *,
    patient_id: str,
    doctor_id: str,
    date: str,
    time: str,
    appointment_type: str = "In-Person",
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new appointment."""
    rows = await prisma.query_raw(
        (
            "INSERT INTO appointments (appointment_id, patient_id, doctor_id, date, time, type, notes) "
            "VALUES ($1, $2, $3, $4::timestamptz, $5, $6, $7) "
            "RETURNING appointment_id, patient_id, doctor_id, date, time, type, status, notes, created_at"
        ),
        _generate_appointment_id(),
        patient_id,
        doctor_id,
        date,
        time,
        appointment_type,
        notes,
    )
    return rows[0]


async def update_appointment_status(
    prisma: Prisma,
    appointment_id: str,
    doctor_id: str,
    new_status: str,
) -> Dict[str, Any]:
    """Update appointment status (doctor only)."""
    if new_status not in ('accepted', 'rejected', 'completed', 'cancelled'):
        raise ValidationError("Invalid appointment status.")

    rows = await prisma.query_raw(
        "SELECT appointment_id, doctor_id FROM appointments WHERE appointment_id = $1 LIMIT 1",
        appointment_id,
    )
    if not rows:
        raise NotFoundError("Appointment not found.")
    if rows[0]['doctor_id'] != doctor_id:
        raise ForbiddenError("Only the assigned doctor can update this appointment.")

    await prisma.execute_raw(
        "UPDATE appointments SET status = $1, updated_at = NOW() WHERE appointment_id = $2",
        new_status,
        appointment_id,
    )
    updated = await prisma.query_raw(
        (
            "SELECT a.appointment_id, a.date, a.time, a.type, a.status, a.notes, a.created_at, "
            "u.full_name AS patient_name, u.health_id AS patient_health_id "
            "FROM appointments a JOIN users u ON u.user_id = a.patient_id "
            "WHERE a.appointment_id = $1"
        ),
        appointment_id,
    )
    return updated[0] if updated else {'appointment_id': appointment_id, 'status': new_status}


async def list_prescriptions(
    prisma: Prisma,
    user_id: str,
    role: str,
    status_filter: Optional[str] = None,
) -> Dict[str, Any]:
    """List prescriptions for a doctor or patient."""
    if role == 'DOCTOR':
        base = (
            "SELECT p.prescription_id, p.medication, p.dosage, p.duration, p.notes, "
            "p.status, p.created_at, p.updated_at, "
            "u.full_name AS patient_name, u.health_id AS patient_health_id "
            "FROM prescriptions p "
            "JOIN users u ON u.user_id = p.patient_id "
            "WHERE p.doctor_id = $1"
        )
    else:
        base = (
            "SELECT p.prescription_id, p.medication, p.dosage, p.duration, p.notes, "
            "p.status, p.created_at, p.updated_at, "
            "u.full_name AS doctor_name, u.health_id AS doctor_health_id "
            "FROM prescriptions p "
            "JOIN users u ON u.user_id = p.doctor_id "
            "WHERE p.patient_id = $1"
        )

    if status_filter:
        base += f" AND p.status = '{status_filter}'"
    base += " ORDER BY p.created_at DESC"

    rows = await prisma.query_raw(base, user_id)
    return {'prescriptions': rows}


async def create_prescription(
    prisma: Prisma,
    *,
    doctor_id: str,
    patient_id: str,
    medication: str,
    dosage: str,
    duration: str,
    notes: Optional[str] = None,
) -> Dict[str, Any]:
    """Create a new prescription (doctor only)."""
    # Verify doctor has connection to patient
    conn = await prisma.query_raw(
        "SELECT connection_id FROM connections "
        "WHERE ((follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)) "
        "AND status = 'accepted' LIMIT 1",
        doctor_id,
        patient_id,
    )
    if not conn:
        raise ForbiddenError("You must have an accepted connection with the patient.")

    rows = await prisma.query_raw(
        (
            "INSERT INTO prescriptions (prescription_id, doctor_id, patient_id, medication, dosage, duration, notes) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7) "
            "RETURNING prescription_id, doctor_id, patient_id, medication, dosage, duration, notes, status, created_at"
        ),
        _generate_prescription_id(),
        doctor_id,
        patient_id,
        medication,
        dosage,
        duration,
        notes,
    )
    return rows[0]


async def update_prescription_status(
    prisma: Prisma,
    prescription_id: str,
    doctor_id: str,
    new_status: str,
) -> Dict[str, Any]:
    """Update prescription status (doctor only)."""
    if new_status not in ('Active', 'Completed', 'Cancelled'):
        raise ValidationError("Status must be 'Active', 'Completed', or 'Cancelled'.")

    rows = await prisma.query_raw(
        "SELECT prescription_id, doctor_id FROM prescriptions WHERE prescription_id = $1 LIMIT 1",
        prescription_id,
    )
    if not rows:
        raise NotFoundError("Prescription not found.")
    if rows[0]['doctor_id'] != doctor_id:
        raise ForbiddenError("Only the prescribing doctor can update this prescription.")

    await prisma.execute_raw(
        "UPDATE prescriptions SET status = $1, updated_at = NOW() WHERE prescription_id = $2",
        new_status,
        prescription_id,
    )
    return {'prescription_id': prescription_id, 'status': new_status}


async def get_doctor_profile(prisma: Prisma, user_id: str) -> Dict[str, Any]:
    """Get the doctor profile with stats."""
    rows = await prisma.query_raw(
        (
            "SELECT user_id, email, full_name, health_id, role, phone_number, "
            "specialization, experience, hospital_affiliation, education, created_at "
            "FROM users WHERE user_id = $1 AND role = 'DOCTOR' LIMIT 1"
        ),
        user_id,
    )
    if not rows:
        raise NotFoundError("Doctor profile not found.")

    profile = rows[0]

    # Patient count
    patient_rows = await prisma.query_raw(
        (
            "SELECT COUNT(DISTINCT CASE WHEN c.follower_id = $1 THEN c.following_id ELSE c.follower_id END) AS cnt "
            "FROM connections c "
            "WHERE (c.follower_id = $1 OR c.following_id = $1) AND c.status = 'accepted'"
        ),
        user_id,
    )
    profile['patient_count'] = patient_rows[0]['cnt'] if patient_rows else 0

    # Rating from the Doctor table if linked
    rating_rows = await prisma.query_raw(
        "SELECT rating FROM doctors WHERE health_id = $1 LIMIT 1",
        profile.get('health_id', ''),
    )
    profile['rating'] = rating_rows[0]['rating'] if rating_rows else 0

    return profile


async def update_doctor_profile(
    prisma: Prisma,
    user_id: str,
    *,
    specialization: Optional[str] = None,
    experience: Optional[str] = None,
    hospital_affiliation: Optional[str] = None,
    education: Optional[str] = None,
    full_name: Optional[str] = None,
    phone_number: Optional[str] = None,
) -> Dict[str, Any]:
    """Update doctor profile fields."""
    updates = []
    params = []
    idx = 1

    for field, value in [
        ('specialization', specialization),
        ('experience', experience),
        ('hospital_affiliation', hospital_affiliation),
        ('education', education),
        ('full_name', full_name),
        ('phone_number', phone_number),
    ]:
        if value is not None:
            updates.append(f"{field} = ${idx}")
            params.append(value)
            idx += 1

    if not updates:
        raise ValidationError("No fields to update.")

    params.append(user_id)
    query = f"UPDATE users SET {', '.join(updates)} WHERE user_id = ${idx} RETURNING user_id, email, full_name, specialization, experience, hospital_affiliation, education, health_id"
    rows = await prisma.query_raw(query, *params)
    return rows[0] if rows else {}
