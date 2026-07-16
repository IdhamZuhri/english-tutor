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

STT_PROMPT = (
    "Transcribe the following audio exactly as spoken by the user. "
    "Return ONLY the transcribed words — no punctuation fixes, no commentary, no explanation. "
    "If the audio contains only silence, background noise, breathing, or is inaudible, "
    "return exactly this and nothing else: [EMPTY]"
)

def _is_rate_limit(exception: BaseException) -> bool:
    return isinstance(exception, RateLimitError)

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
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

    # OpenAI requires a file-like object with a named extension
    file_obj = io.BytesIO(audio_bytes)
    file_obj.name = "audio.webm"

    response = await client.audio.transcriptions.create(
        model=model,
        file=file_obj,
        prompt=STT_PROMPT,
        temperature=0.0
    )

    transcript = response.text.strip()
    logger.info(f"Transcript: {transcript!r}")
    
    # Optional fallback if it still transcribes silence incorrectly (whisper hallucination)
    if not transcript:
        return "[EMPTY]"
        
    return transcript
