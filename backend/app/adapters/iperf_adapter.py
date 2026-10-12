import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
import os
import shutil
import subprocess
from typing import Optional

from app.schemas.schemas import validate_hostname_or_ip

logger = logging.getLogger(__name__)


@dataclass
class IperfResult:
    """Outcome of a controlled synthetic throughput test."""
    available: bool
    success: bool
    host: str
    port: int
    duration_seconds: int
    rx_mbps: Optional[float]
    tx_mbps: Optional[float]
    retransmits: Optional[int]
    error_type: Optional[str]
    error_detail: Optional[str]
    requirements_note: str
    timestamp: datetime


class IperfAdapter:
    """Safe wrapper for controlled active throughput benchmarking using iperf3."""

    _cached_path: Optional[str] = None

    @classmethod
    def get_binary_path(cls) -> Optional[str]:
        """Locate the iperf3 binary in system PATH or common local install locations."""
        if cls._cached_path and os.path.isfile(cls._cached_path):
            return cls._cached_path

        exe_name = "iperf3.exe" if os.name == "nt" else "iperf3"
        found = shutil.which(exe_name)
        if found:
            cls._cached_path = found
            return found

        # Search common Windows paths if on Windows
        if os.name == "nt":
            candidates = [
                r"C:\Program Files\iperf3\iperf3.exe",
                r"C:\iperf3\iperf3.exe",
                os.path.join(os.path.expanduser("~"), "iperf3", "iperf3.exe"),
            ]
            for p in candidates:
                if os.path.isfile(p):
                    cls._cached_path = p
                    return p

        return None

    @classmethod
    def is_available(cls) -> bool:
        """Check whether iperf3 binary is available on the system."""
        return cls.get_binary_path() is not None

    @classmethod
    async def run_controlled_test(
        cls,
        host: str,
        port: int = 5201,
        duration_seconds: int = 5,
        protocol: str = "tcp",
    ) -> IperfResult:
        """Execute a controlled throughput test against an authorized iperf3 server."""
        now_utc = datetime.now(timezone.utc)
        req_note = (
            "Controlled throughput testing requires an active iperf3 server running at the "
            f"destination target ({host}:{port}) via 'iperf3 -s'. Testing generates active synthetic "
            "network traffic to measure maximum link saturation."
        )

        # 1. Check binary availability
        binary_path = cls.get_binary_path()
        if not binary_path:
            return IperfResult(
                available=False,
                success=False,
                host=host,
                port=port,
                duration_seconds=duration_seconds,
                rx_mbps=None,
                tx_mbps=None,
                retransmits=None,
                error_type="BINARY_NOT_FOUND",
                error_detail=(
                    "iperf3 binary was not found in system PATH. To perform active synthetic bandwidth tests, "
                    "install iperf3 (e.g. via 'winget install iperf3' on Windows or 'apt install iperf3' on Linux) "
                    "and start a server on the target with 'iperf3 -s'."
                ),
                requirements_note=req_note,
                timestamp=now_utc,
            )

        # 2. Validate host and port
        try:
            validated_host = validate_hostname_or_ip(host)
        except Exception as e:
            return IperfResult(
                available=True,
                success=False,
                host=host,
                port=port,
                duration_seconds=duration_seconds,
                rx_mbps=None,
                tx_mbps=None,
                retransmits=None,
                error_type="INVALID_HOST",
                error_detail=str(e),
                requirements_note=req_note,
                timestamp=now_utc,
            )

        bounded_port = max(1, min(65535, port))
        bounded_duration = max(1, min(30, duration_seconds))

        cmd = [
            binary_path,
            "-c",
            validated_host,
            "-p",
            str(bounded_port),
            "-t",
            str(bounded_duration),
            "-J",  # JSON output
        ]

        logger.info("Executing controlled iperf3 test: %s", " ".join(cmd))

        def _sync_exec():
            return subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=bounded_duration + 8.0,
            )

        try:
            completed = await asyncio.to_thread(_sync_exec)
            stdout = completed.stdout.strip()
            stderr = completed.stderr.strip()

            if not stdout:
                return IperfResult(
                    available=True,
                    success=False,
                    host=validated_host,
                    port=bounded_port,
                    duration_seconds=bounded_duration,
                    rx_mbps=None,
                    tx_mbps=None,
                    retransmits=None,
                    error_type="SERVER_UNREACHABLE",
                    error_detail=stderr or "No response from iperf3 process. Target server may be offline or blocking port.",
                    requirements_note=req_note,
                    timestamp=now_utc,
                )

            try:
                data = json.loads(stdout)
            except json.JSONDecodeError:
                return IperfResult(
                    available=True,
                    success=False,
                    host=validated_host,
                    port=bounded_port,
                    duration_seconds=bounded_duration,
                    rx_mbps=None,
                    tx_mbps=None,
                    retransmits=None,
                    error_type="OUTPUT_PARSE_ERROR",
                    error_detail=stdout[:300],
                    requirements_note=req_note,
                    timestamp=now_utc,
                )

            if "error" in data:
                err_msg = data["error"]
                return IperfResult(
                    available=True,
                    success=False,
                    host=validated_host,
                    port=bounded_port,
                    duration_seconds=bounded_duration,
                    rx_mbps=None,
                    tx_mbps=None,
                    retransmits=None,
                    error_type="SERVER_ERROR",
                    error_detail=f"iperf3 reported: {err_msg}. Confirm 'iperf3 -s' is running on {validated_host}:{bounded_port}.",
                    requirements_note=req_note,
                    timestamp=now_utc,
                )

            # Extract throughput metrics from JSON
            end = data.get("end", {})
            sum_sent = end.get("sum_sent", {})
            sum_received = end.get("sum_received", {})

            # Convert bits/sec to Mbps
            tx_bps = sum_sent.get("bits_per_second", 0.0)
            rx_bps = sum_received.get("bits_per_second", 0.0)

            tx_mbps = round(tx_bps / 1_000_000.0, 2)
            rx_mbps = round(rx_bps / 1_000_000.0, 2)
            retransmits = sum_sent.get("retransmits", 0)

            return IperfResult(
                available=True,
                success=True,
                host=validated_host,
                port=bounded_port,
                duration_seconds=bounded_duration,
                rx_mbps=rx_mbps,
                tx_mbps=tx_mbps,
                retransmits=retransmits,
                error_type=None,
                error_detail=None,
                requirements_note=req_note,
                timestamp=now_utc,
            )

        except subprocess.TimeoutExpired:
            return IperfResult(
                available=True,
                success=False,
                host=validated_host,
                port=bounded_port,
                duration_seconds=bounded_duration,
                rx_mbps=None,
                tx_mbps=None,
                retransmits=None,
                error_type="TIMEOUT",
                error_detail=f"Controlled test timed out after {bounded_duration + 8}s. Server {validated_host}:{bounded_port} did not complete test.",
                requirements_note=req_note,
                timestamp=now_utc,
            )
        except Exception as e:
            return IperfResult(
                available=True,
                success=False,
                host=validated_host,
                port=bounded_port,
                duration_seconds=bounded_duration,
                rx_mbps=None,
                tx_mbps=None,
                retransmits=None,
                error_type="EXECUTION_ERROR",
                error_detail=str(e),
                requirements_note=req_note,
                timestamp=now_utc,
            )
