import hashlib
import json
import os
import subprocess
from pathlib import Path
from typing import Optional


class FrameServiceError(Exception):
    """Generic frame service error."""


class FrameService:
    """
    提供基于 ffmpeg 的帧提取能力，将源视频转码为 GOP=1 的编辑版，确保时间轴对齐。
    每个源视频会生成一个 session（按文件 path+size+mtime 生成签名，避免重复转码）。
    """

    def __init__(self, base_dir: str = "transcodes", ffmpeg_bin: str = "ffmpeg") -> None:
        self.base_dir = Path(base_dir).resolve()
        self.ffmpeg_bin = ffmpeg_bin
        self.base_dir.mkdir(parents=True, exist_ok=True)

    # Public API -----------------------------------------------------
    def ensure_session(self, video_path: str, duration: Optional[float] = None) -> dict:
        """
        返回 {session_id, edit_path, edit_url_segment, duration}
        如不存在则转码生成，已存在则复用。
        """
        source = Path(video_path).resolve()
        if not source.exists():
            raise FrameServiceError(f"视频不存在: {video_path}")

        signature = self._build_signature(source)
        session_id = self._load_or_create_session(signature)
        session_dir = self.base_dir / session_id
        edit_path = session_dir / "edit.mp4"
        frames_dir = session_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)

        if not edit_path.exists():
            self._transcode(source, edit_path, duration)

        # 记录 metadata 方便下次复用
        meta_path = session_dir / "meta.json"
        if not meta_path.exists():
            meta = {
                "source": str(source),
                "signature": signature,
                "duration": duration,
            }
            meta_path.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")

        actual_duration = duration or self._probe_duration(edit_path)
        return {
            "session_id": session_id,
            "edit_path": str(edit_path),
            "edit_url_segment": f"/api/transcode/video/{session_id}",
            "duration": actual_duration,
        }

    def get_frame(self, session_id: str, timecode: float) -> Path:
        session_dir = self.base_dir / session_id
        edit_path = session_dir / "edit.mp4"
        if not edit_path.exists():
            raise FrameServiceError("编辑版视频未就绪")

        frames_dir = session_dir / "frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        frame_path = frames_dir / self._frame_filename(timecode)
        if frame_path.exists():
            return frame_path

        self._extract_frame(edit_path, frame_path, timecode)
        return frame_path

    def get_edit_video_path(self, session_id: str) -> Path:
        session_dir = self.base_dir / session_id
        edit_path = session_dir / "edit.mp4"
        if not edit_path.exists():
            raise FrameServiceError("编辑版视频未就绪")
        return edit_path

    # Internal helpers ------------------------------------------------
    def _build_signature(self, source: Path) -> str:
        stat = source.stat()
        base = f"{source.resolve()}|{stat.st_size}|{stat.st_mtime}"
        return hashlib.sha1(base.encode("utf-8")).hexdigest()[:12]

    def _load_or_create_session(self, signature: str) -> str:
        # signature 直接作为 session_id，若目录存在则复用
        session_id = signature
        session_dir = self.base_dir / session_id
        if not session_dir.exists():
            session_dir.mkdir(parents=True, exist_ok=True)
        return session_id

    def _transcode(self, source: Path, target: Path, duration: Optional[float]) -> None:
        cmd = [
            self.ffmpeg_bin,
            "-hide_banner",
            "-y",
            "-i",
            str(source),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "15",
            "-g",
            "1",
            "-sc_threshold",
            "0",
            "-pix_fmt",
            "yuv420p",
            "-an",
            str(target),
        ]
        timeout = max(int((duration or 60) * 2), 60)
        try:
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                timeout=timeout,
            )
        except subprocess.SubprocessError as exc:
            raise FrameServiceError(f"转码失败: {exc}") from exc

    def _extract_frame(self, source: Path, output: Path, timecode: float) -> None:
        cmd = [
            self.ffmpeg_bin,
            "-hide_banner",
            "-ss",
            f"{max(timecode, 0.0):.3f}",
            "-i",
            str(source),
            "-frames:v",
            "1",
            "-q:v",
            "4",
            "-y",
            str(output),
        ]
        try:
            subprocess.run(
                cmd,
                check=True,
                capture_output=True,
                timeout=30,
            )
        except subprocess.SubprocessError as exc:
            if output.exists():
                output.unlink()
            raise FrameServiceError(f"帧提取失败: {exc}") from exc

        if not output.exists():
            raise FrameServiceError("帧文件缺失")

    def _probe_duration(self, source: Path) -> float:
        cmd = [
            self.ffmpeg_bin,
            "-hide_banner",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(source),
        ]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=20,
            )
            return float(result.stdout.strip() or 0) or 0.0
        except subprocess.SubprocessError:
            return 0.0
        except ValueError:
            return 0.0

    @staticmethod
    def _frame_filename(timecode: float) -> str:
        milliseconds = int(round(max(timecode, 0.0) * 1000))
        return f"frame_{milliseconds:08d}.jpg"
