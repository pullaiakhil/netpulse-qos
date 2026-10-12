import pytest
from httpx import AsyncClient
from app.models.models import MonitoringTarget


@pytest.mark.asyncio
async def test_crud_targets(client: AsyncClient):
    """Test full CRUD lifecycle for targets."""
    # 1. Create Target
    create_payload = {
        "name": "Google DNS",
        "host": "8.8.8.8",
        "target_type": "icmp",
        "enabled": True,
    }
    res_post = await client.post("/api/targets", json=create_payload)
    assert res_post.status_code == 201
    created = res_post.json()
    target_id = created["id"]
    assert created["name"] == "Google DNS"
    assert created["host"] == "8.8.8.8"

    # 2. List Targets
    res_list = await client.get("/api/targets")
    assert res_list.status_code == 200
    targets = res_list.json()
    assert any(t["id"] == target_id for t in targets)

    # 3. Get Target
    res_get = await client.get(f"/api/targets/{target_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == target_id

    # 4. Update Target
    res_put = await client.put(
        f"/api/targets/{target_id}",
        json={"name": "Google Public DNS Primary"},
    )
    assert res_put.status_code == 200
    assert res_put.json()["name"] == "Google Public DNS Primary"

    # 5. Delete Target
    res_del = await client.delete(f"/api/targets/{target_id}")
    assert res_del.status_code == 204

    # 6. Verify 404 after deletion
    res_get_deleted = await client.get(f"/api/targets/{target_id}")
    assert res_get_deleted.status_code == 404


@pytest.mark.asyncio
async def test_target_validation_errors(client: AsyncClient):
    """Test input validation for invalid hostname and missing required fields."""
    # Invalid host format
    res_bad_host = await client.post(
        "/api/targets",
        json={"name": "Bad Target", "host": "bad$$host@@name", "target_type": "icmp"},
    )
    assert res_bad_host.status_code == 422

    # Missing name
    res_no_name = await client.post(
        "/api/targets",
        json={"host": "1.1.1.1", "target_type": "icmp"},
    )
    assert res_no_name.status_code == 422


@pytest.mark.asyncio
async def test_target_not_found(client: AsyncClient):
    """Test 404 for non-existent target ID."""
    res = await client.get("/api/targets/999999")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()
