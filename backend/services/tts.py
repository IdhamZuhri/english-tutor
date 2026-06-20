"""
Text-to-Speech service using Gemini TTS API.
Falls back gracefully — returns None if TTS is unavailable,
signaling the frontend to use Web Speech API fallback.
"""
import os
import base64
import struct
import io
import logging
from google import genai
from google.genai import types

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable not set.")
        _client = genai.Client(api_key=api_key)
    return _client


def _pcm_to_wav(
    pcm_data: bytes,
    sample_rate: int = 24000,
    channels: int = 1,
    bits_per_sample: int = 16,
) -> bytes:
    """Wrap raw PCM bytes in a WAV container so browsers can play it."""
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8

    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))           # chunk size
    buf.write(struct.pack("<H", 1))            # PCM format
    buf.write(struct.pack("<H", channels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", byte_rate))
    buf.write(struct.pack("<H", block_align))
    buf.write(struct.pack("<H", bits_per_sample))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_data)
    return buf.getvalue()


async def synthesize_speech(text: str) -> str | None:
    """
    Convert text to speech using Gemini TTS.

    Args:
        text: The text to synthesize.

    Returns:
        Base64-encoded WAV audio string, or None if TTS is unavailable.
        When None is returned, the frontend should use Web Speech API fallback.
    """
    client = _get_client()
    tts_model = os.environ.get("GEMINI_TTS_MODEL", "gemini-2.5-flash-preview-tts")
    voice_name = os.environ.get("GEMINI_TTS_VOICE", "Aoede")

    logger.info(f"Synthesizing TTS with model={tts_model}, voice={voice_name}")

    try:
        response = await client.aio.models.generate_content(
            model=tts_model,
            contents=text,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
                speech_config=types.SpeechConfig(
                    voice_config=types.VoiceConfig(
                        prebuilt_voice_config=types.PrebuiltVoiceConfig(
                            voice_name=voice_name
                        )
                    )
                ),
            ),
        )

        part = response.candidates[0].content.parts[0]
        if not part.inline_data:
            logger.warning("Gemini TTS returned no inline_data — falling back.")
            return None

        audio_b64 = part.inline_data.data        # base64-encoded PCM
        mime_type = part.inline_data.mime_type   # e.g. "audio/L16;rate=24000"

        logger.info(f"TTS response mime_type={mime_type}, data_len={len(audio_b64)}")

        # Parse sample rate from mime type if available
        sample_rate = 24000
        if "rate=" in mime_type:
            try:
                sample_rate = int(mime_type.split("rate=")[1].split(";")[0])
            except ValueError:
                pass

        # Decode base64 → raw PCM bytes → WAV container
        pcm_bytes = base64.b64decode(audio_b64)
        wav_bytes = _pcm_to_wav(pcm_bytes, sample_rate=sample_rate)

        return base64.b64encode(wav_bytes).decode("utf-8")

    except Exception as e:
        logger.warning(f"Gemini TTS failed ({type(e).__name__}: {e}) — falling back to browser TTS.")
        return None
