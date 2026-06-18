# VoiceSync — RAG-Powered Voice Assistant (100% free, local)

Voice assistant: speak → transcribe → RAG retrieve → local LLM reply → speech + 3D lip-sync.
No paid APIs. Everything runs on your machine + MongoDB Atlas free tier.

## Stack
- **Frontend:** React + React Three Fiber (3D avatar + lip-sync)
- **Backend:** Flask
- **STT:** faster-whisper (local)
- **LLM:** Ollama `llama3.2:3b` (local)
- **TTS:** pyttsx3 (local)
- **Embeddings:** sentence-transformers `all-MiniLM-L6-v2`
- **Vector store:** MongoDB Atlas (free M0, brute-force cosine)
- **Lip-sync:** Rhubarb Lip Sync (optional, see below)

## Prerequisites
- Python 3.11, Node 18+, Ollama running (`brew services start ollama`)
- Model: `ollama pull llama3.2:3b`
- MongoDB Atlas free cluster + connection string
- (Optional) Rhubarb: `brew install rhubarb-lip-sync` — without it, avatar still moves on a simple fallback

## Setup
```bash
# backend
cd backend
cp .env.example .env        # fill MONGO_URI
python3.11 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python app.py    # http://localhost:5001

# frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

## Add knowledge (RAG)
```bash
curl -X POST localhost:5001/api/ingest \
  -H 'Content-Type: application/json' \
  -d '{"text":"VoiceSync was built by Pranav. It uses local models."}'
```

## Avatar
Default uses a public ReadyPlayerMe model. Make your own at https://readyplayer.me,
append `?morphTargets=Oculus%20Visemes` to the `.glb` URL, set it in `frontend/src/App.jsx`.

## Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/transcribe | audio → text |
| POST | /api/chat | text → RAG+LLM reply |
| POST | /api/speak | text → wav + lipsync cues |
| POST | /api/ingest | store text in vector DB |
| GET  | /api/health | status |
