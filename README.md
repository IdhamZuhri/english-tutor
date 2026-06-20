# SpeakWell — AI English Speaking Companion

A personal, local AI English speaking practice app. Talk to Alex (your AI companion) by voice, get inline grammar corrections as you speak, and receive a detailed performance breakdown at the end of each session.

---

## Architecture

```
Browser (React + Vite)          Backend (FastAPI)           External APIs
─────────────────────    ───────────────────────────   ─────────────────────
SetupScreen              POST /api/chat                 OpenAI Whisper (STT)
  → topic + duration     ├─ stt.py  → Whisper           Google Gemini (LLM)
ChatScreen      ─────►  ├─ llm.py  → Gemini chat        Google Gemini TTS
  → audio blob           ├─ llm.py  → Gemini corrections
SummaryScreen   ◄─────  └─ tts.py  → Gemini TTS
  → radar chart          POST /api/analyze
                         └─ analysis.py → Gemini scoring
```

**Key design decisions:**
- Two Gemini calls per turn (conversation reply + corrections) run **concurrently** via `asyncio.gather`, adding minimal latency.
- Grammar corrections are **silent** — never spoken aloud — keeping the conversation natural.
- Gemini TTS returns raw PCM → backend wraps in WAV → frontend plays natively. Falls back to browser Web Speech API if Gemini TTS is unavailable.

---

## Prerequisites

- **Python 3.11+** (`python --version`)
- **Node.js 18+** + npm (`node --version`)
- An **OpenAI API key** (for Whisper transcription)
- A **Google Gemini API key** (for conversation, corrections, TTS, and analysis)

---

## Setup & Running

### Step 1 — Clone / navigate to the project

```bash
cd d:\EnglishTutor
```

### Step 2 — Configure API keys

```bash
# Copy the example env file
copy backend\.env.example backend\.env
```

Then open `backend\.env` and fill in your keys:

```env
OPENAI_API_KEY=sk-your-openai-key-here
GEMINI_API_KEY=AIza-your-gemini-key-here
```

### Step 3 — Set up the backend

Open a terminal and run:

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv venv
venv\Scripts\activate       # Windows PowerShell: .\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the backend (stays running)
uvicorn main:app --reload --port 8000
```

You should see:
```
✅ SpeakWell backend started. All API keys found.
INFO:     Uvicorn running on http://127.0.0.1:8000
```

### Step 4 — Set up the frontend

Open a **second terminal** and run:

```bash
cd frontend

# Install dependencies (first time only)
npm install

# Start the dev server
npm run dev
```

You should see:
```
  VITE v5.x  ready in Xms
  ➜  Local:   http://localhost:5173/
```

### Step 5 — Open the app

Navigate to **http://localhost:5173** in your browser.

> ⚠️ **Microphone permissions**: Your browser will ask for mic access the first time you press the record button. Click "Allow".

---

## Optional Configuration

Edit `backend/.env` to tweak:

| Variable           | Default                          | Description                            |
|--------------------|----------------------------------|----------------------------------------|
| `GEMINI_TTS_VOICE` | `Aoede`                          | Voice name: Aoede, Charon, Fenrir, Kore, Puck |
| `GEMINI_MODEL`     | `gemini-2.0-flash`               | Gemini model for chat + analysis       |
| `GEMINI_TTS_MODEL` | `gemini-2.5-flash-preview-tts`   | Gemini TTS model                       |

> **TTS fallback**: If your Gemini API key doesn't have TTS access, the app automatically falls back to your browser's built-in `SpeechSynthesis` API. You'll still hear the companion speak — the voice just won't be Gemini's.

---

## Data Flow (per conversation turn)

```
1. [Browser] User presses mic → MediaRecorder starts (WebM/Opus)
2. [Browser] User releases mic → audio Blob created
3. [Browser → Backend] POST /api/chat (multipart: audio + history + topic)
4. [Backend] Whisper transcribes audio → transcript string
5. [Backend] Gemini (concurrent):
     a. Generate conversational reply
     b. Analyze grammar → correction JSON
6. [Backend] Gemini TTS → PCM → WAV → base64
7. [Backend → Browser] { transcript, corrections, reply_text, reply_audio_b64 }
8. [Browser] Render user bubble (with corrections)
9. [Browser] Render AI bubble + play WAV audio
10. [Browser] When audio ends → return to idle state
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Missing required environment variables" | Check `backend/.env` has both keys |
| Microphone not working | Check browser permissions (🔒 icon in address bar) |
| Empty transcript ("I didn't catch that") | Speak clearly and a bit louder; check mic level in OS settings |
| TTS falls back to browser voice | Your Gemini API key may not have TTS access yet (preview feature) |
| Backend 502 error | Check your OpenAI / Gemini API quotas and key validity |
| Port 8000 already in use | Change port: `uvicorn main:app --port 8001` and update `frontend/vite.config.js` proxy target |
