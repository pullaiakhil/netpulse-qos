from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set

from app.services.qos_engine import PROFILES


@dataclass
class AlertCandidate:
    """Alert structure ready to be persisted."""
    metric: str
    severity: str
    observed_value: float
    threshold_value: float
    message: str


@dataclass
class AlertEvaluationResult:
    """Result of assessing a batch of metrics against SLA threshold limits."""
    alerts_to_create: List[AlertCandidate] = field(default_factory=list)
    metrics_to_resolve: List[str] = field(default_factory=list)


class AlertEngine:
    """Stateful violation counter and alert resolution tracker per monitoring session."""

    def __init__(
        self,
        session_id: int,
        consecutive_violations_required: int = 3,
        consecutive_normal_required: int = 3,
        profile_name: str = "video_conferencing",
    ):
        self.session_id = session_id
        self.consecutive_violations_required = consecutive_violations_required
        self.consecutive_normal_required = consecutive_normal_required
        self.profile_name = profile_name

        # State tracking: metric -> consecutive violation count
        self.violation_counts: Dict[str, int] = {
            "latency": 0,
            "jitter": 0,
            "packet_loss": 0,
        }
        # State tracking: metric -> consecutive normal count
        self.normal_counts: Dict[str, int] = {
            "latency": 0,
            "jitter": 0,
            "packet_loss": 0,
        }
        # Active alerted metrics currently open
        self.active_alert_metrics: Set[str] = set()

    def evaluate_metrics(
        self,
        mean_rtt_ms: Optional[float],
        jitter_ms: Optional[float],
        packet_loss_pct: Optional[float],
    ) -> AlertEvaluationResult:
        """Evaluate latest metrics, increment/reset counters, and yield triggers/resolutions."""
        profile = PROFILES.get(self.profile_name, PROFILES["video_conferencing"])
        results = AlertEvaluationResult()

        metrics_data = [
            ("latency", mean_rtt_ms, profile["latency_ms"], "ms"),
            ("jitter", jitter_ms, profile["jitter_ms"], "ms"),
            ("packet_loss", packet_loss_pct, profile["packet_loss_pct"], "%"),
        ]

        for metric_name, value, thresholds, unit in metrics_data:
            if value is None:
                # If metric is not available (e.g. 100% loss means jitter is None), skip
                continue

            good_thresh = thresholds["good"]
            degraded_thresh = thresholds["degraded"]

            is_violation = value > good_thresh

            if is_violation:
                # Violation detected
                self.violation_counts[metric_name] = self.violation_counts.get(metric_name, 0) + 1
                self.normal_counts[metric_name] = 0

                # Determine severity
                severity = "critical" if value > degraded_thresh else "warning"

                # Check if threshold reached and not already actively alerting
                if (
                    self.violation_counts[metric_name] >= self.consecutive_violations_required
                    and metric_name not in self.active_alert_metrics
                ):
                    self.active_alert_metrics.add(metric_name)
                    threshold_val = degraded_thresh if severity == "critical" else good_thresh
                    results.alerts_to_create.append(
                        AlertCandidate(
                            metric=metric_name,
                            severity=severity,
                            observed_value=value,
                            threshold_value=threshold_val,
                            message=(
                                f"{metric_name.capitalize()} exceeded threshold: "
                                f"{value}{unit} > {threshold_val}{unit} for "
                                f"{self.violation_counts[metric_name]} consecutive intervals"
                            ),
                        )
                    )
            else:
                # Normal reading
                self.normal_counts[metric_name] = self.normal_counts.get(metric_name, 0) + 1
                self.violation_counts[metric_name] = 0

                # Check if we should resolve active alert
                if (
                    self.normal_counts[metric_name] >= self.consecutive_normal_required
                    and metric_name in self.active_alert_metrics
                ):
                    self.active_alert_metrics.remove(metric_name)
                    results.metrics_to_resolve.append(metric_name)

        return results
