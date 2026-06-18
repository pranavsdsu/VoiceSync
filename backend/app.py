"""VoiceSync Flask backend.

Pipeline:
  /api/transcribe  audio  -> text   (faster-whisper, local)
  /api/chat        text   -> reply  (RAG retrieve + Ollama local LLM)
  /api/speak       text   -> wav + lipsync cues (pyttsx3 + Rhubarb)
  /api/ingest      text   -> store in MongoDB vector store

Everything runs locally. No paid APIs.
"""
import os
import json
import uuid
import subprocess
import tempfile

import requests
from dotenv import load_dotenv
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

from rag import RagStore

load_dotenv()

app = Flask(__name__)
CORS(app)

AUDIO_DIR = os.path.join(os.path.dirname(__file__), "audio_out")
os.makedirs(AUDIO_DIR, exist_ok=True)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

# lazy singletons
_whisper = None
_rag = None


def whisper():
    global _whisper
    if _whisper is None:
        from faster_whisper import WhisperModel
        _whisper = WhisperModel(
            os.getenv("WHISPER_MODEL", "base"), device="cpu", compute_type="int8"
        )
    return _whisper


def rag():
    global _rag
    if _rag is None:
        _rag = RagStore()
    return _rag


@app.get("/api/health")
def health():
    return jsonify({"ok": True, "model": OLLAMA_MODEL})


@app.post("/api/transcribe")
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "no audio file"}), 400
    f = request.files["audio"]
    with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
        f.save(tmp.name)
        path = tmp.name
    try:
        segments, _ = whisper().transcribe(path, beam_size=1)
        text = " ".join(s.text for s in segments).strip()
    finally:
        os.unlink(path)
    return jsonify({"text": text})


@app.post("/api/ingest")
def ingest():
    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "empty text"}), 400
    # naive chunking by paragraph
    chunks = [c.strip() for c in text.split("\n\n") if c.strip()] or [text]
    n = rag().add_many(chunks, source=data.get("source", "upload"))
    return jsonify({"added": n, "total": rag().count()})


@app.post("/api/chat")
def chat():
    data = request.get_json(force=True)
    query = data.get("text", "").strip()
    if not query:
        return jsonify({"error": "empty text"}), 400

    # RAG retrieve
    hits = []
    try:
        hits = rag().search(query, k=4)
    except Exception as e:
        app.logger.warning("RAG skipped: %s", e)

    context = "\n\n".join(h["text"] for h in hits)
    system = (
        "You are VoiceSync, a friendly voice assistant. Answer briefly and "
        "conversationally. Use the context if relevant.\n\nContext:\n" + context
    )
    payload = {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": query},
        ],
        "stream": False,
    }
    r = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=120)
    r.raise_for_status()
    reply = r.json()["message"]["content"].strip()
    return jsonify({"reply": reply, "sources": [h.get("source") for h in hits]})


@app.post("/api/speak")
def speak():
    """Text -> wav (pyttsx3) -> lipsync cues (Rhubarb if installed)."""
    data = request.get_json(force=True)
    text = data.get("text", "").strip()
    if not text:
        return jsonify({"error": "empty text"}), 400

    uid = uuid.uuid4().hex[:8]
    aiff_path = os.path.join(AUDIO_DIR, f"{uid}.aiff")
    wav_path = os.path.join(AUDIO_DIR, f"{uid}.wav")

    # macOS native TTS -> aiff, then convert to PCM wav (Rhubarb + browser need wav)
    subprocess.run(["say", "-o", aiff_path, text], check=True, timeout=60)
    subprocess.run(
        ["afconvert", "-f", "WAVE", "-d", "LEI16", aiff_path, wav_path],
        check=True, timeout=60,
    )
    os.remove(aiff_path)

    lipsync = run_rhubarb(wav_path)
    return jsonify({"audio_url": f"/api/audio/{uid}.wav", "lipsync": lipsync})


def run_rhubarb(wav_path):
    """Return Rhubarb mouth cues, or [] if Rhubarb not installed."""
    rhubarb_bin = os.path.join(os.path.dirname(__file__), "rhubarb", "rhubarb")
    if not os.path.exists(rhubarb_bin):
        rhubarb_bin = "rhubarb"  # fall back to PATH
    try:
        out = subprocess.run(
            [rhubarb_bin, "-f", "json", "--quiet", wav_path],
            capture_output=True, text=True, timeout=60,
        )
        if out.returncode == 0:
            return json.loads(out.stdout).get("mouthCues", [])
    except (FileNotFoundError, subprocess.TimeoutExpired, json.JSONDecodeError):
        pass
    return []


@app.get("/api/audio/<name>")
def audio(name):
    return send_file(os.path.join(AUDIO_DIR, name), mimetype="audio/wav")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
