from datetime import datetime, timezone
from typing import Any, Dict, List
from fastapi import APIRouter
import psutil

from app.adapters.throughput_adapter import ThroughputAdapter

router = APIRouter(prefix="/interfaces", tags=["Interfaces & Throughput"])


@router.get("")
async def get_interfaces() -> Dict[str, Any]:
    """Retrieve all physical and virtual interfaces and their current throughput rates."""
    stats = psutil.net_if_stats()
    counters = psutil.net_io_counters(pernic=True)
    
    interface_list = []
    throughput_list = []

    for nic, nic_stats in stats.items():
        cnt = counters.get(nic)
        is_up = nic_stats.isup
        speed = nic_stats.speed

        bytes_recv = cnt.bytes_recv if cnt else 0
        bytes_sent = cnt.bytes_sent if cnt else 0
        packets_recv = cnt.packets_recv if cnt else 0
        packets_sent = cnt.packets_sent if cnt else 0
        errin = cnt.errin if cnt else 0
        errout = cnt.errout if cnt else 0
        dropin = cnt.dropin if cnt else 0
        dropout = cnt.dropout if cnt else 0

        interface_list.append({
            "name": nic,
            "is_up": is_up,
            "speed_mbps": speed,
            "bytes_recv": bytes_recv,
            "bytes_sent": bytes_sent,
            "packets_recv": packets_recv,
            "packets_sent": packets_sent,
            "errin": errin,
            "errout": errout,
            "dropin": dropin,
            "dropout": dropout,
        })

    # Sample throughput on all/default interfaces
    sample = await ThroughputAdapter.sample_interface()
    if sample:
        throughput_list.append({
            "interface_name": sample.interface,
            "rx_mbps": sample.rx_mbps,
            "tx_mbps": sample.tx_mbps,
            "rx_kbps": round(sample.rx_mbps * 1000, 2),
            "tx_kbps": round(sample.tx_mbps * 1000, 2),
            "timestamp": sample.timestamp.isoformat(),
        })

    return {
        "interfaces": interface_list,
        "throughput": throughput_list,
    }


@router.get("/throughput")
async def get_throughput_history() -> List[Dict[str, Any]]:
    """Retrieve instantaneous throughput samples."""
    sample = await ThroughputAdapter.sample_interface()
    if not sample:
        return []
    return [{
        "interface_name": sample.interface,
        "rx_mbps": sample.rx_mbps,
        "tx_mbps": sample.tx_mbps,
        "rx_kbps": round(sample.rx_mbps * 1000, 2),
        "tx_kbps": round(sample.tx_mbps * 1000, 2),
        "timestamp": sample.timestamp.isoformat(),
    }]
