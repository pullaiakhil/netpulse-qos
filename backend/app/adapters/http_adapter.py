from dataclasses import dataclass
from datetime import datetime, timezone
import time
from typing import Optional
import httpx


@dataclass
class HttpResult:
    """Dataclass holding HTTP endpoint probing response metrics."""
    success: bool
    status_code: Optional[int]
    latency_ms: Optional[float]
    error_type: Optional[str]
    error_detail: Optional[str]
    timestamp: datetime


class HttpAdapter:
    """HTTP/HTTPS probe adapter with detailed timing metrics."""

    @classmethod
    async def probe(
        cls,
        url: str,
        timeout_seconds: float = 5.0,
        method: str = "GET",
    ) -> HttpResult:
        """Measure HTTP round-trip latency to a destination URL."""
        now_utc = datetime.now(timezone.utc)
        if not url.startswith(("http://", "https://")):
            url = f"http://{url}"

        start_mono = time.monotonic()
        try:
            async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
                response = await client.request(method, url)
                elapsed_ms = (time.monotonic() - start_mono) * 1000.0

                return HttpResult(
                    success=response.is_success,
                    status_code=response.status_code,
                    latency_ms=round(elapsed_ms, 2),
                    error_type=None if response.is_success else f"HTTP_{response.status_code}",
                    error_detail=None if response.is_success else response.reason_phrase,
                    timestamp=now_utc,
                )

        except httpx.TimeoutException:
            return HttpResult(
                success=False,
                status_code=None,
                latency_ms=None,
                error_type="TIMEOUT",
                error_detail=f"Request timed out after {timeout_seconds}s",
                timestamp=now_utc,
            )
        except httpx.ConnectError as e:
            return HttpResult(
                success=False,
                status_code=None,
                latency_ms=None,
                error_type="CONNECT_ERROR",
                error_detail=str(e),
                timestamp=now_utc,
            )
        except Exception as e:
            return HttpResult(
                success=False,
                status_code=None,
                latency_ms=None,
                error_type="HTTP_ERROR",
                error_detail=str(e),
                timestamp=now_utc,
            )
