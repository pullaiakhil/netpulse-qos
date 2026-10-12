# NetPulse QoS — Academic Documentation
## Quality of Service Monitoring System for Network Applications
### B.Tech CSE | R22 Regulation | Computer Networks Project

---

## 1. Abstract

NetPulse QoS is a real-time Quality of Service (QoS) monitoring system designed to measure, analyze, and report network performance metrics for various applications. The system performs genuine network measurements using operating-system-level tools and presents results through a professional web-based analytics dashboard.

The application measures ICMP round-trip time (latency), calculates jitter from consecutive RTT variation, tracks packet loss rates, monitors network interface throughput using system counters, and tests TCP connectivity establishment time. These measurements are evaluated against configurable QoS profiles for applications such as video conferencing, VoIP, online gaming, and general browsing.

The system is built with a FastAPI (Python) backend for network measurements and data persistence, and a React (TypeScript) frontend for real-time visualization. All measurements are genuine, derived from actual network probes, and stored in an SQLite database for historical analysis.

**Keywords:** Quality of Service, Network Monitoring, Latency, Jitter, Packet Loss, Throughput, ICMP, TCP, Real-time Analytics

---

## 2. Problem Statement

Network applications such as video conferencing, voice over IP, online gaming, and real-time collaboration require specific network performance characteristics to function acceptably. Poor network conditions — high latency, excessive jitter, packet loss, or insufficient throughput — directly degrade user experience.

Most users lack visibility into their network's actual performance characteristics and cannot determine whether their connection meets the requirements of their intended applications. Existing commercial tools are either overly simplistic (single-point speed tests) or prohibitively complex (enterprise network management suites).

**Problem:** There is no accessible, self-hosted tool that performs genuine, continuous network measurements, evaluates them against application-specific QoS requirements, and presents results in an understandable format suitable for both technical analysis and educational purposes.

---

## 3. Motivation

1. **Educational Value** — Understanding QoS metrics is fundamental to Computer Networks education. This project provides a hands-on platform to observe and analyze real network behavior.

2. **Practical Application** — Students, developers, and network administrators need tools to diagnose network issues affecting their applications.

3. **Transparency** — Unlike black-box speed test services, this system exposes its measurement methodology, enabling users to understand exactly how results are derived.

4. **Customizability** — Different applications have different network requirements. A configurable QoS assessment system allows users to evaluate their network for specific use cases.

5. **Continuous Monitoring** — Single-point measurements miss transient issues. Continuous monitoring reveals patterns, trends, and intermittent degradation.

---

## 4. Objectives

1. Measure ICMP round-trip time using genuine OS ping utilities.
2. Calculate jitter from consecutive RTT variation using documented algorithms.
3. Track packet loss from actual probe success and failure counts.
4. Monitor network interface throughput using system byte counters.
5. Test TCP connectivity establishment time to configured hosts and ports.
6. Implement configurable QoS profiles for common application categories.
7. Generate threshold-based alerts with hysteresis to reduce false alarms.
8. Persist all measurements in a relational database for historical analysis.
9. Display results through a real-time, professional web dashboard.
10. Export measurement data in CSV format for external analysis.

---

## 5. Existing System Limitations

| Existing Approach | Limitations |
|---|---|
| Online speed tests (Ookla, Fast.com) | Single-point measurement; no continuous monitoring; no QoS assessment; external dependency |
| Command-line ping/tracert | No visualization; no persistence; manual interpretation required |
| Wireshark | Packet-level analysis; steep learning curve; not application-QoS focused |
| Nagios/Zabbix | Enterprise complexity; heavy infrastructure; not educational |
| PRTG/SolarWinds | Commercial licenses; not self-hosted for students; overkill for learning |

---

## 6. Proposed System

NetPulse QoS addresses these limitations with:

- **Genuine measurements** using OS-native tools (no simulated data)
- **Continuous monitoring** with configurable intervals
- **Application-specific QoS assessment** with editable profiles
- **Persistent storage** for historical analysis and trend detection
- **Professional web interface** accessible from any browser
- **Self-hosted** operation without external service dependencies
- **Educational transparency** — all algorithms and methods are documented

