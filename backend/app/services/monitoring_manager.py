import asyncio
from dataclasses import asdict
from datetime import datetime, timezone
import logging
import time
from typing import Any, Dict, List, Optional, Set

from sqlalchemy import desc, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.c_engine_adapter import CEngineAdapter
from app.adapters.icmp_adapter import IcmpAdapter
from app.adapters.tcp_adapter import TcpAdapter
from app.adapters.throughput_adapter import ThroughputAdapter
from app.config import settings
from app import database
from app.models.models import (
    Alert,
    MonitoringSession,
    MonitoringTarget,
    ProbeResult,
    QoSSnapshot,
)
from app.services.alert_engine import AlertEngine
from app.services.qos_engine import QoSEngine

logger = logging.getLogger(__name__)


class ActiveSessionContext:
    """In-memory runtime tracking context for an ongoing monitoring task."""

    def __init__(
        self,
        session_id: int,
        target_id: int,
        target_name: str,
        target_host: str,
        target_type: str,
        target_port: Optional[int],
        interval_seconds: float,
        profile_name: str,
        task: asyncio.Task,
    ):
        self.session_id = session_id
        self.target_id = target_id
        self.target_name = target_name
        self.target_host = target_host
        self.target_type = target_type
        self.target_port = target_port
        self.interval_seconds = interval_seconds
        self.profile_name = profile_name
        self.task = task
        self.start_time = datetime.now(timezone.utc)
        self.start_mono = time.monotonic()
        self.probes_sent = 0
        self.probes_received = 0
        self.recent_rtts: List[float] = []
        self.latest_snapshot: Optional[Dict[str, Any]] = None
        self.alert_engine = AlertEngine(
            session_id=session_id,
            consecutive_violations_required=settings.DEFAULT_CONSECUTIVE_VIOLATIONS,
            consecutive_normal_required=settings.DEFAULT_AUTO_RESOLVE_COUNT,
            profile_name=profile_name,
        )


