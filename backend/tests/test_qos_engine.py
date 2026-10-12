import pytest
from app.services.qos_engine import QoSEngine, PROFILES


def test_calculate_latency_stats_known_values():
    """Test latency stats with standard test sequence."""
    rtts = [10.0, 20.0, 30.0, 40.0, 50.0]
    stats = QoSEngine.calculate_latency_stats(rtts)
    assert stats.min_ms == 10.0
    assert stats.max_ms == 50.0
    assert stats.mean_ms == 30.0
    assert stats.median_ms == 30.0
    assert stats.stddev_ms == 15.81
    assert stats.p95_ms == 48.0


def test_calculate_latency_stats_empty():
    """Test edge case with empty list of RTTs."""
    stats = QoSEngine.calculate_latency_stats([])
    assert stats.min_ms is None
    assert stats.max_ms is None
    assert stats.mean_ms is None
    assert stats.median_ms is None
    assert stats.stddev_ms is None
    assert stats.p95_ms is None


def test_calculate_latency_stats_single_value():
    """Test edge case with single RTT measurement."""
    stats = QoSEngine.calculate_latency_stats([25.4])
    assert stats.min_ms == 25.4
    assert stats.max_ms == 25.4
    assert stats.mean_ms == 25.4
    assert stats.median_ms == 25.4
    assert stats.stddev_ms == 0.0
    assert stats.p95_ms == 25.4


def test_calculate_jitter():
    """Test jitter RFC RFC1889/3550 calculation."""
    # Differences: |15-10|=5, |20-15|=5, |30-20|=10 -> mean = (5+5+10)/3 = 6.67
    rtts = [10.0, 15.0, 20.0, 30.0]
    jitter = QoSEngine.calculate_jitter(rtts)
    assert jitter == 6.67


def test_calculate_jitter_insufficient_samples():
    """Test jitter with 0 or 1 sample returns None."""
    assert QoSEngine.calculate_jitter([]) is None
    assert QoSEngine.calculate_jitter([10.0]) is None


def test_calculate_packet_loss():
    """Test packet loss calculation."""
    assert QoSEngine.calculate_packet_loss(sent=10, received=10) == 0.0
    assert QoSEngine.calculate_packet_loss(sent=10, received=8) == 20.0
    assert QoSEngine.calculate_packet_loss(sent=10, received=0) == 100.0
    assert QoSEngine.calculate_packet_loss(sent=0, received=0) is None


def test_assess_qos_insufficient_data():
    """Test QoS assessment when sample count is less than threshold."""
    assessment = QoSEngine.assess_qos(
        mean_rtt_ms=25.0,
        jitter_ms=5.0,
        packet_loss_pct=0.0,
        sample_count=2,
        profile_name="video_conferencing",  # requires min 3
    )
    assert assessment.overall_status == "insufficient_data"


def test_assess_qos_all_profiles():
    """Test assessment evaluation across all built-in profiles."""
    profiles = ["video_conferencing", "voip", "gaming", "browsing", "file_download"]
    for prof in profiles:
        # Excellent metrics should yield 'good'
        assessment_good = QoSEngine.assess_qos(
            mean_rtt_ms=10.0,
            jitter_ms=2.0,
            packet_loss_pct=0.0,
            sample_count=5,
            profile_name=prof,
        )
        assert assessment_good.overall_status == "good"

        # Very high latency should yield 'poor'
        assessment_poor = QoSEngine.assess_qos(
            mean_rtt_ms=1000.0,
            jitter_ms=500.0,
            packet_loss_pct=25.0,
            sample_count=5,
            profile_name=prof,
        )
        assert assessment_poor.overall_status == "poor"


def test_assess_qos_worst_metric_precedence():
    """Test that a single poor metric degrades the overall status."""
    # Latency good (20ms), jitter good (5ms), but packet loss poor (15%)
    assessment = QoSEngine.assess_qos(
        mean_rtt_ms=20.0,
        jitter_ms=5.0,
        packet_loss_pct=15.0,
        sample_count=10,
        profile_name="video_conferencing",
    )
    assert assessment.overall_status == "poor"
    assert assessment.details["packet_loss"]["status"] == "poor"
    assert assessment.details["latency"]["status"] == "good"
