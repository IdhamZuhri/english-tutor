import asyncio
import os
from dotenv import load_dotenv
load_dotenv(override=True)
from services.llm import _get_client, _get_model

async def main():
    client = _get_client()
    model = _get_model()
    prompt = """You are Alex, a warm English conversation partner. 
Start a new practice conversation naturally about: Small Talk
Write ONE opening greeting + ONE engaging question. Keep it to 2 sentences maximum.
Sound genuinely curious and friendly, not like a formal tutor.
Do not say 'Welcome' or 'Let's practice' — just dive into natural conversation."""
    response = await client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_completion_tokens=100
    )
    print("Full response:")
    print(response)

asyncio.run(main())
