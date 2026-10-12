from datetime import datetime, timezone
import statistics
from fastapi import APIRouter, HTTPException, status

from app.adapters.c_engine_adapter import CEngineAdapter
from app.adapters.icmp_adapter import IcmpAdapter
from app.adapters.iperf_adapter import IperfAdapter
from app.adapters.tcp_adapter import TcpAdapter
from app.schemas.schemas import (
    IperfTestRequest,
    IperfTestResponse,
    MultiTargetCompareRequest,
    MultiTargetCompareResponse,
    PingItem,
    PingTestRequest,
    PingTestResponse,
    TargetCompareResultItem,
    TcpTestRequest,
    TcpTestResponse,
)
from app.services.qos_engine import QoSEngine

router = APIRouter(prefix="/tests", tags=["Diagnostics"])


@router.post("/tcp", response_model=TcpTestResponse)
async def run_tcp_test(payload: TcpTestRequest):
    """Execute on-demand TCP handshake test to a host and port."""
    if CEngineAdapter.is_available():
        c_res = await CEngineAdapter.execute_probe(
            mode="tcp",
            host=payload.host,
            port=payload.port,
            count=1,
            timeout_seconds=payload.timeout,
        )
        if c_res and c_res.probes:
            p = c_res.probes[0]
            return TcpTestResponse(
                host=payload.host,
                port=payload.port,
                success=p.success,
                connect_time_ms=p.rtt_ms,
                rtt_ms=p.rtt_ms,
                error_type=p.error_type,
                error_detail=p.error_detail,
                error=p.error_detail or p.error_type,
                timestamp=c_res.timestamp,
            )

    result = await TcpAdapter.test_connection(
        host=payload.host,
        port=payload.port,
        timeout_seconds=payload.timeout,
    )
    return TcpTestResponse(
        host=payload.host,
        port=payload.port,
        success=result.success,
        connect_time_ms=result.connect_time_ms,
        rtt_ms=result.connect_time_ms,
        error_type=result.error_type,
        error_detail=result.error_detail,
        error=result.error_detail or result.error_type,
        timestamp=result.timestamp,
    )


@router.post("/iperf", response_model=IperfTestResponse)
async def run_iperf_test(payload: IperfTestRequest):
    """Execute controlled active network throughput benchmark to an authorized iperf3 server."""
    res = await IperfAdapter.run_controlled_test(
        host=payload.host,
        port=payload.port,
        duration_seconds=payload.duration_seconds,
    )
    return IperfTestResponse(
        available=res.available,
        success=res.success,
        host=res.host,
        port=res.port,
        duration_seconds=res.duration_seconds,
        rx_mbps=res.rx_mbps,
        tx_mbps=res.tx_mbps,
        retransmits=res.retransmits,
        error_type=res.error_type,
        error_detail=res.error_detail,
        requirements_note=res.requirements_note,
        timestamp=res.timestamp,
    )


@router.post("/ping", response_model=PingTestResponse)
async def run_ping_test(payload: PingTestRequest):
    """Execute bounded on-demand ICMP ping sequence and summarize latency stats."""
    count = payload.count

    # Try C-native measurement engine first
    if CEngineAdapter.is_available():
        c_res = await CEngineAdapter.execute_probe(
            mode="icmp",
            host=payload.host,
            count=count,
            timeout_seconds=payload.timeout,
        )
        if c_res:
            probes = [
                PingItem(
                    sequence=p.sequence,
                    success=p.success,
                    rtt_ms=p.rtt_ms,
                    error_type=p.error_type,
                    error_detail=p.error_detail,
                )
                for p in c_res.probes
            ]
            return PingTestResponse(
                host=c_res.target_host,
                resolved_ip=c_res.resolved_ip,
                count=c_res.count,
                transmitted=c_res.transmitted,
                received=c_res.received,
                packet_loss_pct=c_res.packet_loss_pct,
                min_rtt_ms=c_res.min_rtt_ms,
                max_rtt_ms=c_res.max_rtt_ms,
                mean_rtt_ms=c_res.mean_rtt_ms,
                jitter_ms=c_res.jitter_ms,
                probes=probes,
                timestamp=c_res.timestamp,
            )
    probes = []
    successful_rtts = []
    resolved_ip = None

    for seq in range(1, count + 1):
        res = await IcmpAdapter.ping(
            host=payload.host,
            timeout_seconds=payload.timeout,
        )
        if res.resolved_ip and not resolved_ip:
            resolved_ip = res.resolved_ip

        if res.success and res.rtt_ms is not None:
            successful_rtts.append(res.rtt_ms)

        probes.append(
            PingItem(
                sequence=seq,
                success=res.success,
                rtt_ms=res.rtt_ms,
                error_type=res.error_type,
                error_detail=res.error_detail,
            )
        )

    transmitted = count
    received = len(successful_rtts)
    loss_pct = round(((transmitted - received) / transmitted) * 100.0, 2)

    min_rtt = round(min(successful_rtts), 2) if successful_rtts else None
    max_rtt = round(max(successful_rtts), 2) if successful_rtts else None
    mean_rtt = round(statistics.mean(successful_rtts), 2) if successful_rtts else None
    jitter = QoSEngine.calculate_jitter(successful_rtts)

    return PingTestResponse(
        host=payload.host,
        resolved_ip=resolved_ip,
        count=count,
        transmitted=transmitted,
        received=received,
        packet_loss_pct=loss_pct,
        min_rtt_ms=min_rtt,
        max_rtt_ms=max_rtt,
        mean_rtt_ms=mean_rtt,
        jitter_ms=jitter,
        probes=probes,
        timestamp=datetime.now(timezone.utc),
    )