---

## 7. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Measure ICMP RTT to configured targets | High |
| FR-02 | Calculate latency statistics (min, max, mean, median, σ, P95) | High |
| FR-03 | Calculate jitter from consecutive RTT differences | High |
| FR-04 | Calculate packet loss percentage | High |
| FR-05 | Monitor network interface Rx/Tx throughput | High |
| FR-06 | Test TCP connectivity and measure connection time | Medium |
| FR-07 | Manage multiple monitoring targets (CRUD) | High |
| FR-08 | Start, stop, and configure monitoring sessions | High |
| FR-09 | Persist measurements in a database | High |
| FR-10 | Display real-time metrics on a dashboard | High |
| FR-11 | Generate alerts when thresholds are exceeded | Medium |
| FR-12 | Assess QoS against application profiles | Medium |
| FR-13 | Display historical trends with charts | Medium |
| FR-14 | Export data in CSV format | Medium |
| FR-15 | Validate all user inputs | High |
| FR-16 | Handle errors and display meaningful messages | High |

## 8. Non-Functional Requirements

| ID | Requirement |
|---|---|
| NFR-01 | Backend response time < 500ms for API calls |
| NFR-02 | Frontend loads within 3 seconds |
| NFR-03 | Support concurrent monitoring of multiple targets |
| NFR-04 | Operate without internet connectivity (local targets) |
| NFR-05 | Accessible UI meeting WCAG AA contrast standards |
| NFR-06 | Responsive design for desktop and tablet viewports |
| NFR-07 | No fabricated or simulated measurement data |
| NFR-08 | Safe subprocess execution (no shell injection) |
| NFR-09 | Input validation on all API endpoints |
| NFR-10 | Graceful degradation when network tools are unavailable |

---

## 9. Software and Hardware Requirements

### Software Requirements

| Component | Requirement |
|---|---|
| Operating System | Windows 10/11 or Linux (Ubuntu 20.04+) |
| Python | 3.11 or newer |
| Node.js | 18.x or newer |
| npm | 9.x or newer |
| Browser | Chrome 90+, Firefox 90+, Edge 90+ |
| Database | SQLite 3 (bundled with Python) |

### Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| Processor | Dual-core 2.0 GHz | Quad-core 2.5 GHz |
| RAM | 4 GB | 8 GB |
| Storage | 500 MB | 1 GB |
| Network | Ethernet or Wi-Fi adapter | Ethernet |

---

## 10. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Browser (Client)                      │
│  ┌───────────────────────────────────────────────────────┐  │
│  │   React Frontend (TypeScript + Tailwind CSS)          │  │
│  │   ├── Dashboard / Overview                            │  │
│  │   ├── Live Monitoring (real-time charts)              │  │
│  │   ├── Target Management                               │  │
│  │   ├── Throughput Analysis                             │  │
│  │   ├── QoS Assessment                                  │  │
│  │   ├── Alerts & Incidents                              │  │
│  │   ├── Reports & History                               │  │
│  │   └── Settings                                        │  │
│  └───────────────────┬───────────────────────────────────┘  │
│                      │ HTTP REST API                         │
└──────────────────────┼──────────────────────────────────────┘
                       │
