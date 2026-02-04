"""Test fixtures and utilities."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from config.settings import settings
from shared.models import Base
from shared.database import get_db_session
from api.main import create_app


@pytest.fixture(scope="session")
def test_db():
    """Create test database."""
    # Use in-memory SQLite for tests
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    yield engine
    engine.dispose()


@pytest.fixture
def test_client(test_db):
    """Create test client."""
    app = create_app()
    return TestClient(app)


@pytest.fixture
def test_user(test_db):
    """Create test user."""
    from shared.models import User
    from shared.security import generate_user_id

    Session = sessionmaker(bind=test_db)
    session = Session()

    user = User(
        user_id=generate_user_id(),
        email="test@example.com",
        is_active=True,
        role="USER",
    )
    session.add(user)
    session.commit()

    yield user

    session.close()
