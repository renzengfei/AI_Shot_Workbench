import json
import math
import os
import re
import subprocess
from typing import Iterable, List, Tuple


class SceneDetectionError(Exception):
    """Raised when scene detection fails."""


class SceneDetector:
    """
    FFmpeg-based scene detector with:
    - Multi-threshold pass (primary + optional secondary)
    - Refinement for very长 segments
    - Min scene duration + short-segment merge
    - Fallback uniform split when detection失败
    """

    _PTS_PATTERN = re.compile(r"pts_time:(?P<time>\d+(?:\.\d+)?)")

    def __init__(self) -> None:
        # Thresholds roughly align with yesu 版本的策略
        self.primary_threshold = self._get_float("SCENE_THRESHOLD", 0.3)
        # 默认关闭副阈值，与 yesu 配置对齐；如需启用可设置 SCENE_SECONDARY_THRESHOLD 环境变量
        self.secondary_threshold = self._get_float("SCENE_SECONDARY_THRESHOLD", 0.0)
        if self.secondary_threshold <= 0 or self.secondary_threshold >= self.primary_threshold:
            self.secondary_threshold = None

        self.min_scene_duration = self._get_float("SCENE_MIN_DURATION", 0.5)
        self.merge_frame_threshold = int(os.getenv("SCENE_MERGE_FRAME_THRESHOLD", "3"))
        self.long_scene_frame_threshold = int(os.getenv("SCENE_LONG_SCENE_FRAME_THRESHOLD", "150"))
        self.fallback_interval_seconds = self._get_float("SCENE_FALLBACK_INTERVAL", 10.0)

        self.ffmpeg_bin = os.getenv("FFMPEG_BIN", "ffmpeg")
        self.ffprobe_bin = os.getenv("FFPROBE_BIN", "ffprobe")

    # Public API ----------------------------------------------------------

    def detect_scenes(self, video_path: str) -> List[dict]:
        duration, fps = self._probe_video(video_path)
        try:
            candidate_times = self._collect_candidate_times(video_path, duration, fps)
            fallback = False
        except SceneDetectionError:
            candidate_times = []
            fallback = True

        if not candidate_times:
            candidate_times = self._generate_fallback_times(duration)
            fallback = True

        cut_times = self._build_cut_times(candidate_times, duration, fps, fallback)
        return [
            {
                "time": round(ts, 3),
                "type": "boundary" if idx in (0, len(cut_times) - 1) else ("fallback" if fallback else "auto"),
            }
            for idx, ts in enumerate(cut_times)
        ]

    def get_duration(self, video_path: str) -> float:
        duration, _ = self._probe_video(video_path)
        return float(duration or 0.0)

    # Internal helpers ----------------------------------------------------

    def _probe_video(self, video_path: str) -> Tuple[float, float]:
        cmd = [
            self.ffprobe_bin,
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=r_frame_rate,duration",
            "-of",
            "json",
            video_path,
        ]
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=30,
            )
        except subprocess.SubprocessError as exc:  # pragma: no cover
            raise SceneDetectionError("无法读取视频元数据") from exc

        duration = 0.0
        fps = 24.0
        try:
            data = json.loads(result.stdout)
            stream = (data.get("streams") or [{}])[0]
            duration_str = stream.get("duration")
            if duration_str is not None:
                duration = float(duration_str)
            fps_str = stream.get("r_frame_rate")
            if fps_str:
                if "/" in fps_str:
                    num, den = fps_str.split("/", 1)
                    fps = float(num) / float(den)
                else:
                    fps = float(fps_str)
        except (ValueError, KeyError, IndexError, json.JSONDecodeError):
            pass

        if fps <= 0 or math.isnan(fps):
            fps = 24.0
        return duration, fps

    def _collect_candidate_times(
        self,
        video_path: str,
        duration: float,
        fps: float,
    ) -> List[float]:
        thresholds: list[float] = []
        if self.primary_threshold and self.primary_threshold > 0:
            thresholds.append(self.primary_threshold)
        if self.secondary_threshold and self.secondary_threshold > 0:
            thresholds.append(self.secondary_threshold)

        collected: set[float] = set()
        for threshold in thresholds:
            output = self._run_ffmpeg_scene_detect(video_path, duration, threshold)
            collected.update(self._parse_scene_times(output, duration))

        if not collected:
            return []

        candidates = sorted(collected)
        return self._refine_long_segments(video_path, candidates, duration, fps)

    def _run_ffmpeg_scene_detect(
        self,
        video_path: str,
        duration: float,
        threshold: float,
        start: float | None = None,
        end: float | None = None,
    ) -> str:
        timeout = max(int(duration * 2), 60)
        cmd = [self.ffmpeg_bin, "-hide_banner", "-loglevel", "info"]
        if start is not None:
            cmd.extend(["-ss", f"{start:.3f}"])
        cmd.extend(["-i", video_path])
        if end is not None and start is not None and end > start:
            cmd.extend(["-to", f"{end - start:.3f}"])
        cmd.extend(
            [
                "-vf",
                f"select='gt(scene,{threshold})',showinfo",
                "-f",
                "null",
                "-",
            ]
        )
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True,
                timeout=timeout,
            )
        except subprocess.TimeoutExpired as exc:
            raise SceneDetectionError("FFmpeg 检测超时") from exc
        except subprocess.CalledProcessError as exc:
            raise SceneDetectionError("FFmpeg 检测失败") from exc
        return result.stderr

    def _parse_scene_times(self, ffmpeg_output: str, duration: float) -> List[float]:
        times: list[float] = []
        for match in self._PTS_PATTERN.finditer(ffmpeg_output):
            try:
                timestamp = float(match.group("time"))
            except ValueError:
                continue
            if timestamp <= 0 or timestamp >= duration:
                continue
            times.append(timestamp)
        return times

    def _refine_long_segments(
        self,
        video_path: str,
        candidate_times: Iterable[float],
        duration: float,
        fps: float,
    ) -> List[float]:
        times = sorted(set(t for t in candidate_times if 0 < t < duration))
        start_points = [0.0] + times + [duration]
        segments = list(zip(start_points, start_points[1:]))

        extra_times: set[float] = set()
        if (
            self.secondary_threshold
            and self.secondary_threshold > 0
            and self.long_scene_frame_threshold > 0
        ):
            for start, end in segments:
                frames = (end - start) * fps
                if frames > self.long_scene_frame_threshold:
                    try:
                        output = self._run_ffmpeg_scene_detect(
                            video_path,
                            duration=end - start,
                            threshold=self.secondary_threshold,
                            start=start,
                            end=end,
                        )
                        sub_times = self._parse_scene_times(output, end - start)
                        extra_times.update(start + t for t in sub_times)
                    except SceneDetectionError:
                        continue

        combined = sorted(set(times).union(extra_times))
        return combined

    def _generate_fallback_times(self, duration: float) -> List[float]:
        if duration <= 0:
            return []
        interval = max(self.fallback_interval_seconds, self.min_scene_duration)
        segments = max(1, math.ceil(duration / interval))
        return [duration * i / segments for i in range(1, segments)]

    def _build_cut_times(
        self,
        candidate_times: Iterable[float],
        duration: float,
        fps: float,
        fallback: bool,
    ) -> List[float]:
        filtered = self._apply_min_scene_duration(candidate_times, duration)
        filtered = self._merge_short_segments(filtered, duration, fps)
        # ensure boundaries
        if not filtered or filtered[0] != 0.0:
            filtered = [0.0] + filtered
        if filtered[-1] != duration:
            filtered.append(duration)
        return filtered

    def _apply_min_scene_duration(
        self,
        candidate_times: Iterable[float],
        duration: float,
    ) -> List[float]:
        times = [0.0]
        for timestamp in sorted(candidate_times):
            if timestamp <= 0 or timestamp >= duration:
                continue
            if timestamp - times[-1] >= self.min_scene_duration:
                times.append(timestamp)
        if duration > 0:
            if duration - times[-1] >= self.min_scene_duration or len(times) == 1:
                times.append(duration)
            else:
                times[-1] = duration
        return times

    def _merge_short_segments(
        self,
        cut_times: List[float],
        duration: float,
        fps: float,
    ) -> List[float]:
        if len(cut_times) < 2:
            return cut_times

        merged = [cut_times[0]]
        for idx in range(1, len(cut_times)):
            start = merged[-1]
            end = cut_times[idx]
            frames = (end - start) * fps
            if frames < self.merge_frame_threshold and idx < len(cut_times) - 1:
                # merge with next segment
                continue
            merged.append(end)
        if merged[-1] != duration:
            merged[-1] = duration
        return merged

    @staticmethod
    def _get_float(env_name: str, default: float) -> float:
        try:
            return float(os.getenv(env_name, str(default)))
        except ValueError:
            return default
