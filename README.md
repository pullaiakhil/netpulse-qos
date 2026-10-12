# NetPulse QoS — Quality of Service Monitoring System

> Real-time Quality of Service (QoS) SLA monitoring, diagnostics, and multi-scenario network lab.  
> B.Tech CSE | Computer Networks Project

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB.svg?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6.svg?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![C Native](https://img.shields.io/badge/Core-C_Networking_Engine-00599C.svg?style=flat&logo=c)](c_engine/)
[![Docker](https://img.shields.io/badge/Deployment-Docker-2496ED.svg?style=flat&logo=docker)](Dockerfile)

---

## Overview

NetPulse QoS is an enterprise-grade full-stack network monitoring and Quality of Service diagnostic system. It performs **genuine, unsimulated network measurements** using native operating system socket APIs, high-precision C binaries, and live hardware interface counters.

### Core Capabilities

- **C Native Measurement Engine** — High-resolution monotonic timer with native ICMP echo and non-blocking TCP socket handshakes.
- **Multi-Target Comparison Lab** — Concurrent side-by-side benchmarking of Google DNS (`8.8.8.8`), Cloudflare DNS (`1.1.1.1`), and local gateways.
- **TCP Service Latency Probing** — Measures connection establishment handshake delay to any authorized port (e.g. `127.0.0.1:8000`), explicitly distinguishing TCP timing from ICMP RTT.
- **Live Interface Throughput (Mbps)** — Continuous inbound (Rx) and outbound (Tx) hardware adapter bitrates and packet drop counters via `psutil`.
- **SLA Threshold Incidents & Anti-Spam Alerts** — Configurable latency, jitter, and loss violation thresholds backed by a stateful hysteresis counter (3 consecutive breaches before firing, 3 normal intervals before auto-resolving).
- **Historical Session Comparison** — Side-by-side audit comparing two diagnostic runs with delta calculations ($\Delta$ ms, $\Delta$ %, $\Delta$ jitter) and distribution quantiles.
- **Controlled Active Bandwidth Lab (iperf3)** — Guarded on-demand throughput benchmarking to authorized `iperf3` servers.

---

## Architectural Model & Cloud Hosting Reality

> [!IMPORTANT]
> **Cloud Datacenter vs Local Computer Measurement Notice**  
> When the NetPulse backend is deployed to a remote cloud provider (e.g. Render, Railway, Fly.io, AWS, DigitalOcean), network probes originate from the **hosting server's network adapter**.  
> The telemetry reflects network quality between the **cloud datacenter and the target**, NOT between the website visitor's home laptop/browser and the target.  
> To test your local Wi-Fi or home broadband connectivity, run NetPulse locally on your machine.

```
┌─────────────────────────────────────────────────────────────┐
│               Frontend (React + Vite + TS)                  │
│       Vercel / Netlify / Cloudflare Pages / Static CDN      │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP REST (VITE_API_BASE_URL)
┌──────────────────────────────▼──────────────────────────────┐
│                  FastAPI Backend (Python 3.11+)             │
│            Docker Container / Cloud Host (0.0.0.0:$PORT)    │
│                                                             │
│  ┌─────────────────────────┐   ┌─────────────────────────┐  │
│  │   C Networking Engine   │   │  SQLAlchemy 2.0 Async   │  │
│  │   (/usr/local/bin)      │   │  SQLite (SQLITE_DB_PATH)│  │
│  └────────────┬────────────┘   └─────────────────────────┘  │
│               │                                             │
│               ├─ ICMP Echo / Ping (OS Raw / Win32 Icmp)    │
│               ├─ TCP Handshake Socket Timing               │
│               └─ psutil Physical NIC Hardware Counters      │
└─────────────────────────────────────────────────────────────┘
```

---

## Quick Start (Local Development)

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **C Compiler (Optional):** GCC (`gcc`) or MSVC (`cl.exe`)

### 1. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python -m venv .venv

# Windows:
.venv\Scripts\Activate.ps1
# Linux / macOS:
source .venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```
Backend API starts at `http://localhost:8000`. Swagger documentation available at `http://localhost:8000/docs`.

### 2. Frontend Setup
```bash
# Open a new terminal
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```
Frontend dashboard starts at `http://localhost:5173`.

### 3. C Networking Engine Compilation (Optional)
The core C engine is located under `c_engine/`. If `gcc` is available:
```bash
cd c_engine

# Linux / macOS:
make linux

# Windows:
make windows
# or run:
.\build.bat
```
*Note: If no C compiler is detected, NetPulse automatically falls back to its built-in Python asyncio and OS ping adapters seamlessly.*

---

## Production Deployment

For full deployment guides, see [DEPLOYMENT.md](DEPLOYMENT.md).

### 1. Docker Deployment (Backend & C Engine)
The root Dockerfile compiles the C engine natively on Linux and starts FastAPI:

```bash
# Build the production Docker image
docker build -t netpulse-backend:latest .

# Run with persistent volume and platform port
docker run -d \
  --name netpulse-backend \
  -p 8000:8000 \
  -e PORT=8000 \
  -e SQLITE_DB_PATH=/data/netpulse.db \
  -e CORS_ORIGINS="https://your-frontend.vercel.app,http://localhost:5173" \
  -v netpulse_data:/data \
  netpulse-backend:latest
```

Or using Docker Compose:
```bash
docker compose up -d
```

### 2. Frontend Static Deployment
Deploy to Vercel, Netlify, Cloudflare Pages, or AWS S3:

- **Build Directory:** `frontend/`
- **Build Command:** `npm run build`
- **Output Directory:** `frontend/dist`
- **Environment Variable:** Set `VITE_API_BASE_URL` to your backend URL (e.g. `https://api.yourdomain.com`).
- **SPA Fallback:** Handled automatically by `frontend/public/_redirects` and `frontend/vercel.json`.

---

## Environment Variables Reference

### Backend (`backend/.env` or Container Environment)
| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | IP address to bind server. |
| `PORT` | `8000` | Port for HTTP server (respects cloud `$PORT`). |
| `SQLITE_DB_PATH` | `./netpulse.db` | Persistent SQLite file location (use `/data/netpulse.db` in Docker). |
| `DATABASE_URL` | Auto-derived | Full async SQLAlchemy database URL. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed frontend origins. |
| `C_ENGINE_BIN_PATH` | Auto-detected | Path to compiled C engine binary. |
| `DEBUG` | `false` | Enable or disable verbose debug logging. |

### Frontend (`frontend/.env` or Static Host Environment)
| Variable | Default | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Base URL of deployed backend. Omit if using reverse proxy on same domain. |

---

## Public-Service Safety Safeguards

1. **No Arbitrary Shell Execution:** Target addresses are never passed to shell interpreters (`shell=True` is prohibited). Arguments are passed as sanitized parameter arrays.
2. **Strict Hostname & IP Validation:** All targets must pass regex FQDN or IPv4/IPv6 address validation. Malicious characters (`;`, `&`, `|`, `$`) are rejected with HTTP 422.
3. **Probe Rate Limiting & Timeouts:** Minimum probe interval is 1.0s to prevent DoS flooding. Ping bursts are bounded ($\le 20$ probes) with enforced timeouts.
4. **Controlled Throughput Guard:** Synthetic `iperf3` tests require explicit user confirmation acknowledging authorization.
5. **No Synthetic Fabricated Data:** Probes only display real network data; unavailable measurements display `—` or an explicit error type (`TIMEOUT`, `CONNECTION_REFUSED`, `ICMP_BLOCKED`).

---

## Health Check Endpoint

```http
GET /api/health
```
Returns system status, database connectivity (`db_connected: true`), Python runtime version, host OS, and C engine readiness (`operational` / `source ready`).

---

## License & Credits

Academic & Educational Project — B.Tech CSE, Computer Networks.  
Developed by **Akhil Pullai**.
