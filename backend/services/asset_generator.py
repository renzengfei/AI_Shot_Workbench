import os
import subprocess
from pathlib import Path
from typing import List, Dict, Any


class AssetGenerationError(Exception):
    """Raised when frame or clip extraction fails."""


class AssetGenerator:
    FRAME_EPSILON = 1e-3

    def __init__(self, ffmpeg_bin: str = "ffmpeg") -> None:
        self.ffmpeg_bin = ffmpeg_bin

    def generate_assets(
        self,
        video_path: str,
        segments: List[float],
        workspace_path: str,
        include_video: bool = True,
        hidden_segments: List[float] | None = None,
    ) -> Dict[str, Any]:
        """
        segments: sorted cut points (seconds). Creates frames/clip per visible segment.
        """
        source = Path(video_path)
        if not source.exists():
            raise AssetGenerationError(f"视频文件不存在: {video_path}")

        cut_points = sorted(set(segments))
        if len(cut_points) < 2:
            raise AssetGenerationError("至少需要起点和终点切点")

        assets_dir = Path(workspace_path) / "assets"
        frames_dir = assets_dir / "frames"
        videos_dir = assets_dir / "videos"
        frames_dir.mkdir(parents=True, exist_ok=True)
        if include_video:
            videos_dir.mkdir(parents=True, exist_ok=True)

        report: List[Dict[str, Any]] = []
        failed_frames: List[float] = []
        failed_videos: List[float] = []

        hidden_set = set(round(v, 3) for v in hidden_segments or [])
        hidden_ranges: List[Dict[str, Any]] = []

        for idx in range(len(cut_points) - 1):
            start = cut_points[idx]
            end = cut_points[idx + 1]
            if end - start <= self.FRAME_EPSILON:
                continue

            ordinal = idx + 1
            frame_name = f"frame_{ordinal:03d}_{start:.3f}s.jpg"
            frame_path = frames_dir / frame_name
            frame_status = "success"

            hidden = round(start, 3) in hidden_set

            if hidden:
                frame_status = "skipped_hidden"
                video_name = None
                video_status = "skipped_hidden"
                hidden_ranges.append({
                    "start": start,
                    "end": end,
                    "message": f"{start:.3f}s~{end:.3f}s 片段已被用户舍弃，无需分析"
                })
            else:
                try:
                    self._extract_frame(source, start, frame_path)
                except Exception:
                    frame_status = "failed"
                    failed_frames.append(start)

                video_name = f"clip_{ordinal:03d}_{start:.3f}s.mp4"
                video_status = "skipped"
                if include_video:
                    video_path_out = videos_dir / video_name
                    try:
                        self._extract_clip(source, start, end, video_path_out)
                        video_status = "success"
                    except Exception:
                        video_status = "failed"
                        failed_videos.append(start)

            report.append(
                {
                    "ordinal": ordinal,
                    "start": start,
                    "end": end,
                    "duration": end - start,
                    "frame": frame_name if not hidden else None,
                    "frame_status": frame_status,
                    "clip": video_name if include_video and not hidden else None,
                    "clip_status": video_status,
                    "hidden": hidden,
                }
            )

        return {
            "report": report,
            "frames_dir": str(frames_dir),
            "videos_dir": str(videos_dir) if include_video else None,
            "failed_frames": failed_frames,
            "failed_videos": failed_videos,
            "hidden_segments": hidden_ranges,
        }

    def _extract_frame(self, source: Path, timecode: float, output: Path) -> None:
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
        subprocess.run(cmd, check=True, capture_output=True, timeout=60)
        if not output.exists():
            raise AssetGenerationError(f"帧导出失败 {timecode}")

    def _extract_clip(self, source: Path, start: float, end: float, output: Path) -> None:
        duration = max(end - start, self.FRAME_EPSILON)
        # 精准切片：先解码再重新编码，避免 stream copy 在非关键帧处导致音画不同步
        cmd = [
            self.ffmpeg_bin,
            "-hide_banner",
            "-y",
            "-i",
            str(source),
            "-ss",
            f"{max(start, 0.0):.3f}",
            "-t",
            f"{duration:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "20",
            "-c:a",
            "aac",
            "-movflags",
            "+faststart",
            "-avoid_negative_ts",
            "make_zero",
            "-fflags",
            "+genpts",
            "-reset_timestamps",
            "1",
            str(output),
        ]
        try:
            subprocess.run(cmd, check=True, capture_output=True, timeout=180)
            if output.exists():
                return
        except subprocess.CalledProcessError as e:
            raise AssetGenerationError(f"分镜导出失败 {start:.3f}-{end:.3f}: {e}") from e
        raise AssetGenerationError(f"分镜导出失败 {start:.3f}-{end:.3f}")
