from fastapi import FastAPI, UploadFile, File, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
from services.scene_detector import SceneDetector
from services.exporter import Exporter
from services.youtube_downloader import YouTubeDownloader
from services.frame_service import FrameService, FrameServiceError
from services.asset_generator import AssetGenerator, AssetGenerationError

from services.workspace_manager import WorkspaceManager
from services.file_watcher import FileWatcher

app = FastAPI(title="AI Shot Workbench API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Directories
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"
TRANSCODE_DIR = "transcodes"
WORKSPACES_DIR = "../workspaces"  # Move outside backend to prevent auto-reload loop
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TRANSCODE_DIR, exist_ok=True)
# Ensure workspaces dir exists
os.makedirs(WORKSPACES_DIR, exist_ok=True)

# Services
workspace_manager = WorkspaceManager(WORKSPACES_DIR)
file_watcher = FileWatcher()
frame_service = FrameService(TRANSCODE_DIR)
asset_generator = AssetGenerator()

# Mount static files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/workspaces", StaticFiles(directory=WORKSPACES_DIR), name="workspaces")

# Models
class CutPoint(BaseModel):
    time: float
    type: str

class AnalyzeResponse(BaseModel):
    video_path: str
    duration: float
    cuts: List[CutPoint]
    session_id: Optional[str] = None
    edit_video_url: Optional[str] = None

class ExportRequest(BaseModel):
    video_path: str
    cuts: List[CutPoint]
    project_name: str = "project"
    hidden_segments: Optional[List[float]] = []

class GenerateAssetsRequest(BaseModel):
    cuts: List[float]
    duration: float
    session_id: Optional[str] = None
    file_name: Optional[str] = None  # fallback to uploads/<file_name> if no session
    include_video: bool = True
    hidden_segments: Optional[List[float]] = []

class YouTubeRequest(BaseModel):
    url: str
    cookies_from_browser: Optional[str] = None
    cookies_file: Optional[str] = None

class CreateWorkspaceRequest(BaseModel):
    name: str

class OpenWorkspaceRequest(BaseModel):
    path: str

@app.get("/")
def read_root():
    return {"status": "AI Shot Workbench API is running"}

# WebSocket Endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await file_watcher.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        file_watcher.disconnect(websocket)

# Workspace Endpoints
@app.get("/api/workspaces")
async def list_workspaces():
    return workspace_manager.list_workspaces()

@app.post("/api/workspaces")
async def create_workspace(request: CreateWorkspaceRequest):
    try:
        result = workspace_manager.create_workspace(request.name)
        # Start watching the new workspace
        await file_watcher.start_watching(result['path'])
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/workspaces/open")
async def open_workspace(request: OpenWorkspaceRequest):
    try:
        result = workspace_manager.open_workspace(request.path)
        # Start watching the opened workspace
        await file_watcher.start_watching(result['path'])
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# File operation endpoints
@app.get("/api/workspaces/{workspace_path:path}/segmentation")
async def get_segmentation(workspace_path: str):
    """Get segmentation data from workspace"""
    try:
        data = workspace_manager.get_segmentation(workspace_path)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workspaces/{workspace_path:path}/segmentation")
