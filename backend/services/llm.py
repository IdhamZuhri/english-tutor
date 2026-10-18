"""
LLM service using OpenAI API.
Handles conversational replies and grammar correction extraction.
"""
import os
import json
import logging
from typing import List, Dict, Any
from openai import AsyncOpenAI, RateLimitError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

COMPANION_PERSONA = """You are Alex, a warm, encouraging English conversation partner. Your goal is to have natural, genuine conversations — not to teach formally.

Guidelines:
- Speak naturally and authentically, like a real person would.
- Keep replies extremely concise — strictly 1 to 2 short sentences, appropriate for spoken conversation.
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
- Return ONLY valid JSON."""

def _is_rate_limit(exception: BaseException) -> bool:
    return isinstance(exception, RateLimitError)

_client: AsyncOpenAI | None = None

def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY", "").strip()
        if not api_key or api_key == "your_openai_api_key_here":
            raise RuntimeError("OPENAI_API_KEY environment variable not set or invalid.")
        _client = AsyncOpenAI(api_key=api_key)
    return _client

def _get_model() -> str:
    return os.environ.get("OPENAI_MODEL", "gpt-6-luna")

def _build_messages(history: List[Dict], new_message: str, system_prompt: str) -> List[Dict[str, str]]:
    """Convert chat history to OpenAI message format."""
    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        # Map roles if needed, though they should already be 'user' or 'assistant'
        role = "user" if msg["role"] == "user" else "assistant"
        messages.append({"role": role, "content": msg["content"]})
    
    messages.append({"role": "user", "content": new_message})
    return messages

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
    """
    client = _get_client()
    model = _get_model()

    system_prompt = f"{COMPANION_PERSONA}\n\nCurrent conversation topic: {topic}"

    # Build opening context if this is the first message
    if not history:
        system_prompt += "\n\nOpen the conversation naturally with a warm greeting and an engaging question. The user has just started a practice session."

    messages = _build_messages(history, transcript, system_prompt)

    logger.info(f"Generating reply for topic={topic!r}, history_len={len(history)}")

    response = await client.chat.completions.create(
        model=model,
        messages=messages,
    )

    reply_text = response.choices[0].message.content.strip()
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
Do not say 'Welcome' or 'Let's practice' — just dive into natural conversation."""

    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content.strip()

@retry(
    retry=retry_if_exception(_is_rate_limit),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(4),
    reraise=True
)
async def get_corrections(transcript: str) -> Dict[str, Any]:
    """
    Silently analyze a transcript for grammar/structure corrections.
    """
    client = _get_client()
    model = _get_model()

    prompt = CORRECTION_PROMPT.format(sentence=transcript)
    logger.info(f"Getting corrections for: {transcript!r}")

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        raw = response.choices[0].message.content.strip()
        result = json.loads(raw)
        logger.info(f"Corrections: {result}")
        return result

    except Exception as e:
        logger.warning(f"Correction parsing failed: {e}")
        return {
            "has_corrections": False,
            "corrected_sentence": transcript,
            "corrections": [],
        }
