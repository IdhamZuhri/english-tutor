"""
Speech-to-Text service using OpenAI API (Whisper).
"""
import io
import os
import logging
from openai import AsyncOpenAI, RateLimitError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None

# Provide context rather than instructions, as instructions can cause Whisper to truncate audio
STT_PROMPT = (
    "This is a transcript of an English learning session between a student and a tutor. "
    "The student is practicing their spoken English."
)

def _is_rate_limit(exception: BaseException) -> bool:
    return isinstance(exception, RateLimitError)

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key or api_key == "your_openai_api_key_here":
            raise RuntimeError("OPENAI_API_KEY environment variable not set or invalid.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

@retry(
    retry=retry_if_exception(_is_rate_limit),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(4),
    reraise=True
)
async def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/webm") -> str:
    """
    Transcribe audio bytes to text using OpenAI Whisper.

    Args:
        audio_bytes: Raw audio data from the browser.
        content_type: MIME type of the audio.

    Returns:
        Transcribed text string.
    """
    client = _get_client()
    model = os.environ.get("OPENAI_STT_MODEL", "whisper-1")

    logger.info(f"Transcribing {len(audio_bytes)} bytes via OpenAI model={model}")

    ext = "webm"
    if "mp4" in content_type or "m4a" in content_type:
        ext = "m4a"
    elif "ogg" in content_type:
        ext = "ogg"
    elif "wav" in content_type:
        ext = "wav"
        
    # Bulletproof magic bytes finder to strip any garbage prefix
    magic_bytes = [
        b"\x1a\x45\xdf\xa3",  # WebM
        b"OggS",              # OGG
        b"RIFF",              # WAV
        b"ftyp",              # MP4/M4A (usually preceded by 4 bytes of length, but we can search for ftyp)
        b"ID3"                # MP3
    ]
    
    start_idx = 0
    for magic in magic_bytes:
        idx = audio_bytes.find(magic)
        if idx != -1:
            if magic == b"ftyp":
                # ftyp is usually preceded by a 4-byte size integer, so we step back 4 bytes if possible
                start_idx = max(0, idx - 4)
            else:
                start_idx = idx
            break
            
    if start_idx > 0:
        logger.info(f"Stripping {start_idx} bytes of garbage prefix from audio file.")
        audio_bytes = audio_bytes[start_idx:]

    response = await client.audio.transcriptions.create(
        model=model,
        file=(f"audio.{ext}", audio_bytes),
        prompt=STT_PROMPT,
        temperature=0.0
    )

    transcript = response.text.strip()
    logger.info(f"Transcript: {transcript!r}")
    
    # Optional fallback if it still transcribes silence incorrectly (whisper hallucination)
    if not transcript:
        return "[EMPTY]"
        
    return transcript
