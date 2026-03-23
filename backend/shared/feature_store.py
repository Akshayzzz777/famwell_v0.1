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
            "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            ")"
        ),
        "CREATE UNIQUE INDEX IF NOT EXISTS connections_pair_unique ON connections (follower_id, following_id)",
        "CREATE INDEX IF NOT EXISTS connections_follower_idx ON connections (follower_id)",
        "CREATE INDEX IF NOT EXISTS connections_following_idx ON connections (following_id)",
    ]

    for statement in statements:
        await prisma.execute_raw(statement)

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

    return target_user_id


async def list_records(
    prisma: Prisma,
    requester: Dict[str, Any],
    target_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    owner_id = await _resolve_record_owner_id(prisma, requester, target_user_id)
    rows = await prisma.query_raw(
        (
            "SELECT record_id, user_id, record_type, data, created_at, updated_at "
            "FROM records WHERE user_id = $1 ORDER BY updated_at DESC, created_at DESC"
        ),
        owner_id,
    )
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
        "SELECT connection_id FROM connections WHERE follower_id = $1 AND following_id = $2 LIMIT 1",
        follower_id,
        target_user['user_id'],
    )
    if existing:
        raise ConflictError('This Health ID is already in your connections.')

    rows = await prisma.query_raw(
        (
            "INSERT INTO connections (connection_id, follower_id, following_id) "
            "VALUES ($1, $2, $3) "
            "RETURNING connection_id, follower_id, following_id, created_at"
        ),
        _generate_connection_id(),
        follower_id,
        target_user['user_id'],
    )
    connection = rows[0]
    connection['user'] = target_user
    return connection


async def list_connections(prisma: Prisma, follower_id: str) -> Dict[str, Any]:
    rows = await prisma.query_raw(
        (
            "SELECT c.connection_id, c.follower_id, c.following_id, c.created_at, "
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


def get_insights_payload() -> Dict[str, Any]:
    return {
        'status': 'pending',
        'message': 'Insights will be available once the model is ready',
    }
