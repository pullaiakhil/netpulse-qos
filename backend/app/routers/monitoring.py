from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import MonitoringSession, ProbeResult
from app.schemas.schemas import (
    LiveMetricsResponse,
    MonitoringSessionResponse,
    MonitoringSessionStartRequest,
    MonitoringSessionStopRequest,
    MonitoringStatusResponse,
    ProbeResultResponse,
    QoSSnapshotResponse,
)
from app.services.monitoring_manager import monitoring_manager

router = APIRouter(prefix="/monitoring", tags=["Monitoring"])


@router.post("/start", response_model=dict, status_code=status.HTTP_201_CREATED)
async def start_monitoring_session(
    payload: MonitoringSessionStartRequest,
):
    """Start real-time monitoring session for a target."""
    try:
        session_id = await monitoring_manager.start_monitoring(
            target_id=payload.target_id,
            interval_seconds=payload.interval_seconds,
            profile_name=payload.profile or "video_conferencing",
        )
        return {
            "session_id": session_id,
            "target_id": payload.target_id,
            "status": "running",
            "message": "Monitoring session started successfully",
        }
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.post("/stop", response_model=dict)
async def stop_monitoring_session(
    payload: MonitoringSessionStopRequest,
):
    """Stop an active monitoring session."""
    stopped = await monitoring_manager.stop_monitoring(
        session_id=payload.session_id,
        target_id=payload.target_id,
    )
    if not stopped:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active monitoring session not found for specified session_id or target_id",
        )
    return {
        "status": "stopped",
        "message": "Monitoring session stopped successfully",
    }


@router.get("/status", response_model=MonitoringStatusResponse)
async def get_monitoring_status():
    """Retrieve runtime status of all currently active monitoring sessions."""
    return monitoring_manager.get_status()


@router.get("/metrics", response_model=LiveMetricsResponse)
async def get_latest_metrics(
    session_id: Optional[int] = Query(default=None, description="Optional Session ID"),
    limit: int = Query(default=50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get real-time monitoring metrics including recent probes and latest QoS snapshot."""
    target_sid = session_id
    if not target_sid:
        status_info = monitoring_manager.get_status()
        if status_info.get("sessions"):
            target_sid = status_info["sessions"][0]["session_id"]
        else:
            # Check latest session in DB
            latest_sess = await db.execute(
                select(MonitoringSession).order_by(desc(MonitoringSession.start_time)).limit(1)
            )
            sess_obj = latest_sess.scalar_one_or_none()
            if sess_obj:
                target_sid = sess_obj.id

    if not target_sid:
        return LiveMetricsResponse(session=None, probes=[], latest_snapshot=None)

    # Fetch session
    sess_res = await db.execute(select(MonitoringSession).where(MonitoringSession.id == target_sid))
    session_obj = sess_res.scalar_one_or_none()

    # Fetch recent probes
    probes_res = await db.execute(
        select(ProbeResult)
        .where(ProbeResult.session_id == target_sid)
        .order_by(desc(ProbeResult.timestamp))
        .limit(limit)
    )
    probes_list = list(reversed(probes_res.scalars().all()))

    # Fetch latest snapshot
    snapshot = await monitoring_manager.get_latest_metrics(target_sid)

    return LiveMetricsResponse(
        session=session_obj,
        probes=probes_list,
        latest_snapshot=snapshot,
    )


@router.get("/history", response_model=List[QoSSnapshotResponse])
async def get_metrics_history(
    session_id: int = Query(..., gt=0),
    start: Optional[datetime] = Query(default=None),
    end: Optional[datetime] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
):
    """Get historical series of QoS snapshots for charting."""
    return await monitoring_manager.get_history(
        session_id=session_id,
        start_time=start,
        end_time=end,
        limit=limit,
    )


@router.get("/sessions", response_model=List[MonitoringSessionResponse])
async def list_monitoring_sessions(
    skip: int = 0,
    limit: int = 50,
    target_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    """List historical monitoring sessions with pagination."""
    stmt = select(MonitoringSession)
    if target_id is not None:
        stmt = stmt.where(MonitoringSession.target_id == target_id)
    stmt = stmt.order_by(desc(MonitoringSession.start_time)).offset(skip).limit(limit)
    res = await db.execute(stmt)
    return res.scalars().all()
