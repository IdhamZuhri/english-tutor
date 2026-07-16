"""
Session analysis service using OpenAI API.
Analyzes a full conversation transcript and returns structured performance scores.
"""
import os
import json
import logging
from typing import List, Dict, Any
from openai import AsyncOpenAI, RateLimitError
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

ANALYSIS_PROMPT = """You are an expert English language assessor. Analyze this English speaking practice session between a learner (User) and an AI companion (Alex).

Conversation transcript:
{transcript}

Evaluate the learner's English performance and return a JSON object with EXACTLY this structure:
{{
  "summary": "2-3 sentence overall impression of the session, warm and encouraging in tone",
  "scores": {{
    "grammar": <integer 0-100>,
    "fluency": <integer 0-100>,
    "vocabulary": <integer 0-100>,
    "pronunciation": <integer 0-100>
  }},
  "filler_count": <integer — count of filler words: um, uh, like, you know, well, kind of, sort of, basically, literally, actually (used as filler)>,
  "justifications": {{
    "grammar": "1-2 sentence explanation of the grammar score",
    "fluency": "1-2 sentence explanation of the fluency score",
    "vocabulary": "1-2 sentence explanation of the vocabulary score",
    "pronunciation": "1-2 sentence explanation (note: estimated from transcript patterns since no acoustic data)",
    "filler_words": "brief comment on filler word usage"
  }}
}}

Scoring guidelines:
- grammar: Accuracy of grammatical structures (tense, articles, prepositions, subject-verb agreement)
- fluency: Natural flow, sentence completion, minimal repetition or self-correction
- vocabulary: Range and appropriateness of word choice beyond basic level
- pronunciation: ESTIMATED from transcript only — infer from patterns like incomplete words, unusual word choices that suggest mishearing, filler frequency, sentence fragment patterns. Label conservatively.
- filler_count: Exact count of filler words/phrases in user messages only

Be encouraging and constructive. Scores of 60-80 represent solid intermediate learners.
Return ONLY valid JSON."""

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

def _format_transcript(history: List[Dict]) -> str:
    """Format conversation history as a readable transcript."""
    lines = []
    for msg in history:
        role = "User" if msg["role"] == "user" else "Alex"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)

@retry(
    retry=retry_if_exception(_is_rate_limit),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    stop=stop_after_attempt(4),
    reraise=True
)
async def analyze_session(history: List[Dict]) -> Dict[str, Any]:
    """
    Analyze a full session transcript and return structured performance scores.
    """
    client = _get_client()
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    # Filter to only user messages for analysis
    user_messages = [m for m in history if m["role"] == "user"]
    if not user_messages:
        return _empty_analysis()

    transcript = _format_transcript(history)
    prompt = ANALYSIS_PROMPT.format(transcript=transcript)

    logger.info(f"Analyzing session with {len(user_messages)} user turns")

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        raw = response.choices[0].message.content.strip()
        result = json.loads(raw)

        # Validate and clamp scores to 0-100
        for key in ["grammar", "fluency", "vocabulary", "pronunciation"]:
            result["scores"][key] = max(0, min(100, int(result["scores"].get(key, 70))))

        result["filler_count"] = max(0, int(result.get("filler_count", 0)))

        logger.info(f"Analysis complete: {result['scores']}")
        return result

    except Exception as e:
        logger.error(f"Session analysis failed: {e}")
        return _empty_analysis(error=str(e))

def _empty_analysis(error: str | None = None) -> Dict[str, Any]:
    """Return a safe fallback when analysis fails."""
    return {
        "summary": "Not enough data to generate a full analysis. Keep practicing — every session counts!",
        "scores": {"grammar": 0, "fluency": 0, "vocabulary": 0, "pronunciation": 0},
        "filler_count": 0,
        "justifications": {
            "grammar": "Insufficient data.",
            "fluency": "Insufficient data.",
            "vocabulary": "Insufficient data.",
            "pronunciation": "Insufficient data.",
            "filler_words": error or "Insufficient data.",
        },
    }
