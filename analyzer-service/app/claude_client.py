import json
from pathlib import Path

from anthropic import Anthropic

from .config import settings
from .frames import frame_to_b64


SYSTEM_PROMPT = """You are a kitchen assistant that looks at frames sampled from a short
social-media video and decides whether the video is a cooking recipe. If it is,
you transcribe it into a clean, structured written recipe.

Rules:
- If the video is clearly NOT a recipe (e.g. travel, fashion, dance, pet, a
  product unboxing with no cooking), set is_recipe=false and leave recipe null.
- A recipe means someone is preparing food: visible ingredients being combined,
  cooked, baked, plated, mixed, etc. A single shot of a finished dish is NOT
  enough; you must see preparation or have a caption that lists steps.
- Use the caption/description the user provides as supporting context.
- Be concise. Ingredients should have `quantity` when visible or implied; use
  null when unknown. Steps should be imperative and ordered.
- Output ONLY valid JSON matching the schema below. No prose, no markdown."""


SCHEMA_HINT = """{
  "is_recipe": boolean,
  "reason": string | null,
  "recipe": null | {
    "title": string,
    "description": string | null,
    "servings": string | null,
    "prep_minutes": integer | null,
    "cook_minutes": integer | null,
    "ingredients": [{"name": string, "quantity": string | null, "notes": string | null}],
    "steps": [string],
    "tags": [string]
  }
}"""


def analyze_frames(frame_paths: list[Path], caption: str | None, title: str | None) -> dict:
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not configured")
    client = Anthropic(api_key=settings.anthropic_api_key)

    content: list[dict] = []
    for p in frame_paths:
        content.append(
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/jpeg",
                    "data": frame_to_b64(p),
                },
            }
        )
    context = (
        f"Post title: {title or '(none)'}\n"
        f"Post caption: {caption or '(none)'}\n\n"
        f"Return JSON only, matching this schema:\n{SCHEMA_HINT}"
    )
    content.append({"type": "text", "text": context})

    resp = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )

    text = "".join(block.text for block in resp.content if getattr(block, "type", None) == "text").strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Claude returned non-JSON output: {text[:200]}") from exc
