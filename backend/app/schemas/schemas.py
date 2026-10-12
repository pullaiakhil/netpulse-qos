from datetime import datetime
import ipaddress
import re
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


HOST_REGEX = re.compile(
    r"^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*"
    r"([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$"
)


def validate_hostname_or_ip(v: str) -> str:
    cleaned = v.strip()
    if not cleaned:
        raise ValueError("Host cannot be empty")
    try:
        ipaddress.ip_address(cleaned)
        return cleaned
    except ValueError:
        pass

    if len(cleaned) > 255:
        raise ValueError("Hostname exceeds maximum length of 255 characters")
    if not HOST_REGEX.match(cleaned):
        raise ValueError("Invalid hostname or IP address format")
    return cleaned


# ==========================================
# Monitoring Target Schemas
# ==========================================

class MonitoringTargetBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="Display name for target")
    host: str = Field(..., min_length=1, max_length=255, description="FQDN hostname or IP address")
    target_type: Literal["icmp", "tcp", "http"] = Field(default="icmp", description="Measurement protocol")
    port: Optional[int] = Field(default=None, ge=1, le=65535, description="Port number (required for TCP)")
    enabled: bool = Field(default=True, description="Whether target is active")

    @field_validator("host")
    @classmethod
    def check_host(cls, v: str) -> str:
        return validate_hostname_or_ip(v)

    @field_validator("port")
    @classmethod
    def check_port(cls, v: Optional[int], info) -> Optional[int]:
        target_type = info.data.get("target_type")
        if target_type == "tcp" and v is None:
            raise ValueError("Port is required for TCP targets")
        return v


class MonitoringTargetCreate(MonitoringTargetBase):
    pass


class MonitoringTargetUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    host: Optional[str] = Field(default=None, min_length=1, max_length=255)
    target_type: Optional[Literal["icmp", "tcp", "http"]] = None
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    enabled: Optional[bool] = None

    @field_validator("host")
    @classmethod
    def check_host(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            return validate_hostname_or_ip(v)
        return v


class MonitoringTargetResponse(MonitoringTargetBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Monitoring Session Schemas
# ==========================================

class MonitoringSessionStartRequest(BaseModel):
    target_id: int = Field(..., gt=0, description="Target ID to monitor")
    interval_seconds: float = Field(default=5.0, ge=0.5, le=3600.0, description="Probe frequency in seconds")
    profile: Optional[str] = Field(
        default="video_conferencing",
        description="QoS SLA profile (video_conferencing, voip, gaming, browsing, file_download)"
    )


class MonitoringSessionStopRequest(BaseModel):
    session_id: Optional[int] = Field(default=None, gt=0, description="Session ID to terminate")
    target_id: Optional[int] = Field(default=None, gt=0, description="Target ID to stop active session for")


class MonitoringSessionResponse(BaseModel):
    id: int
    target_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    interval_seconds: float
    config_snapshot: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# Probe Result Schemas
# ==========================================

class ProbeResultResponse(BaseModel):
    id: int
    session_id: int
    timestamp: datetime
    sequence_number: int
    success: bool
    rtt_ms: Optional[float] = None
    error_type: Optional[str] = None
    error_detail: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ==========================================
# QoS Snapshot Schemas
# ==========================================

class QoSSnapshotResponse(BaseModel):
    id: int
    session_id: int
    timestamp: datetime
    min_rtt_ms: Optional[float] = None
    max_rtt_ms: Optional[float] = None
    mean_rtt_ms: Optional[float] = None
    median_rtt_ms: Optional[float] = None
    stddev_rtt_ms: Optional[float] = None
    p95_rtt_ms: Optional[float] = None
    jitter_ms: Optional[float] = None
    probes_sent: int = 0
    probes_received: int = 0
    packet_loss_pct: Optional[float] = None
    rx_throughput_mbps: Optional[float] = None
    tx_throughput_mbps: Optional[float] = None
    assessment_status: Optional[str] = None
    assessment_details: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class MonitoringSessionDetailResponse(MonitoringSessionResponse):
    target: Optional[MonitoringTargetResponse] = None
    latest_snapshot: Optional[QoSSnapshotResponse] = None
    probes_count: int = 0


class ActiveSessionStatus(BaseModel):
    session_id: int
    target_id: int
    target_name: str
    target_host: str
    status: str
    interval_seconds: float
    probes_sent: int
    uptime_seconds: float
    latest_metrics: Optional[QoSSnapshotResponse] = None


class MonitoringStatusResponse(BaseModel):
    active_count: int
    sessions: List[ActiveSessionStatus]


class LiveMetricsResponse(BaseModel):
    session: Optional[MonitoringSessionResponse] = None
    probes: List[ProbeResultResponse] = []
    latest_snapshot: Optional[QoSSnapshotResponse] = None


# ==========================================
# Alert Schemas
# ==========================================

class AlertResponse(BaseModel):
    id: int
    session_id: int
    target_id: Optional[int] = None
    target_name: Optional[str] = None
    timestamp: datetime
    severity: str
    metric: str
    observed_value: float
    actual_value: Optional[float] = None
    threshold_value: float
    unit: Optional[str] = None
    message: str
    resolved_at: Optional[datetime] = None
    resolved: bool = False
    acknowledged: bool

    model_config = ConfigDict(from_attributes=True)


class AlertAcknowledgeResponse(BaseModel):
    id: int
    acknowledged: bool
    message: str


class AlertResolveResponse(BaseModel):
    id: int
    resolved_at: datetime
    message: str


# ==========================================
# Diagnostic Test Schemas
# ==========================================

class TcpTestRequest(BaseModel):
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(..., ge=1, le=65535)
    timeout: float = Field(default=3.0, ge=0.1, le=30.0)

    @field_validator("host")
    @classmethod
    def check_host(cls, v: str) -> str:
        return validate_hostname_or_ip(v)


class TcpTestResponse(BaseModel):
    host: str
    port: int
    success: bool
    connect_time_ms: Optional[float] = None
    rtt_ms: Optional[float] = None
    error_type: Optional[str] = None
    error_detail: Optional[str] = None
    error: Optional[str] = None
    timestamp: datetime


class PingTestRequest(BaseModel):
    host: str = Field(..., min_length=1, max_length=255)
    count: int = Field(default=4, ge=1, le=20)
    timeout: float = Field(default=3.0, ge=0.5, le=10.0)

    @field_validator("host")
    @classmethod
    def check_host(cls, v: str) -> str:
        return validate_hostname_or_ip(v)


class PingItem(BaseModel):
    sequence: int
    success: bool
    rtt_ms: Optional[float] = None
    error_type: Optional[str] = None
    error_detail: Optional[str] = None


class PingTestResponse(BaseModel):
    host: str
    resolved_ip: Optional[str] = None
    count: int
    transmitted: int
    received: int
    packet_loss_pct: float
    min_rtt_ms: Optional[float] = None
    max_rtt_ms: Optional[float] = None
    mean_rtt_ms: Optional[float] = None
    jitter_ms: Optional[float] = None
    probes: List[PingItem]
    timestamp: datetime


class IperfTestRequest(BaseModel):
    host: str = Field(..., min_length=1, max_length=255)
    port: int = Field(default=5201, ge=1, le=65535)
    duration_seconds: int = Field(default=5, ge=1, le=30)
    authorized: bool = Field(default=True)

    @field_validator("host")
    @classmethod
    def check_host(cls, v: str) -> str:
        return validate_hostname_or_ip(v)


class IperfTestResponse(BaseModel):
    available: bool
    success: bool
    host: str
    port: int
    duration_seconds: int
    rx_mbps: Optional[float] = None
    tx_mbps: Optional[float] = None
    retransmits: Optional[int] = None
    error_type: Optional[str] = None
    error_detail: Optional[str] = None
    requirements_note: str
    timestamp: datetime



class TargetCompareItemRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    host: str = Field(..., min_length=1, max_length=255)
    protocol: Literal["icmp", "tcp"] = Field(default="icmp")
    port: Optional[int] = Field(default=None, ge=1, le=65535)

    @field_validator("host")
    @classmethod
    def check_host(cls, v: str) -> str:
        return validate_hostname_or_ip(v)


class MultiTargetCompareRequest(BaseModel):
    targets: List[TargetCompareItemRequest] = Field(..., min_length=1, max_length=10)
    probes_per_target: int = Field(default=3, ge=1, le=10)
    timeout_seconds: float = Field(default=2.5, ge=0.5, le=5.0)


class TargetCompareResultItem(BaseModel):
    name: str
    host: str
    protocol: str
    port: Optional[int] = None
    resolved_ip: Optional[str] = None
    probes_sent: int
    probes_received: int
    packet_loss_pct: float
    min_rtt_ms: Optional[float] = None
    max_rtt_ms: Optional[float] = None
    mean_rtt_ms: Optional[float] = None
    jitter_ms: Optional[float] = None
    status: str  # online, degraded, unreachable, icmp_blocked
    diagnostic: Optional[str] = None
    probes: List[Dict[str, Any]]


class MultiTargetCompareResponse(BaseModel):
    timestamp: datetime
    results: List[TargetCompareResultItem]


# ==========================================
# Report Schemas
# ==========================================

class SessionSummaryResponse(BaseModel):
    session_id: int
    target_id: int
    target_name: str
    target_host: str
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: float
    total_probes: int
    successful_probes: int
    failed_probes: int
    packet_loss_pct: float
    min_rtt_ms: Optional[float] = None
    max_rtt_ms: Optional[float] = None
    mean_rtt_ms: Optional[float] = None
    median_rtt_ms: Optional[float] = None
    p95_rtt_ms: Optional[float] = None
    jitter_ms: Optional[float] = None
    alert_counts: Dict[str, int]
    assessment_summary: Optional[Dict[str, Any]] = None


# ==========================================
# Health Schema
# ==========================================

class HealthResponse(BaseModel):
    status: str
    version: str
    uptime: float
    db_connected: bool
    python_version: Optional[str] = None
    os: Optional[str] = None
    c_engine_status: str = "unavailable"
    c_engine_binary: Optional[str] = None
    timestamp: datetime
