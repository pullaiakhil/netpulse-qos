import csv
from datetime import datetime, timezone
import io
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import MonitoringSession, MonitoringTarget, ProbeResult


@pytest.mark.asyncio
async def test_csv_export_format_and_accuracy(client: AsyncClient, db_session: AsyncSession):
    """Test exporting probe records as CSV with both successful and failed probes."""
    # 1. Create a target
    target = MonitoringTarget(
        name="Localhost HTTP",
        host="127.0.0.1",
        target_type="tcp",
        port=8000,
        enabled=True,
    )
    db_session.add(target)
    await db_session.commit()
    await db_session.refresh(target)

    # 2. Create a session
    sess = MonitoringSession(
        target_id=target.id,
        start_time=datetime.now(timezone.utc),
        status="completed",
        interval_seconds=1.0,
        config_snapshot={
            "target_name": target.name,
            "target_host": target.host,
            "target_type": target.target_type,
            "target_port": target.port,
        },
    )
    db_session.add(sess)
    await db_session.commit()
    await db_session.refresh(sess)

    # 3. Add genuine test probes (one successful, one failed with diagnostic error)
    p1 = ProbeResult(
        session_id=sess.id,
        sequence_number=1,
        timestamp=datetime.now(timezone.utc),
        success=True,
        rtt_ms=4.25,
        error_type=None,
        error_detail=None,
    )
    p2 = ProbeResult(
        session_id=sess.id,
        sequence_number=2,
        timestamp=datetime.now(timezone.utc),
        success=False,
        rtt_ms=None,
        error_type="CONNECTION_REFUSED",
        error_detail="Port is closed or connection was actively refused",
    )
    db_session.add_all([p1, p2])
    await db_session.commit()

    # 4. Request CSV Export
    res = await client.get(f"/api/reports/export?session_id={sess.id}&format=csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]

    csv_reader = list(csv.reader(io.StringIO(res.text)))
    assert len(csv_reader) == 3  # Header + 2 rows

    header = csv_reader[0]
    assert "sequence_number" in header
    assert "target_name" in header
    assert "target_host" in header
    assert "protocol" in header
    assert "status" in header
    assert "rtt_ms" in header
    assert "error_type" in header
    assert "error_detail" in header

    # Row 1: Success
    row1 = csv_reader[1]
    assert row1[header.index("sequence_number")] == "1"
    assert row1[header.index("target_name")] == "Localhost HTTP"
    assert row1[header.index("target_host")] == "127.0.0.1"
    assert row1[header.index("protocol")] == "TCP"
    assert row1[header.index("status")] == "SUCCESS"
    assert row1[header.index("rtt_ms")] == "4.25"
    assert row1[header.index("error_type")] == ""
    assert row1[header.index("error_detail")] == ""

    # Row 2: Failure
    row2 = csv_reader[2]
    assert row2[header.index("sequence_number")] == "2"
    assert row2[header.index("status")] == "FAILED"
    assert row2[header.index("rtt_ms")] == ""  # Never fabricate 0 or fake RTT!
    assert row2[header.index("error_type")] == "CONNECTION_REFUSED"
    assert "actively refused" in row2[header.index("error_detail")]
