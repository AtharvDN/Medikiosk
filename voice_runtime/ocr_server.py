"""
MediKiosk Sovereign OCR Service (PaddleOCR Devanagari + English)
Runs on dedicated port 8002 (configurable via OCR_PORT / OCR_URL).
"""

import os
import sys
import io
import json
import base64
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

HOST = os.environ.get("OCR_HOST", "127.0.0.1")
PORT = int(os.environ.get("OCR_PORT", "8002"))

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True
    request_queue_size = 64

class OCRHandler(BaseHTTPRequestHandler):
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
                "service": "paddleocr",
                "ready": True,
                "modelLoaded": True,
                "model": "devanagari_PP-OCRv5_mobile_rec",
                "languages": ["mr", "hi", "en"],
                "port": PORT,
                "status": "online"
            })
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        if self.path == "/ocr":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)

            try:
                req = json.loads(body_bytes.decode("utf-8"))
            except Exception:
                self._send_json(400, {"error": "Invalid JSON payload"})
                return

            image_base64 = req.get("image_base64", "")
            file_name = req.get("fileName", "document.jpg")
            request_id = req.get("requestId", None)
            session_id = req.get("sessionId", None)

            if not image_base64 or len(image_base64) < 16:
                self._send_json(400, {
                    "success": False,
                    "error": "EMPTY_OR_CORRUPT_FILE",
                    "message": "Uploaded file is empty or corrupted.",
                    "ocrText": "",
                    "confidence": 0.0,
                    "processingStatus": "FAILED",
                    "requestId": request_id,
                })
                return

            try:
                raw_image = base64.b64decode(image_base64)
            except Exception as e:
                self._send_json(400, {
                    "success": False,
                    "error": "INVALID_BASE64",
                    "message": f"Failed to decode base64 image: {e}",
                    "ocrText": "",
                    "confidence": 0.0,
                    "processingStatus": "FAILED",
                    "requestId": request_id,
                })
                return

            try:
                try:
                    from voice_runtime.ocr_runtime import process_image
                except ModuleNotFoundError:
                    from ocr_runtime import process_image
                ocr_res = process_image(raw_image)
            except Exception as ocr_err:
                print(f"[OCR Service] Processing error: {ocr_err}")
                ocr_res = {
                    "success": False,
                    "error": "OCR_INFERENCE_ERROR",
                    "message": f"OCR processing failed: {ocr_err}",
                    "ocrText": "",
                    "confidence": 0.0,
                    "processingStatus": "FAILED",
                }

            ocr_res["requestId"] = request_id
            ocr_res["sessionId"] = session_id
            ocr_res["fileName"] = file_name
            self._send_json(200, ocr_res)
        else:
            self._send_json(404, {"error": "Not Found"})

import threading

def start_ocr_server(host=HOST, port=PORT):
    server = ThreadedHTTPServer((host, port), OCRHandler)
    print(f"[OCR Service (Port {port})] PaddleOCR Devanagari OCR online at http://{host}:{port}")

    def _warmup():
        try:
            try:
                from voice_runtime.ocr_runtime import get_ocr_engine
            except ModuleNotFoundError:
                from ocr_runtime import get_ocr_engine
            print(f"[OCR Service (Port {port})] Pre-warming PaddleOCR Devanagari engine in background...")
            get_ocr_engine()
            print(f"[OCR Service (Port {port})] PaddleOCR engine pre-warmed and ready.")
        except Exception as e:
            print(f"[OCR Service (Port {port})] Note on OCR pre-warming: {e}")

    threading.Thread(target=_warmup, daemon=True).start()
    return server

if __name__ == "__main__":
    server = start_ocr_server()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[OCR Service] Shutting down.")
        server.server_close()
