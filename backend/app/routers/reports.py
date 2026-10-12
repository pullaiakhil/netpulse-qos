import csv
from datetime import datetime, timezone
import io
import statistics
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Alert, MonitoringSession, MonitoringTarget, ProbeResult, QoSSnapshot
from app.schemas.schemas import SessionSummaryResponse
from app.services.qos_engine import QoSEngine

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/export")
async def export_probes_csv(
    session_id: int = Query(..., gt=0, description="Session ID to export"),
    format: str = Query(default="csv", regex="^(csv)$"),
    db: AsyncSession = Depends(get_db),
):
    """Export all probe results for a monitoring session as a downloadable CSV file."""
    # Verify session exists
    session_stmt = select(MonitoringSession).where(MonitoringSession.id == session_id)
    session_res = await db.execute(session_stmt)
    sess = session_res.scalar_one_or_none()
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitoring session {session_id} not found",
        )

    # Fetch target details from session
    target_stmt = select(MonitoringTarget).where(MonitoringTarget.id == sess.target_id)
    target_res = await db.execute(target_stmt)
    target = target_res.scalar_one_or_none()

    target_name = target.name if target else (sess.config_snapshot.get("target_name") if sess.config_snapshot else "Unknown")
    target_host = target.host if target else (sess.config_snapshot.get("target_host") if sess.config_snapshot else "Unknown")
    target_type = target.target_type if target else (sess.config_snapshot.get("target_type") if sess.config_snapshot else "icmp")
    target_port = target.port if target else (sess.config_snapshot.get("target_port") if sess.config_snapshot else None)

    # Fetch all probes
    probes_stmt = (
        select(ProbeResult)
        .where(ProbeResult.session_id == session_id)
        .order_by(ProbeResult.sequence_number)
    )
    probes_res = await db.execute(probes_stmt)
    probes = probes_res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "sequence_number",
        "timestamp_utc",
        "target_name",
        "target_host",
        "protocol",
        "target_port",
        "status",
        "rtt_ms",
        "error_type",
        "error_detail",
    ])

    for p in probes:
        status_str = "SUCCESS" if p.success else "FAILED"
        rtt_str = f"{p.rtt_ms:.2f}" if (p.success and p.rtt_ms is not None) else ""
        err_type_str = p.error_type if p.error_type else ("" if p.success else "UNKNOWN_ERROR")
        err_detail_str = p.error_detail if p.error_detail else ("" if p.success else "No diagnostic error detail provided")

        writer.writerow([
            p.sequence_number,
            p.timestamp.isoformat() if p.timestamp else "",
            target_name,
            target_host,
            target_type.upper(),
            target_port or "",
            status_str,
            rtt_str,
            err_type_str,
            err_detail_str,
        ])

    csv_data = output.getvalue()
    filename = f"netpulse_session_{session_id}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        },
    )


@router.get("/summary", response_model=SessionSummaryResponse)
async def get_session_summary(
    session_id: int = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
):
    """Compute and return aggregated overall statistical QoS summary for a session."""
    session_stmt = select(MonitoringSession).where(MonitoringSession.id == session_id)
    session_res = await db.execute(session_stmt)
    sess = session_res.scalar_one_or_none()
    if not sess:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Monitoring session {session_id} not found",
        )

    target_stmt = select(MonitoringTarget).where(MonitoringTarget.id == sess.target_id)
    target_res = await db.execute(target_stmt)
    target = target_res.scalar_one_or_none()

    target_name = target.name if target else "Unknown"
    target_host = target.host if target else "Unknown"

    # Query all probes
    probes_stmt = (
        select(ProbeResult)
        .where(ProbeResult.session_id == session_id)
        .order_by(ProbeResult.sequence_number)
    )
    probes_res = await db.execute(probes_stmt)
    probes = probes_res.scalars().all()

    total_probes = len(probes)
    successful_rtts = [p.rtt_ms for p in probes if p.success and p.rtt_ms is not None]
    successful_probes = len(successful_rtts)
    failed_probes = total_probes - successful_probes

    loss_pct = 0.0
    if total_probes > 0:
        loss_pct = round(((total_probes - successful_probes) / total_probes) * 100.0, 2)

    lat_stats = QoSEngine.calculate_latency_stats(successful_rtts)
    jitter = QoSEngine.calculate_jitter(successful_rtts)

    # Compute duration
    end_time = sess.end_time or datetime.now(timezone.utc)
    # Ensure timezone compatibility for difference calculation
    start_ts = sess.start_time
    if start_ts.tzinfo is None:
        start_ts = start_ts.replace(tzinfo=timezone.utc)
    if end_time.tzinfo is None:
        end_time = end_time.replace(tzinfo=timezone.utc)
    duration_sec = max(0.0, round((end_time - start_ts).total_seconds(), 2))

    # Alert counts
    alerts_stmt = select(Alert.severity, func.count(Alert.id)).where(Alert.session_id == session_id).group_by(Alert.severity)
    alerts_res = await db.execute(alerts_stmt)
    alert_counts = {"info": 0, "warning": 0, "critical": 0}
    for sev, count in alerts_res.all():
        alert_counts[sev] = count

    profile_name = "video_conferencing"
    if sess.config_snapshot and "profile" in sess.config_snapshot:
        profile_name = sess.config_snapshot["profile"]

    assessment = QoSEngine.assess_qos(
        mean_rtt_ms=lat_stats.mean_ms,
        jitter_ms=jitter,
        packet_loss_pct=loss_pct,
        sample_count=successful_probes,
        profile_name=profile_name,
    )

    return SessionSummaryResponse(
        session_id=sess.id,
        target_id=sess.target_id,
        target_name=target_name,
        target_host=target_host,
        start_time=sess.start_time,
        end_time=sess.end_time,
        duration_seconds=duration_sec,
        total_probes=total_probes,
        successful_probes=successful_probes,
        failed_probes=failed_probes,
        packet_loss_pct=loss_pct,
        min_rtt_ms=lat_stats.min_ms,
        max_rtt_ms=lat_stats.max_ms,
        mean_rtt_ms=lat_stats.mean_ms,
        median_rtt_ms=lat_stats.median_ms,
        p95_rtt_ms=lat_stats.p95_ms,
        jitter_ms=jitter,
        alert_counts=alert_counts,
        assessment_summary={
            "status": assessment.overall_status,
            "profile": profile_name,
            "summary": assessment.summary,
            "details": assessment.details,
        },
    )
