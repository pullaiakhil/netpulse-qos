import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import logging
import os
import platform
import re
import shutil
import socket
import subprocess
from typing import Optional, Tuple

from app.schemas.schemas import validate_hostname_or_ip

logger = logging.getLogger(__name__)


@dataclass
class PingResult:
    """Dataclass holding normalized ping execution output."""
    success: bool
    rtt_ms: Optional[float]
    error_type: Optional[str]
    error_detail: Optional[str]
    resolved_ip: Optional[str]
    timestamp: datetime


class IcmpAdapter:
    """Production-grade ICMP ping adapter wrapping native OS ping binaries."""

    # Regex patterns for parsing RTT
    WIN_RTT_PATTERN = re.compile(r"time[=<]\s*([0-9.]+)\s*ms", re.IGNORECASE)
    WIN_IP_PATTERN = re.compile(r"\[([0-9a-fA-F:.]+)\]|from\s+([0-9a-fA-F:.]+):", re.IGNORECASE)

    UNIX_RTT_PATTERN = re.compile(r"time=([0-9.]+)\s*ms", re.IGNORECASE)
    UNIX_IP_PATTERN = re.compile(r"\(([0-9a-fA-F:.]+)\)", re.IGNORECASE)

    @classmethod
    def _is_windows(cls) -> bool:
        return platform.system().lower() == "windows"

    @classmethod
    def _get_ping_command_path(cls) -> str:
        """Find the absolute path to the OS ping binary to ensure reliable execution."""
        if cls._is_windows():
            system_root = os.environ.get("SystemRoot", r"C:\Windows")
            sys32_ping = os.path.join(system_root, "System32", "ping.exe")
            if os.path.isfile(sys32_ping):
                return sys32_ping
            which_ping = shutil.which("ping.exe") or shutil.which("ping")
            return which_ping if which_ping else "ping"
        else:
            return shutil.which("ping") or "/bin/ping"

    @classmethod
    async def resolve_host(cls, host: str) -> Optional[str]:
        """Asynchronously resolve DNS to IPv4/IPv6 without blocking event loop."""
        try:
            loop = asyncio.get_running_loop()
            addr_info = await loop.getaddrinfo(host, None)
            if addr_info and len(addr_info) > 0:
                return addr_info[0][4][0]
        except Exception:
            pass
        return None

    @classmethod
    def _sync_ping(cls, ping_bin: str, cmd: list, timeout_sec: float) -> Tuple[int, str, str]:
        """Synchronously execute ping command in a worker thread."""
        logger.info("IcmpAdapter: running command: %s (timeout: %.1fs)", " ".join(cmd), timeout_sec)
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout_sec,
            shell=False,
        )
        logger.info("IcmpAdapter: exited with code %d. stdout: %s | stderr: %s", proc.returncode, proc.stdout.strip(), proc.stderr.strip())
        return proc.returncode, proc.stdout, proc.stderr

    @classmethod
    async def ping(cls, host: str, timeout_seconds: float = 3.0) -> PingResult:
        """Execute a single ICMP echo request using the OS ping binary."""
        # 1. Validation
        try:
            validated_host = validate_hostname_or_ip(host)
        except Exception as e:
            return PingResult(
                success=False,
                rtt_ms=None,
                error_type="INVALID_HOST",
                error_detail=str(e),
                resolved_ip=None,
                timestamp=datetime.now(timezone.utc),
            )

        is_win = cls._is_windows()
        timeout_ms = int(max(100, timeout_seconds * 1000))
        timeout_sec = max(1, int(timeout_seconds))
        ping_bin = cls._get_ping_command_path()

        if is_win:
            cmd = [ping_bin, "-n", "1", "-w", str(timeout_ms), validated_host]
        else:
            cmd = [ping_bin, "-c", "1", "-W", str(timeout_sec), validated_host]

        now_utc = datetime.now(timezone.utc)

        try:
            # Run in worker thread to prevent any Windows asyncio event-loop pipe limitations
            returncode, stdout, stderr = await asyncio.to_thread(
                cls._sync_ping,
                ping_bin,
                cmd,
                timeout_seconds + 2.0,
            )

            combined = f"{stdout}\n{stderr}".strip()

            # Extract resolved IP
            resolved_ip = None
            if is_win:
                ip_match = cls.WIN_IP_PATTERN.search(stdout)
                if ip_match:
                    resolved_ip = ip_match.group(1) or ip_match.group(2)
            else:
                ip_match = cls.UNIX_IP_PATTERN.search(stdout)
                if ip_match:
                    resolved_ip = ip_match.group(1)

            if not resolved_ip:
                resolved_ip = await cls.resolve_host(validated_host)

            # Check for return code failure
            if returncode != 0:
                lower_out = combined.lower()
                if "could not find host" in lower_out or "unknown host" in lower_out or "name or service not known" in lower_out:
                    return PingResult(
                        success=False,
                        rtt_ms=None,
                        error_type="DNS_FAILURE",
                        error_detail=f"Could not resolve host '{validated_host}'",
                        resolved_ip=None,
                        timestamp=now_utc,
                    )
                if "request timed out" in lower_out or "100% packet loss" in lower_out or "100% loss" in lower_out:
                    return PingResult(
                        success=False,
                        rtt_ms=None,
                        error_type="TIMEOUT",
                        error_detail=f"Request timed out after {timeout_seconds}s",
                        resolved_ip=resolved_ip,
                        timestamp=now_utc,
                    )
                if "destination host unreachable" in lower_out or "network unreachable" in lower_out or "transmit failed" in lower_out:
                    return PingResult(
                        success=False,
                        rtt_ms=None,
                        error_type="HOST_UNREACHABLE",
                        error_detail="Destination network or host unreachable",
                        resolved_ip=resolved_ip,
                        timestamp=now_utc,
                    )
                if "operation not permitted" in lower_out or "permission denied" in lower_out:
                    return PingResult(
                        success=False,
                        rtt_ms=None,
                        error_type="PERMISSION_DENIED",
                        error_detail="Insufficient permissions for ICMP socket",
                        resolved_ip=resolved_ip,
                        timestamp=now_utc,
                    )

                detail_msg = stdout.strip() or stderr.strip() or f"Ping exited with code {returncode}"
                return PingResult(
                    success=False,
                    rtt_ms=None,
                    error_type="EXECUTION_ERROR",
                    error_detail=detail_msg[:500],
                    resolved_ip=resolved_ip,
                    timestamp=now_utc,
                )

            # Check for Windows "Request timed out" or packet loss when return code is 0
            if ("request timed out" in combined.lower() or "100% loss" in combined.lower()) and not cls.WIN_RTT_PATTERN.search(stdout):
                return PingResult(
                    success=False,
                    rtt_ms=None,
                    error_type="TIMEOUT",
                    error_detail=f"Request timed out after {timeout_seconds}s",
                    resolved_ip=resolved_ip,
                    timestamp=now_utc,
                )

            # Successful probe - parse RTT
            rtt_match = cls.WIN_RTT_PATTERN.search(stdout) if is_win else cls.UNIX_RTT_PATTERN.search(stdout)
            if rtt_match:
                try:
                    # Handle sub-millisecond report like <1ms
                    if "<1ms" in stdout.lower().replace(" ", "") or (rtt_match and "<" in rtt_match.group(0)):
                        rtt_val = 0.5
                    else:
                        rtt_val = float(rtt_match.group(1))
                    return PingResult(
                        success=True,
                        rtt_ms=round(rtt_val, 2),
                        error_type=None,
                        error_detail=None,
                        resolved_ip=resolved_ip,
                        timestamp=now_utc,
                    )
                except ValueError:
                    pass

            # Fallback if pattern didn't match standard lines
            return PingResult(
                success=False,
                rtt_ms=None,
                error_type="PARSE_ERROR",
                error_detail=f"Unable to parse round trip time from ping output: {stdout[:200]}",
                resolved_ip=resolved_ip,
                timestamp=now_utc,
            )

        except subprocess.TimeoutExpired:
            return PingResult(
                success=False,
                rtt_ms=None,
                error_type="TIMEOUT",
                error_detail=f"Ping command timed out after {timeout_seconds}s",
                resolved_ip=None,
                timestamp=now_utc,
            )
        except FileNotFoundError as e:
            logger.error("Ping binary not found: %s", e)
            return PingResult(
                success=False,
                rtt_ms=None,
                error_type="UTILITY_NOT_FOUND",
                error_detail=f"System ping utility was not found at '{ping_bin}': {e}",
                resolved_ip=None,
                timestamp=now_utc,
            )
        except PermissionError as e:
            logger.error("Permission error executing ping subprocess: %s", e)
            return PingResult(
                success=False,
                rtt_ms=None,
                error_type="PERMISSION_DENIED",
                error_detail=f"Access denied executing ping subprocess: {e}",
                resolved_ip=None,
                timestamp=now_utc,
            )
        except OSError as e:
            logger.error("OS error executing ping subprocess: %s", e)
            return PingResult(
                success=False,
                rtt_ms=None,
                error_type="OS_ERROR",
                error_detail=f"Operating system process error: {e}",
                resolved_ip=None,
                timestamp=now_utc,
            )
        except Exception as e:
            logger.exception("Unexpected exception executing ping probe for host %s: %s", validated_host, e)
            return PingResult(
                success=False,
                rtt_ms=None,
                error_type="INTERNAL_ERROR",
                error_detail=f"{type(e).__name__}: {str(e)}",
                resolved_ip=None,
                timestamp=now_utc,
            )
