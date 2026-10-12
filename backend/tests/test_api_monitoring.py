import pytest
from httpx import AsyncClient
from app.models.models import MonitoringTarget


@pytest.mark.asyncio
async def test_monitoring_start_stop_lifecycle(client: AsyncClient, sample_target: MonitoringTarget):
    """Test starting and stopping a real monitoring session through API."""
    # 1. Start monitoring session
    start_payload = {
        "target_id": sample_target.id,
        "interval_seconds": 2.0,
        "profile": "gaming",
    }
    res_start = await client.post("/api/monitoring/start", json=start_payload)
    assert res_start.status_code == 201
    start_data = res_start.json()
    assert "session_id" in start_data
    session_id = start_data["session_id"]
    assert start_data["status"] == "running"

    # 2. Check status endpoint
    res_status = await client.get("/api/monitoring/status")
    assert res_status.status_code == 200
    status_data = res_status.json()
    assert status_data["active_count"] >= 1
    assert any(s["session_id"] == session_id for s in status_data["sessions"])

    # 3. Stop monitoring session
    stop_payload = {"session_id": session_id}
    res_stop = await client.post("/api/monitoring/stop", json=stop_payload)
    assert res_stop.status_code == 200
    stop_data = res_stop.json()
    assert stop_data["status"] == "stopped"

    # 4. Confirm stopped in status
    res_status_after = await client.get("/api/monitoring/status")
    status_after_data = res_status_after.json()
    assert not any(s["session_id"] == session_id for s in status_after_data["sessions"])


@pytest.mark.asyncio
async def test_monitoring_invalid_target(client: AsyncClient):
    """Test attempting to monitor a non-existent target ID."""
    res = await client.post(
        "/api/monitoring/start",
        json={"target_id": 88888, "interval_seconds": 5.0},
    )
    assert res.status_code == 400
    assert "not found" in res.json()["detail"].lower()
