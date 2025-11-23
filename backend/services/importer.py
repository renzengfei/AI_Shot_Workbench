import os
import json
import hashlib
from pathlib import Path

class Importer:
    def __init__(self):
        pass

    def import_project(self, json_path: str, video_path: str = None):
        """
        Import project from JSON file.
        Validates hash if video_path is provided.
        Returns project data.
        """
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        # Validate required fields
        required_fields = ['project_name', 'cuts']
        for field in required_fields:
            if field not in data:
                raise ValueError(f"Missing required field: {field}")

        # Validate video hash if provided
        if video_path and 'video_hash' in data:
            current_hash = self._calculate_file_hash(video_path)
            if current_hash != data['video_hash']:
                raise ValueError(
                    f"Video hash mismatch!\n"
                    f"Expected: {data['video_hash']}\n"
                    f"Got: {current_hash}\n"
                    f"The video file may have been modified or is not the original source."
                )

        return {
            'project_name': data['project_name'],
            'cuts': data.get('cuts', []),
            'hidden_segments': data.get('hidden_segments', []),
            'video_hash': data.get('video_hash'),
        }

    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA-1 hash of video file."""
        sha1 = hashlib.sha1()
        with open(file_path, 'rb') as f:
            while chunk := f.read(8192):
                sha1.update(chunk)
        return sha1.hexdigest()
