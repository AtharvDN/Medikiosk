"""
MediKiosk Sovereign Multilingual Neural TTS Service
Runs on dedicated port 8003 (configurable via TTS_PORT / TTS_URL).
Provides high-fidelity natural speech synthesis for Marathi (mr), Hindi (hi), and English (en).
Primary: Edge-TTS Microsoft Neural voices (mr-IN-AarohiNeural, hi-IN-SwaraNeural, en-IN-NeerjaNeural).
Fallback: Meta MMS-TTS VITS models.
Format: 24kHz 16-bit Mono linear PCM WAV.
"""

import os
import sys
import io
import json
import base64
import asyncio
import time
import subprocess
import shutil
from socketserver import ThreadingMixIn
from http.server import HTTPServer, BaseHTTPRequestHandler

# Force UTF-8 encoding safely
os.environ["PYTHONIOENCODING"] = "utf-8"
if hasattr(sys.stdout, "reconfigure"):
    try: sys.stdout.reconfigure(encoding="utf-8", errors="ignore")
    except Exception: pass
if hasattr(sys.stderr, "reconfigure"):
    try: sys.stderr.reconfigure(encoding="utf-8", errors="ignore")
    except Exception: pass

HOST = os.environ.get("TTS_HOST", "127.0.0.1")
PORT = int(os.environ.get("TTS_PORT", "8003"))

FFMPEG_BIN = shutil.which("ffmpeg")
if not FFMPEG_BIN:
    import glob
    localappdata = os.environ.get("LOCALAPPDATA", "")
    matches = glob.glob(os.path.join(localappdata, "Microsoft", "WinGet", "Packages", "**", "ffmpeg.exe"), recursive=True) if localappdata else []
    if matches:
        FFMPEG_BIN = matches[0]
    else:
        FFMPEG_BIN = "ffmpeg"

NEURAL_VOICES = {
    "mr": "mr-IN-AarohiNeural",
    "hi": "hi-IN-SwaraNeural",
    "en": "en-IN-NeerjaNeural",
}

MMS_MODELS = {
    "mr": "facebook/mms-tts-mar",
    "hi": "facebook/mms-tts-hin",
    "en": "facebook/mms-tts-eng",
}

RUNTIME_STATE = {
    "device": "cpu",
    "mms_cache": {},
}

def init_tts_runtime():
    global RUNTIME_STATE
    try:
        import torch
        if torch.cuda.is_available():
            RUNTIME_STATE["device"] = "cuda"
            print(f"[TTS Service] CUDA GPU detected: {torch.cuda.get_device_name(0)}")
        else:
            RUNTIME_STATE["device"] = "cpu"
            print("[TTS Service] Running on CPU")
    except Exception as e:
        print(f"[TTS Service] Device init note: {e}")

    # Warm up synthesis pipeline so the first patient interaction is fast and responsive
    try:
        asyncio.run(synthesize_edge_tts("नमस्कार", "mr", 24000))
        print("[TTS Service] Pre-warming complete. Fluent Marathi voice ready.")
    except Exception as e:
        print(f"[TTS Service] Note on pre-warming: {e}")

