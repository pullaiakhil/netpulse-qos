import pytest
from httpx import AsyncClient
from datetime import datetime, timezone
from app.models.models import Alert, MonitoringSession, MonitoringTarget
from app import database


@pytest.mark.asyncio
async def test_scenario_1_multi_target_compare_api(client: AsyncClient):
    """Scenario 1: Test multi-target benchmark comparison endpoint."""
    payload = {
        "targets": [
            {"name": "Google DNS", "host": "8.8.8.8", "protocol": "icmp"},
            {"name": "Cloudflare DNS", "host": "1.1.1.1", "protocol": "icmp"},
            {"name": "Local Backend", "host": "127.0.0.1", "protocol": "tcp", "port": 8000},
        ],
        "probes_per_target": 2,
        "timeout_seconds": 1.5,
    }
    res = await client.post("/api/tests/compare", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "timestamp" in data
    assert "results" in data
    assert len(data["results"]) == 3

    for item in data["results"]:
        assert "name" in item
        assert "host" in item
        assert "protocol" in item
        assert "probes_sent" in item
        assert "probes_received" in item
        assert "packet_loss_pct" in item
        assert "status" in item
        assert item["probes_sent"] == 2


@pytest.mark.asyncio
async def test_scenario_2_tcp_test_api(client: AsyncClient):
    """Scenario 2: Test TCP handshake diagnostic endpoint."""
    # Test connection to port where nothing is listening or localhost
    payload = {
        "host": "127.0.0.1",
        "port": 59999,  # Unused port
        "timeout": 1.0,
    }
    res = await client.post("/api/tests/tcp", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["host"] == "127.0.0.1"
    assert data["port"] == 59999
    assert "success" in data
    assert "timestamp" in data
    # When connection refused, error_type should be set
    if not data["success"]:
        assert data["error_type"] is not None


@pytest.mark.asyncio
async def test_scenario_3_interfaces_api(client: AsyncClient):
    """Scenario 3: Test live network interface counters and throughput rates."""
    res = await client.get("/api/interfaces")
    assert res.status_code == 200
    data = res.json()
    assert "interfaces" in data
    assert "throughput" in data
    assert isinstance(data["interfaces"], list)

    if data["interfaces"]:
        iface = data["interfaces"][0]
        assert "name" in iface
        assert "is_up" in iface
        assert "bytes_recv" in iface
        assert "bytes_sent" in iface
        assert "packets_recv" in iface
        assert "packets_sent" in iface


@pytest.mark.asyncio
async def test_scenario_4_alerts_lifecycle_api(client: AsyncClient, sample_target: MonitoringTarget):
    """Scenario 4: Test alert listing, acknowledgment, and resolution."""
    # Seed an alert directly in DB
    async with database.AsyncSessionLocal() as db:
        session = MonitoringSession(
            target_id=sample_target.id,
            start_time=datetime.now(timezone.utc),
            status="running",
            interval_seconds=3.0,
            config_snapshot={"target_name": sample_target.name},
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

        alert = Alert(
            session_id=session.id,
            timestamp=datetime.now(timezone.utc),
            severity="warning",
            metric="latency",
            observed_value=185.4,
            threshold_value=150.0,
            message="Latency exceeded threshold: 185.4ms > 150.0ms",
            acknowledged=False,
            resolved_at=None,
        )
        db.add(alert)
        await db.commit()
        await db.refresh(alert)
        alert_id = alert.id

    # 1. List alerts
    res_list = await client.get("/api/alerts")
    assert res_list.status_code == 200
    alerts = res_list.json()
    assert any(a["id"] == alert_id for a in alerts)
    target_alert = next(a for a in alerts if a["id"] == alert_id)
    assert target_alert["observed_value"] == 185.4
    assert target_alert["unit"] == "ms"
    assert target_alert["resolved"] is False

    # 2. Acknowledge alert (PUT)
    res_ack = await client.put(f"/api/alerts/{alert_id}/acknowledge")
    assert res_ack.status_code == 200
    assert res_ack.json()["acknowledged"] is True

    # 3. Resolve alert (PUT)
    res_res = await client.put(f"/api/alerts/{alert_id}/resolve")
    assert res_res.status_code == 200
    assert res_res.json()["resolved_at"] is not None


@pytest.mark.asyncio
async def test_scenario_6_iperf_safe_fallback_api(client: AsyncClient):
    """Scenario 6: Test controlled throughput test endpoint returns safe structured response."""
    payload = {
        "host": "127.0.0.1",
        "port": 5201,
        "duration_seconds": 2,
        "authorized": True,
    }
    res = await client.post("/api/tests/iperf", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "available" in data
    assert "success" in data
    assert "host" in data
    assert "port" in data
    assert "requirements_note" in data
    assert "timestamp" in data
