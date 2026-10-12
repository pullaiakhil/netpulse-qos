import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import json
import logging
import os
import platform
import shutil
import subprocess
from typing import Any, Dict, List, Optional

from app.schemas.schemas import validate_hostname_or_ip

logger = logging.getLogger(__name__)


@dataclass
class CEngineProbeItem:
    sequence: int
    success: bool
    rtt_ms: Optional[float]
    error_type: Optional[str]
    error_detail: Optional[str]


@dataclass
class CEngineExecutionResult:
    engine: str
    mode: str
    target_host: str
    target_port: int
    resolved_ip: Optional[str]
    count: int
    transmitted: int
    received: int
    failed: int
    packet_loss_pct: float
    min_rtt_ms: Optional[float]
    max_rtt_ms: Optional[float]
    mean_rtt_ms: Optional[float]
    median_rtt_ms: Optional[float]
    stddev_rtt_ms: Optional[float]
    p95_rtt_ms: Optional[float]
    jitter_ms: Optional[float]
    probes: List[CEngineProbeItem]
    timestamp: datetime


class CEngineAdapter:
    """Orchestrates genuine C-native network measurement binary."""

    _cached_binary_path: Optional[str] = None

    @classmethod
    def get_binary_path(cls) -> Optional[str]:
        """Locate the compiled C engine binary."""
        if cls._cached_binary_path and os.path.isfile(cls._cached_binary_path):
            return cls._cached_binary_path

        # 1. Explicit environment variable override
        env_path = os.environ.get("C_ENGINE_BIN_PATH")
        if env_path and os.path.isfile(env_path):
            cls._cached_binary_path = env_path
            return env_path

        is_win = platform.system().lower() == "windows"
        exe_name = "netpulse_engine.exe" if is_win else "netpulse_engine"

        # Search candidates:
        # 1. c_engine directory in workspace
        # 2. backend directory
        # 3. Linux container deployment paths (/usr/local/bin, /app)
        # 4. system PATH
        current_dir = os.path.dirname(os.path.abspath(__file__))  # app/adapters
        backend_dir = os.path.dirname(os.path.dirname(current_dir))  # backend
        workspace_dir = os.path.dirname(backend_dir)  # workspace cn

        candidates = [
            os.path.join(workspace_dir, "c_engine", exe_name),
            os.path.join(backend_dir, "c_engine", exe_name),
            os.path.join(backend_dir, exe_name),
            os.path.join("/usr", "local", "bin", exe_name),
            os.path.join("/app", "c_engine", exe_name),
            os.path.join("/app", exe_name),
        ]

        for p in candidates:
            if os.path.isfile(p):
                cls._cached_binary_path = p
                return p

        # Check system PATH
        which_path = shutil.which(exe_name)
        if which_path:
            cls._cached_binary_path = which_path
            return which_path

        return None

    @classmethod
    def is_available(cls) -> bool:
        """Check whether the compiled C engine executable is present."""
        return cls.get_binary_path() is not None

    @classmethod
    async def execute_probe(
        cls,
        mode: str,  # 'icmp' or 'tcp'
        host: str,
        port: int = 80,
        count: int = 4,
        timeout_seconds: float = 3.0,
    ) -> Optional[CEngineExecutionResult]:
        """Execute compiled C engine subprocess with safe argument list and JSON parsing."""
        binary_path = cls.get_binary_path()
        if not binary_path:
            return None

        # Validate inputs
        try:
            validated_host = validate_hostname_or_ip(host)
        except Exception:
            return None

        bounded_port = max(1, min(65535, port))
        bounded_count = max(1, min(200, count))
        bounded_timeout = max(0.2, min(30.0, timeout_seconds))

        cmd = [
            binary_path,
            mode.lower(),
            validated_host,
            str(bounded_port),
            str(bounded_count),
            f"{bounded_timeout:.2f}",
        ]
        logger.info("Executing C networking engine: %s", " ".join(cmd))

        def _sync_run():
            return subprocess.run(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=(bounded_timeout * bounded_count) + 3.0,
            )

        try:
            completed = await asyncio.to_thread(_sync_run)
            stdout = completed.stdout.strip()
            stderr = completed.stderr.strip()

            if completed.returncode != 0:
                logger.warning(
                    "C engine exited with code %d. stderr: %s. stdout: %s",
                    completed.returncode,
                    stderr,
                    stdout,
                )
                if not stdout:
                    return None

            try:
                data = json.loads(stdout)
            except json.JSONDecodeError as jde:
                logger.error("Failed to parse JSON output from C engine: %s. Raw stdout was: %s", jde, stdout)
                return None

            probes_list = []
            for item in data.get("probes", []):
                probes_list.append(
                    CEngineProbeItem(
                        sequence=item.get("sequence", 1),
                        success=bool(item.get("success", False)),
                        rtt_ms=item.get("rtt_ms"),
                        error_type=item.get("error_type"),
                        error_detail=item.get("error_detail"),
                    )
                )

            return CEngineExecutionResult(
                engine=data.get("engine", "c_native"),
                mode=data.get("mode", mode),
                target_host=data.get("target_host", validated_host),
                target_port=data.get("target_port", bounded_port),
                resolved_ip=data.get("resolved_ip") or None,
                count=data.get("count", bounded_count),
                transmitted=data.get("transmitted", bounded_count),
                received=data.get("received", 0),
                failed=data.get("failed", bounded_count),
                packet_loss_pct=float(data.get("packet_loss_pct", 100.0)),
                min_rtt_ms=data.get("min_rtt_ms"),
                max_rtt_ms=data.get("max_rtt_ms"),
                mean_rtt_ms=data.get("mean_rtt_ms"),
                median_rtt_ms=data.get("median_rtt_ms"),
                stddev_rtt_ms=data.get("stddev_rtt_ms"),
                p95_rtt_ms=data.get("p95_rtt_ms"),
                jitter_ms=data.get("jitter_ms"),
                probes=probes_list,
                timestamp=datetime.now(timezone.utc),
            )

        except subprocess.TimeoutExpired:
            logger.warning("C engine execution timed out after %ds", int((bounded_timeout * bounded_count) + 3.0))
            return None
        except Exception as exc:
            logger.warning("C engine execution exception: %s", exc)
            return None
