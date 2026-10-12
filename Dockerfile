# ==============================================================================
# NetPulse QoS - Production Dockerfile
# Multi-stage Linux build compiling C engine and running FastAPI backend
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build C Networking Engine natively on Linux
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS c-builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    make \
    libc6-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build/c_engine
COPY c_engine/ .

# Compile Linux POSIX binary using Makefile
RUN make linux

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM python:3.11-slim AS runner

# Install OS network diagnostics and healthcheck curl
RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy compiled C measurement engine to system PATH
COPY --from=c-builder /build/c_engine/netpulse_engine /usr/local/bin/netpulse_engine
RUN chmod +x /usr/local/bin/netpulse_engine

# Install Python backend dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/app ./app

# Prepare persistent storage directory for SQLite database
RUN mkdir -p /data && chmod 777 /data

# Default production environment variables
ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    SQLITE_DB_PATH=/data/netpulse.db \
    C_ENGINE_BIN_PATH=/usr/local/bin/netpulse_engine

# Mount point for persistent database retention across container restarts
VOLUME ["/data"]

EXPOSE 8000

# Container liveness check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:${PORT:-8000}/api/health || exit 1

# Start uvicorn with dynamic platform PORT binding
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
