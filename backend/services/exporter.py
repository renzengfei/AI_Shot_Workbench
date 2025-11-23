import os
import json
import hashlib
from pathlib import Path
import ffmpeg

class Exporter:
    def __init__(self, output_dir: str = "outputs"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

    def export_project(self, video_path: str, cuts: list, project_name: str = "project", hidden_segments: list = None):
        """
        Export project with:
        - Project Report (Markdown)
        - Keyframe Images
        - Shot Videos
        - SHA-1 hash for validation
        - Hidden segment filtering
        """
        project_dir = os.path.join(self.output_dir, project_name)
        images_dir = os.path.join(project_dir, "images")
        videos_dir = os.path.join(project_dir, "videos")
        
        os.makedirs(images_dir, exist_ok=True)
        os.makedirs(videos_dir, exist_ok=True)

        # Calculate video hash
        video_hash = self._calculate_file_hash(video_path)
        
        # Normalize hidden segments
        hidden_set = set()
        if hidden_segments:
            hidden_set = set(f"{h:.3f}" for h in hidden_segments)

        # Generate segments from cuts, filtering hidden ones
        segments = []
        segment_counter = 1
        for i in range(len(cuts) - 1):
            start_time = cuts[i]["time"]
            # Check if this segment is hidden
            if f"{start_time:.3f}" in hidden_set:
                continue
                
            segments.append({
                "id": segment_counter,
                "start": start_time,
                "end": cuts[i + 1]["time"],
                "duration": cuts[i + 1]["time"] - start_time,
                "original_index": i
            })
            segment_counter += 1

        # Extract keyframes and clips
        for seg in segments:
            frame_name = f"frame_{seg['id']:03d}_{seg['start']:.3f}s.jpg"
            video_name = f"shot_{seg['id']:03d}_{seg['start']:.3f}s.mp4"
            
            # Extract keyframe
            try:
                ffmpeg.input(video_path, ss=seg['start']).output(
                    os.path.join(images_dir, frame_name),
                    vframes=1
                ).overwrite_output().run(quiet=True)
            except Exception as e:
                print(f"Failed to extract frame {seg['id']}: {e}")

            # Extract clip
            try:
                ffmpeg.input(video_path, ss=seg['start'], t=seg['duration']).output(
                    os.path.join(videos_dir, video_name),
                    c='copy'
                ).overwrite_output().run(quiet=True)
            except Exception as e:
                print(f"Failed to extract clip {seg['id']}: {e}")

        # Generate Markdown Report
        report = self._generate_markdown_report(segments, project_name)
        report_path = os.path.join(project_dir, "项目报告.md")
        with open(report_path, "w", encoding="utf-8") as f:
            f.write(report)

        # Generate JSON Data
        json_data = {
            "project_name": project_name,
            "video_hash": video_hash,
            "cuts": cuts,
            "hidden_segments": hidden_segments or [],
            "segments": segments
        }
        json_path = os.path.join(project_dir, "项目数据.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)

        return project_dir

    def _generate_markdown_report(self, segments: list, project_name: str) -> str:
        report = f"# {project_name} - 分镜头报告\n\n"
        report += "| 镜号 | 开始时间 | 结束时间 | 时长 | 首帧图 | 视频片段 |\n"
        report += "|------|----------|----------|------|--------|----------|\n"
        
        for seg in segments:
            frame_name = f"frame_{seg['id']:03d}_{seg['start']:.3f}s.jpg"
            video_name = f"shot_{seg['id']:03d}_{seg['start']:.3f}s.mp4"
            report += f"| {seg['id']} | {seg['start']:.3f}s | {seg['end']:.3f}s | {seg['duration']:.3f}s | ![](images/{frame_name}) | [视频](videos/{video_name}) |\n"
        
        return report

    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA-1 hash of video file for validation."""
        sha1 = hashlib.sha1()
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                sha1.update(chunk)
        return sha1.hexdigest()
