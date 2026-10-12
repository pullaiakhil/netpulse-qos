import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

# Ensure parent directory exists for persistent SQLite database paths
if "sqlite" in settings.DATABASE_URL:
    try:
        raw_path = settings.DATABASE_URL.split(":///")[-1]
        db_dir = os.path.dirname(raw_path)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
    except Exception:
        pass

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base model class for all SQLAlchemy entities."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for providing database session to FastAPI routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables on application startup and seed initial lab targets if empty."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed default lab targets if database is fresh
    from sqlalchemy import select, func
    from app.models.models import MonitoringTarget

    async with AsyncSessionLocal() as session:
        count_res = await session.execute(select(func.count(MonitoringTarget.id)))
        target_count = count_res.scalar() or 0

        if target_count == 0:
            default_targets = [
                MonitoringTarget(
                    name="Google Public DNS",
                    host="8.8.8.8",
                    target_type="icmp",
                    port=None,
                    enabled=True,
                ),
                MonitoringTarget(
                    name="Cloudflare DNS",
                    host="1.1.1.1",
                    target_type="icmp",
                    port=None,
                    enabled=True,
                ),
                MonitoringTarget(
                    name="Local NetPulse Backend (TCP)",
                    host="127.0.0.1",
                    target_type="tcp",
                    port=8000,
                    enabled=True,
                ),
                MonitoringTarget(
                    name="Localhost HTTP/Web (TCP)",
                    host="127.0.0.1",
                    target_type="tcp",
                    port=5173,
                    enabled=True,
                ),
            ]
            session.add_all(default_targets)
            await session.commit()
