#!/bin/sh
set -e

echo "=================================================="
echo " Starting MediKiosk Sovereign Cloud Production Pod"
echo "=================================================="

# 1. Start Python Sovereign Voice, OCR & TTS Microservices (Ports 8001, 8002, 8003)
echo "[Voice Runtime] Launching Sovereign Python Microservices..."
python3 voice_runtime/server.py &
VOICE_PID=$!

# Wait briefly for voice microservice ports to bind
sleep 2

# 2. Push schema to Supabase / PostgreSQL if DATABASE_URL is defined
if [ -n "$DATABASE_URL" ]; then
  echo "[Database] Synchronizing schema with Supabase PostgreSQL..."
  (cd backend && npx prisma db push --skip-generate || true)
fi

# 3. Handle shutdown cleanly
cleanup() {
  echo "[MediKiosk] Caught termination signal. Stopping all processes..."
  kill -TERM "$VOICE_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM

# 4. Launch Node.js Express REST API Server on platform $PORT
echo "[Backend API] Launching Express REST API on port ${PORT:-5000}..."
cd backend
exec node src/server.js
