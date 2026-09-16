# ==============================================================================
# MediKiosk Production Docker Container for Render / Sovereign Cloud Deployment
# Multi-service runtime: Node.js Express REST API + Python Voice/OCR Microservices
# ==============================================================================

FROM node:20-bookworm-slim

# Install Python 3, pip, venv, and FFmpeg for audio transcoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Create and activate Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python Voice & OCR Runtime dependencies
COPY voice_runtime/requirements.txt ./voice_runtime/
RUN pip install --no-cache-dir \
    edge-tts \
    soundfile \
    SpeechRecognition \
    pypdfium2 \
    opencv-python-headless \
    Pillow \
    numpy

# Install Node.js dependencies across root and backend workspaces
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/
RUN npm ci --omit=dev

# Copy application source code
COPY backend/ ./backend/
COPY voice_runtime/ ./voice_runtime/
COPY start.sh ./start.sh
RUN chmod +x ./start.sh

# Generate Prisma Client for PostgreSQL / Supabase
WORKDIR /app/backend
RUN npx prisma generate
WORKDIR /app

# Production Environment Variables Defaults
ENV NODE_ENV=production
ENV PORT=5000
ENV ASR_URL=http://127.0.0.1:8001
ENV OCR_URL=http://127.0.0.1:8002
ENV TTS_URL=http://127.0.0.1:8003
ENV AI_MODE=mock
ENV ASR_MODE=indicconformer

EXPOSE 5000 8001 8002 8003

CMD ["./start.sh"]