async def synthesize_edge_tts(text: str, language: str = "mr", sample_rate: int = 24000) -> tuple[bytes, str]:
    import edge_tts
    voice = NEURAL_VOICES.get(language, NEURAL_VOICES["en"])
    communicate = edge_tts.Communicate(text, voice)

    mp3_chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            mp3_chunks.append(chunk["data"])

    mp3_bytes = b"".join(mp3_chunks)
    if not mp3_bytes:
        raise RuntimeError("Empty audio output from Edge-TTS")

    cmd = [
        FFMPEG_BIN,
        "-y",
        "-i", "pipe:0",
        "-ar", str(sample_rate),
        "-ac", "1",
        "-f", "wav",
        "pipe:1"
    ]
    proc = subprocess.run(cmd, input=mp3_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if proc.returncode != 0:
        raise RuntimeError(f"FFmpeg conversion failed: {proc.stderr.decode('utf-8', errors='ignore')}")

    import soundfile as sf
    buf_in = io.BytesIO(proc.stdout)
    audio_data, sr = sf.read(buf_in)
    buf_out = io.BytesIO()
    sf.write(buf_out, audio_data, sr, format="WAV", subtype="PCM_16")

    return buf_out.getvalue(), f"edge-neural-tts ({voice})"

def synthesize_mms_tts(text: str, language: str = "mr", sample_rate: int = 24000) -> tuple[bytes, str]:
    import torch
    from transformers import VitsModel, AutoTokenizer
    import soundfile as sf

    model_id = MMS_MODELS.get(language, MMS_MODELS["en"])
    device = RUNTIME_STATE["device"]

    if model_id not in RUNTIME_STATE["mms_cache"]:
        print(f"[TTS Service] Loading MMS-TTS for {language} ({model_id}) on {device}...")
        tokenizer = AutoTokenizer.from_pretrained(model_id)
        model = VitsModel.from_pretrained(model_id).to(device)
        RUNTIME_STATE["mms_cache"][model_id] = (tokenizer, model)

    tokenizer, model = RUNTIME_STATE["mms_cache"][model_id]
    inputs = tokenizer(text, return_tensors="pt").to(device)

    with torch.no_grad():
        output = model(**inputs).waveform

    audio = output.squeeze().cpu().numpy()
    native_sr = model.config.sampling_rate

    buf = io.BytesIO()
    sf.write(buf, audio, native_sr, format="WAV", subtype="PCM_16")
    wav_bytes = buf.getvalue()

    if sample_rate != native_sr and sample_rate > 0:
        cmd = [
            FFMPEG_BIN,
            "-y",
            "-i", "pipe:0",
            "-ar", str(sample_rate),
            "-ac", "1",
            "-f", "wav",
            "pipe:1"
        ]
        proc = subprocess.run(cmd, input=wav_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if proc.returncode == 0:
            wav_bytes = proc.stdout

    return wav_bytes, f"meta-mms-tts ({model_id})"

def synthesize_speech(text: str, language: str = "mr", sample_rate: int = 24000) -> tuple[bytes, str]:
    clean_text = text.strip()
    if not clean_text:
        raise ValueError("Empty text provided for synthesis")

    lang = language.lower().split("-")[0]
    if lang not in ("mr", "hi", "en"):
        lang = "mr"

    try:
        return asyncio.run(synthesize_edge_tts(clean_text, lang, sample_rate))
    except Exception as edge_err:
        print(f"[TTS Service] Edge-TTS notice: {edge_err}. Using local MMS-TTS.")
        try:
            return synthesize_mms_tts(clean_text, lang, sample_rate)
        except Exception as mms_err:
            raise RuntimeError(f"Both Edge-TTS ({edge_err}) and MMS-TTS ({mms_err}) failed")

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    request_queue_size = 64

class TTSHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    timeout = 25

    def handle(self):
        try:
            super().handle()
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def _send_json(self, status: int, data: dict):
        try:
            body = json.dumps(data, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)
        except (ConnectionResetError, ConnectionAbortedError, BrokenPipeError):
            pass

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Connection", "close")
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/health", "/status"):
            self._send_json(200, {
                "service": "neural-tts",
                "ready": True,
                "modelLoaded": True,
                "voices": {
                    "mr": "mr-IN-AarohiNeural",
                    "hi": "hi-IN-SwaraNeural",
                    "en": "en-IN-NeerjaNeural"
                },
                "languages": ["mr", "hi", "en"],
                "sample_rate": 24000,
                "port": PORT,
                "status": "online"
            })
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        if self.path == "/tts":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)

            try:
                req = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                self._send_json(400, {"error": "Invalid JSON payload"})
                return

            text = req.get("text", "").strip()
            language = req.get("language", "mr")
            sample_rate = int(req.get("sample_rate", 24000))
            request_id = req.get("requestId", None)

            if not text:
                self._send_json(400, {"error": "text is required", "requestId": request_id})
                return

            t0 = time.time()
            try:
                wav_bytes, provider = synthesize_speech(text, language, sample_rate)
            except Exception as e:
                print(f"[TTS Service] Synthesis error: {e}")
                self._send_json(500, {"error": f"Synthesis failed: {e}", "requestId": request_id})
                return

            elapsed_ms = int((time.time() - t0) * 1000)
            accept = self.headers.get("Accept", "")

            if "audio" in accept or "octet-stream" in accept:
                self.send_response(200)
                self.send_header("Content-Type", "audio/wav")
                self.send_header("Content-Length", str(len(wav_bytes)))
                self.send_header("Connection", "close")
                self.send_header("X-Provider", provider)
                if request_id:
                    self.send_header("X-Request-Id", request_id)
                self.end_headers()
                self.wfile.write(wav_bytes)
            else:
                b64_audio = base64.b64encode(wav_bytes).decode("ascii")
                self._send_json(200, {
                    "success": True,
                    "audio_base64": b64_audio,
                    "format": "wav",
                    "sample_rate": sample_rate,
                    "language": language,
                    "requestId": request_id,
                    "provider": "neural-tts",
                    "model": provider,
                    "device": RUNTIME_STATE["device"],
                    "latency_ms": elapsed_ms,
                })
        else:
            self._send_json(404, {"error": "Not Found"})

def start_tts_server(host=HOST, port=PORT):
    init_tts_runtime()
    server = ThreadedHTTPServer((host, port), TTSHandler)
    print(f"[TTS Service (Port {port})] Multilingual Neural TTS online at http://{host}:{port}")
    return server

if __name__ == "__main__":
    server = start_tts_server()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[TTS Service] Shutting down.")
        server.server_close()
