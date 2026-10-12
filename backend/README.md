# NetPulse QoS Backend

Production-quality FastAPI backend for the **NetPulse QoS** Network SLA Monitoring and Diagnostics System.

## Features
- **Real Network Adapters**: Native OS ICMP ping execution (Windows/Linux/macOS), real TCP socket handshakes, and `psutil` network interface counters. Zero fabricated measurements.
- **QoS Calculation Engine**: Computes latency distributions (min, max, mean, median, stddev, 95th percentile), RFC 1889/3550 jitter, and packet loss percentages against five built-in SLA profiles (`video_conferencing`, `voip`, `gaming`, `browsing`, `file_download`).
- **Stateful Alert Engine**: Evaluates consecutive SLA threshold violations and automatically resolves alerts when metrics normalize.
- **FastAPI & Async SQLAlchemy 2.0**: High-throughput async database interactions powered by SQLite (`aiosqlite`).
- **RESTful API**: Comprehensive endpoints for targets management, real-time session lifecycle, diagnostic tests, alert handling, and CSV report exports.

## Directory Structure
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app, CORS, lifespan
│   ├── config.py                # Settings via pydantic-settings
│   ├── database.py              # SQLAlchemy engine, session
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py            # SQLAlchemy models
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── schemas.py           # Pydantic schemas
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── health.py            # /api/health
│   │   ├── targets.py           # /api/targets
│   │   ├── monitoring.py        # /api/monitoring
│   │   ├── tests.py             # /api/tests
│   │   ├── alerts.py            # /api/alerts
│   │   └── reports.py           # /api/reports
│   ├── services/
│   │   ├── __init__.py
│   │   ├── monitoring_manager.py# Monitoring lifecycle manager
│   │   ├── qos_engine.py        # QoS calculations & SLA profiles
│   │   └── alert_engine.py      # Alert evaluation engine
│   └── adapters/
│       ├── __init__.py
│       ├── icmp_adapter.py      # OS ping wrapper
│       ├── tcp_adapter.py       # TCP connectivity
│       ├── throughput_adapter.py# psutil interface counters
│       └── http_adapter.py      # HTTP probe
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_qos_engine.py
│   ├── test_alert_engine.py
│   ├── test_api_targets.py
│   ├── test_api_monitoring.py
│   └── test_api_health.py
├── requirements.txt
└── README.md
```

## Setup and Installation

### 1. Create and Activate Virtual Environment
```bash
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Run Test Suite
```bash
pytest -v
```

### 4. Start Development Server
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Interactive API documentation will be available at:
- Swagger UI: [http://localhost:8000/docs](http://localhost:8000/docs)
- ReDoc: [http://localhost:8000/redoc](http://localhost:8000/redoc)
