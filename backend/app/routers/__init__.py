from app.routers.health import router as health_router
from app.routers.targets import router as targets_router
from app.routers.monitoring import router as monitoring_router
from app.routers.tests import router as tests_router
from app.routers.alerts import router as alerts_router
from app.routers.reports import router as reports_router
from app.routers.interfaces import router as interfaces_router

__all__ = [
    "health_router",
    "targets_router",
    "monitoring_router",
    "tests_router",
    "alerts_router",
    "reports_router",
    "interfaces_router",
]
