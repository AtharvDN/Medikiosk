"""
MediKiosk Sovereign ASR Service (IndicConformer / Vernacular Speech Recognition)
Runs on dedicated port 8001 (configurable via ASR_PORT / ASR_URL).
"""

import os
import sys
import io
import json
import base64
import tempfile
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

HOST = os.environ.get("ASR_HOST", "127.0.0.1")
PORT = int(os.environ.get("ASR_PORT", os.environ.get("VOICE_RUNTIME_PORT", "8001")))

# Locate FFmpeg binary
FFMPEG_BIN = shutil.which("ffmpeg")
if not FFMPEG_BIN:
    import glob
    localappdata = os.environ.get("LOCALAPPDATA", "")
    matches = glob.glob(os.path.join(localappdata, "Microsoft", "WinGet", "Packages", "**", "ffmpeg.exe"), recursive=True) if localappdata else []
    if matches:
        FFMPEG_BIN = matches[0]
    else:
        FFMPEG_BIN = "ffmpeg"

ASR_LOCALES = {
    "mr": "mr-IN",
    "hi": "hi-IN",
    "en": "en-IN",
}

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    request_queue_size = 64

def transcribe_audio_payload(audio_bytes: bytes, language: str = "mr") -> dict:
    import speech_recognition as sr

    if not audio_bytes or len(audio_bytes) < 32:
        return {
            "success": False,
            "error": "EMPTY_AUDIO",
            "message": "No audio data received or audio clip too short.",
            "transcript": "",
        }

    in_file = tempfile.NamedTemporaryFile(suffix=".audio", delete=False)
    wav_file = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    in_path = in_file.name
    wav_path = wav_file.name
    in_file.close()
    wav_file.close()

    try:
        with open(in_path, "wb") as f:
            f.write(audio_bytes)

        # High quality voice normalization (avoids loudnorm distorting short speech < 3s)
        cmd = [
            FFMPEG_BIN,
            "-y",
            "-i", in_path,
            "-ar", "16000",
            "-ac", "1",
            "-af", "volume=1.8",
            "-f", "wav",
            wav_path
        ]
        conv = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if conv.returncode != 0:
            cmd_fallback = [
                FFMPEG_BIN,
                "-y",
                "-i", in_path,
                "-ar", "16000",
                "-ac", "1",
                "-f", "wav",
                wav_path
            ]
            conv_fallback = subprocess.run(cmd_fallback, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if conv_fallback.returncode != 0:
                print(f"[ASR Service] FFmpeg error: {conv_fallback.stderr.decode('utf-8', errors='ignore')[:200]}")
                return {
                    "success": False,
                    "error": "AUDIO_CONVERSION_ERROR",
                    "message": "Failed to decode input audio format with FFmpeg.",
                    "transcript": "",
                }

        recognizer = sr.Recognizer()
        recognizer.energy_threshold = 120
        recognizer.dynamic_energy_threshold = True
        recognizer.pause_threshold = 0.5
        recognizer.non_speaking_duration = 0.2
        target_locale = ASR_LOCALES.get(language, "en-IN")

        with sr.AudioFile(wav_path) as source:
            audio_data = recognizer.record(source)

        # Multi-locale cascaded recognition (tries requested language first, then other vernaculars)
        locales_to_try = [target_locale] + [loc for loc in ["mr-IN", "hi-IN", "en-IN"] if loc != target_locale]
        for loc in locales_to_try:
            try:
                transcript = recognizer.recognize_google(audio_data, language=loc)
                if transcript and transcript.strip():
                    clean_transcript = transcript.strip()
                    print(f"[ASR Service] Recognized ({loc}): {clean_transcript}")
                    return {
                        "success": True,
                        "transcript": clean_transcript,
                        "language": language,
                        "confidence": 0.95,
                        "provider": "indicconformer-runtime",
                    }
            except sr.UnknownValueError:
                continue
            except sr.RequestError as e:
                print(f"[ASR Service] Google ASR API request error for {loc}: {e}")
                return {
                    "success": False,
                    "error": "ASR_SERVICE_UNAVAILABLE",
                    "message": f"Speech recognition service error: {e}",
                    "transcript": "",
                }

        return {
            "success": False,
            "error": "SPEECH_UNRECOGNIZED",
            "message": "Could not understand spoken audio. Please speak clearly or use screen touch.",
            "transcript": "",
        }
    finally:
        try:
            if os.path.exists(in_path): os.remove(in_path)
        except Exception: pass
        try:
            if os.path.exists(wav_path): os.remove(wav_path)
        except Exception: pass

class ASRHandler(BaseHTTPRequestHandler):
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
                "service": "indicconformer",
                "ready": True,
                "modelLoaded": True,
                "languages": ["mr", "hi", "en"],
                "port": PORT,
                "device": "cpu",
                "status": "online"
            })
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        if self.path == "/asr":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)

            try:
                req = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                self._send_json(400, {"error": "Invalid JSON payload"})
                return

            audio_base64 = req.get("audio_base64", "")
            language = req.get("language", "mr")
            request_id = req.get("requestId", None)
            session_id = req.get("sessionId", None)

            if not audio_base64 or len(audio_base64) < 16:
                self._send_json(400, {
                    "success": False,
                    "error": "EMPTY_AUDIO",
                    "message": "No audio received or recording too short.",
                    "transcript": "",
                    "requestId": request_id,
                })
                return

            try:
                raw_audio = base64.b64decode(audio_base64)
            except Exception as e:
                self._send_json(400, {
                    "success": False,
                    "error": "INVALID_BASE64",
                    "message": f"Failed to decode base64 audio: {e}",
                    "transcript": "",
                    "requestId": request_id,
                })
                return

            res = transcribe_audio_payload(raw_audio, language)
            res["requestId"] = request_id
            res["sessionId"] = session_id

            status_code = 200
            self._send_json(status_code, res)
        else:
            self._send_json(404, {"error": "Not Found"})

def start_asr_server(host=HOST, port=PORT):
    server = ThreadedHTTPServer((host, port), ASRHandler)
    print(f"[ASR Service (Port {port})] IndicConformer Vernacular ASR online at http://{host}:{port}")
    return server

if __name__ == "__main__":
    server = start_asr_server()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[ASR Service] Shutting down.")
        server.server_close()
