import json
import subprocess
from unittest.mock import patch, MagicMock
import pytest

from app.adapters.c_engine_adapter import CEngineAdapter, CEngineExecutionResult


@pytest.mark.asyncio
async def test_c_engine_adapter_success_parsing():
    """Verify CEngineAdapter correctly parses structured JSON output on success."""
    mock_json = json.dumps({
        "engine": "c_native",
        "mode": "tcp",
        "target_host": "127.0.0.1",
        "target_port": 8000,
        "resolved_ip": "127.0.0.1",
        "count": 1,
        "transmitted": 1,
        "received": 1,
        "failed": 0,
        "packet_loss_pct": 0.0,
        "min_rtt_ms": 1.25,
        "max_rtt_ms": 1.25,
        "mean_rtt_ms": 1.25,
        "median_rtt_ms": 1.25,
        "stddev_rtt_ms": 0.0,
        "p95_rtt_ms": 1.25,
        "jitter_ms": 0.0,
        "probes": [
            {
                "sequence": 1,
                "success": True,
                "rtt_ms": 1.25,
                "error_type": None,
                "error_detail": None
            }
        ]
    })

    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = mock_json
    mock_proc.stderr = ""

    with patch.object(CEngineAdapter, "get_binary_path", return_value="C:\\fake\\netpulse_engine.exe"), \
         patch("subprocess.run", return_value=mock_proc):
        res = await CEngineAdapter.execute_probe(mode="tcp", host="127.0.0.1", port=8000, count=1)
        assert res is not None
        assert res.engine == "c_native"
        assert res.received == 1
        assert len(res.probes) == 1
        assert res.probes[0].success is True
        assert res.probes[0].rtt_ms == 1.25


@pytest.mark.asyncio
async def test_c_engine_adapter_malformed_json():
    """Verify CEngineAdapter safely handles malformed JSON without crashing."""
    mock_proc = MagicMock()
    mock_proc.returncode = 0
    mock_proc.stdout = "NOT_VALID_JSON{abc"
    mock_proc.stderr = ""

    with patch.object(CEngineAdapter, "get_binary_path", return_value="C:\\fake\\netpulse_engine.exe"), \
         patch("subprocess.run", return_value=mock_proc):
        res = await CEngineAdapter.execute_probe(mode="tcp", host="127.0.0.1", port=8000)
        assert res is None


@pytest.mark.asyncio
async def test_c_engine_adapter_timeout():
    """Verify CEngineAdapter handles subprocess timeout gracefully."""
    with patch.object(CEngineAdapter, "get_binary_path", return_value="C:\\fake\\netpulse_engine.exe"), \
         patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd=["fake"], timeout=5.0)):
        res = await CEngineAdapter.execute_probe(mode="tcp", host="127.0.0.1", port=8000)
        assert res is None


@pytest.mark.asyncio
async def test_c_engine_adapter_missing_binary():
    """Verify CEngineAdapter returns None when binary is not found."""
    with patch.object(CEngineAdapter, "get_binary_path", return_value=None):
        res = await CEngineAdapter.execute_probe(mode="tcp", host="127.0.0.1", port=8000)
        assert res is None
