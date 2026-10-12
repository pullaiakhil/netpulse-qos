from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
)
from sqlalchemy.orm import relationship

from app.database import Base


def utc_now() -> datetime:
    """Return current UTC timestamp with timezone awareness stripped for SQLite compatibility."""
    return datetime.now(timezone.utc)


class MonitoringTarget(Base):
    """Network target configured for QoS monitoring."""

    __tablename__ = "monitoring_targets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    host = Column(String(255), nullable=False)
    target_type = Column(String(20), nullable=False, default="icmp")
    port = Column(Integer, nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, default=utc_now)
    updated_at = Column(DateTime, nullable=True, default=utc_now, onupdate=utc_now)

    sessions = relationship(
        "MonitoringSession",
        back_populates="target",
        cascade="all, delete-orphan",
    )


class MonitoringSession(Base):
    """An active or completed monitoring session for a target."""

    __tablename__ = "monitoring_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    target_id = Column(
        Integer,
        ForeignKey("monitoring_targets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    start_time = Column(DateTime, nullable=False, default=utc_now)
    end_time = Column(DateTime, nullable=True)
    status = Column(String(20), nullable=False, default="running")
    interval_seconds = Column(Float, nullable=False, default=5.0)
    config_snapshot = Column(JSON, nullable=True)

    target = relationship("MonitoringTarget", back_populates="sessions")
    probe_results = relationship(
        "ProbeResult",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    qos_snapshots = relationship(
        "QoSSnapshot",
        back_populates="session",
        cascade="all, delete-orphan",
    )
    alerts = relationship(
        "Alert",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class ProbeResult(Base):
    """Raw network probe observation."""

    __tablename__ = "probe_results"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(
        Integer,
        ForeignKey("monitoring_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    timestamp = Column(DateTime, nullable=False, default=utc_now)
    sequence_number = Column(Integer, nullable=False)
    success = Column(Boolean, nullable=False)
    rtt_ms = Column(Float, nullable=True)
    error_type = Column(String(50), nullable=True)
    error_detail = Column(String(500), nullable=True)

    session = relationship("MonitoringSession", back_populates="probe_results")

    __table_args__ = (
        Index("ix_probe_results_session_timestamp", "session_id", "timestamp"),
    )


class QoSSnapshot(Base):
    """Aggregated QoS metrics evaluated across a window of probes."""

    __tablename__ = "qos_snapshots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(
        Integer,
        ForeignKey("monitoring_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    timestamp = Column(DateTime, nullable=False, default=utc_now)
    min_rtt_ms = Column(Float, nullable=True)
    max_rtt_ms = Column(Float, nullable=True)
    mean_rtt_ms = Column(Float, nullable=True)
    median_rtt_ms = Column(Float, nullable=True)
    stddev_rtt_ms = Column(Float, nullable=True)
    p95_rtt_ms = Column(Float, nullable=True)
    jitter_ms = Column(Float, nullable=True)
    probes_sent = Column(Integer, nullable=False, default=0)
    probes_received = Column(Integer, nullable=False, default=0)
    packet_loss_pct = Column(Float, nullable=True)
    rx_throughput_mbps = Column(Float, nullable=True)
    tx_throughput_mbps = Column(Float, nullable=True)
    assessment_status = Column(String(20), nullable=True)
    assessment_details = Column(JSON, nullable=True)

    session = relationship("MonitoringSession", back_populates="qos_snapshots")

    __table_args__ = (
        Index("ix_qos_snapshots_session_timestamp", "session_id", "timestamp"),
    )


class Alert(Base):
    """QoS threshold violation alert."""

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(
        Integer,
        ForeignKey("monitoring_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    timestamp = Column(DateTime, nullable=False, default=utc_now)
    severity = Column(String(20), nullable=False)  # info, warning, critical
    metric = Column(String(50), nullable=False)
    observed_value = Column(Float, nullable=False)
    threshold_value = Column(Float, nullable=False)
    message = Column(String(500), nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    acknowledged = Column(Boolean, nullable=False, default=False)

    session = relationship("MonitoringSession", back_populates="alerts")
