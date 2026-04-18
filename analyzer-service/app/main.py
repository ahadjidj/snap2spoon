import logging
import shutil
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from .claude_client import analyze_frames
from .config import settings
from .downloader import DownloadError, download
from .frames import extract_frames

logger = logging.getLogger("analyzer")
app = FastAPI(title="snap2spoon analyzer", version="0.1.0")


class AnalyzeRequest(BaseModel):
    url: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
def analyze(req: AnalyzeRequest):
    job_dir = Path(settings.work_dir) / uuid.uuid4().hex
    job_dir.mkdir(parents=True, exist_ok=True)
    try:
        try:
            video = download(req.url, str(job_dir))
        except DownloadError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        frames = extract_frames(
            video.path,
            count=settings.max_frames,
            max_pixels=settings.frame_max_pixels,
            out_dir=job_dir / "frames",
        )
        if not frames:
            raise HTTPException(status_code=500, detail="Could not extract frames from video")

        result = analyze_frames(frames, caption=video.description, title=video.title)
        if not isinstance(result, dict) or "is_recipe" not in result:
            raise HTTPException(status_code=502, detail="Unexpected model output")

        if result.get("is_recipe") and result.get("recipe"):
            result["recipe"].setdefault("thumbnail_url", video.thumbnail_url)
        return result
    finally:
        shutil.rmtree(job_dir, ignore_errors=True)