┌──────────────────────┼──────────────────────────────────────┐
│               FastAPI Backend (Python)                       │
│  ┌───────────────────┴───────────────────────────────────┐  │
│  │   API Layer (Routers)                                  │  │
│  │   ├── /api/health                                     │  │
│  │   ├── /api/targets                                    │  │
│  │   ├── /api/monitoring                                 │  │
│  │   ├── /api/tests                                      │  │
│  │   ├── /api/alerts                                     │  │
│  │   └── /api/reports                                    │  │
│  └───────────────────┬───────────────────────────────────┘  │
│  ┌───────────────────┴───────────────────────────────────┐  │
│  │   Service Layer                                        │  │
│  │   ├── Monitoring Manager (lifecycle, scheduling)       │  │
│  │   ├── QoS Engine (calculations, assessment)           │  │
│  │   └── Alert Engine (threshold evaluation, hysteresis)  │  │
│  └───────────────────┬───────────────────────────────────┘  │
│  ┌───────────────────┴───────────────────────────────────┐  │
│  │   Adapter Layer                                        │  │
│  │   ├── ICMP Adapter (OS ping subprocess)               │  │
│  │   ├── TCP Adapter (socket connect timing)             │  │
│  │   ├── Throughput Adapter (psutil counters)             │  │
│  │   └── HTTP Adapter (request timing)                   │  │
│  └───────────────────┬───────────────────────────────────┘  │
│  ┌───────────────────┴───────────────────────────────────┐  │
│  │   Persistence Layer                                    │  │
│  │   ├── SQLAlchemy ORM Models                           │  │
│  │   └── SQLite Database                                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Algorithms and Formulas

### 11.1 Round-Trip Time (RTT)

RTT is the time for an ICMP Echo Request to travel from the source to the destination and for the ICMP Echo Reply to return.

```
RTT = T_reply_received − T_request_sent
```

Measured using the OS `ping` command, which sends an ICMP Type 8 (Echo Request) packet and receives an ICMP Type 0 (Echo Reply) packet.

### 11.2 Latency Statistics

Given a set of N successful RTT measurements {rtt₁, rtt₂, ..., rttₙ}:

- **Minimum RTT** = min(rtt₁, rtt₂, ..., rttₙ)
- **Maximum RTT** = max(rtt₁, rtt₂, ..., rttₙ)
- **Mean RTT** = (Σ rttᵢ) / N
- **Median RTT** = middle value of sorted measurements
- **Standard Deviation** = √[(Σ(rttᵢ − mean)²) / N]
- **95th Percentile** = value below which 95% of measurements fall

### 11.3 Jitter Calculation

Jitter is calculated as the mean of absolute differences between consecutive successful RTT measurements:

```
Jitter_i = |RTT_i − RTT_(i−1)|

Mean Jitter = (Σ Jitter_i) / (N − 1)
```

where N is the number of consecutive successful RTT pairs.

**Important notes:**
- Failed probes are excluded from consecutive pairs
- If probe 3 fails, the jitter between probes 2 and 4 is NOT calculated (they are not consecutive)
- This measures RTT variation, which is an approximation. The standardized RTP jitter metric (RFC 3550) uses one-way delay variation, which requires clock synchronization

### 11.4 Packet Loss

```
Packet Loss (%) = (Failed Probes / Total Probes) × 100

where:
  Failed Probes = Total Probes − Successful Probes
  Successful Probe = received a valid ICMP Echo Reply within timeout
```

A probe is failed if it times out, receives a "Destination Unreachable" response, or encounters any error.

### 11.5 Interface Throughput

```
Throughput (Mbps) = (ΔBytes × 8) / (Δt × 1,000,000)

where:
  ΔBytes = bytes_now − bytes_previous
  Δt = elapsed time in seconds between readings
```

**Bandwidth vs. Throughput distinction:**
- **Bandwidth** — The maximum theoretical capacity of a link (e.g., 1 Gbps Ethernet)
- **Throughput** — The actual data transfer rate observed at a given time
- **Utilization** — Throughput / Bandwidth × 100%

### 11.6 TCP Connection Time

```
TCP Connection Time = T_connected − T_connect_initiated
```

This measures the TCP three-way handshake duration (SYN → SYN-ACK → ACK), not application-level response time.

### 11.7 QoS Assessment

Each application profile defines thresholds:

