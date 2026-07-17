from pydantic import BaseModel
from typing import List, Optional, Any


class Correction(BaseModel):
    original: str
    corrected: str
    explanation: str


class CorrectionsResult(BaseModel):
    has_corrections: bool
    corrected_sentence: str
    corrections: List[Correction]


class HistoryMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatResponse(BaseModel):
    transcript: str
    corrections: CorrectionsResult
    reply_text: str
    reply_audio_b64: Optional[str] = None
    tts_fallback: bool = False
    error: Optional[str] = None
    message: Optional[str] = None


class AnalyzeRequest(BaseModel):
    session_id: int
    history: List[HistoryMessage]


class ScoreBreakdown(BaseModel):
    grammar: int
    fluency: int
    vocabulary: int
    pronunciation: int


class AnalyzeResponse(BaseModel):
    summary: str
    scores: ScoreBreakdown
    filler_count: int
    justifications: dict
