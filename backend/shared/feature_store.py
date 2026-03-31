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
