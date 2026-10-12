import asyncio
from dataclasses import dataclass
from datetime import datetime, timezone
import time
from typing import Dict, List, Optional, Tuple
import psutil


@dataclass
class ThroughputResult:
    """Bandwidth rate calculation result for a network interface."""
    interface: str
    rx_mbps: float
    tx_mbps: float
    rx_bytes: int
    tx_bytes: int
    elapsed_seconds: float
    timestamp: datetime


class ThroughputAdapter:
    """Network interface throughput measurement using real OS network counters."""

    # Storage for interface previous samples: interface_name -> (bytes_recv, bytes_sent, monotonic_ts)
    _previous_readings: Dict[str, Tuple[int, int, float]] = {}

    @classmethod
    def get_available_interfaces(cls) -> List[str]:
        """Return list of active non-loopback network interfaces."""
        try:
            stats = psutil.net_if_stats()
            # Return active interfaces up and running, fallback to all
            up_interfaces = [nic for nic, stat in stats.items() if stat.isup]
            return up_interfaces if up_interfaces else list(stats.keys())
        except Exception:
            try:
                return list(psutil.net_io_counters(pernic=True).keys())
            except Exception:
                return []

    @classmethod
    def get_default_interface(cls) -> Optional[str]:
        """Attempt to locate the primary connected interface."""
        interfaces = cls.get_available_interfaces()
        # Exclude loopback
        filtered = [i for i in interfaces if "loopback" not in i.lower() and "lo" != i.lower()]
        if filtered:
            return filtered[0]
        return interfaces[0] if interfaces else None

    @classmethod
    async def sample_interface(cls, interface_name: Optional[str] = None) -> Optional[ThroughputResult]:
        """Asynchronously compute Rx/Tx throughput (Mbps) for the selected interface."""
        return await asyncio.to_thread(cls._sample_interface_sync, interface_name)

    @classmethod
    def _sample_interface_sync(cls, interface_name: Optional[str] = None) -> Optional[ThroughputResult]:
        """Synchronous reading and delta calculation."""
        target_nic = interface_name or cls.get_default_interface()
        if not target_nic:
            return None

        counters_map = psutil.net_io_counters(pernic=True)
        if target_nic not in counters_map:
            # Fallback to total sum across all interfaces if named interface not found
            total_counter = psutil.net_io_counters(pernic=False)
            curr_recv = total_counter.bytes_recv
            curr_sent = total_counter.bytes_sent
            target_nic = "all"
        else:
            curr_recv = counters_map[target_nic].bytes_recv
            curr_sent = counters_map[target_nic].bytes_sent

        now_mono = time.monotonic()
        now_utc = datetime.now(timezone.utc)

        prev = cls._previous_readings.get(target_nic)
        cls._previous_readings[target_nic] = (curr_recv, curr_sent, now_mono)

        if prev is None:
            # First observation: cannot compute rate yet
            return ThroughputResult(
                interface=target_nic,
                rx_mbps=0.0,
                tx_mbps=0.0,
                rx_bytes=curr_recv,
                tx_bytes=curr_sent,
                elapsed_seconds=0.0,
                timestamp=now_utc,
            )

        prev_recv, prev_sent, prev_mono = prev
        delta_seconds = now_mono - prev_mono

        if delta_seconds <= 0.0:
            delta_seconds = 0.001

        # Check for system reboot or 32-bit counter rollover
        delta_rx = curr_recv - prev_recv
        delta_tx = curr_sent - prev_sent
        if delta_rx < 0 or delta_tx < 0:
            delta_rx = max(0, curr_recv)
            delta_tx = max(0, curr_sent)

        rx_mbps = (delta_rx * 8.0) / (delta_seconds * 1_000_000.0)
        tx_mbps = (delta_tx * 8.0) / (delta_seconds * 1_000_000.0)

        return ThroughputResult(
            interface=target_nic,
            rx_mbps=round(rx_mbps, 3),
            tx_mbps=round(tx_mbps, 3),
            rx_bytes=curr_recv,
            tx_bytes=curr_sent,
            elapsed_seconds=round(delta_seconds, 3),
            timestamp=now_utc,
        )