| Metric | Video Conferencing | VoIP | Gaming | Browsing |
|---|---|---|---|---|
| Latency (ms) | Good: <100, Degraded: <200, Poor: ≥200 | Good: <80, Degraded: <150, Poor: ≥150 | Good: <50, Degraded: <100, Poor: ≥100 | Good: <200, Degraded: <500, Poor: ≥500 |
| Jitter (ms) | Good: <20, Degraded: <50, Poor: ≥50 | Good: <15, Degraded: <30, Poor: ≥30 | Good: <10, Degraded: <30, Poor: ≥30 | Good: <50, Degraded: <100, Poor: ≥100 |
| Packet Loss (%) | Good: <1, Degraded: <3, Poor: ≥3 | Good: <1, Degraded: <2, Poor: ≥2 | Good: <1, Degraded: <2.5, Poor: ≥2.5 | Good: <2, Degraded: <5, Poor: ≥5 |

**Assessment rule:** The worst individual metric determines the overall status. A session marked "Good" for latency but "Poor" for packet loss receives an overall "Poor" rating.

A minimum of 10 valid observations is required before issuing a confident assessment. Below this threshold, the status is "Insufficient Data."

---

## 12. Database Entity-Relationship Diagram

```
┌──────────────────┐     ┌──────────────────────┐
│ MonitoringTarget │     │  MonitoringSession    │
├──────────────────┤     ├──────────────────────┤
│ PK id            │◄──┐ │ PK id                │
│    name          │   └─│ FK target_id          │
│    host          │     │    start_time         │
│    target_type   │     │    end_time           │
│    port          │     │    status             │
│    enabled       │     │    interval_seconds   │
│    created_at    │     │    config_snapshot    │
│    updated_at    │     └─────────┬────────────┘
└──────────────────┘               │
                          ┌────────┼────────┐
                          │        │        │
                    ┌─────┴──┐  ┌──┴───┐  ┌─┴──────┐
                    │ Probe  │  │ QoS  │  │ Alert  │
                    │ Result │  │ Snap │  │        │
                    ├────────┤  ├──────┤  ├────────┤
                    │ PK id  │  │PK id │  │ PK id  │
                    │FK sess │  │FK ses│  │ FK ses │
                    │ tstamp │  │tstamp│  │ tstamp │
                    │ seq_no │  │min_rt│  │severity│
                    │success │  │max_rt│  │ metric │
                    │ rtt_ms │  │mean  │  │obs_val │
                    │err_type│  │median│  │thresh  │
                    │err_det │  │stddev│  │message │
                    └────────┘  │p95   │  │resolv'd│
                                │jitter│  │ack'd   │
                                │probes│  └────────┘
                                │loss% │
                                │rx_tp │
                                │tx_tp │
                                │assess│
                                └──────┘
```

---

## 13. Key Networking Concepts Explained

### 13.1 Quality of Service (QoS)

Quality of Service refers to the set of technologies and mechanisms that manage network traffic to ensure acceptable performance for specific applications. QoS is characterized by measurable metrics: latency, jitter, packet loss, throughput, and availability.

Different applications have different QoS requirements. A video call tolerates some latency but is very sensitive to jitter and packet loss. A file download tolerates latency and jitter but needs high throughput.

### 13.2 ICMP (Internet Control Message Protocol)

ICMP is a network-layer protocol (part of the IP suite) used for diagnostic and control purposes. The `ping` utility sends ICMP Echo Request (Type 8) messages and listens for Echo Reply (Type 0) messages.

```
Source → ICMP Echo Request (Type 8, Code 0) → Destination
Source ← ICMP Echo Reply  (Type 0, Code 0) ← Destination
```

ICMP messages are encapsulated in IP packets. They do not use TCP or UDP port numbers.

### 13.3 TCP Three-Way Handshake

TCP connection establishment uses a three-way handshake:

```
Client → SYN → Server              (Step 1: Client initiates)
Client ← SYN-ACK ← Server          (Step 2: Server acknowledges)
Client → ACK → Server              (Step 3: Client confirms)
```

The TCP connection time measured in this project corresponds to the time from sending SYN to completing the handshake. This is distinct from ICMP RTT and from HTTP response time.

### 13.4 Sampling and Monitoring

**Sampling interval** — The time between consecutive probes. A 5-second interval means one probe every 5 seconds.

