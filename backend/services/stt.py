"""
Speech-to-Text service using OpenAI Whisper API.
Swap this module to change the STT provider.
"""
import os
import io
import logging
from openai import AsyncOpenAI

logger = logging.getLogger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise RuntimeError("OPENAI_API_KEY environment variable not set.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


async def transcribe_audio(audio_bytes: bytes, content_type: str = "audio/webm") -> str:
    """
    Transcribe audio bytes to text using OpenAI Whisper.

    Args:
        audio_bytes: Raw audio data from the browser (WebM/Opus format by default).
        content_type: MIME type of the audio (e.g. 'audio/webm').

    Returns:
        Transcribed text string.
    """
    client = _get_client()

    # Determine file extension from content type
    ext_map = {
        "audio/webm": "audio.webm",
        "audio/ogg": "audio.ogg",
        "audio/wav": "audio.wav",
        "audio/mp4": "audio.mp4",
        "audio/mpeg": "audio.mp3",
    }
    filename = ext_map.get(content_type.split(";")[0].strip(), "audio.webm")

    audio_file = io.BytesIO(audio_bytes)
    audio_file.name = filename

    logger.info(f"Transcribing {len(audio_bytes)} bytes of {filename}")

    response = await client.audio.transcriptions.create(
        model="whisper-1",
        file=audio_file,
        language="en",
    )

    transcript = response.text.strip()
    logger.info(f"Transcript: {transcript!r}")
    return transcript
