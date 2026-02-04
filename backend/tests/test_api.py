"""Test suite for API endpoints."""

import pytest
from fastapi import status


def test_health_check(test_client):
    """Test health check endpoint."""
    response = test_client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == "healthy"


def test_root_endpoint(test_client):
    """Test root endpoint."""
    response = test_client.get("/")
    assert response.status_code == status.HTTP_200_OK
    assert "service" in response.json()


@pytest.mark.asyncio
async def test_upload_without_auth(test_client):
    """Test that upload requires authentication."""
    response = test_client.post(
        "/api/upload",
        files={"file": ("test.pdf", b"test content")}
    )
    # Should require auth
    assert response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]


def test_invalid_file_type(test_client, test_user):
    """Test rejection of non-PDF files."""
    # This is a placeholder - real test would need valid auth token
    pass


def test_file_size_validation(test_client, test_user):
    """Test file size limit enforcement."""
    # This is a placeholder
    pass


# RBAC Tests
def test_user_role_enum():
    """Test UserRole enum values."""
    from api.auth import UserRole
    
    assert UserRole.USER.value == "USER"
    assert UserRole.DOCTOR.value == "DOCTOR"


def test_require_role_decorator():
    """Test that role decorator is properly defined."""
    from api.auth import require_role, require_user, require_doctor, UserRole
    
    # Test that convenience dependencies are defined
    assert require_user is not None
    assert require_doctor is not None
    
    # Test require_role returns a callable
    role_checker = require_role(UserRole.USER)
    assert callable(role_checker)