**Timeout** — The maximum time to wait for a response before declaring a probe failed. Must be less than the sampling interval.

**Session** — A continuous monitoring period with a specific target and configuration.

### 13.5 Bandwidth vs. Throughput

| Term | Definition | How to Measure |
|---|---|---|
| Bandwidth | Maximum theoretical capacity of a link | Read from hardware specs (e.g., "1 Gbps Ethernet") |
| Throughput | Actual data rate at a given time | Measure bytes transferred over time |
| Goodput | Application-level throughput (excluding headers) | Measure application data only |

Bandwidth is an upper bound. Throughput is always ≤ Bandwidth due to protocol overhead, congestion, and other factors.

---

## 14. Test Cases

### Unit Tests

| TC-ID | Description | Input | Expected Output |
|---|---|---|---|
| TC-01 | Latency stats with known values | [10, 20, 30, 40, 50] | min=10, max=50, mean=30, median=30 |
| TC-02 | Jitter calculation | [10, 15, 12, 18] | mean of [5, 3, 6] = 4.67 |
| TC-03 | Packet loss 0% | sent=100, received=100 | loss=0.0% |
| TC-04 | Packet loss 25% | sent=100, received=75 | loss=25.0% |
| TC-05 | Packet loss no probes | sent=0, received=0 | None (insufficient data) |
| TC-06 | Throughput conversion | 125000 bytes in 1 second | 1.0 Mbps |
| TC-07 | QoS assessment - Good | latency=20ms, jitter=5ms, loss=0.1% | Good |
| TC-08 | QoS assessment - Poor | latency=20ms, jitter=5ms, loss=10% | Poor (packet loss) |
| TC-09 | QoS insufficient data | 3 samples | Insufficient Data |
| TC-10 | Empty RTT list | [] | None for all statistics |

### Integration Tests

| TC-ID | Description | Expected Behavior |
|---|---|---|
| TC-11 | Create target with valid data | Returns 201 with target details |
| TC-12 | Create target with empty host | Returns 422 validation error |
| TC-13 | Delete nonexistent target | Returns 404 |
| TC-14 | Start monitoring valid target | Returns session ID, status=running |
| TC-15 | Stop monitoring | Session status updated to stopped |
| TC-16 | Health endpoint | Returns status=ok with version |
| TC-17 | Export CSV for session | Returns valid CSV content |
| TC-18 | Get alerts (empty) | Returns empty list |

---

## 15. Limitations

1. **ICMP Privilege Requirements** — On Linux, raw ICMP sockets may require root or `cap_net_raw`. Windows generally allows `ping` for standard users.

2. **Interface Throughput ≠ Internet Speed** — psutil counters measure all traffic through an interface, not end-to-end internet bandwidth.

3. **Jitter Approximation** — The RTT-variation method approximates jitter from round-trip measurements. True one-way jitter (RFC 3550) requires synchronized clocks.

4. **Single-Machine Deployment** — Designed for local use. Not configured for production multi-user deployment without additional security hardening.

5. **QoS Thresholds Are Estimates** — Assessment profiles provide guidelines, not guarantees. Actual application performance depends on many factors beyond these metrics.

6. **No Packet Capture** — Does not perform deep packet inspection or protocol-level analysis.

7. **Intermediate Router Opacity** — Route diagnostics cannot guarantee visibility of all hops, as routers may not respond to probe packets.

---

## 16. Future Enhancements

1. **IPv6 Support** — Extend ICMP measurements to support IPv6 targets.
2. **DNS Resolution Monitoring** — Add DNS lookup time as a separate metric.
3. **Multi-User Authentication** — Add user accounts with role-based access.
4. **WebSocket Live Updates** — Replace polling with WebSocket for lower-latency UI updates.
5. **SNMPv3 Integration** — Query network devices for interface statistics.
6. **Packet Capture Analysis** — Optional pcap integration for protocol-level insights.
7. **Mobile Application** — React Native companion for on-the-go monitoring.
8. **Email/SMS Alerting** — External notification channels for critical alerts.
9. **Historical Anomaly Detection** — Statistical outlier detection for measurement patterns.
10. **Dashboard Customization** — User-configurable widget layout.

