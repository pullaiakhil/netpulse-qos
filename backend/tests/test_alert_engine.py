import pytest
from app.services.alert_engine import AlertEngine


def test_consecutive_violation_threshold():
    """Alert should only trigger after consecutive violations reach threshold (default 3)."""
    engine = AlertEngine(
        session_id=1,
        consecutive_violations_required=3,
        consecutive_normal_required=3,
        profile_name="video_conferencing",  # latency good <= 150, degraded <= 300
    )

    # 1st violation (latency 200ms > 150ms)
    res1 = engine.evaluate_metrics(mean_rtt_ms=200.0, jitter_ms=10.0, packet_loss_pct=0.0)
    assert len(res1.alerts_to_create) == 0

    # 2nd violation
    res2 = engine.evaluate_metrics(mean_rtt_ms=205.0, jitter_ms=10.0, packet_loss_pct=0.0)
    assert len(res2.alerts_to_create) == 0

    # 3rd violation -> Alert triggers!
    res3 = engine.evaluate_metrics(mean_rtt_ms=210.0, jitter_ms=10.0, packet_loss_pct=0.0)
    assert len(res3.alerts_to_create) == 1
    alert = res3.alerts_to_create[0]
    assert alert.metric == "latency"
    assert alert.severity == "warning"
    assert "exceeded threshold" in alert.message

    # 4th violation -> should not duplicate alert since already active
    res4 = engine.evaluate_metrics(mean_rtt_ms=215.0, jitter_ms=10.0, packet_loss_pct=0.0)
    assert len(res4.alerts_to_create) == 0


def test_alert_auto_resolve():
    """Alert should resolve after metric stays normal for required consecutive intervals."""
    engine = AlertEngine(
        session_id=1,
        consecutive_violations_required=2,
        consecutive_normal_required=2,
        profile_name="video_conferencing",
    )

    # Trigger alert with 2 violations
    engine.evaluate_metrics(mean_rtt_ms=400.0, jitter_ms=10.0, packet_loss_pct=0.0)
    res_trigger = engine.evaluate_metrics(mean_rtt_ms=400.0, jitter_ms=10.0, packet_loss_pct=0.0)
    assert len(res_trigger.alerts_to_create) == 1
    assert "latency" in engine.active_alert_metrics

    # 1st normal reading (latency = 50ms <= 150ms)
    res_norm1 = engine.evaluate_metrics(mean_rtt_ms=50.0, jitter_ms=10.0, packet_loss_pct=0.0)
    assert len(res_norm1.metrics_to_resolve) == 0
    assert "latency" in engine.active_alert_metrics

    # 2nd normal reading -> metric should resolve!
    res_norm2 = engine.evaluate_metrics(mean_rtt_ms=50.0, jitter_ms=10.0, packet_loss_pct=0.0)
    assert "latency" in res_norm2.metrics_to_resolve
    assert "latency" not in engine.active_alert_metrics


def test_multiple_metrics_independent():
    """Test latency and packet loss alerting independently."""
    engine = AlertEngine(
        session_id=1,
        consecutive_violations_required=1,
        consecutive_normal_required=1,
        profile_name="video_conferencing",
    )

    # Both latency (400ms > 300ms => critical) and packet loss (10% > 5% => critical)
    res = engine.evaluate_metrics(mean_rtt_ms=400.0, jitter_ms=5.0, packet_loss_pct=10.0)
    assert len(res.alerts_to_create) == 2
    metrics = {a.metric for a in res.alerts_to_create}
    assert metrics == {"latency", "packet_loss"}
    assert all(a.severity == "critical" for a in res.alerts_to_create)
