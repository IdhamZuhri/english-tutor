"""
SpeakWell Backend — FastAPI Application
Orchestrates STT, LLM conversation, grammar correction, TTS, and session analysis.
"""
import asyncio
import json
import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(override=True)

from models import AnalyzeRequest
from services.analysis import analyze_session
from services.llm import generate_reply, get_corrections, get_opening_message
from services.stt import transcribe_audio

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Validate required env vars on startup
REQUIRED_ENV_VARS = ["GEMINI_API_KEY"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
    if missing:
        logger.error(f"Missing required environment variables: {missing}")
        logger.error("Please copy backend/.env.example to backend/.env and fill in your API keys.")
    else:
        logger.info("✅ SpeakWell backend started. All API keys found.")
    yield


app = FastAPI(
    title="SpeakWell API",
    description="AI English Speaking Companion — local backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    missing = [v for v in REQUIRED_ENV_VARS if not os.environ.get(v)]
    return {
        "status": "ok",
        "missing_keys": missing,
        "ready": len(missing) == 0,
    }


# ─── Opening Message ──────────────────────────────────────────────────────────

@app.get("/api/opening")
async def opening(topic: str = "Small Talk"):
    """Generate the companion's opening message for a session."""
    try:
        message = await get_opening_message(topic)
        return {
            "reply_text": message,
            "reply_audio_b64": None,
            "tts_fallback": False,
        }
    except Exception as e:
        logger.error(f"Opening message error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── Chat Turn ────────────────────────────────────────────────────────────────

@app.post("/api/chat")
async def chat(
    audio: UploadFile = File(...),
    history: str = Form(...),
    topic: str = Form(default="Small Talk"),
):
    """
    Full turn cycle:
    1. Receive audio from browser
    2. Transcribe via Whisper
    3. Generate conversational reply + grammar corrections (concurrent)
    4. Synthesize TTS audio
    5. Return everything to frontend
    """
    try:
        audio_bytes = await audio.read()
        content_type = audio.content_type or "audio/webm"

        # Check for empty/silent audio — WebM containers are always a few KB even when silent
        if len(audio_bytes) < 8000:
            return JSONResponse(
                {
                    "error": "silent",
                    "message": "I didn't catch that — could you try speaking again?",
                }
            )

        # Step 1: Transcribe
        try:
            transcript = await transcribe_audio(audio_bytes, content_type)
        except Exception as e:
            logger.error(f"STT failed: {e}")
            raise HTTPException(
                status_code=502,
                detail=f"Transcription service error: {str(e)}",
            )

        # Reject empty transcripts or suspiciously short ones (likely hallucinated silence)
        if not transcript or transcript.strip() == "[EMPTY]" or len(transcript.strip().split()) < 2:
            return JSONResponse(
                {
                    "error": "empty",
                    "message": "I didn't catch that — could you try speaking again?",
                }
            )

        history_list = json.loads(history)

        # Steps 2+3: Generate reply AND corrections concurrently
        try:
            reply_result, corrections = await asyncio.gather(
                generate_reply(transcript, history_list, topic),
                get_corrections(transcript),
            )
        except Exception as e:
            logger.error(f"LLM failed: {e}")
            raise HTTPException(
                status_code=502,
                detail=f"Language model error: {str(e)}",
            )

        # TTS disabled — text-only mode
        audio_b64 = None

        return {
            "transcript": transcript,
            "corrections": corrections,
            "reply_text": reply_result["reply_text"],
            "reply_audio_b64": None,
            "tts_fallback": False,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in /api/chat: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# ─── Session Analysis ─────────────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze(request: AnalyzeRequest):
    """
    Analyze the full session transcript and return structured performance scores.
    Called when the session ends (timer expires or user manually ends).
    """
    try:
        if not request.history:
            raise HTTPException(status_code=400, detail="No conversation history provided.")

        history_dicts = [msg.model_dump() for msg in request.history]
        result = await analyze_session(history_dicts)
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in /api/analyze: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

