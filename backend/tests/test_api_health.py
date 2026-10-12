import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check_endpoint(client: AsyncClient):
    """Verify that /api/health returns status, version, uptime, and db connectivity."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()

    assert "status" in data
    assert data["status"] in ("healthy", "degraded")
    assert "version" in data
    assert "uptime" in data
    assert isinstance(data["uptime"], (int, float))
    assert data["uptime"] >= 0
    assert "db_connected" in data
    assert data["db_connected"] is True
    assert "timestamp" in data
