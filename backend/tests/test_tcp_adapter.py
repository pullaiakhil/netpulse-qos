import asyncio
from unittest.mock import patch, AsyncMock, MagicMock
import pytest

from app.adapters.tcp_adapter import TcpAdapter, TcpResult


@pytest.mark.asyncio
async def test_tcp_adapter_success():
    """Test successful TCP handshake measurement."""
    mock_writer = AsyncMock()
    mock_writer.close = MagicMock()
    mock_writer.wait_closed = AsyncMock()

    with patch("asyncio.open_connection", return_value=(AsyncMock(), mock_writer)):
        result = await TcpAdapter.test_connection("127.0.0.1", 8000, timeout_seconds=2.0)
        assert result.success is True
        assert result.connect_time_ms is not None
        assert result.connect_time_ms >= 0.0
        assert result.error_type is None
        assert result.error_detail is None


@pytest.mark.asyncio
async def test_tcp_adapter_connection_refused():
    """Test TCP connection refused handling."""
    with patch("asyncio.open_connection", side_effect=ConnectionRefusedError("Connection refused")):
        result = await TcpAdapter.test_connection("127.0.0.1", 9999, timeout_seconds=2.0)
        assert result.success is False
        assert result.connect_time_ms is None
        assert result.error_type == "CONNECTION_REFUSED"
        assert "actively refused" in result.error_detail


@pytest.mark.asyncio
async def test_tcp_adapter_timeout():
    """Test TCP timeout handling."""
    with patch("asyncio.open_connection", side_effect=asyncio.TimeoutError()):
        result = await TcpAdapter.test_connection("192.0.2.1", 80, timeout_seconds=1.0)
        assert result.success is False
        assert result.connect_time_ms is None
        assert result.error_type == "TIMEOUT"
        assert "timed out after 1.0s" in result.error_detail


@pytest.mark.asyncio
async def test_tcp_adapter_dns_failure():
    """Test TCP DNS failure handling."""
    with patch("asyncio.open_connection", side_effect=OSError("getaddrinfo failed")):
        result = await TcpAdapter.test_connection("non-existent-host.invalid", 80, timeout_seconds=1.0)
        assert result.success is False
        assert result.connect_time_ms is None
        assert result.error_type == "DNS_FAILURE"


@pytest.mark.asyncio
async def test_tcp_adapter_invalid_port():
    """Test TCP invalid port validation."""
    result = await TcpAdapter.test_connection("127.0.0.1", 70000, timeout_seconds=1.0)
    assert result.success is False
    assert result.error_type == "INVALID_PORT"
