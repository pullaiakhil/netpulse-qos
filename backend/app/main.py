import asyncio
from contextlib import asynccontextmanager
import logging
import platform
import sys
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# On Windows, enforce ProactorEventLoop to support asyncio subprocesses properly
if sys.platform == "win32" or platform.system().lower() == "windows":
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    except Exception:
        pass

from app.config import settings
from app.database import init_db
from app.routers import (
    alerts_router,
    health_router,
    monitoring_router,
    reports_router,
    targets_router,
    tests_router,
    interfaces_router,
)
from app.services.monitoring_manager import monitoring_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("netpulse")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and graceful shutdown."""
    logger.info("Initializing NetPulse database and resources...")
    await init_db()
    logger.info("Database initialized successfully.")
    yield
    logger.info("Shutting down NetPulse: stopping active monitoring sessions...")
    await monitoring_manager.stop_all()
    logger.info("All monitoring sessions stopped cleanly.")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Quality of Service (QoS) Network SLA Monitoring and Diagnostics System",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Exception Handlers
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error processing request %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred. Please check logs for details."},
    )


# Include Routers under /api
app.include_router(health_router, prefix="/api")
app.include_router(targets_router, prefix="/api")
app.include_router(monitoring_router, prefix="/api")
app.include_router(tests_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(interfaces_router, prefix="/api")


@app.get("/")
async def root():
    """Root metadata endpoint."""
    return {
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/api/health",
    }


if __name__ == "__main__":
    import os
    import uvicorn

    host = os.environ.get("HOST", settings.HOST)
    port = int(os.environ.get("PORT", str(settings.PORT)))
    uvicorn.run("app.main:app", host=host, port=port, reload=settings.DEBUG)

