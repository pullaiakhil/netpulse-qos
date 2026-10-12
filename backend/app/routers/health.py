import platform
import sys
import time
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.c_engine_adapter import CEngineAdapter
from app.config import settings
from app.database import get_db
from app.schemas.schemas import HealthResponse

router = APIRouter(tags=["Health"])

START_TIME = time.monotonic()


@router.get("/health", response_model=HealthResponse)
async def check_health(db: AsyncSession = Depends(get_db)):
    """Health check endpoint validating service uptime and database connectivity."""
    db_ok = False
    try:
        res = await db.execute(text("SELECT 1"))
        db_ok = res.scalar() == 1
    except Exception:
        db_ok = False

    uptime_sec = round(time.monotonic() - START_TIME, 2)
    c_bin = CEngineAdapter.get_binary_path()
    c_status = "operational (compiled binary active)" if c_bin else "source ready (compilation optional)"

    return HealthResponse(
        status="healthy" if db_ok else "degraded",
        version=settings.APP_VERSION,
        uptime=uptime_sec,
        db_connected=db_ok,
        python_version=f"Python {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        os=f"{platform.system()} {platform.release()}",
        c_engine_status=c_status,
        c_engine_binary=c_bin,
        timestamp=datetime.now(timezone.utc),
    )
