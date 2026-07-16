"""
Speech-to-Text service using Google Gemini API (inline audio transcription).
Swap this module to change the STT provider.
"""
import os
import logging
from google import genai
from google.genai import types
from google.genai.errors import APIError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

_client: genai.Client | None = None

STT_PROMPT = (
    "Transcribe the following audio exactly as spoken by the user. "
    "Return ONLY the transcribed words — no punctuation fixes, no commentary, no explanation. "
    "If the audio contains only silence, background noise, breathing, or is inaudible, "
    "return exactly this and nothing else: [EMPTY]"
)

def _is_rate_limit(exception: BaseException) -> bool:
    if isinstance(exception, APIError):
        # 429 means Too Many Requests / Quota Exceeded
        return exception.code == 429
    return False

def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable not set.")
        _client = genai.Client(api_key=api_key)
    return _client


@retry(
    retry=retry_if_exception(_is_rate_limit),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(4),
    reraise=True
)
async def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/webm") -> str:
    """
    Transcribe audio bytes to text using Google Gemini inline audio.

    Args:
        audio_bytes: Raw audio data from the browser (WebM/Opus format by default).
        content_type: MIME type of the audio (e.g. 'audio/webm').

    Returns:
        Transcribed text string.
    """
    client = _get_client()

    # Use GEMINI_STT_MODEL if set, otherwise fall back to GEMINI_MODEL
    model = os.environ.get("GEMINI_STT_MODEL") or os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")

    # Normalise content type (strip codec params like 'audio/webm;codecs=opus')
    mime_type = content_type.split(";")[0].strip()

    # Gemini supports: audio/wav, audio/mp3, audio/aiff, audio/aac, audio/ogg,
    # audio/flac, audio/webm — fall back to audio/webm for anything unknown.
    supported = {
        "audio/wav", "audio/mp3", "audio/mpeg", "audio/aiff",
        "audio/aac", "audio/ogg", "audio/flac", "audio/webm",
    }
    if mime_type not in supported:
        mime_type = "audio/webm"

    logger.info(f"Transcribing {len(audio_bytes)} bytes via Gemini model={model} ({mime_type})")

    response = await client.aio.models.generate_content(
        model=model,
        contents=[
            types.Content(
                role="user",
                parts=[
                    types.Part(text=STT_PROMPT),
                    types.Part(
                        inline_data=types.Blob(
                            mime_type=mime_type,
                            data=audio_bytes,  # SDK handles base64 encoding internally
                        )
                    ),
                ],
            )
        ],
        config=types.GenerateContentConfig(
            temperature=0.0,
            max_output_tokens=500,
        ),
    )

    transcript = response.text.strip()
    logger.info(f"Transcript: {transcript!r}")
    return transcript