@router.post("/compare", response_model=MultiTargetCompareResponse)
async def run_multi_target_compare(payload: MultiTargetCompareRequest):
    """Execute concurrent real-world network diagnostics across multiple targets for side-by-side comparison."""
    import asyncio

    async def _probe_single_target(item) -> TargetCompareResultItem:
        target_probes = []
        successful_rtts = []
        resolved_ip = None
        diagnostic_msg = None

        count = payload.probes_per_target
        timeout = payload.timeout_seconds

        for seq in range(1, count + 1):
            if item.protocol == "tcp" and item.port:
                # Genuine TCP socket test
                tcp_res = await TcpAdapter.test_connection(
                    host=item.host,
                    port=item.port,
                    timeout_seconds=timeout,
                )
                if tcp_res.success and tcp_res.connect_time_ms is not None:
                    successful_rtts.append(tcp_res.connect_time_ms)
                else:
                    diagnostic_msg = tcp_res.error_detail or tcp_res.error_type
                target_probes.append({
                    "sequence": seq,
                    "success": tcp_res.success,
                    "rtt_ms": tcp_res.connect_time_ms,
                    "error_type": tcp_res.error_type,
                    "error_detail": tcp_res.error_detail,
                })
            else:
                # Genuine ICMP probe
                icmp_res = await IcmpAdapter.ping(
                    host=item.host,
                    timeout_seconds=timeout,
                )
                if icmp_res.resolved_ip and not resolved_ip:
                    resolved_ip = icmp_res.resolved_ip
                if icmp_res.success and icmp_res.rtt_ms is not None:
                    successful_rtts.append(icmp_res.rtt_ms)
                else:
                    diagnostic_msg = icmp_res.error_detail or icmp_res.error_type
                target_probes.append({
                    "sequence": seq,
                    "success": icmp_res.success,
                    "rtt_ms": icmp_res.rtt_ms,
                    "error_type": icmp_res.error_type,
                    "error_detail": icmp_res.error_detail,
                })

            # Small 200ms stagger between probes to same host
            if seq < count:
                await asyncio.sleep(0.2)

        transmitted = count
        received = len(successful_rtts)
        loss_pct = round(((transmitted - received) / transmitted) * 100.0, 2)

        min_rtt = round(min(successful_rtts), 2) if successful_rtts else None
        max_rtt = round(max(successful_rtts), 2) if successful_rtts else None
        mean_rtt = round(statistics.mean(successful_rtts), 2) if successful_rtts else None
        jitter = QoSEngine.calculate_jitter(successful_rtts)

        # Classify status honestly
        if received == transmitted:
            status_str = "online"
        elif received > 0:
            status_str = "degraded"
        else:
            if diagnostic_msg and "timed out" in diagnostic_msg.lower():
                status_str = "icmp_blocked" if item.protocol == "icmp" else "timeout"
            else:
                status_str = "unreachable"

        return TargetCompareResultItem(
            name=item.name,
            host=item.host,
            protocol=item.protocol.upper(),
            port=item.port,
            resolved_ip=resolved_ip,
            probes_sent=transmitted,
            probes_received=received,
            packet_loss_pct=loss_pct,
            min_rtt_ms=min_rtt,
            max_rtt_ms=max_rtt,
            mean_rtt_ms=mean_rtt,
            jitter_ms=jitter,
            status=status_str,
            diagnostic=diagnostic_msg,
            probes=target_probes,
        )

    # Run comparisons concurrently across targets
    results = await asyncio.gather(*[_probe_single_target(t) for t in payload.targets])

    return MultiTargetCompareResponse(
        timestamp=datetime.now(timezone.utc),
        results=results,
    )