class MonitoringManager:
    """Manages active network monitoring sessions and execution tasks."""

    def __init__(self):
        self.active_sessions: Dict[int, ActiveSessionContext] = {}
        self.target_session_map: Dict[int, int] = {}  # target_id -> session_id
        self._lock = asyncio.Lock()

    async def start_monitoring(
        self,
        target_id: int,
        interval_seconds: float = 5.0,
        profile_name: str = "video_conferencing",
    ) -> int:
        """Initialize and spawn an asynchronous probe loop for the specified target."""
        async with self._lock:
            # 1. Check if target is already running an active monitoring session
            if target_id in self.target_session_map:
                existing_sid = self.target_session_map[target_id]
                if existing_sid in self.active_sessions:
                    raise ValueError(f"Monitoring is already active for target {target_id} (Session #{existing_sid})")

            # 2. Query target details from database
            async with database.AsyncSessionLocal() as db:
                stmt = select(MonitoringTarget).where(MonitoringTarget.id == target_id)
                res = await db.execute(stmt)
                target = res.scalar_one_or_none()

                if not target:
                    raise ValueError(f"Target with id {target_id} not found")
                if not target.enabled:
                    raise ValueError(f"Target '{target.name}' is disabled")

                # Create Session record in DB
                session_record = MonitoringSession(
                    target_id=target.id,
                    start_time=datetime.now(timezone.utc),
                    status="running",
                    interval_seconds=interval_seconds,
                    config_snapshot={
                        "target_name": target.name,
                        "target_host": target.host,
                        "target_type": target.target_type,
                        "target_port": target.port,
                        "profile": profile_name,
                    },
                )
                db.add(session_record)
                await db.commit()
                await db.refresh(session_record)
                session_id = session_record.id

                target_name = target.name
                target_host = target.host
                target_type = target.target_type
                target_port = target.port

            # 3. Create context and launch background task
            task = asyncio.create_task(
                self._run_probe_loop(session_id),
                name=f"probe-session-{session_id}",
            )

            context = ActiveSessionContext(
                session_id=session_id,
                target_id=target_id,
                target_name=target_name,
                target_host=target_host,
                target_type=target_type,
                target_port=target_port,
                interval_seconds=interval_seconds,
                profile_name=profile_name,
                task=task,
            )

            self.active_sessions[session_id] = context
            self.target_session_map[target_id] = session_id

            logger.info("Started monitoring session %d for target %s (%s)", session_id, target_name, target_host)
            return session_id

    async def stop_monitoring(self, session_id: Optional[int] = None, target_id: Optional[int] = None) -> bool:
        """Cancel an ongoing monitoring session and persist termination state in DB."""
        async with self._lock:
            if session_id is None and target_id is not None:
                session_id = self.target_session_map.get(target_id)

            if not session_id or session_id not in self.active_sessions:
                return False

            ctx = self.active_sessions.pop(session_id)
            if ctx.target_id in self.target_session_map:
                del self.target_session_map[ctx.target_id]

            # Cancel background probe task
            if not ctx.task.done():
                ctx.task.cancel()
                try:
                    await ctx.task
                except asyncio.CancelledError:
                    pass

            # Update DB session record
            async with database.AsyncSessionLocal() as db:
                stmt = (
                    update(MonitoringSession)
                    .where(MonitoringSession.id == session_id)
                    .values(
                        end_time=datetime.now(timezone.utc),
                        status="stopped",
                    )
                )
                await db.execute(stmt)
                await db.commit()

            logger.info("Stopped monitoring session %d", session_id)
            return True

    async def stop_all(self) -> None:
        """Gracefully stop all ongoing sessions on application shutdown."""
        active_ids = list(self.active_sessions.keys())
        for sid in active_ids:
            try:
                await self.stop_monitoring(session_id=sid)
            except Exception as e:
                logger.error("Error stopping session %d during shutdown: %s", sid, e)

    def get_status(self) -> Dict[str, Any]:
        """Return runtime status of active sessions."""
        now_mono = time.monotonic()
        items = []
        for sid, ctx in self.active_sessions.items():
            uptime = max(0.0, round(now_mono - ctx.start_mono, 2))
            items.append({
                "session_id": sid,
                "target_id": ctx.target_id,
                "target_name": ctx.target_name,
                "target_host": ctx.target_host,
                "status": "running",
                "interval_seconds": ctx.interval_seconds,
                "probes_sent": ctx.probes_sent,
                "uptime_seconds": uptime,
                "latest_metrics": ctx.latest_snapshot,
            })
        return {
            "active_count": len(items),
            "sessions": items,
        }

    async def get_latest_metrics(self, session_id: int) -> Optional[QoSSnapshot]:
        """Fetch the most recent QoSSnapshot for a given session."""
        async with database.AsyncSessionLocal() as db:
            stmt = (
                select(QoSSnapshot)
                .where(QoSSnapshot.session_id == session_id)
                .order_by(desc(QoSSnapshot.timestamp))
                .limit(1)
            )
            res = await db.execute(stmt)
            return res.scalar_one_or_none()

    async def get_history(
        self,
        session_id: int,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[QoSSnapshot]:
        """Fetch historical QoS snapshots for charting and reporting."""
        async with database.AsyncSessionLocal() as db:
            stmt = select(QoSSnapshot).where(QoSSnapshot.session_id == session_id)
            if start_time:
                stmt = stmt.where(QoSSnapshot.timestamp >= start_time)
            if end_time:
                stmt = stmt.where(QoSSnapshot.timestamp <= end_time)
            stmt = stmt.order_by(desc(QoSSnapshot.timestamp)).limit(limit)
            res = await db.execute(stmt)
            return list(reversed(res.scalars().all()))

    async def _run_probe_loop(self, session_id: int) -> None:
        """Core periodic polling loop running in an asyncio task."""
        try:
            while True:
                ctx = self.active_sessions.get(session_id)
                if not ctx:
                    break

                # 1. Execute probe
                ctx.probes_sent += 1
                seq_num = ctx.probes_sent

                probe_success = False
                probe_rtt: Optional[float] = None
                error_type: Optional[str] = None
                error_detail: Optional[str] = None

                # Attempt genuine C-native networking engine probe first if compiled binary exists
                c_engine_res = None
                if CEngineAdapter.is_available():
                    mode_str = "tcp" if (ctx.target_type == "tcp" and ctx.target_port) else "icmp"
                    port_val = ctx.target_port or 80
                    c_engine_res = await CEngineAdapter.execute_probe(
                        mode=mode_str,
                        host=ctx.target_host,
                        port=port_val,
                        count=1,
                        timeout_seconds=min(ctx.interval_seconds, 3.0),
                    )

                if c_engine_res and c_engine_res.probes:
                    p = c_engine_res.probes[0]
                    probe_success = p.success
                    probe_rtt = p.rtt_ms
                    error_type = p.error_type
                    error_detail = p.error_detail
                else:
                    # Fallback to Python networking adapters (or primary if C engine is not built)
                    if ctx.target_type == "tcp" and ctx.target_port:
                        res = await TcpAdapter.test_connection(
                            host=ctx.target_host,
                            port=ctx.target_port,
                            timeout_seconds=min(ctx.interval_seconds, 3.0),
                        )
                        probe_success = res.success
                        probe_rtt = res.connect_time_ms
                        error_type = res.error_type
                        error_detail = res.error_detail
                    else:
                        # Default ICMP Ping
                        res = await IcmpAdapter.ping(
                            host=ctx.target_host,
                            timeout_seconds=min(ctx.interval_seconds, 3.0),
                        )
                        probe_success = res.success
                        probe_rtt = res.rtt_ms
                        error_type = res.error_type
                        error_detail = res.error_detail

                # Ensure failed probes have explicit diagnostic error_type and error_detail
                if not probe_success:
                    if not error_type:
                        error_type = "PROBE_FAILED"
                    if not error_detail:
                        error_detail = f"Probe to {ctx.target_host} ({ctx.target_type}) failed with no diagnostic message"
                    logger.warning(
                        "Probe #%d for session %d (%s) failed: type=%s, detail=%s",
                        seq_num,
                        session_id,
                        ctx.target_host,
                        error_type,
                        error_detail,
                    )
                else:
                    logger.info(
                        "Probe #%d for session %d (%s) succeeded: rtt=%.2fms",
                        seq_num,
                        session_id,
                        ctx.target_host,
                        probe_rtt or 0.0,
                    )

                if probe_success and probe_rtt is not None:
                    ctx.probes_received += 1
                    ctx.recent_rtts.append(probe_rtt)
                    # Keep rolling window of last 50 probes
                    if len(ctx.recent_rtts) > 50:
                        ctx.recent_rtts.pop(0)

                # Persist ProbeResult to Database
                probe_ts = datetime.now(timezone.utc)
                async with database.AsyncSessionLocal() as db:
                    probe_record = ProbeResult(
                        session_id=session_id,
                        timestamp=probe_ts,
                        sequence_number=seq_num,
                        success=probe_success,
                        rtt_ms=probe_rtt,
                        error_type=error_type,
                        error_detail=error_detail,
                    )
                    db.add(probe_record)
                    await db.commit()

                # 2. Check if we should compute a QoS Snapshot
                # Compute either on reaching snapshot threshold or minimum window
                if ctx.probes_sent % settings.PROBES_PER_QOS_SNAPSHOT == 0 or ctx.probes_sent == 1:
                    await self._compute_and_store_snapshot(ctx)

                await asyncio.sleep(ctx.interval_seconds)

        except asyncio.CancelledError:
            logger.info("Probe loop cancelled for session %d", session_id)
        except Exception as e:
            logger.exception("Unexpected error in probe loop for session %d: %s", session_id, e)
            async with database.AsyncSessionLocal() as db:
                stmt = (
                    update(MonitoringSession)
                    .where(MonitoringSession.id == session_id)
                    .values(
                        end_time=datetime.now(timezone.utc),
                        status="error",
                    )
                )
                await db.execute(stmt)
                await db.commit()

    async def _compute_and_store_snapshot(self, ctx: ActiveSessionContext) -> None:
        """Compute statistics, throughput, evaluate SLA alerts, and store QoSSnapshot."""
        now_utc = datetime.now(timezone.utc)

        # QoS calculations
        lat_stats = QoSEngine.calculate_latency_stats(ctx.recent_rtts)
        jitter_val = QoSEngine.calculate_jitter(ctx.recent_rtts)
        loss_pct = QoSEngine.calculate_packet_loss(ctx.probes_sent, ctx.probes_received)

        assessment = QoSEngine.assess_qos(
            mean_rtt_ms=lat_stats.mean_ms,
            jitter_ms=jitter_val,
            packet_loss_pct=loss_pct,
            sample_count=len(ctx.recent_rtts),
            profile_name=ctx.profile_name,
        )

        # Throughput adapter reading
        throughput_res = await ThroughputAdapter.sample_interface()
        rx_mbps = throughput_res.rx_mbps if throughput_res else None
        tx_mbps = throughput_res.tx_mbps if throughput_res else None

        # Alert evaluation
        alert_eval = ctx.alert_engine.evaluate_metrics(
            mean_rtt_ms=lat_stats.mean_ms,
            jitter_ms=jitter_val,
            packet_loss_pct=loss_pct,
        )

        async with database.AsyncSessionLocal() as db:
            snapshot = QoSSnapshot(
                session_id=ctx.session_id,
                timestamp=now_utc,
                min_rtt_ms=lat_stats.min_ms,
                max_rtt_ms=lat_stats.max_ms,
                mean_rtt_ms=lat_stats.mean_ms,
                median_rtt_ms=lat_stats.median_ms,
                stddev_rtt_ms=lat_stats.stddev_ms,
                p95_rtt_ms=lat_stats.p95_ms,
                jitter_ms=jitter_val,
                probes_sent=ctx.probes_sent,
                probes_received=ctx.probes_received,
                packet_loss_pct=loss_pct,
                rx_throughput_mbps=rx_mbps,
                tx_throughput_mbps=tx_mbps,
                assessment_status=assessment.overall_status,
                assessment_details=assessment.details,
            )
            db.add(snapshot)

            # Store any new alerts
            for alert_candidate in alert_eval.alerts_to_create:
                db_alert = Alert(
                    session_id=ctx.session_id,
                    timestamp=now_utc,
                    severity=alert_candidate.severity,
                    metric=alert_candidate.metric,
                    observed_value=alert_candidate.observed_value,
                    threshold_value=alert_candidate.threshold_value,
                    message=alert_candidate.message,
                    acknowledged=False,
                    resolved_at=None,
                )
                db.add(db_alert)

            # Auto-resolve recovered metrics
            for resolved_metric in alert_eval.metrics_to_resolve:
                resolve_stmt = (
                    update(Alert)
                    .where(
                        Alert.session_id == ctx.session_id,
                        Alert.metric == resolved_metric,
                        Alert.resolved_at.is_(None),
                    )
                    .values(resolved_at=now_utc)
                )
                await db.execute(resolve_stmt)

            await db.commit()

            # Cache latest snapshot for in-memory status calls
            ctx.latest_snapshot = {
                "id": snapshot.id,
                "session_id": ctx.session_id,
                "timestamp": now_utc.isoformat(),
                "min_rtt_ms": lat_stats.min_ms,
                "max_rtt_ms": lat_stats.max_ms,
                "mean_rtt_ms": lat_stats.mean_ms,
                "median_rtt_ms": lat_stats.median_ms,
                "stddev_rtt_ms": lat_stats.stddev_ms,
                "p95_rtt_ms": lat_stats.p95_ms,
                "jitter_ms": jitter_val,
                "probes_sent": ctx.probes_sent,
                "probes_received": ctx.probes_received,
                "packet_loss_pct": loss_pct,
                "rx_throughput_mbps": rx_mbps,
                "tx_throughput_mbps": tx_mbps,
                "assessment_status": assessment.overall_status,
                "assessment_details": assessment.details,
            }


monitoring_manager = MonitoringManager()
