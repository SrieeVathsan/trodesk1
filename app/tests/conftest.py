# app/tests/conftest.py
from httpx import AsyncClient
import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from contextlib import asynccontextmanager

from app.db.session import Base, get_db
from app.main import app
from app.models.models import Platform, User, MentionPost

# Setup for async database testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for each test case."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def async_db_engine():
    """Create engine for testing database"""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(async_db_engine):
    """Create a fresh database session for each test"""
    async_session = sessionmaker(
        async_db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
        await session.rollback()

@pytest.fixture
def mock_db_session():
    """Mock database session for unit tests"""
    session = AsyncMock(spec=AsyncSession)
    session.__aenter__.return_value = session
    session.__aexit__.return_value = None
    return session

@pytest.fixture
def client(mock_db_session):
    """Test client with mocked database"""
    # Create a fresh app instance for each test
    from app.main import app as test_app
    
    # Override the database dependency
    test_app.dependency_overrides[get_db] = lambda: mock_db_session
    
    with TestClient(test_app) as test_client:
        yield test_client
    
    # Clean up overrides
    test_app.dependency_overrides.clear()

@pytest.fixture
async def async_client():
    async with AsyncClient(app=app, base_url="http://test") as client:
        yield client

@pytest.fixture
def mock_platform():
    return Platform(id="x", name="X")

@pytest.fixture
def mock_user():
    return User(
        id="user123",
        username="testuser",
        display_name="Test User",
        platform_id="x"
    )

@pytest.fixture
def mock_mention():
    return MentionPost(
        id="tweet1",
        platform_id="x",
        user_id="user123",
        text="Test tweet",
        is_reply=False
    )

@pytest.fixture
async def setup_test_data(db_session, mock_platform, mock_user, mock_mention):
    """Setup test data in database"""
    db_session.add(mock_platform)
    db_session.add(mock_user)
    db_session.add(mock_mention)
    await db_session.commit()
    yield
    await db_session.rollback()