import os
import re
import uuid
from dataclasses import dataclass
from pathlib import Path

import yt_dlp


ALLOWED_HOSTS = ("instagram.com", "www.instagram.com")


@dataclass
class DownloadedVideo:
    path: Path
    title: str | None
    description: str | None
    thumbnail_url: str | None
    duration_seconds: float | None


class DownloadError(RuntimeError):
    pass


def validate_instagram_url(url: str) -> None:
    match = re.match(r"^https?://([^/]+)/.*", url.strip())
    if not match or match.group(1).lower() not in ALLOWED_HOSTS:
        raise DownloadError("URL must be an instagram.com link")


def download(url: str, work_dir: str) -> DownloadedVideo:
    validate_instagram_url(url)
    os.makedirs(work_dir, exist_ok=True)
    target = Path(work_dir) / f"{uuid.uuid4().hex}.%(ext)s"
    opts = {
        "outtmpl": str(target),
        "quiet": True,
        "no_warnings": True,
        "format": "mp4/best",
        "noplaylist": True,
        "socket_timeout": 30,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filepath = Path(ydl.prepare_filename(info))
    except yt_dlp.utils.DownloadError as exc:
        raise DownloadError(str(exc)) from exc

    if not filepath.exists():
        raise DownloadError("Video file missing after download")

    return DownloadedVideo(
        path=filepath,
        title=info.get("title"),
        description=info.get("description"),
        thumbnail_url=info.get("thumbnail"),
        duration_seconds=info.get("duration"),
    )
