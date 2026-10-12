import asyncio
import subprocess
from unittest.mock import patch, MagicMock
import pytest

from app.adapters.icmp_adapter import IcmpAdapter, PingResult


@pytest.mark.asyncio
async def test_icmp_adapter_success_windows():
    """Test successful Windows ping output parsing."""
    sample_windows_stdout = """
Pinging 8.8.8.8 with 32 bytes of data:
Reply from 8.8.8.8: bytes=32 time=14ms TTL=117

Ping statistics for 8.8.8.8:
    Packets: Sent = 1, Received = 1, Lost = 0 (0% loss),
Approximate round trip times in milli-seconds:
    Minimum = 14ms, Maximum = 14ms, Average = 14ms
"""
    with patch.object(IcmpAdapter, "_is_windows", return_value=True), \
         patch.object(IcmpAdapter, "_sync_ping", return_value=(0, sample_windows_stdout, "")):
        result = await IcmpAdapter.ping("8.8.8.8", timeout_seconds=2.0)
        assert result.success is True
        assert result.rtt_ms == 14.0
        assert result.error_type is None
        assert result.error_detail is None
        assert result.resolved_ip == "8.8.8.8"


@pytest.mark.asyncio
async def test_icmp_adapter_sub_millisecond_windows():
    """Test Windows sub-millisecond '<1ms' parsing."""
    sample_stdout = "Reply from 127.0.0.1: bytes=32 time<1ms TTL=128\n"
    with patch.object(IcmpAdapter, "_is_windows", return_value=True), \
         patch.object(IcmpAdapter, "_sync_ping", return_value=(0, sample_stdout, "")):
        result = await IcmpAdapter.ping("127.0.0.1", timeout_seconds=1.0)
        assert result.success is True
        assert result.rtt_ms == 0.5


@pytest.mark.asyncio
async def test_icmp_adapter_timeout_windows():
    """Test Windows Request timed out handling."""
    sample_stdout = """
Pinging 192.0.2.1 with 32 bytes of data:
Request timed out.

Ping statistics for 192.0.2.1:
    Packets: Sent = 1, Received = 0, Lost = 1 (100% loss),
"""
    with patch.object(IcmpAdapter, "_is_windows", return_value=True), \
         patch.object(IcmpAdapter, "_sync_ping", return_value=(1, sample_stdout, "")):
        result = await IcmpAdapter.ping("192.0.2.1", timeout_seconds=2.0)
        assert result.success is False
        assert result.rtt_ms is None
        assert result.error_type == "TIMEOUT"
        assert "timed out" in result.error_detail.lower()


@pytest.mark.asyncio
async def test_icmp_adapter_host_unreachable():
    """Test Destination host unreachable handling."""
    sample_stdout = "Reply from 192.168.1.1: Destination host unreachable."
    with patch.object(IcmpAdapter, "_is_windows", return_value=True), \
         patch.object(IcmpAdapter, "_sync_ping", return_value=(1, sample_stdout, "")):
        result = await IcmpAdapter.ping("10.254.254.254", timeout_seconds=2.0)
        assert result.success is False
        assert result.rtt_ms is None
        assert result.error_type == "HOST_UNREACHABLE"
        assert "unreachable" in result.error_detail.lower()


@pytest.mark.asyncio
async def test_icmp_adapter_dns_failure():
    """Test DNS failure handling."""
    sample_stdout = "Ping request could not find host non-existent-test-host.xyz. Please check the name and try again."
    with patch.object(IcmpAdapter, "_is_windows", return_value=True), \
         patch.object(IcmpAdapter, "_sync_ping", return_value=(1, sample_stdout, "")):
        result = await IcmpAdapter.ping("non-existent-test-host.xyz", timeout_seconds=2.0)
        assert result.success is False
        assert result.rtt_ms is None
        assert result.error_type == "DNS_FAILURE"
        assert "Could not resolve" in result.error_detail


@pytest.mark.asyncio
async def test_icmp_adapter_subprocess_timeout():
    """Test subprocess timeout expiration."""
    with patch.object(IcmpAdapter, "_sync_ping", side_effect=subprocess.TimeoutExpired(cmd=["ping"], timeout=2.0)):
        result = await IcmpAdapter.ping("8.8.8.8", timeout_seconds=2.0)
        assert result.success is False
        assert result.rtt_ms is None
        assert result.error_type == "TIMEOUT"
        assert "timed out after 2.0s" in result.error_detail


@pytest.mark.asyncio
async def test_icmp_adapter_utility_not_found():
    """Test missing ping utility exception handling."""
    with patch.object(IcmpAdapter, "_sync_ping", side_effect=FileNotFoundError("ping.exe not found")):
        result = await IcmpAdapter.ping("8.8.8.8", timeout_seconds=2.0)
        assert result.success is False
        assert result.rtt_ms is None
        assert result.error_type == "UTILITY_NOT_FOUND"
        assert "was not found" in result.error_detail
