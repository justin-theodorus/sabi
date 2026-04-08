#!/bin/bash
set -e

# Kill any stale processes on service ports (native services only)
echo "Clearing ports 3000 8001 8002 8004 8005..."
for port in 3000 8001 8002 8004 8005; do
  lsof -ti tcp:$port | xargs kill -9 2>/dev/null || true
done

# Start Redis, MinIO, and expression-service via Docker
# expression-service runs in Docker because DeepFace/TensorFlow is heavy to install natively.
# On first run, Docker will build the image and download model weights (~5 min).
echo "Starting Redis, MinIO, and expression-service (Docker)..."
docker-compose up -d --build redis minio expression-service

# Sync Node dependencies (fast no-op if already up to date)
for service in aac-icon-service session-service frontend; do
  echo "Syncing $service dependencies..."
  (cd "$service" && npm install --silent)
done

# Create venvs if missing, always sync dependencies
for service in dialogue-engine persona-engine; do
  if [ ! -d "$service/venv" ]; then
    echo "Creating venv for $service..."
    python3 -m venv "$service/venv"
  fi
  echo "Syncing $service dependencies..."
  "$service/venv/bin/pip" install -q -r "$service/requirements.txt"
done

echo ""
echo "Starting native services..."
echo "  frontend          → http://localhost:3000"
echo "  dialogue-engine   → http://localhost:8001"
echo "  persona-engine    → http://localhost:8002"
echo "  expression-service→ http://localhost:8003  (Docker — may take ~30s to warm up)"
echo "  session-service   → http://localhost:8004"
echo "  aac-icon-service  → http://localhost:8005"
echo "  MinIO console     → http://localhost:9001  (minioadmin / minioadmin)"
echo ""
echo "Press Ctrl+C to stop native services."
echo "Note: Docker services (Redis, MinIO, expression-service) keep running."
echo "      Run 'docker-compose stop' to stop them too."
echo ""

# Trap Ctrl+C and kill all background processes
trap 'echo ""; echo "Stopping native services..."; kill 0' SIGINT SIGTERM

# Start native services in background
(cd dialogue-engine && venv/bin/uvicorn main:app --reload --port 8001) &
(cd persona-engine  && venv/bin/uvicorn main:app --reload --port 8002) &
(cd session-service  && node --watch index.js) &
(cd aac-icon-service && node --watch index.js) &
(cd frontend && npm run dev) &

wait