---

## 17. Viva Questions and Answers

### Q1: What is Quality of Service (QoS)?
**A:** QoS refers to the set of technologies and mechanisms for managing network traffic to meet specific performance requirements. Key QoS metrics include latency, jitter, packet loss, throughput, and availability. Different applications have different QoS requirements — for example, VoIP needs low latency and jitter, while file downloads prioritize throughput.

### Q2: What is the difference between latency and RTT?
**A:** Latency generally refers to the delay in transmitting data from source to destination (one-way). RTT (Round-Trip Time) is the time for a packet to travel from source to destination and back. In practice, when we use `ping`, we measure RTT. One-way latency is approximately RTT/2, though this is an approximation because forward and reverse paths may differ.

### Q3: How do you calculate jitter?
**A:** In this project, we calculate jitter as the mean of absolute differences between consecutive successful RTT measurements: `Jitter_i = |RTT_i − RTT_(i-1)|`. This is a commonly used approximation. The formal RTP jitter metric (RFC 3550) uses one-way delay variation with exponential smoothing, which requires synchronized clocks between sender and receiver.

### Q4: What is the TCP three-way handshake?
**A:** TCP uses a three-step process to establish connections: (1) The client sends a SYN segment, (2) The server responds with SYN-ACK, (3) The client sends ACK. This establishes sequence numbers and confirms both sides are ready. The TCP connection time in our project measures the duration of this handshake.

### Q5: What is the difference between bandwidth and throughput?
**A:** Bandwidth is the maximum theoretical capacity of a network link (e.g., 1 Gbps Ethernet). Throughput is the actual data transfer rate observed at a given time, which is always less than or equal to bandwidth due to protocol overhead, congestion, sharing, and other factors.

### Q6: How does ICMP work?
**A:** ICMP (Internet Control Message Protocol) operates at the network layer alongside IP. The `ping` utility sends ICMP Echo Request (Type 8) messages to a target. If the target is reachable and configured to respond, it sends back an ICMP Echo Reply (Type 0). ICMP messages are encapsulated in IP packets and do not use TCP or UDP.

### Q7: Why not use random data to simulate network measurements?
**A:** Fabricated data provides no real information about network conditions. It would misrepresent the system's capabilities, provide no educational value for understanding actual network behavior, and would be academically dishonest. Our system uses genuine OS tools to make real measurements.

### Q8: How do you prevent ICMP command injection?
**A:** We use Python's subprocess with argument lists (not shell strings) and validate hostnames against allowed patterns before execution. This prevents command injection attacks where malicious hostnames could include shell metacharacters.

### Q9: What is packet loss and how is it calculated?
**A:** Packet loss is the percentage of sent probes that do not receive a valid response. Calculated as: `(Failed Probes / Total Probes) × 100`. Causes include network congestion, hardware failures, routing issues, or target unavailability.

### Q10: How does the alert system work?
**A:** Alerts use configurable thresholds with a consecutive-violation mechanism. A metric must exceed its threshold for a configured number of consecutive readings (default: 3) before an alert is generated. This hysteresis prevents false alarms from single measurement anomalies. Alerts auto-resolve when the metric returns to acceptable levels for the same number of consecutive readings.

### Q11: What is psutil and how is it used here?
**A:** psutil is a Python library that provides system and process information. We use `psutil.net_io_counters(pernic=True)` to get byte counters per network interface. By comparing counter values at two points in time, we calculate the actual throughput: `Throughput = (ΔBytes × 8) / (Δtime × 10⁶)` Mbps.

### Q12: Why use SQLite instead of MySQL or PostgreSQL?
**A:** SQLite requires no separate server process, stores data in a single file, comes bundled with Python, and is ideal for local single-user applications. This simplifies installation and deployment while still providing ACID-compliant relational storage. For multi-user production deployment, migration to PostgreSQL would be recommended.

