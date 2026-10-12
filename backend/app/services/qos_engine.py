from dataclasses import dataclass, field
import math
import statistics
from typing import Any, Dict, List, Optional


@dataclass
class LatencyStats:
    """Latency statistical summary calculated over sample window."""
    min_ms: Optional[float]
    max_ms: Optional[float]
    mean_ms: Optional[float]
    median_ms: Optional[float]
    stddev_ms: Optional[float]
    p95_ms: Optional[float]


@dataclass
class MetricAssessment:
    """Assessment of a single metric against SLA thresholds."""
    metric: str
    observed_value: Optional[float]
    status: str  # good, degraded, poor, insufficient_data
    threshold_good: float
    threshold_degraded: float
    message: str


@dataclass
class QoSAssessment:
    """Overall QoS assessment across latency, jitter, and packet loss."""
    profile_name: str
    overall_status: str  # good, degraded, poor, insufficient_data
    details: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    summary: str = ""


# Threshold definitions per profile
# Format: metric -> (good_threshold, degraded_threshold)
# Values <= good_threshold are "good"
# Values <= degraded_threshold are "degraded"
# Values > degraded_threshold are "poor"
PROFILES: Dict[str, Dict[str, Any]] = {
    "video_conferencing": {
        "min_samples": 3,
        "latency_ms": {"good": 150.0, "degraded": 300.0},
        "jitter_ms": {"good": 30.0, "degraded": 50.0},
        "packet_loss_pct": {"good": 1.0, "degraded": 5.0},
    },
    "voip": {
        "min_samples": 3,
        "latency_ms": {"good": 100.0, "degraded": 200.0},
        "jitter_ms": {"good": 20.0, "degraded": 40.0},
        "packet_loss_pct": {"good": 0.5, "degraded": 2.0},
    },
    "gaming": {
        "min_samples": 3,
        "latency_ms": {"good": 50.0, "degraded": 100.0},
        "jitter_ms": {"good": 10.0, "degraded": 25.0},
        "packet_loss_pct": {"good": 0.1, "degraded": 2.0},
    },
    "browsing": {
        "min_samples": 2,
        "latency_ms": {"good": 250.0, "degraded": 500.0},
        "jitter_ms": {"good": 50.0, "degraded": 100.0},
        "packet_loss_pct": {"good": 2.0, "degraded": 8.0},
    },
    "file_download": {
        "min_samples": 2,
        "latency_ms": {"good": 400.0, "degraded": 800.0},
        "jitter_ms": {"good": 100.0, "degraded": 200.0},
        "packet_loss_pct": {"good": 3.0, "degraded": 10.0},
    },
}

STATUS_SEVERITY = {
    "insufficient_data": 0,
    "good": 1,
    "degraded": 2,
    "poor": 3,
}


