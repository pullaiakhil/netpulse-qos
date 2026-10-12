import asyncio
from typing import AsyncGenerator
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models.models import MonitoringTarget, MonitoringSession

# In-memory SQLite async engine for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)




@pytest.fixture(autouse=True)
async def setup_test_db(monkeypatch):
    """Create all tables before each test and drop them after."""
    monkeypatch.setattr("app.database.AsyncSessionLocal", TestingSessionLocal)
    monkeypatch.setattr("app.database.engine", test_engine)

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide isolated db session for tests."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Asynchronous HTTP test client with database dependency override."""
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.fixture
async def sample_target(db_session: AsyncSession) -> MonitoringTarget:
    """Fixture providing a sample created target."""
    target = MonitoringTarget(
        name="Cloudflare DNS",
        host="1.1.1.1",
        target_type="icmp",
        port=None,
        enabled=True,
    )
    db_session.add(target)
    await db_session.commit()
    await db_session.refresh(target)
    return target


@pytest.fixture
async def sample_session(db_session: AsyncSession, sample_target: MonitoringTarget) -> MonitoringSession:
    """Fixture providing a sample monitoring session."""
    session = MonitoringSession(
        target_id=sample_target.id,
        status="running",
        interval_seconds=5.0,
        config_snapshot={"profile": "video_conferencing"},
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session
