import os
import json
from datetime import datetime
from typing import Optional, Dict, Any

class WorkspaceManager:
    def __init__(self, base_dir: str = "workspaces"):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def create_workspace(self, name: str) -> Dict[str, Any]:
        """Create a new workspace folder and initialize project.json"""
        # Sanitize name
        safe_name = "".join([c for c in name if c.isalnum() or c in (' ', '-', '_')]).strip()
        workspace_path = os.path.join(self.base_dir, safe_name)
        
        if os.path.exists(workspace_path):
            raise ValueError(f"Workspace '{safe_name}' already exists")
            
        os.makedirs(workspace_path)
        
        # Initialize directories
        os.makedirs(os.path.join(workspace_path, "assets"), exist_ok=True)
        os.makedirs(os.path.join(workspace_path, "export"), exist_ok=True)
        
        # Create project.json
        project_data = {
            "name": name,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "version": "2.0",
            "current_step": 1
        }
        
        self._save_json(os.path.join(workspace_path, "project.json"), project_data)
        
        return {
            "path": os.path.abspath(workspace_path),
            "data": project_data
        }

    def open_workspace(self, path: str) -> Dict[str, Any]:
        """Open an existing workspace and validate structure"""
        if not os.path.exists(path):
            raise ValueError(f"Workspace path not found: {path}")
            
        project_json_path = os.path.join(path, "project.json")
        if not os.path.exists(project_json_path):
            raise ValueError("Invalid workspace: project.json missing")
            
        with open(project_json_path, 'r', encoding='utf-8') as f:
            project_data = json.load(f)
            
        return {
            "path": os.path.abspath(path),
            "data": project_data
        }
        
    def list_workspaces(self) -> list:
        """List all workspaces in the base directory"""
        workspaces = []
        if not os.path.exists(self.base_dir):
            return []
            
        for item in os.listdir(self.base_dir):
            path = os.path.join(self.base_dir, item)
            if os.path.isdir(path) and os.path.exists(os.path.join(path, "project.json")):
                try:
                    with open(os.path.join(path, "project.json"), 'r') as f:
                        data = json.load(f)
                        workspaces.append({
                            "name": data.get("name", item),
                            "path": os.path.abspath(path),
                            "updated_at": data.get("updated_at")
                        })
                except:
                    continue
        
        # Sort by updated_at desc
        workspaces.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return workspaces

    def _save_json(self, path: str, data: Dict[str, Any]):
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    
    def _load_json(self, path: str) -> Dict[str, Any]:
        """Load JSON file, return empty dict if not exists"""
        if not os.path.exists(path):
            return {}
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _load_text(self, path: str) -> str:
        """Load text file, return empty string if not exists"""
        if not os.path.exists(path):
            return ""
        with open(path, 'r', encoding='utf-8') as f:
            return f.read()
    
    def _save_text(self, path: str, content: str):
        """Save text file"""
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
    
    # Segmentation operations
    def get_segmentation(self, workspace_path: str) -> Dict[str, Any]:
        """Get segmentation data from workspace"""
        seg_path = os.path.join(workspace_path, "segmentation.json")
        return self._load_json(seg_path)
    
    def save_segmentation(self, workspace_path: str, data: Dict[str, Any]):
        """Save segmentation data to workspace"""
        seg_path = os.path.join(workspace_path, "segmentation.json")
        self._save_json(seg_path, data)
        self._update_timestamp(workspace_path)
    
    # Shots operations
    def get_shots(self, workspace_path: str) -> Dict[str, Any]:
        """Get shots data from workspace"""
        shots_path = os.path.join(workspace_path, "shots.json")
        return self._load_json(shots_path)
    
    def save_shots(self, workspace_path: str, data: Dict[str, Any]):
        """Save shots data to workspace"""
        shots_path = os.path.join(workspace_path, "shots.json")
        self._save_json(shots_path, data)
        self._update_timestamp(workspace_path)

    # Reference image mappings (character -> reference image id)
    def get_reference_links(self, workspace_path: str) -> Dict[str, Any]:
        links_path = os.path.join(workspace_path, "reference_links.json")
        return self._load_json(links_path)

    def save_reference_links(self, workspace_path: str, data: Dict[str, Any]):
        links_path = os.path.join(workspace_path, "reference_links.json")
        self._save_json(links_path, data)
        self._update_timestamp(workspace_path)
    
    # Deconstruction operations
    def get_deconstruction(self, workspace_path: str) -> str:
        """Get deconstruction markdown from workspace"""
        decon_path = os.path.join(workspace_path, "deconstruction.md")
        return self._load_text(decon_path)
    
    def save_deconstruction(self, workspace_path: str, content: str):
        """Save deconstruction markdown to workspace"""
        decon_path = os.path.join(workspace_path, "deconstruction.md")
        self._save_text(decon_path, content)
        self._update_timestamp(workspace_path)
    
    # Project operations
    def update_project_step(self, workspace_path: str, step: int):
        """Update current step in project.json"""
        project_path = os.path.join(workspace_path, "project.json")
        project_data = self._load_json(project_path)
        project_data["current_step"] = step
        project_data["updated_at"] = datetime.now().isoformat()
        self._save_json(project_path, project_data)
    
    def _update_timestamp(self, workspace_path: str):
        """Update the updated_at timestamp in project.json"""
        project_path = os.path.join(workspace_path, "project.json")
        project_data = self._load_json(project_path)
        project_data["updated_at"] = datetime.now().isoformat()
        self._save_json(project_path, project_data)
