import os
import json
import uuid
from datetime import datetime
from typing import List, Optional, Dict, Any


class ImagePresetManager:
    def __init__(self, file_path: str = "image_presets.json"):
        self.file_path = file_path
        dir_name = os.path.dirname(self.file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)

    def _load(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.file_path):
            return []
        try:
            with open(self.file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except Exception:
            return []

    def _save(self, presets: List[Dict[str, Any]]):
        dir_name = os.path.dirname(self.file_path)
        if dir_name:
            os.makedirs(dir_name, exist_ok=True)
        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(presets, f, ensure_ascii=False, indent=2)

    def list_presets(self) -> List[Dict[str, Any]]:
        presets = self._load()
        return sorted(presets, key=lambda x: x.get("updated_at", ""), reverse=True)

    def get_preset(self, preset_id: str) -> Optional[Dict[str, Any]]:
        for p in self._load():
            if p.get("id") == preset_id:
                return p
        return None

    def _auto_name(self, name: Optional[str], content: str) -> str:
        base = (name or "").strip()
        if base:
            return base
        snippet = (content or "").strip().splitlines()[0] if content else ""
        snippet = snippet[:32] if snippet else ""
        return snippet or "未命名设定"

    def create_preset(self, name: Optional[str], content: str) -> Dict[str, Any]:
        now = datetime.now().isoformat()
        preset = {
            "id": str(uuid.uuid4()),
            "name": self._auto_name(name, content),
            "content": content.strip(),
            "created_at": now,
            "updated_at": now,
        }
        presets = self._load()
        presets.append(preset)
        self._save(presets)
        return preset

    def update_preset(self, preset_id: str, name: Optional[str] = None, content: Optional[str] = None) -> Optional[Dict[str, Any]]:
        presets = self._load()
        updated = None
        for p in presets:
            if p.get("id") == preset_id:
                if content is not None:
                    p["content"] = content.strip()
                if name is not None:
                    p["name"] = name.strip() or self._auto_name(name, p.get("content") or "")
                elif content is not None:
                    # auto rename when name not explicitly provided
                    p["name"] = self._auto_name(p.get("name"), p.get("content") or "")
                p["updated_at"] = datetime.now().isoformat()
                updated = p
                break
        if updated:
            self._save(presets)
        return updated

    def delete_preset(self, preset_id: str) -> bool:
        presets = self._load()
        next_list = [p for p in presets if p.get("id") != preset_id]
        if len(next_list) == len(presets):
            return False
        self._save(next_list)
        return True