async def save_segmentation(workspace_path: str, data: dict):
    """Save segmentation data to workspace"""
    try:
        workspace_manager.save_segmentation(workspace_path, data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspaces/{workspace_path:path}/shots")
async def get_shots(workspace_path: str):
    """Get shots data from workspace"""
    try:
        data = workspace_manager.get_shots(workspace_path)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workspaces/{workspace_path:path}/shots")
async def save_shots(workspace_path: str, data: dict):
    """Save shots data to workspace"""
    try:
        workspace_manager.save_shots(workspace_path, data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspaces/{workspace_path:path}/deconstruction")
async def get_deconstruction(workspace_path: str):
    """Get deconstruction markdown from workspace"""
    try:
        content = workspace_manager.get_deconstruction(workspace_path)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workspaces/{workspace_path:path}/deconstruction")
async def save_deconstruction(workspace_path: str, data: dict):
    """Save deconstruction markdown to workspace"""
    try:
        workspace_manager.save_deconstruction(workspace_path, data.get("content", ""))
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workspaces/{workspace_path:path}/step")
async def update_step(workspace_path: str, data: dict):
    """Update current step in project"""
    try:
        workspace_manager.update_project_step(workspace_path, data.get("step", 1))
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze_video(file: UploadFile = File(...)):
    video_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(video_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    detector = SceneDetector()
    cuts = detector.detect_scenes(video_path)
    
    # Add start (0.0) and end points
    duration = detector.get_duration(video_path)
    if not cuts or cuts[0]["time"] != 0.0:
        cuts.insert(0, {"time": 0.0, "type": "auto"})
    if cuts[-1]["time"] < duration:
        cuts.append({"time": duration, "type": "auto"})

    session_id = None
    edit_url = None
    try:
        session = frame_service.ensure_session(video_path, duration)
        session_id = session["session_id"]
        edit_url = session["edit_url_segment"]
    except FrameServiceError as e:
        print(f"[frame_service] {e}")

    return {
        "video_path": video_path,
        "duration": duration,
        "cuts": cuts,
        "session_id": session_id,
        "edit_video_url": edit_url,
    }

@app.post("/api/export")
async def export_project(request: ExportRequest):
    if not os.path.exists(request.video_path):
        raise HTTPException(status_code=404, detail="Video file not found")
    
    exporter = Exporter(OUTPUT_DIR)
    project_dir = exporter.export_project(
        request.video_path,
        [cut.dict() for cut in request.cuts],
        request.project_name,
        request.hidden_segments
    )
    
    return {
        "status": "success",
        "project_dir": project_dir,
        "message": f"项目已导出到 {project_dir}"
    }

# Generate assets into workspace (frames + optional clips)

@app.post("/api/workspaces/{workspace_path:path}/generate-assets")
async def generate_assets(workspace_path: str, request: GenerateAssetsRequest):
    try:
        # Prefer original uploaded file for clips with audio
        video_path = None
        if request.file_name:
            candidate = os.path.join(UPLOAD_DIR, request.file_name)
            if os.path.exists(candidate):
                video_path = candidate
        if not video_path and request.session_id:
            try:
                video_path = frame_service.get_edit_video_path(request.session_id)
            except FrameServiceError:
                video_path = None
        if not video_path:
            raise HTTPException(status_code=404, detail="视频文件未找到，无法生成资产")

        # Cleanup old assets before regeneration
        assets_base = os.path.join(workspace_path, "assets")
        frames_dir = os.path.join(assets_base, "frames")
        videos_dir = os.path.join(assets_base, "videos")
        report_path = os.path.join(assets_base, "report.json")
        try:
            if os.path.exists(frames_dir):
                shutil.rmtree(frames_dir, ignore_errors=True)
            if os.path.exists(videos_dir):
                shutil.rmtree(videos_dir, ignore_errors=True)
            if os.path.exists(report_path):
                os.remove(report_path)
        except Exception:
            # 不阻塞主流程，继续生成
            pass

        # Apply hidden segments: remove hidden start/end from cut list, and reconcile boundaries
        hidden_set = set(round(v, 3) for v in request.hidden_segments or [])
        filtered_cuts = [c for c in request.cuts if round(c, 3) not in hidden_set]
        # ensure boundary cutpoints preserved
        filtered_cuts = filtered_cuts if len(filtered_cuts) >= 2 else request.cuts

        result = asset_generator.generate_assets(
            video_path=video_path,
            segments=filtered_cuts,
            workspace_path=workspace_path,
            include_video=request.include_video,
            hidden_segments=request.hidden_segments or [],
        )

        # Persist report
        report_path = os.path.join(workspace_path, "assets", "report.json")
        os.makedirs(os.path.dirname(report_path), exist_ok=True)
        import json
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        return {"status": "success", **result}
    except AssetGenerationError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/download-youtube", response_model=AnalyzeResponse)
async def download_youtube(request: YouTubeRequest):
    try:
        downloader = YouTubeDownloader(
            UPLOAD_DIR,
            cookies_from_browser=request.cookies_from_browser,
            cookies_file=request.cookies_file,
        )
        video_info = downloader.download(request.url)

        detector = SceneDetector()
        cuts = detector.detect_scenes(video_info["video_path"])

        duration = detector.get_duration(video_info["video_path"])
        if not cuts or cuts[0]["time"] != 0.0:
            cuts.insert(0, {"time": 0.0, "type": "auto"})
        if cuts[-1]["time"] < duration:
            cuts.append({"time": duration, "type": "auto"})

        session = frame_service.ensure_session(video_info["video_path"], duration)

        return {
            "video_path": video_info["video_path"],
            "duration": duration,
            "cuts": cuts,
            "session_id": session["session_id"],
            "edit_video_url": session["edit_url_segment"],
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YouTube download failed: {str(e)}")


@app.get("/api/transcode/video/{session_id}")
async def get_transcoded_video(session_id: str):
    try:
        path = frame_service.get_edit_video_path(session_id)
    except FrameServiceError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return FileResponse(path, media_type="video/mp4", filename=os.path.basename(path))


@app.get("/api/frame/{session_id}")
async def get_frame(session_id: str, time: float):
    try:
        frame_path = frame_service.get_frame(session_id, time)
    except FrameServiceError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(frame_path, media_type="image/jpeg", filename=os.path.basename(frame_path))
