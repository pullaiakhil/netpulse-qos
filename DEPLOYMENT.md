# NetPulse QoS — Public Deployment & Operations Guide

This guide covers production deployment for the **NetPulse QoS** system, including the React frontend, FastAPI Python backend, and native C networking engine.

---

## 1. Architectural Model & Measurement Reality

> [!IMPORTANT]
> **Hosted Cloud Engine Measurement Reality**  
> When the backend is deployed to a remote cloud host (e.g., Render, Railway, Fly.io, AWS, DigitalOcean), network probes (ICMP Echo and TCP Handshakes) originate from the **hosting server's network interface**.  
> The telemetry measures latency, jitter, and packet loss between the **cloud datacenter and the target destination**, NOT between the website visitor's home laptop/browser and the target.  
> To measure local user connectivity, run the NetPulse backend locally on the machine being tested.

---

## 2. Frontend Deployment (Vercel, Netlify, Cloudflare Pages, S3)

The frontend is a React + TypeScript Single Page Application (SPA) built with Vite and Tailwind CSS.

### Build Specifications
- **Working Directory:** `frontend/`
- **Install Command:** `npm install`
- **Build Command:** `npm run build`
- **Output Directory:** `frontend/dist`
- **Node Version:** 18+ (Node 20 LTS recommended)

### Environment Variables
Configure the following build-time environment variable on your static host:

| Variable Name | Required | Default | Example Value | Description |
|---|---|---|---|---|
| `VITE_API_BASE_URL` | Optional | `/api` | `https://api.netpulse.example.com` | Base URL of deployed backend. Omit if using reverse proxy on same domain. |

### Single-Page App (SPA) Routing Fallback
NetPulse uses client-side routing via `react-router-dom`. All route paths (`/monitoring`, `/targets`, `/throughput`, `/qos`, `/alerts`, `/reports`, `/settings`) must fall back to `/index.html`:
- **Netlify & Cloudflare Pages:** Automatically handled by [`frontend/public/_redirects`](frontend/public/_redirects).
- **Vercel:** Automatically configured by [`frontend/vercel.json`](frontend/vercel.json).
- **Nginx (Self-Hosted):**
  ```nginx
  location / {
      root /var/www/netpulse/dist;
      index index.html;
      try_files $uri $uri/ /index.html;
  }
  ```

---

## 3. Backend Deployment (Docker, Render, Railway, Fly.io, AWS)

The backend is packaged in a production multi-stage Dockerfile that:
1. Compiles the C networking engine natively on Linux using `gcc` and `make`.
2. Installs Python 3.11+ dependencies and OS networking packages (`iputils-ping`).
3. Sets up persistent storage for the SQLite database.

### Docker Build & Run

```bash
# Build the production container image
docker build -t netpulse-backend:latest .

# Run with persistent volume and custom port
docker run -d \
  --name netpulse-backend \
  -p 8000:8000 \
  -e PORT=8000 \
  -e SQLITE_DB_PATH=/data/netpulse.db \
  -e CORS_ORIGINS="https://my-frontend.vercel.app,http://localhost:5173" \
  -v netpulse_data:/data \
  netpulse-backend:latest
```

### Docker Compose (One-Command Startup)
```bash
docker compose up -d
```

### Backend Environment Variables

| Variable Name | Default | Production Recommendation | Description |
|---|---|---|---|
| `PORT` | `8000` | Auto-assigned by host (e.g. `$PORT`) | Port on which the HTTP server listens. |
| `HOST` | `0.0.0.0` | `0.0.0.0` | Network binding address. |
| `SQLITE_DB_PATH` | `./netpulse.db` | `/data/netpulse.db` | Persistent volume path for SQLite database. |
| `DATABASE_URL` | Auto-generated from `SQLITE_DB_PATH` | (Leave blank or specify) | Full SQLAlchemy async database URI. |
| `CORS_ORIGINS` | `http://localhost:5173` | `https://your-frontend-domain.com` | Comma-separated list of allowed frontend origins. Rejects unlisted origins. |
| `C_ENGINE_BIN_PATH` | Auto-detected | `/usr/local/bin/netpulse_engine` | Path to compiled C measurement binary. |
| `DEBUG` | `false` | `false` | Disable debug logs in production. |

---

## 4. Health Checks & Monitoring

The backend exposes an automated liveness and readiness health endpoint:

```http
GET /api/health
```

### Sample Health Response
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 142.5,
  "db_connected": true,
  "python_version": "Python 3.11.9",
  "os": "Linux 6.1.0",
  "c_engine_status": "operational (compiled binary active)",
  "c_engine_binary": "/usr/local/bin/netpulse_engine",
  "timestamp": "2026-10-12T17:45:00.000000Z"
}
```

The Dockerfile includes an automated `HEALTHCHECK` running every 30 seconds:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1
```

---

## 5. Public-Service Safety & Security Safeguards

1. **No Arbitrary Command Execution:**  
   Target input values are never passed to shell interpreters (`shell=True` is prohibited). Arguments are passed as sanitized parameter arrays.
2. **Strict Hostname & IP Address Validation:**  
   All targets are validated against standard RFC FQDN and IPv4/IPv6 patterns. Malformed characters or command separators (`&`, `;`, `|`, `` ` ``, `$`) are rejected with HTTP 422.
3. **Rate Limiting & Safety Bounds:**  
   - Probing interval has a strict floor of 1.0 second per session to prevent denial-of-service abuse.
   - On-demand ping sequences are bounded to a maximum of 20 probes.
   - Probe timeouts are strictly enforced (maximum 10.0 seconds).
4. **Controlled Throughput Guard (iperf3):**  
   Active synthetic bandwidth tests cannot be executed without explicit user confirmation acknowledging target ownership and authorization.
5. **Measurement Integrity:**  
   Missing measurements return `—` or an explicit diagnostic error code (`TIMEOUT`, `CONNECTION_REFUSED`, `ICMP_BLOCKED`). Fabricated or synthetic placeholder numbers are never substituted for real measurements.