class QoSEngine:
    """Core calculation engine for network Quality of Service analytics."""

    @staticmethod
    def calculate_latency_stats(rtt_values: List[float]) -> LatencyStats:
        """Calculate min, max, mean, median, sample stddev, and 95th percentile RTT."""
        if not rtt_values:
            return LatencyStats(
                min_ms=None,
                max_ms=None,
                mean_ms=None,
                median_ms=None,
                stddev_ms=None,
                p95_ms=None,
            )

        sorted_rtts = sorted(rtt_values)
        n = len(sorted_rtts)

        min_val = round(sorted_rtts[0], 2)
        max_val = round(sorted_rtts[-1], 2)
        mean_val = round(statistics.mean(sorted_rtts), 2)
        median_val = round(statistics.median(sorted_rtts), 2)

        # Standard deviation requires at least 2 values
        if n >= 2:
            stddev_val = round(statistics.stdev(sorted_rtts), 2)
        else:
            stddev_val = 0.0

        # Percentile 95 calculation using nearest rank / linear interpolation
        if n == 1:
            p95_val = sorted_rtts[0]
        else:
            # Nearest rank / percentile index
            k = 0.95 * (n - 1)
            f = math.floor(k)
            c = math.ceil(k)
            if f == c:
                p95_val = sorted_rtts[int(k)]
            else:
                p95_val = sorted_rtts[f] * (c - k) + sorted_rtts[c] * (k - f)

        return LatencyStats(
            min_ms=min_val,
            max_ms=max_val,
            mean_ms=mean_val,
            median_ms=median_val,
            stddev_ms=stddev_val,
            p95_ms=round(p95_val, 2),
        )

    @staticmethod
    def calculate_jitter(rtt_values: List[float]) -> Optional[float]:
        """RFC 1889 / 3550 style jitter: mean of absolute differences between consecutive packets."""
        if not rtt_values or len(rtt_values) < 2:
            return None

        diffs = [
            abs(rtt_values[i] - rtt_values[i - 1])
            for i in range(1, len(rtt_values))
        ]
        return round(statistics.mean(diffs), 2)

    @staticmethod
    def calculate_packet_loss(sent: int, received: int) -> Optional[float]:
        """Calculate packet loss percentage based on transmitted vs received probe counts."""
        if sent <= 0:
            return None
        loss_pct = ((sent - max(0, received)) / sent) * 100.0
        return round(max(0.0, min(100.0, loss_pct)), 2)

    @classmethod
    def assess_qos(
        cls,
        mean_rtt_ms: Optional[float],
        jitter_ms: Optional[float],
        packet_loss_pct: Optional[float],
        sample_count: int,
        profile_name: str = "video_conferencing",
    ) -> QoSAssessment:
        """Evaluate network measurements against profile QoS thresholds."""
        profile = PROFILES.get(profile_name, PROFILES["video_conferencing"])
        min_samples = profile.get("min_samples", 3)

        if sample_count < min_samples:
            return QoSAssessment(
                profile_name=profile_name,
                overall_status="insufficient_data",
                details={
                    "sample_count": {
                        "value": sample_count,
                        "required": min_samples,
                        "status": "insufficient_data",
                    }
                },
                summary=f"Insufficient samples ({sample_count}/{min_samples}) for SLA assessment",
            )

        details: Dict[str, Dict[str, Any]] = {}
        worst_severity = 1  # good

        # 1. Latency assessment
        if mean_rtt_ms is not None:
            lat_thresh = profile["latency_ms"]
            if mean_rtt_ms <= lat_thresh["good"]:
                lat_status = "good"
            elif mean_rtt_ms <= lat_thresh["degraded"]:
                lat_status = "degraded"
            else:
                lat_status = "poor"
            
            worst_severity = max(worst_severity, STATUS_SEVERITY[lat_status])
            details["latency"] = {
                "metric": "latency",
                "observed_value": mean_rtt_ms,
                "status": lat_status,
                "threshold_good": lat_thresh["good"],
                "threshold_degraded": lat_thresh["degraded"],
                "unit": "ms",
            }
        else:
            # All packets lost
            worst_severity = 3
            details["latency"] = {
                "metric": "latency",
                "observed_value": None,
                "status": "poor",
                "unit": "ms",
                "message": "No latency data (100% loss)",
            }

        # 2. Jitter assessment
        if jitter_ms is not None:
            jit_thresh = profile["jitter_ms"]
            if jitter_ms <= jit_thresh["good"]:
                jit_status = "good"
            elif jitter_ms <= jit_thresh["degraded"]:
                jit_status = "degraded"
            else:
                jit_status = "poor"

            worst_severity = max(worst_severity, STATUS_SEVERITY[jit_status])
            details["jitter"] = {
                "metric": "jitter",
                "observed_value": jitter_ms,
                "status": jit_status,
                "threshold_good": jit_thresh["good"],
                "threshold_degraded": jit_thresh["degraded"],
                "unit": "ms",
            }
        elif mean_rtt_ms is not None:
            # Latency exists but jitter cannot be computed (e.g. single successful probe)
            details["jitter"] = {
                "metric": "jitter",
                "observed_value": None,
                "status": "insufficient_data",
                "unit": "ms",
            }

        # 3. Packet Loss assessment
        if packet_loss_pct is not None:
            loss_thresh = profile["packet_loss_pct"]
            if packet_loss_pct <= loss_thresh["good"]:
                loss_status = "good"
            elif packet_loss_pct <= loss_thresh["degraded"]:
                loss_status = "degraded"
            else:
                loss_status = "poor"

            worst_severity = max(worst_severity, STATUS_SEVERITY[loss_status])
            details["packet_loss"] = {
                "metric": "packet_loss",
                "observed_value": packet_loss_pct,
                "status": loss_status,
                "threshold_good": loss_thresh["good"],
                "threshold_degraded": loss_thresh["degraded"],
                "unit": "%",
            }

        # Determine overall status from worst severity
        severity_map = {1: "good", 2: "degraded", 3: "poor"}
        overall_status = severity_map.get(worst_severity, "good")

        summary_parts = []
        for k, v in details.items():
            if v.get("status") in ("degraded", "poor"):
                summary_parts.append(f"{k} is {v['status']} ({v.get('observed_value')})")

        summary = "; ".join(summary_parts) if summary_parts else f"All metrics within {profile_name} SLAs"

        return QoSAssessment(
            profile_name=profile_name,
            overall_status=overall_status,
            details=details,
            summary=summary,
        )
