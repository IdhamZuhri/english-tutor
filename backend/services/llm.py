"""
LLM service using Google Gemini API.
Handles conversational replies and grammar correction extraction.
"""
import os
import json
import logging
from typing import List, Dict, Any
from google import genai
from google.genai import types
from google.genai.errors import APIError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

COMPANION_PERSONA = """You are Alex, a warm, encouraging English conversation partner. Your goal is to have natural, genuine conversations — not to teach formally.

Guidelines:
- Speak naturally and authentically, like a real person would.
- Keep replies concise — 2 to 4 sentences, appropriate for spoken conversation.
- Always end your response with a follow-up question or conversational prompt to keep the dialogue flowing.
- Never correct grammar out loud — corrections are handled separately and shown as text annotations.
- Be curious, encouraging, and genuinely interested in what the user is sharing.
- Match the conversational register of the topic naturally.
- If the user makes a mistake, simply continue the conversation naturally without highlighting the error.
- Your tone: warm, relaxed, friendly — like chatting with a knowledgeable friend."""

CORRECTION_PROMPT = """You are an expert English grammar analyst. Analyze this sentence spoken by an English learner:

"{sentence}"

Return a JSON object with this exact structure:
{{
  "has_corrections": true or false,
  "corrected_sentence": "the fully corrected sentence",
  "corrections": [
    {{"original": "incorrect phrase", "corrected": "correct phrase", "explanation": "brief, friendly explanation"}}
  ]
}}

Rules:
- Only flag clear grammatical errors (wrong tense, missing articles, subject-verb disagreement, etc.)
- Do NOT correct informal style, natural pauses, or personal word choice preferences
- If the sentence is already correct, set has_corrections to false and corrections to []
- Keep explanations short (max 8 words) and friendly
- Return ONLY valid JSON, no markdown fences"""

def _is_rate_limit(exception: BaseException) -> bool:
    if isinstance(exception, APIError):
        return exception.code == 429
    return False

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable not set.")
        _client = genai.Client(api_key=api_key)
    return _client


def _get_model() -> str:
    return os.environ.get("GEMINI_MODEL", "gemini-2.0-flash")


def _build_contents(history: List[Dict], new_message: str) -> List[types.Content]:
    """Convert chat history to Gemini content format."""
    contents = []
    for msg in history:
        role = "user" if msg["role"] == "user" else "model"
        contents.append(
            types.Content(role=role, parts=[types.Part(text=msg["content"])])
        )
    contents.append(
        types.Content(role="user", parts=[types.Part(text=new_message)])
    )
    return contents


@retry(
    retry=retry_if_exception(_is_rate_limit),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(4),
    reraise=True
)
async def generate_reply(
    transcript: str,
    history: List[Dict],
    topic: str,
) -> Dict[str, str]:
    """
    Generate a conversational reply from the AI companion.

    Args:
        transcript: The user's latest transcribed speech.
        history: Previous conversation history [{role, content}].
        topic: The session topic (e.g. "Travel").

    Returns:
        Dict with 'reply_text' key.
    """
    client = _get_client()
    model = _get_model()

    system_prompt = f"{COMPANION_PERSONA}\n\nCurrent conversation topic: {topic}"

    # Build opening context if this is the first message
    if not history:
        system_prompt += f"\n\nOpen the conversation naturally with a warm greeting and an engaging question about {topic}. The user has just started a practice session."

    contents = _build_contents(history, transcript)

    logger.info(f"Generating reply for topic={topic!r}, history_len={len(history)}")

    response = await client.aio.models.generate_content(
        model=model,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.85,
            max_output_tokens=300,
        ),
    )

    reply_text = response.text.strip()
    logger.info(f"Reply: {reply_text!r}")
    return {"reply_text": reply_text}


@retry(
    retry=retry_if_exception(_is_rate_limit),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(4),
    reraise=True
)
async def get_opening_message(topic: str) -> str:
    """Generate the companion's opening line for a new session."""
    client = _get_client()
    model = _get_model()

    prompt = f"""You are Alex, a warm English conversation partner. 
Start a new practice conversation naturally about: {topic}
Write ONE opening greeting + ONE engaging question. Keep it to 2 sentences maximum.
Sound genuinely curious and friendly, not like a formal tutor.
Do not say 'Welcome' or 'Let\'s practice' — just dive into natural conversation."""

    response = await client.aio.models.generate_content(
        model=model,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.9,
            max_output_tokens=100,
        ),
    )
    return response.text.strip()


@retry(
    retry=retry_if_exception(_is_rate_limit),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(4),
    reraise=True
)
async def get_corrections(transcript: str) -> Dict[str, Any]:
    """
    Silently analyze a transcript for grammar/structure corrections.

    Args:
        transcript: The user's transcribed sentence.

    Returns:
        Dict with has_corrections, corrected_sentence, and corrections list.
    """
    client = _get_client()
    model = _get_model()

    prompt = CORRECTION_PROMPT.format(sentence=transcript)

    logger.info(f"Getting corrections for: {transcript!r}")

    try:
        response = await client.aio.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=400,
            ),
        )

        raw = response.text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        raw = raw.strip()

        result = json.loads(raw)
        logger.info(f"Corrections: {result}")
        return result

    except (json.JSONDecodeError, Exception) as e:
        logger.warning(f"Correction parsing failed: {e}")
        return {
            "has_corrections": False,
            "corrected_sentence": transcript,
            "corrections": [],
        }
