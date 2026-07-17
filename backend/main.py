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
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database import engine, Base, get_db
from db_models import Session, Message


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
REQUIRED_ENV_VARS = ["OPENAI_API_KEY"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Database Tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

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
async def opening(topic: str = "Small Talk", db: AsyncSession = Depends(get_db)):
    """Generate the companion's opening message for a session."""
    try:
        # Create a new session in the DB
        db_session = Session(topic=topic)
        db.add(db_session)
        await db.commit()
        await db.refresh(db_session)

        message = await get_opening_message(topic)
        return {
            "session_id": db_session.id,
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
    session_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
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

        # Save to DB
        db_msg_user = Message(
            session_id=session_id,
            role="user",
            content=transcript,
            corrections_json=corrections.get("corrections", []) if corrections.get("has_corrections") else []
        )
        db.add(db_msg_user)

        db_msg_assistant = Message(
            session_id=session_id,
            role="assistant",
            content=reply_result["reply_text"]
        )
        db.add(db_msg_assistant)
        await db.commit()

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
async def analyze(request: AnalyzeRequest, db: AsyncSession = Depends(get_db)):
    """
    Analyze the full session transcript and return structured performance scores.
    Called when the session ends (timer expires or user manually ends).
    """
    try:
        if not request.history:
            raise HTTPException(status_code=400, detail="No conversation history provided.")

        history_dicts = [msg.model_dump() for msg in request.history]
        result = await analyze_session(history_dicts)

        # Save to DB
        db_session = await db.get(Session, request.session_id)
        if db_session:
            db_session.grammar_score = result["scores"]["grammar"]
            db_session.fluency_score = result["scores"]["fluency"]
            db_session.vocabulary_score = result["scores"]["vocabulary"]
            db_session.pronunciation_score = result["scores"]["pronunciation"]
            db_session.filler_count = result["filler_count"]
            db_session.summary = result["summary"]
            db_session.justifications = result["justifications"]
            await db.commit()

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in /api/analyze: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ─── Sessions Retrieval ───────────────────────────────────────────────────────

@app.get("/api/sessions")
async def get_sessions(db: AsyncSession = Depends(get_db)):
    """Fetch past sessions for the homepage."""
    from sqlalchemy import select, desc
    try:
        result = await db.execute(
            select(Session)
            .where(Session.summary.is_not(None))
            .order_by(desc(Session.created_at))
            .limit(10)
        )
        sessions = result.scalars().all()
        return [
            {
                "id": s.id,
                "topic": s.topic,
                "created_at": s.created_at,
                "grammar_score": s.grammar_score,
                "fluency_score": s.fluency_score,
                "vocabulary_score": s.vocabulary_score,
                "pronunciation_score": s.pronunciation_score
            }
            for s in sessions
        ]
    except Exception as e:
        logger.error(f"Error fetching sessions: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch sessions")

@app.get("/api/sessions/{session_id}")
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Fetch a specific session's details and messages for the summary screen."""
    from sqlalchemy import select
    try:
        session_result = await db.execute(select(Session).where(Session.id == session_id))
        session = session_result.scalars().first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
            
        messages_result = await db.execute(select(Message).where(Message.session_id == session_id).order_by(Message.created_at))
        messages = messages_result.scalars().all()
        
        return {
            "summary": session.summary,
            "topic": session.topic,
            "scores": {
                "grammar": session.grammar_score,
                "fluency": session.fluency_score,
                "vocabulary": session.vocabulary_score,
                "pronunciation": session.pronunciation_score,
            },
            "filler_count": session.filler_count,
            "justifications": session.justifications,
            "history": [{"role": m.role, "content": m.content, "corrections": m.corrections_json} for m in messages]
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching session {session_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch session")

