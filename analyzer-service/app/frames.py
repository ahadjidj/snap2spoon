import base64
import subprocess
from pathlib import Path


def extract_frames(video_path: Path, count: int, max_pixels: int, out_dir: Path) -> list[Path]:
    """Extract `count` evenly-spaced frames using ffmpeg. Returns their paths."""
    out_dir.mkdir(parents=True, exist_ok=True)
    duration = _probe_duration(video_path)
    if duration <= 0:
        duration = 1.0
    step = max(duration / count, 0.5)
    paths: list[Path] = []
    for i in range(count):
        ts = min(i * step + step / 2, max(duration - 0.1, 0.0))
        out = out_dir / f"frame_{i:02d}.jpg"
        cmd = [
            "ffmpeg", "-y",
            "-ss", f"{ts:.2f}",
            "-i", str(video_path),
            "-vframes", "1",
            "-vf", f"scale='min({max_pixels},iw)':-2",
            "-q:v", "4",
            str(out),
        ]
        result = subprocess.run(cmd, capture_output=True)
        if result.returncode == 0 and out.exists():
            paths.append(out)
    return paths


def _probe_duration(video_path: Path) -> float:
    result = subprocess.run(
        [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(video_path),
        ],
        capture_output=True,
        text=True,
    )
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def frame_to_b64(path: Path) -> str:
    return base64.standard_b64encode(path.read_bytes()).decode("ascii")