### Q13: What is FastAPI and why was it chosen?
**A:** FastAPI is a modern Python web framework for building APIs with automatic validation, serialization, and documentation. Key advantages: automatic OpenAPI/Swagger documentation, Pydantic-based request validation, native async support (important for non-blocking network operations), and high performance via Uvicorn/Starlette.

### Q14: How does the frontend communicate with the backend?
**A:** The React frontend communicates with the FastAPI backend via HTTP REST API calls. In development, Vite's proxy forwards `/api/*` requests to the backend on port 8000. The frontend uses TanStack Query for server-state management with automatic polling for live updates during monitoring sessions.

### Q15: What are QoS profiles and how are they used?
**A:** QoS profiles define application-specific performance thresholds. For example, the "VoIP" profile requires latency < 80ms, jitter < 15ms, and packet loss < 1% for a "Good" rating. The system evaluates current measurements against the selected profile and assigns a status (Good, Degraded, Poor) based on the worst individual metric.

---

## 18. Faculty Demonstration Guide

### Setup (5 minutes before demonstration)

1. Open PowerShell terminal
2. Start backend: `cd backend; .venv\Scripts\Activate.ps1; python -m uvicorn app.main:app --reload`
3. Open new terminal, start frontend: `cd frontend; npm run dev`
4. Open browser to http://localhost:5173

### Demonstration Flow (15–20 minutes)

**Part 1: System Overview (2 min)**
- Show the dashboard with no active monitoring (empty state)
- Point out the clean UI, navigation, and responsive layout
- Show the Settings page with backend health status

**Part 2: Target Management (2 min)**
- Navigate to Targets page
- Add a target: Name="Google DNS", Host="8.8.8.8", Type="ICMP"
- Add a second target: Name="Localhost", Host="127.0.0.1"
- Show validation by trying an empty hostname

**Part 3: Live Monitoring (5 min)**
- Navigate to Live Monitoring
- Select "Google DNS" target
- Click Start — show real-time probe results updating
- Point out the latency chart building with actual measurements
- Explain the jitter calculation visible in the metric card
- After 30+ seconds, show accumulated statistics
- Click Stop — show session recorded

**Part 4: QoS Assessment (3 min)**
- Navigate to QoS Assessment
- Select "Video Conferencing" profile
- Show per-metric evaluation with actual measurements
- Switch to "Gaming" profile — note different thresholds
- Explain how the worst metric determines overall status

**Part 5: History & Export (2 min)**
- Navigate to Reports
- Select the completed session
- Show historical charts from database records
- Click Export CSV — download and open in Excel

**Part 6: Technical Deep-Dive (3 min)**
- Show API documentation at http://localhost:8000/docs
- Show the database file being populated
- Show a test run: `python -m pytest tests/ -v`
- Explain the ICMP adapter parsing real ping output

**Part 7: Q&A (3 min)**
- Be prepared for viva questions from Section 17

### Backup Plan
If external network is unavailable:
- Monitor `127.0.0.1` (localhost) — always works
- Show TCP test against a local service
- Interface throughput still works with local traffic

---

## 19. References

1. Kurose, J.F. & Ross, K.W. (2021). *Computer Networking: A Top-Down Approach*, 8th Edition. Pearson.
2. RFC 792 — Internet Control Message Protocol (ICMP). September 1981.
3. RFC 793 — Transmission Control Protocol (TCP). September 1981.
4. RFC 3550 — RTP: A Transport Protocol for Real-Time Applications. July 2003.
5. RFC 2544 — Benchmarking Methodology for Network Interconnect Devices. March 1999.
6. ITU-T G.114 — One-way transmission time. May 2003.
7. FastAPI Documentation. https://fastapi.tiangolo.com/
8. SQLAlchemy Documentation. https://docs.sqlalchemy.org/
9. React Documentation. https://react.dev/
10. psutil Documentation. https://psutil.readthedocs.io/

---

*Document prepared for academic evaluation — B.Tech CSE, R22 Regulation, Computer Networks Project*
