import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import time
from typing import Optional

from app.schemas.schemas import validate_hostname_or_ip


@dataclass
class TcpResult:
    """Dataclass holding TCP connectivity check results."""
    success: bool
    connect_time_ms: Optional[float]
    error_type: Optional[str]
    error_detail: Optional[str]
    timestamp: datetime


class TcpAdapter:
    """Real TCP connectivity and handshake latency measurement adapter."""

    @classmethod
    async def test_connection(
        cls,
        host: str,
        port: int,
        timeout_seconds: float = 3.0,
    ) -> TcpResult:
        """Measure TCP connection establishment time to host:port using asyncio."""
        now_utc = datetime.now(timezone.utc)

        # 1. Validation
        try:
            validated_host = validate_hostname_or_ip(host)
        except Exception as e:
            return TcpResult(
                success=False,
                connect_time_ms=None,
                error_type="INVALID_HOST",
                error_detail=str(e),
                timestamp=now_utc,
            )

        if not (1 <= port <= 65535):
            return TcpResult(
                success=False,
                connect_time_ms=None,
                error_type="INVALID_PORT",
                error_detail=f"Port must be between 1 and 65535, got {port}",
                timestamp=now_utc,
            )

        start_mono = time.monotonic()
        try:
            # Attempt TCP handshake with strict timeout
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(validated_host, port),
                timeout=timeout_seconds,
            )
            elapsed_ms = (time.monotonic() - start_mono) * 1000.0

            # Gracefully close socket
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

            return TcpResult(
                success=True,
                connect_time_ms=round(elapsed_ms, 2),
                error_type=None,
                error_detail=None,
                timestamp=now_utc,
            )

        except asyncio.TimeoutError:
            return TcpResult(
                success=False,
                connect_time_ms=None,
                error_type="TIMEOUT",
                error_detail=f"Connection timed out after {timeout_seconds}s",
                timestamp=now_utc,
            )
        except ConnectionRefusedError:
            return TcpResult(
                success=False,
                connect_time_ms=None,
                error_type="CONNECTION_REFUSED",
                error_detail="Port is closed or connection was actively refused",
                timestamp=now_utc,
            )
        except OSError as e:
            err_str = str(e).lower()
            if "getaddrinfo failed" in err_str or "nodename nor servname provided" in err_str:
                err_type = "DNS_FAILURE"
            elif "network is unreachable" in err_str:
                err_type = "NETWORK_UNREACHABLE"
            elif "no route to host" in err_str:
                err_type = "HOST_UNREACHABLE"
            else:
                err_type = "OS_ERROR"

            return TcpResult(
                success=False,
                connect_time_ms=None,
                error_type=err_type,
                error_detail=str(e),
                timestamp=now_utc,
            )
        except Exception as e:
            return TcpResult(
                success=False,
                connect_time_ms=None,
                error_type="UNKNOWN_ERROR",
                error_detail=str(e),
                timestamp=now_utc,
            )
