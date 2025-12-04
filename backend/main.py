from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional, Union
import os
import shutil
import uuid
import base64
import json
import re
import requests
import time
import logging
import httpx
import asyncio
from datetime import datetime
from pathlib import Path
from services.scene_detector import SceneDetector
from services.exporter import Exporter
from services.youtube_downloader import YouTubeDownloader
from services.frame_service import FrameService, FrameServiceError
from services.asset_generator import AssetGenerator, AssetGenerationError

from services.workspace_manager import WorkspaceManager
from services.file_watcher import FileWatcher
from services.image_preset_manager import ImagePresetManager
from services.image_providers import ImageProvider, ProviderConfig, ProviderType, GenerateResult
from services.provider_config import provider_config_manager

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("ai-shot-workbench")

app = FastAPI(title="AI Shot Workbench API")


@app.on_event("shutdown")
async def shutdown_event():
    """服务关闭时清理所有任务"""
    print("🛑 服务关闭中...")
    # 云雾 API 任务会自动清理


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
REFERENCE_GALLERY_DIR = "reference_gallery"
REFERENCE_IMAGES_DIR = os.path.join(REFERENCE_GALLERY_DIR, "images")
REFERENCE_METADATA_PATH = os.path.join(REFERENCE_GALLERY_DIR, "metadata.json")
REFERENCE_CATEGORY_PROMPTS_PATH = os.path.join(REFERENCE_GALLERY_DIR, "category_prompts.json")
REFERENCE_CATEGORIES_PATH = os.path.join(REFERENCE_GALLERY_DIR, "categories.json")
IMAGE_PRESETS_PATH = os.path.join(BASE_DIR, "image_presets.json")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(TRANSCODE_DIR, exist_ok=True)
os.makedirs(REFERENCE_IMAGES_DIR, exist_ok=True)
# Ensure workspaces dir exists
os.makedirs(WORKSPACES_DIR, exist_ok=True)

# Services
workspace_manager = WorkspaceManager(WORKSPACES_DIR)
file_watcher = FileWatcher()
frame_service = FrameService(TRANSCODE_DIR)
asset_generator = AssetGenerator()
image_preset_manager = ImagePresetManager(IMAGE_PRESETS_PATH)

# Mount static files
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
app.mount("/workspaces", StaticFiles(directory=WORKSPACES_DIR), name="workspaces")
app.mount("/reference-gallery", StaticFiles(directory=REFERENCE_GALLERY_DIR), name="reference-gallery")

# Helpers for reference gallery
def load_reference_metadata():
    if not os.path.exists(REFERENCE_METADATA_PATH):
        return []
    try:
        import json
        with open(REFERENCE_METADATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_reference_metadata(items):
    with open(REFERENCE_METADATA_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def load_category_prompts():
    if not os.path.exists(REFERENCE_CATEGORY_PROMPTS_PATH):
        return {}
    try:
        with open(REFERENCE_CATEGORY_PROMPTS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_category_prompts(prompts):
    with open(REFERENCE_CATEGORY_PROMPTS_PATH, "w", encoding="utf-8") as f:
        json.dump(prompts, f, ensure_ascii=False, indent=2)


def load_categories():
    if not os.path.exists(REFERENCE_CATEGORIES_PATH):
        return []
    try:
        with open(REFERENCE_CATEGORIES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def save_categories(categories):
    with open(REFERENCE_CATEGORIES_PATH, "w", encoding="utf-8") as f:
        json.dump(categories, f, ensure_ascii=False, indent=2)


def get_reference_image_path(image_id: str):
    items = load_reference_metadata()
    for item in items:
        if item.get("id") == image_id:
            filename = item.get("filename")
            if filename:
                return os.path.join(REFERENCE_IMAGES_DIR, filename)
    return None


def sanitize_category_dir(category: Optional[str]) -> str:
    if not category:
        return ""
    cat = str(category).strip()
    if not cat:
        return ""
    # allow CJK + basic filename chars
    safe = re.sub(r"[^a-zA-Z0-9._\-\u4e00-\u9fff]+", "_", cat)
    return safe


def make_filename(relative_name: str, category: Optional[str]) -> str:
    folder = sanitize_category_dir(category)
    if folder:
        return os.path.join(folder, relative_name)
    return relative_name


def ensure_category_folder(category: Optional[str]):
    folder = sanitize_category_dir(category)
    if not folder:
        os.makedirs(REFERENCE_IMAGES_DIR, exist_ok=True)
        return REFERENCE_IMAGES_DIR
    target_dir = os.path.join(REFERENCE_IMAGES_DIR, folder)
    os.makedirs(target_dir, exist_ok=True)
    return target_dir


def slugify_name(name: Optional[str], fallback: str = "image") -> str:
    if not name or not str(name).strip():
        return fallback
    safe = re.sub(r"[^a-zA-Z0-9._\-\u4e00-\u9fff]+", "_", str(name)).strip("_")
    return safe or fallback


def migrate_reference_files():
    """Ensure files align with category subfolders and slug-based filenames."""
    items = load_reference_metadata()
    changed = False
    for item in items:
        image_id = item.get("id") or ""
        name = item.get("name") or image_id or "image"
        category = item.get("category")
        filename = item.get("filename") or f"{image_id}.jpg"
        ext = os.path.splitext(filename)[1] or ".jpg"
        base_slug = slugify_name(name, "image")
        target_rel = make_filename(f"{base_slug}_{image_id}{ext}", category)
        current_rel = filename.replace("\\", "/")
        if current_rel == target_rel:
            continue
        src_path = os.path.join(REFERENCE_IMAGES_DIR, current_rel)
        dst_path = os.path.join(REFERENCE_IMAGES_DIR, target_rel)
        try:
            os.makedirs(os.path.dirname(dst_path), exist_ok=True)
            if os.path.exists(src_path):
                shutil.move(src_path, dst_path)
            elif not os.path.exists(dst_path):
                # nothing to move; skip update to avoid broken metadata
                continue
        except Exception as e:
            # skip this record on failure
            print(f"[reference_gallery] migrate skip {image_id}: {e}")
            continue
        item["filename"] = target_rel.replace("\\", "/")
        item["url"] = f"/reference-gallery/images/{target_rel}".replace("\\", "/")
        changed = True
    if changed:
        save_reference_metadata(items)


# Run migration at startup
migrate_reference_files()

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
    hidden_segments: Optional[List[float]] = []

class YouTubeRequest(BaseModel):
    url: str
    cookies_from_browser: Optional[str] = None
    cookies_file: Optional[str] = None

class CreateWorkspaceRequest(BaseModel):
    name: str

class OpenWorkspaceRequest(BaseModel):
    path: str


class ReferenceUpdateRequest(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None


class GenerateImageRequest(BaseModel):
    workspace_path: str
    prompt: str
    reference_image_ids: Optional[List[str]] = None
    shot_id: Optional[Union[float, str]] = None
    generated_dir: Optional[str] = None
    provider_id: Optional[str] = None  # 指定供应商 ID，None 时使用默认供应商


class ImageTaskCreateRequest(BaseModel):
    workspace_path: str
    prompt: str
    reference_image_ids: Optional[List[str]] = None
    shot_id: Union[float, str]
    generated_dir: Optional[str] = None
    count: int = 2
    provider_id: Optional[str] = None  # 指定供应商 ID


class CategoryPromptRequest(BaseModel):
    category: str
    prompt: Optional[str] = None


class CategoryCreateRequest(BaseModel):
    name: str


class CategoryRenameRequest(BaseModel):
    name: str


class ImagePresetCreateRequest(BaseModel):
    name: Optional[str] = None
    content: str


class ImagePresetUpdateRequest(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None


class WorkspacePresetRequest(BaseModel):
    preset_id: Optional[str] = None

@app.get("/")
def read_root():
    return {"status": "AI Shot Workbench API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}

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


# Reference Gallery Endpoints (global across workspaces)
@app.get("/api/reference-gallery")
async def list_reference_gallery():
    items = load_reference_metadata()
    for item in items:
        fname = item.get("filename") or ""
        item["url"] = f"/reference-gallery/images/{fname}".replace("\\", "/")
    return {"items": items}


@app.get("/api/reference-gallery/category-prompts")
async def list_reference_category_prompts():
    return {"prompts": load_category_prompts()}


@app.post("/api/reference-gallery/category-prompts")
async def update_reference_category_prompt(payload: CategoryPromptRequest):
    if payload.category is None:
        raise HTTPException(status_code=400, detail="category 不能为空")
    prompts = load_category_prompts()
    if payload.prompt is None or str(payload.prompt).strip() == "":
        prompts.pop(payload.category, None)
    else:
        prompts[payload.category] = payload.prompt
    save_category_prompts(prompts)
    return {"status": "saved", "prompts": prompts}


@app.get("/api/reference-gallery/categories")
async def list_reference_categories():
    return {"categories": load_categories()}


@app.post("/api/reference-gallery/categories")
async def create_reference_category(payload: CategoryCreateRequest):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="分类名称不能为空")
    categories = load_categories()
    if name in categories:
        raise HTTPException(status_code=400, detail="分类已存在")
    categories.append(name)
    save_categories(categories)
    return {"categories": categories}


@app.patch("/api/reference-gallery/categories/{category}")
async def rename_reference_category(category: str, payload: CategoryRenameRequest):
    new_name = payload.name.strip()
    if not new_name:
        raise HTTPException(status_code=400, detail="新名称不能为空")
    categories = load_categories()
    if category not in categories:
        raise HTTPException(status_code=404, detail="分类不存在")
    if new_name != category and new_name in categories:
        raise HTTPException(status_code=400, detail="目标分类已存在")

    # rename in category list
    categories = [new_name if c == category else c for c in categories]
    save_categories(categories)

    # update metadata categories and move files
    items = load_reference_metadata()
    for item in items:
        if item.get("category") == category:
            old_filename = item.get("filename")
            base_name = os.path.basename(old_filename) if old_filename else f"{item.get('id')}.jpg"
            new_rel = make_filename(base_name, new_name)
            old_path = os.path.join(REFERENCE_IMAGES_DIR, old_filename) if old_filename else None
            new_path = os.path.join(REFERENCE_IMAGES_DIR, new_rel)
            try:
                os.makedirs(os.path.dirname(new_path), exist_ok=True)
                if old_path and os.path.exists(old_path):
                    shutil.move(old_path, new_path)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"移动文件失败: {e}")
            item["filename"] = new_rel.replace("\\", "/")
            item["category"] = new_name
            item["url"] = f"/reference-gallery/images/{new_rel}".replace("\\", "/")
    save_reference_metadata(items)

    # update prompts
    prompts = load_category_prompts()
    if category in prompts:
        prompts[new_name] = prompts.pop(category)
        save_category_prompts(prompts)

    return {"categories": categories}


@app.delete("/api/reference-gallery/categories/{category}")
async def delete_reference_category(category: str, mode: str = "move"):
    categories = load_categories()
    if category not in categories:
        raise HTTPException(status_code=404, detail="分类不存在")
    categories = [c for c in categories if c != category]
    save_categories(categories)

    items = load_reference_metadata()
    changed = False
    for item in items:
        if item.get("category") == category:
            changed = True
            # move files to root (uncategorized) in either mode since category is removed
            old_filename = item.get("filename")
            base_name = os.path.basename(old_filename) if old_filename else f"{item.get('id')}.jpg"
            new_rel = make_filename(base_name, None)
            old_path = os.path.join(REFERENCE_IMAGES_DIR, old_filename) if old_filename else None
            new_path = os.path.join(REFERENCE_IMAGES_DIR, new_rel)
            try:
                os.makedirs(os.path.dirname(new_path), exist_ok=True)
                if old_path and os.path.exists(old_path):
                    shutil.move(old_path, new_path)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"移动文件失败: {e}")
            item["filename"] = new_rel.replace("\\", "/")
            if mode == "clear":
                item.pop("category", None)
            else:
                item["category"] = ""
    if changed:
        save_reference_metadata(items)

    prompts = load_category_prompts()
    if category in prompts:
        prompts.pop(category, None)
        save_category_prompts(prompts)

    return {"categories": categories}


@app.post("/api/reference-gallery")
async def upload_reference_image(
    file: UploadFile = File(...),
    name: Optional[str] = Form(None),
    category: Optional[str] = Form(None),
):
    if not file:
        raise HTTPException(status_code=400, detail="未提供文件")
    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ".jpg"
    if ext not in [".png", ".jpg", ".jpeg", ".webp"]:
        raise HTTPException(status_code=400, detail="仅支持 png/jpg/jpeg/webp")
    image_id = str(uuid.uuid4())
    display_name = name or os.path.splitext(file.filename)[0] or image_id
    safe_slug = slugify_name(display_name, "image")
    base_filename = f"{safe_slug}_{image_id}{ext}"
    relative_filename = make_filename(base_filename, category)
    dest_path = os.path.join(REFERENCE_IMAGES_DIR, relative_filename)
    try:
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {e}")

    items = load_reference_metadata()
    record = {"id": image_id, "name": display_name, "filename": relative_filename.replace("\\", "/"), "category": category}
    items.append(record)
    save_reference_metadata(items)
    record["url"] = f"/reference-gallery/images/{relative_filename}".replace("\\", "/")
    return record


@app.delete("/api/reference-gallery/{image_id}")
async def delete_reference_image(image_id: str):
    items = load_reference_metadata()
    remaining = []
    removed = None
    for item in items:
        if item.get("id") == image_id:
            removed = item
        else:
            remaining.append(item)
    if not removed:
        raise HTTPException(status_code=404, detail="未找到图片")
    save_reference_metadata(remaining)
    filename = removed.get("filename")
    if filename:
        try:
            os.remove(os.path.join(REFERENCE_IMAGES_DIR, filename))
        except FileNotFoundError:
            pass
    return {"status": "deleted"}


@app.patch("/api/reference-gallery/{image_id}")
async def rename_reference_image(image_id: str, payload: ReferenceUpdateRequest):
    items = load_reference_metadata()
    updated = False
    updated_item = None
    for item in items:
        if item.get("id") == image_id:
            old_filename = item.get("filename")
            old_category = item.get("category")
            target_category = payload.category if payload.category is not None else old_category
            target_name = payload.name if payload.name is not None else item.get("name") or image_id

            if payload.name is not None:
                item["name"] = payload.name

            # determine new relative filename (rename and/or move)
            ext = os.path.splitext(old_filename)[1] if old_filename else ".jpg"
            safe_slug = slugify_name(target_name, "image")
            base_name = f"{safe_slug}_{image_id}{ext}"
            new_rel = make_filename(base_name, target_category)

            old_path = os.path.join(REFERENCE_IMAGES_DIR, old_filename) if old_filename else None
            new_path = os.path.join(REFERENCE_IMAGES_DIR, new_rel)

            if not old_path or os.path.abspath(old_path) != os.path.abspath(new_path):
                try:
                    os.makedirs(os.path.dirname(new_path), exist_ok=True)
                    if old_path and os.path.exists(old_path):
                        shutil.move(old_path, new_path)
                except Exception as e:
                    raise HTTPException(status_code=500, detail=f"移动文件失败: {e}")

            item["filename"] = new_rel.replace("\\", "/")
            item["category"] = target_category
            updated = True
            updated_item = item
            break
    if not updated:
        raise HTTPException(status_code=404, detail="未找到图片")
    save_reference_metadata(items)
    if updated_item:
        updated_item["url"] = f"/reference-gallery/images/{updated_item.get('filename')}".replace("\\", "/")
    return {"status": "renamed", "item": updated_item}


@app.get("/api/image-presets")
def list_image_presets():
    presets = image_preset_manager.list_presets()
    return {"presets": presets}


@app.post("/api/image-presets")
def create_image_preset(payload: ImagePresetCreateRequest):
    preset = image_preset_manager.create_preset(payload.name, payload.content)
    return {"preset": preset}


@app.patch("/api/image-presets/{preset_id}")
def update_image_preset(preset_id: str, payload: ImagePresetUpdateRequest):
    updated = image_preset_manager.update_preset(preset_id, payload.name, payload.content)
    if not updated:
        raise HTTPException(status_code=404, detail="生图设定不存在")
    return {"preset": updated}


@app.delete("/api/image-presets/{preset_id}")
def delete_image_preset(preset_id: str):
    removed = image_preset_manager.delete_preset(preset_id)
    if not removed:
        raise HTTPException(status_code=404, detail="生图设定不存在")
    return {"status": "deleted"}


@app.get("/api/workspaces/{workspace_path:path}/image-preset")
def get_workspace_image_preset(workspace_path: str):
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    preset_id = workspace_manager.get_image_preset_id(workspace_path)
    preset = image_preset_manager.get_preset(preset_id) if preset_id else None
    return {"preset_id": preset_id, "preset": preset}


@app.post("/api/workspaces/{workspace_path:path}/image-preset")
def set_workspace_image_preset(workspace_path: str, payload: WorkspacePresetRequest):
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    preset_id = payload.preset_id
    if preset_id:
        preset = image_preset_manager.get_preset(preset_id)
        if not preset:
            raise HTTPException(status_code=404, detail="生图设定不存在")
    try:
        workspace_manager.set_image_preset_id(workspace_path, preset_id)
        return {"preset_id": preset_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def ensure_workspace_exists(workspace_path: str):
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")


def normalize_generated_dir(generated_dir: Optional[str]) -> str:
    name = (generated_dir or "generated").strip()
    return name or "generated"


def get_task_dir(workspace_path: str, generated_dir: Optional[str]) -> str:
    dir_name = normalize_generated_dir(generated_dir)
    path = os.path.join(workspace_path, dir_name, "image_tasks")
    os.makedirs(path, exist_ok=True)
    return path


def get_task_path(workspace_path: str, generated_dir: Optional[str], task_id: str) -> str:
    return os.path.join(get_task_dir(workspace_path, generated_dir), f"{task_id}.json")


def save_task_record(path: str, record: dict):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(record, f, ensure_ascii=False, indent=2)


def load_task_record(path: str) -> Optional[dict]:
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


def dedupe_files(files: List[str]) -> List[str]:
    seen = set()
    ordered = []
    for f in files:
        if f in seen:
            continue
        seen.add(f)
        ordered.append(f)
    return ordered


async def generate_images_internal(request: GenerateImageRequest) -> dict:
    """
    使用配置的供应商生成图片
    支持多供应商切换（Rabbit/Candy）
    """
    # 1. 获取供应商配置
    if request.provider_id:
        provider_config = provider_config_manager.get_provider(request.provider_id)
        if not provider_config:
            raise HTTPException(status_code=404, detail=f"供应商不存在: {request.provider_id}")
    else:
        provider_config = provider_config_manager.get_default_provider()
        if not provider_config:
            raise HTTPException(status_code=500, detail="未配置任何生图供应商，请先在设置中添加")
    
    logger.info(f"使用供应商: {provider_config.name} ({provider_config.type.value})")
    
    ensure_workspace_exists(request.workspace_path)

    # 2. 构建提示词（合并 preset）
    preset_text = None
    preset_id = workspace_manager.get_image_preset_id(request.workspace_path)
    if preset_id:
        preset_obj = image_preset_manager.get_preset(preset_id)
        if preset_obj:
            preset_text = preset_obj.get("content")

    final_prompt = request.prompt if (preset_text and preset_text in request.prompt) else (
        request.prompt if not preset_text else f"{request.prompt}\n\n生图设定：{preset_text}"
    )

    # 3. 准备参考图片的 data URLs
    image_data_urls = []
    for img_id in request.reference_image_ids or []:
        path = get_reference_image_path(img_id)
        if not path or not os.path.exists(path):
            continue
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            mime = "image/png"
            if path.lower().endswith(".jpg") or path.lower().endswith(".jpeg"):
                mime = "image/jpeg"
            elif path.lower().endswith(".webp"):
                mime = "image/webp"
            image_data_urls.append(f"data:{mime};base64,{encoded}")

    # 4. 准备输出目录
    shot_id = request.shot_id or "unknown"
    shot_label = str(shot_id).strip()
    if ".." in shot_label or "/" in shot_label or "\\" in shot_label:
        raise HTTPException(status_code=400, detail="shot_id 无效")
    generated_dir_name = normalize_generated_dir(request.generated_dir)
    generated_root = os.path.join(request.workspace_path, generated_dir_name, "shots", shot_label)
    os.makedirs(generated_root, exist_ok=True)

    try:
        # 5. 创建 Provider 实例并调用生成
        provider = ImageProvider.create(provider_config)
        result = await provider.generate(
            prompt=final_prompt,
            reference_data_urls=image_data_urls,
            aspect_ratio="9:16",
        )
        
        # 6. 保存图片
        saved_images = []
        source_seen: set = set()
        
        existing_max_idx = 0
        for fname in os.listdir(generated_root):
            m = re.search(r'image(?:_url)?_(\d+)\.', fname)
            if m:
                try:
                    existing_max_idx = max(existing_max_idx, int(m.group(1)))
                except ValueError:
                    continue
        idx = existing_max_idx + 1

        def next_available_filename(base: str, ext: str) -> str:
            nonlocal idx
            while True:
                candidate = f"{base}_{idx}.{ext}"
                full_path = os.path.join(generated_root, candidate)
                if not os.path.exists(full_path):
                    return candidate
                idx += 1

        def save_base64_img(data_url: str):
            nonlocal idx
            if not data_url or data_url in source_seen:
                return
            source_seen.add(data_url)
            try:
                header, b64data = data_url.split(",", 1)
            except ValueError:
                return
            ext = "png"
            if "jpeg" in header or "jpg" in header:
                ext = "jpg"
            elif "webp" in header:
                ext = "webp"
            filename = next_available_filename("image", ext)
            path = os.path.join(generated_root, filename)
            with open(path, "wb") as f:
                f.write(base64.b64decode(b64data))
            # 为每张图片保存对应的 prompt 文件（包含供应商名称）
            prompt_filename = os.path.splitext(filename)[0] + ".prompt.txt"
            prompt_path = os.path.join(generated_root, prompt_filename)
            with open(prompt_path, "w", encoding="utf-8") as f:
                f.write(f"[Provider: {provider_config.name}]\n\n{final_prompt}")
            saved_images.append(filename)
            idx += 1

        async def save_from_url(url: str):
            nonlocal idx
            if not url or url in source_seen:
                return False
            source_seen.add(url)
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    r = await client.get(url)
                    r.raise_for_status()
                    ext = "png"
                    ctype = r.headers.get("content-type", "")
                    if "jpeg" in ctype or "jpg" in ctype:
                        ext = "jpg"
                    elif "webp" in ctype:
                        ext = "webp"
                    filename = next_available_filename("image_url", ext)
                    path = os.path.join(generated_root, filename)
                    with open(path, "wb") as f:
                        f.write(r.content)
                    # 为每张图片保存对应的 prompt 文件（包含供应商名称）
                    prompt_filename = os.path.splitext(filename)[0] + ".prompt.txt"
                    prompt_path = os.path.join(generated_root, prompt_filename)
                    with open(prompt_path, "w", encoding="utf-8") as f:
                        f.write(f"[Provider: {provider_config.name}]\n\n{final_prompt}")
                    saved_images.append(filename)
                    idx += 1
                    return True
            except Exception as e:
                logger.warning(f"下载图片失败: {url}, 错误: {e}")
                return False

        # 去重后的图片 URL，避免同一请求多次写入重复文件
        raw_urls = result.image_urls or []
        seen_urls: set = set()
        deduped_urls: List[str] = []
        for u in raw_urls:
            if not u or u in seen_urls:
                continue
            seen_urls.add(u)
            deduped_urls.append(u)

        # 处理返回的图片 URLs
        for img_url in deduped_urls:
            if img_url.startswith("data:image/"):
                save_base64_img(img_url)
            elif img_url.startswith("http"):
                await save_from_url(img_url)

        # 从文本响应中提取嵌入的图片（Gemini 模型通常将图片嵌入在文本中）
        if result.text_response:
            base64_pattern = r"data:image/[^;]+;base64,[A-Za-z0-9+/=]+"
            url_pattern = r"https?://[^\s<>\")']+\.(?:png|jpg|jpeg|webp|gif)"
            md_image_pattern = r"!\[[^\]]*\]\((https?://[^\s<>\")']+)\)"
            
            for m in re.finditer(base64_pattern, result.text_response):
                save_base64_img(m.group(0))
            for m in re.finditer(url_pattern, result.text_response, re.IGNORECASE):
                await save_from_url(m.group(0))
            for m in re.finditer(md_image_pattern, result.text_response, re.IGNORECASE):
                url = m.group(1)
                if url:
                    await save_from_url(url)

        # 保存发送给生图API的完整prompt（包含供应商名称）
        prompt_path = os.path.join(generated_root, "prompt.txt")
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(f"[Provider: {provider_config.name}]\n\n{final_prompt}")
        
        # 保存文本响应
        text_path = os.path.join(generated_root, "content.txt")
        with open(text_path, "w", encoding="utf-8") as f:
            f.write(result.text_response)

        rel_base = os.path.relpath(generated_root, os.path.abspath(WORKSPACES_DIR))
        image_urls = [f"/workspaces/{rel_base}/{fname}" for fname in dedupe_files(saved_images)]

        return {
            "text": result.text_response,
            "images": image_urls,
            "provider": provider_config.name,
        }
    except RuntimeError as e:
        # Provider 抛出的业务错误
        raise HTTPException(status_code=502, detail=str(e))
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"生成服务请求失败: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"生成图片失败: {e}")
        raise HTTPException(status_code=500, detail=f"请求生成接口失败: {e}")

# Generate image via Gemini API (stream)
@app.post("/api/generate-image")
async def generate_image(request: GenerateImageRequest):
    return await generate_images_internal(request)

async def run_image_task(task_path: str, payload: ImageTaskCreateRequest):
    record = load_task_record(task_path)
    if not record:
        return
    record["status"] = "running"
    record["started_at"] = record.get("started_at") or datetime.utcnow().isoformat()
    save_task_record(task_path, record)

    files: List[str] = []
    error_detail: Optional[str] = None
    count = payload.count if payload.count and payload.count > 0 else 1
    if count > 4:
        count = 4

    # 并发生成多张图片
    async def generate_one():
        gen_req = GenerateImageRequest(
            workspace_path=payload.workspace_path,
            prompt=payload.prompt,
            reference_image_ids=payload.reference_image_ids,
            shot_id=payload.shot_id,
            generated_dir=payload.generated_dir,
            provider_id=payload.provider_id,
        )
        return await generate_images_internal(gen_req)

    tasks = [generate_one() for _ in range(count)]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    error_messages = []
    for result in results:
        if isinstance(result, HTTPException):
            detail = result.detail if isinstance(result.detail, str) else str(result.detail)
            error_messages.append(detail)
        elif isinstance(result, Exception):
            error_messages.append(str(result))
        elif isinstance(result, dict):
            files.extend(result.get("images", []))

    if not files and not error_messages:
        error_messages.append("生成失败，未返回图片")

    record["files"] = dedupe_files(files)
    record["finished_at"] = datetime.utcnow().isoformat()
    if record["files"]:
        # 若至少有一张图片生成成功，任务视为成功，错误记录到 error 字段便于排查
        record["status"] = "succeeded"
        record["error"] = "; ".join(error_messages) if error_messages else None
    else:
        record["status"] = "failed"
        record["error"] = "; ".join(error_messages) if error_messages else "生成失败，未返回图片"
    save_task_record(task_path, record)


@app.post("/api/image-tasks")
async def create_image_task(payload: ImageTaskCreateRequest):
    ensure_workspace_exists(payload.workspace_path)
    count = payload.count if payload.count and payload.count > 0 else 1
    task_id = uuid.uuid4().hex
    record = {
        "id": task_id,
        "workspace_path": payload.workspace_path,
        "shot_id": payload.shot_id,
        "prompt": payload.prompt,
        "reference_image_ids": payload.reference_image_ids or [],
        "generated_dir": normalize_generated_dir(payload.generated_dir),
        "count": min(count, 4),
        "status": "pending",
        "error": None,
        "files": [],
        "created_at": datetime.utcnow().isoformat(),
        "started_at": None,
        "finished_at": None,
    }
    task_path = get_task_path(payload.workspace_path, payload.generated_dir, task_id)
    save_task_record(task_path, record)

    asyncio.create_task(run_image_task(task_path, payload))

    return {"task_id": task_id, "status": "pending"}


@app.get("/api/image-tasks/{task_id}")
async def get_image_task(task_id: str, workspace_path: str, generated_dir: Optional[str] = None):
    ensure_workspace_exists(workspace_path)
    task_path = get_task_path(workspace_path, generated_dir, task_id)
    record = load_task_record(task_path)
    if not record:
        raise HTTPException(status_code=404, detail="任务不存在")
    record["files"] = dedupe_files(record.get("files", []))
    return {"task": record}

@app.get("/api/workspaces/{workspace_path:path}/generated")
async def list_generated_assets(workspace_path: str, shot_id: str, generated_dir: Optional[str] = None):
    """List generated files for a given shot (images/videos)"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    shot_label = str(shot_id).strip()
    if ".." in shot_label:
        raise HTTPException(status_code=400, detail="shot_id 无效")
    dir_name = generated_dir or "generated"
    root = os.path.join(workspace_path, dir_name, "shots", shot_label)
    norm_root = os.path.normpath(root)
    if not norm_root.startswith(os.path.normpath(workspace_path)):
        raise HTTPException(status_code=400, detail="路径无效")
    if not os.path.isdir(norm_root):
        return {"files": []}
    # 获取所有文件并按修改时间倒序（最新的在前）
    file_items = []
    for fname in os.listdir(norm_root):
        fpath = os.path.join(norm_root, fname)
        if os.path.isfile(fpath):
            mtime = os.path.getmtime(fpath)
            rel_base = os.path.relpath(fpath, os.path.abspath(WORKSPACES_DIR))
            file_items.append((mtime, f"/workspaces/{rel_base}"))
    # 按修改时间倒序排序
    file_items.sort(key=lambda x: x[0], reverse=True)
    files = [f[1] for f in file_items]
    return {"files": files}

@app.get("/api/workspaces/{workspace_path:path}/selected-images")
async def get_selected_images(workspace_path: str, generated_dir: Optional[str] = None):
    """读取选中的图片索引"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    dir_name = generated_dir or "generated"
    json_path = os.path.join(workspace_path, dir_name, "selected_images.json")
    norm_path = os.path.normpath(json_path)
    if not norm_path.startswith(os.path.normpath(workspace_path)):
        raise HTTPException(status_code=400, detail="路径无效")
    if not os.path.isfile(norm_path):
        return {"indexes": {}}
    try:
        with open(norm_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {"indexes": data.get("indexes", {})}
    except Exception as e:
        logger.warning(f"读取选中图片索引失败: {e}")
        return {"indexes": {}}

@app.post("/api/workspaces/{workspace_path:path}/selected-images")
async def save_selected_images(workspace_path: str, data: dict):
    """保存选中的图片索引"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    generated_dir = data.get("generated_dir") or "generated"
    indexes = data.get("indexes", {})
    dir_path = os.path.join(workspace_path, generated_dir)
    os.makedirs(dir_path, exist_ok=True)
    json_path = os.path.join(dir_path, "selected_images.json")
    norm_path = os.path.normpath(json_path)
    if not norm_path.startswith(os.path.normpath(workspace_path)):
        raise HTTPException(status_code=400, detail="路径无效")
    try:
        with open(norm_path, "w", encoding="utf-8") as f:
            json.dump({"indexes": indexes}, f, ensure_ascii=False, indent=2)
        return {"success": True}
    except Exception as e:
        logger.error(f"保存选中图片索引失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspaces/{workspace_path:path}/selected-videos")
async def get_selected_videos(workspace_path: str, generated_dir: Optional[str] = None):
    """读取选中的视频索引"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    dir_name = generated_dir or "generated"
    json_path = os.path.join(workspace_path, dir_name, "selected_videos.json")
    norm_path = os.path.normpath(json_path)
    if not norm_path.startswith(os.path.normpath(workspace_path)):
        raise HTTPException(status_code=400, detail="路径无效")
    if not os.path.isfile(norm_path):
        return {"indexes": {}}
    try:
        with open(norm_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {"indexes": data.get("indexes", {})}
    except Exception as e:
        logger.warning(f"读取选中视频索引失败: {e}")
        return {"indexes": {}}

@app.post("/api/workspaces/{workspace_path:path}/selected-videos")
async def save_selected_videos(workspace_path: str, data: dict):
    """保存选中的视频索引"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    generated_dir = data.get("generated_dir") or "generated"
    indexes = data.get("indexes", {})
    dir_path = os.path.join(workspace_path, generated_dir)
    os.makedirs(dir_path, exist_ok=True)
    json_path = os.path.join(dir_path, "selected_videos.json")
    norm_path = os.path.normpath(json_path)
    if not norm_path.startswith(os.path.normpath(workspace_path)):
        raise HTTPException(status_code=400, detail="路径无效")
    try:
        with open(norm_path, "w", encoding="utf-8") as f:
            json.dump({"indexes": indexes}, f, ensure_ascii=False, indent=2)
        return {"success": True}
    except Exception as e:
        logger.error(f"保存选中视频索引失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspaces/{workspace_path:path}/prompt")
async def get_shot_prompt(
    workspace_path: str, 
    shot_id: str, 
    generated_dir: Optional[str] = None,
    image_filename: Optional[str] = None
):
    """读取指定镜头或图片的生图 prompt
    
    - 如果提供 image_filename，优先读取该图片对应的 prompt（如 image_url_36.prompt.txt）
    - 否则回退到 shot 级别的 prompt.txt
    """
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    shot_label = str(shot_id).strip()
    if ".." in shot_label:
        raise HTTPException(status_code=400, detail="shot_id 无效")
    dir_name = generated_dir or "generated"
    shot_dir = os.path.join(workspace_path, dir_name, "shots", shot_label)
    
    # 如果提供了图片文件名，优先读取该图片对应的 prompt
    if image_filename:
        # 从图片文件名推断 prompt 文件名：image_url_36.png -> image_url_36.prompt.txt
        base_name = os.path.splitext(image_filename)[0]
        per_image_prompt_path = os.path.join(shot_dir, f"{base_name}.prompt.txt")
        norm_path = os.path.normpath(per_image_prompt_path)
        if norm_path.startswith(os.path.normpath(workspace_path)) and os.path.isfile(norm_path):
            try:
                with open(norm_path, "r", encoding="utf-8") as f:
                    return {"prompt": f.read()}
            except Exception as e:
                logger.warning(f"读取图片 prompt 失败: {e}")
    
    # 回退到 shot 级别的 prompt.txt
    prompt_path = os.path.join(shot_dir, "prompt.txt")
    norm_path = os.path.normpath(prompt_path)
    if not norm_path.startswith(os.path.normpath(workspace_path)):
        raise HTTPException(status_code=400, detail="路径无效")
    if not os.path.isfile(norm_path):
        return {"prompt": None}
    try:
        with open(norm_path, "r", encoding="utf-8") as f:
            return {"prompt": f.read()}
    except Exception as e:
        logger.warning(f"读取 prompt 失败: {e}")
        return {"prompt": None}

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


@app.get("/api/workspaces/{workspace_path:path}/character-references")
async def get_character_references(workspace_path: str):
    """Get character -> reference image mapping for a workspace"""
    try:
        data = workspace_manager.get_reference_links(workspace_path)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/workspaces/{workspace_path:path}/character-references")
async def save_character_references(workspace_path: str, data: dict):
    """Save character -> reference image mapping for a workspace"""
    try:
        workspace_manager.save_reference_links(workspace_path, data)
        return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspaces/{workspace_path:path}/deconstruction-files")
async def list_deconstruction_files(workspace_path: str):
    """List available deconstruction files under the workspace"""
    try:
        files = workspace_manager.list_deconstruction_files(workspace_path)
        return {"files": files}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/workspaces/{workspace_path:path}/deconstruction")
async def get_deconstruction(workspace_path: str, file: Optional[str] = None):
    """Get deconstruction content from workspace"""
    try:
        content = workspace_manager.get_deconstruction(workspace_path, file)
        return {"content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/workspaces/{workspace_path:path}/deconstruction")
async def save_deconstruction(workspace_path: str, data: dict, file: Optional[str] = None):
    """Save deconstruction content to workspace"""
    try:
        file_name = data.get("file") if isinstance(data, dict) else None
        workspace_manager.save_deconstruction(workspace_path, data.get("content", ""), file_name or file)
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

        result = asset_generator.generate_assets(
            video_path=video_path,
            segments=request.cuts,
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


# ==================== Image Provider Management API ====================

class ProviderCreateRequest(BaseModel):
    name: str
    type: str  # "rabbit" or "candy"
    api_key: str
    endpoint: str
    model: str
    is_default: bool = False


class ProviderUpdateRequest(BaseModel):
    name: Optional[str] = None
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    model: Optional[str] = None
    is_default: Optional[bool] = None


@app.get("/api/providers")
async def list_providers():
    """列出所有已配置的生图供应商（API Key 脱敏）"""
    return {"providers": provider_config_manager.list_providers()}


@app.post("/api/providers")
async def create_provider(request: ProviderCreateRequest):
    """创建新的生图供应商配置"""
    try:
        provider_type = ProviderType(request.type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"无效的供应商类型: {request.type}，支持: rabbit, candy")
    
    provider = provider_config_manager.add_provider(
        name=request.name,
        provider_type=provider_type,
        api_key=request.api_key,
        endpoint=request.endpoint,
        model=request.model,
        is_default=request.is_default,
    )
    return {"success": True, "provider": provider.to_safe_dict()}


@app.put("/api/providers/{provider_id}")
async def update_provider(provider_id: str, request: ProviderUpdateRequest):
    """更新供应商配置"""
    updated = provider_config_manager.update_provider(
        provider_id=provider_id,
        name=request.name,
        api_key=request.api_key,
        endpoint=request.endpoint,
        model=request.model,
        is_default=request.is_default,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="供应商不存在")
    return {"success": True, "provider": updated.to_safe_dict()}


@app.delete("/api/providers/{provider_id}")
async def delete_provider(provider_id: str):
    """删除供应商配置"""
    success = provider_config_manager.delete_provider(provider_id)
    if not success:
        raise HTTPException(status_code=404, detail="供应商不存在")
    return {"success": True}


@app.post("/api/providers/{provider_id}/set-default")
async def set_default_provider(provider_id: str):
    """设置默认供应商"""
    success = provider_config_manager.set_default_provider(provider_id)
    if not success:
        raise HTTPException(status_code=404, detail="供应商不存在")
    return {"success": True}


# ============================================================
# 云雾 API 视频生成
# ============================================================

from services.yunwu_video_service import (
    get_yunwu_video_service, 
    YunwuVideoRequest,
    YunwuVideoTask
)


# 云雾 API 路由
@app.get("/api/yunwu/stats")
async def yunwu_stats():
    """获取云雾 API 任务统计"""
    service = get_yunwu_video_service()
    return {
        "tasks": service.get_stats(),
        "api_key_configured": bool(service.api_key)
    }


@app.post("/api/yunwu/tasks")
async def yunwu_add_task(request: YunwuVideoRequest):
    """添加云雾视频生成任务"""
    service = get_yunwu_video_service()
    task = service.add_task(request)
    return {"success": True, "task": service.to_response(task)}


@app.get("/api/yunwu/tasks")
async def yunwu_list_tasks(status: Optional[str] = None):
    """获取任务列表"""
    service = get_yunwu_video_service()
    tasks = service.get_all_tasks(status)
    return {
        "tasks": [service.to_response(t) for t in tasks],
        "count": len(tasks)
    }


@app.get("/api/yunwu/tasks/{task_id}")
async def yunwu_get_task(task_id: str):
    """获取任务详情"""
    service = get_yunwu_video_service()
    task = service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"task": service.to_response(task)}


@app.post("/api/yunwu/tasks/{task_id}/run")
async def yunwu_run_task(task_id: str):
    """
    执行单个视频生成任务（异步）
    会创建任务、轮询状态、下载视频
    """
    service = get_yunwu_video_service()
    task = service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status not in ["pending", "failed"]:
        raise HTTPException(status_code=400, detail=f"任务状态不允许执行: {task.status}")
    
    # 在后台执行任务
    async def run_task_async():
        await service.process_task(task)
    
    asyncio.create_task(run_task_async())
    
    return {
        "success": True,
        "message": "任务已开始执行",
        "task_id": task_id
    }


@app.post("/api/yunwu/tasks/{task_id}/query")
async def yunwu_query_task(task_id: str):
    """查询任务状态（直接调用 API 查询）"""
    service = get_yunwu_video_service()
    task = service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if not task.api_task_id:
        return {"task": service.to_response(task), "message": "任务尚未提交到 API"}
    
    result = await service.query_video(task)
    return {
        "task": service.to_response(task),
        "api_response": result
    }


@app.post("/api/yunwu/tasks/batch")
async def yunwu_add_tasks_batch(requests: List[YunwuVideoRequest]):
    """批量添加视频生成任务"""
    service = get_yunwu_video_service()
    tasks = []
    for req in requests:
        task = service.add_task(req)
        tasks.append(service.to_response(task))
    return {"success": True, "tasks": tasks, "count": len(tasks)}


@app.post("/api/yunwu/tasks/run-batch")
async def yunwu_run_tasks_batch(data: dict):
    """
    批量执行多个任务（真正并发）
    
    Body:
        task_ids: 任务ID列表
        max_workers: 最大并发数（默认 3）
    """
    import asyncio
    
    task_ids = data.get('task_ids', [])
    max_workers = data.get('max_workers', 3)
    
    if not task_ids:
        raise HTTPException(status_code=400, detail="task_ids 不能为空")
    
    service = get_yunwu_video_service()
    
    # 使用信号量控制并发数
    semaphore = asyncio.Semaphore(max_workers)
    
    async def run_single_task(task_id: str):
        async with semaphore:
            task = service.get_task(task_id)
            if task and task.status in ["pending", "failed"]:
                await service.process_task(task)
    
    # 在后台并发执行所有任务
    async def run_all_tasks():
        await asyncio.gather(*[run_single_task(tid) for tid in task_ids])
    
    asyncio.create_task(run_all_tasks())
    
    return {
        "success": True,
        "message": f"开始并发执行 {len(task_ids)} 个任务",
        "max_workers": max_workers
    }


@app.post("/api/yunwu/tasks/stop-all")
async def yunwu_stop_all_tasks():
    """停止所有未完成的任务"""
    service = get_yunwu_video_service()
    result = service.clear_all_tasks()
    return {
        "success": True,
        "message": f"已取消 {result['cleared']} 个任务",
        **result
    }


# ==================== 视频生成配置 API ====================

class VideoGenConfig(BaseModel):
    mode: str = "yunwu"  # 仅支持 yunwu
    apiKey: str = ""
    model: str = "grok-video-3"
    size: str = "1080P"
    aspectRatio: str = "9:16"
    videosPerShot: int = 3
    concurrency: int = 3
    pollInterval: int = 10

# 配置文件路径
VIDEO_GEN_CONFIG_PATH = Path(__file__).parent / "video_gen_config.json"

def load_video_gen_config() -> VideoGenConfig:
    """从文件加载视频生成配置"""
    if VIDEO_GEN_CONFIG_PATH.exists():
        try:
            with open(VIDEO_GEN_CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                config = VideoGenConfig(**data)
                # 启动时同步 API Key 到云雾服务
                if config.apiKey:
                    service = get_yunwu_video_service()
                    service.set_api_key(config.apiKey)
                return config
        except Exception as e:
            print(f"⚠️ 加载视频配置失败: {e}，使用默认配置")
    return VideoGenConfig()

def save_video_gen_config_to_file(config: VideoGenConfig):
    """将配置保存到文件"""
    try:
        with open(VIDEO_GEN_CONFIG_PATH, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ 保存视频配置失败: {e}")

# 全局配置存储（启动时从文件加载）
_video_gen_config: VideoGenConfig = load_video_gen_config()


@app.get("/api/video-gen/config")
async def get_video_gen_config():
    """获取视频生成配置"""
    return _video_gen_config.model_dump()


@app.post("/api/video-gen/config")
async def save_video_gen_config(config: VideoGenConfig):
    """保存视频生成配置"""
    global _video_gen_config
    _video_gen_config = config
    
    # 持久化到文件
    save_video_gen_config_to_file(config)
    
    # 同步更新云雾服务的 API Key
    if config.apiKey:
        service = get_yunwu_video_service()
        service.set_api_key(config.apiKey)
    
    return {"success": True, "message": "配置已保存"}


class TestConnectionRequest(BaseModel):
    api_key: str


@app.post("/api/yunwu/test-connection")
async def yunwu_test_connection(request: TestConnectionRequest):
    """测试云雾 API 连接"""
    import httpx
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # 简单测试：发送一个小请求验证 API Key
            response = await client.get(
                "https://yunwu.ai/v1/models",
                headers={"Authorization": f"Bearer {request.api_key}"}
            )
            if response.status_code == 200:
                return {"success": True, "message": "连接成功"}
            elif response.status_code == 401:
                raise HTTPException(status_code=401, detail="API Key 无效")
            else:
                raise HTTPException(status_code=response.status_code, detail=f"API 返回错误: {response.status_code}")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="连接超时")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from sse_starlette.sse import EventSourceResponse
import asyncio


@app.get("/api/yunwu/tasks/{task_id}/progress")
async def yunwu_task_progress_sse(task_id: str):
    """SSE 推送任务进度"""
    service = get_yunwu_video_service()
    
    async def event_generator():
        while True:
            task = service.get_task(task_id)
            if not task:
                yield {"event": "error", "data": json.dumps({"error": "任务不存在"})}
                break
            
            task_data = service.to_response(task)
            yield {"event": "progress", "data": json.dumps(task_data)}
            
            if task.status in ["completed", "failed"]:
                yield {"event": "done", "data": json.dumps(task_data)}
                break
            
            await asyncio.sleep(_video_gen_config.pollInterval)
    
    return EventSourceResponse(event_generator())


# ==================== 视频导出 ====================

class ExportVideosRequest(BaseModel):
    workspace_path: str
    generated_dir: str = "generated"


@app.post("/api/export-selected-videos")
async def export_selected_videos(request: ExportVideosRequest):
    """
    导出选中的视频到 export 文件夹，按镜头顺序重命名
    """
    workspace_path = request.workspace_path
    generated_dir = request.generated_dir
    
    # 构建路径
    gen_path = os.path.join(workspace_path, generated_dir)
    videos_dir = os.path.join(gen_path, "videos")
    selected_json_path = os.path.join(gen_path, "selected_videos.json")
    export_dir = os.path.join(gen_path, "export")
    
    # 检查 selected_videos.json 是否存在
    if not os.path.exists(selected_json_path):
        raise HTTPException(status_code=404, detail="未找到 selected_videos.json，请先选择视频")
    
    # 读取选中的视频
    with open(selected_json_path, "r", encoding="utf-8") as f:
        selected_data = json.load(f)
    
    indexes = selected_data.get("indexes", {})
    if not indexes:
        raise HTTPException(status_code=400, detail="没有选中任何视频")
    
    # 创建 export 目录（清空旧内容）
    if os.path.exists(export_dir):
        shutil.rmtree(export_dir)
    os.makedirs(export_dir)
    
    # 按镜头 ID 排序并复制
    exported_files = []
    sorted_shots = sorted(indexes.items(), key=lambda x: float(x[0]))
    
    for order, (shot_id, video_filename) in enumerate(sorted_shots, start=1):
        src_path = os.path.join(videos_dir, video_filename)
        if not os.path.exists(src_path):
            logger.warning(f"视频文件不存在: {src_path}")
            continue
        
        # 新文件名: 01_shot_1.mp4
        shot_num = int(float(shot_id))
        ext = os.path.splitext(video_filename)[1]
        new_filename = f"{order:02d}_shot_{shot_num}{ext}"
        dst_path = os.path.join(export_dir, new_filename)
        
        shutil.copy2(src_path, dst_path)
        exported_files.append({
            "order": order,
            "shot_id": shot_num,
            "original_filename": video_filename,
            "exported_filename": new_filename
        })
    
    # 生成 manifest.json
    manifest = {
        "exported_at": datetime.now().isoformat(),
        "workspace": workspace_path,
        "generated_dir": generated_dir,
        "total_shots": len(exported_files),
        "files": exported_files
    }
    manifest_path = os.path.join(export_dir, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    return {
        "success": True,
        "export_path": export_dir,
        "total": len(exported_files),
        "files": exported_files
    }


# ============== 线稿图生成相关 API ==============

class GenerateOutlineRequest(BaseModel):
    workspace_path: str
    shot_id: str
    frame_url: str           # 原片首帧 URL
    outline_prompt: str      # 线稿提示词
    provider_id: Optional[str] = None


class OutlineConfigModel(BaseModel):
    globalOutlineMode: bool = False
    globalOutlinePrompt: str = "extract clean line art, black outlines on white background, no shading, anime style"


@app.post("/api/generate-outline")
async def generate_outline(request: GenerateOutlineRequest):
    """
    生成线稿图 - 复用生图 API
    将原片首帧作为参考图，使用线稿提示词生成线稿
    """
    ensure_workspace_exists(request.workspace_path)
    
    # 获取供应商配置
    if request.provider_id:
        provider_config = provider_config_manager.get_provider(request.provider_id)
        if not provider_config:
            raise HTTPException(status_code=404, detail=f"供应商不存在: {request.provider_id}")
    else:
        provider_config = provider_config_manager.get_default_provider()
        if not provider_config:
            raise HTTPException(status_code=500, detail="未配置任何生图供应商")
    
    logger.info(f"生成线稿图 - 使用供应商: {provider_config.name}")
    
    # 准备参考图（原片首帧）
    image_data_urls = []
    frame_path = None
    
    # 解析首帧路径
    if request.frame_url.startswith('/api/'):
        # 从 API URL 解析实际路径
        # 例如 /api/workspaces/.../assets/frames/frame_001_xxx.jpg
        parts = request.frame_url.replace('/api/workspaces/', '').split('/')
        if len(parts) >= 4:
            ws_path = '/'.join(parts[:-3])  # workspace path
            frame_filename = parts[-1]
            frame_path = os.path.join(request.workspace_path, 'assets', 'frames', frame_filename)
    elif request.frame_url.startswith('http://127.0.0.1:8000/workspaces/') or request.frame_url.startswith('http://localhost:8000/workspaces/'):
        # 本服务静态文件 URL，解析为本地路径
        # 例如 http://127.0.0.1:8000/workspaces/7/generated_xxx/shots/1.0/image.png
        import urllib.parse
        parsed = urllib.parse.urlparse(request.frame_url)
        # 移除开头的 /workspaces/
        relative_path = parsed.path.replace('/workspaces/', '', 1)
        # 拼接到 workspaces 目录
        frame_path = os.path.join(BASE_DIR, '..', 'workspaces', relative_path)
        frame_path = os.path.normpath(frame_path)
        logger.info(f"解析本地静态文件路径: {frame_path}")
    elif request.frame_url.startswith('http'):
        # 外部 URL，需要下载
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.get(request.frame_url)
                if resp.status_code == 200:
                    content_type = resp.headers.get('content-type', 'image/jpeg')
                    encoded = base64.b64encode(resp.content).decode('utf-8')
                    image_data_urls.append(f"data:{content_type};base64,{encoded}")
        except Exception as e:
            logger.error(f"下载首帧失败: {e}")
            raise HTTPException(status_code=400, detail=f"无法获取首帧图片: {e}")
    else:
        # 直接路径
        frame_path = request.frame_url
    
    # 读取本地首帧文件
    if frame_path and os.path.exists(frame_path):
        with open(frame_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            mime = "image/png"
            if frame_path.lower().endswith((".jpg", ".jpeg")):
                mime = "image/jpeg"
            elif frame_path.lower().endswith(".webp"):
                mime = "image/webp"
            image_data_urls.append(f"data:{mime};base64,{encoded}")
    
    if not image_data_urls:
        raise HTTPException(status_code=400, detail="无法获取首帧图片")
    
    # 准备输出目录
    shot_label = str(request.shot_id).strip()
    if ".." in shot_label or "/" in shot_label or "\\" in shot_label:
        raise HTTPException(status_code=400, detail="shot_id 无效")
    
    outlines_dir = os.path.join(request.workspace_path, "assets", "outlines", shot_label)
    os.makedirs(outlines_dir, exist_ok=True)
    
    try:
        # 调用生图供应商
        provider = ImageProvider.create(provider_config)
        result = await provider.generate(
            prompt=request.outline_prompt,
            reference_data_urls=image_data_urls,
            aspect_ratio="9:16",
        )
        
        # 保存生成的线稿图
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        saved_outline = None
        
        # 处理返回的 image_urls（可能是 data URL 或 http URL）
        for img_url in (result.image_urls or []):
            if not img_url:
                continue
            
            if img_url.startswith("data:"):
                # Base64 data URL
                try:
                    header, b64data = img_url.split(",", 1)
                except ValueError:
                    continue
                ext = "png"
                if "jpeg" in header or "jpg" in header:
                    ext = "jpg"
                filename = f"outline_{timestamp}.{ext}"
                path = os.path.join(outlines_dir, filename)
                with open(path, "wb") as f:
                    f.write(base64.b64decode(b64data))
                ws_path_for_url = request.workspace_path.lstrip('/')
                saved_outline = f"/api/workspaces/{ws_path_for_url}/assets/outlines/{shot_label}/{filename}"
                break
            elif img_url.startswith("http"):
                # HTTP URL，需要下载
                try:
                    async with httpx.AsyncClient(timeout=60.0) as client:
                        resp = await client.get(img_url)
                        if resp.status_code == 200:
                            ext = "png"
                            ct = resp.headers.get("content-type", "")
                            if "jpeg" in ct or "jpg" in ct:
                                ext = "jpg"
                            filename = f"outline_{timestamp}.{ext}"
                            path = os.path.join(outlines_dir, filename)
                            with open(path, "wb") as f:
                                f.write(resp.content)
                            ws_path_for_url = request.workspace_path.lstrip('/')
                            saved_outline = f"/api/workspaces/{ws_path_for_url}/assets/outlines/{shot_label}/{filename}"
                            break
                except Exception as e:
                    logger.error(f"下载线稿图失败: {e}")
                    continue
        
        if not saved_outline:
            raise HTTPException(status_code=500, detail="线稿生成结果为空")
        
        return {"success": True, "outline_url": saved_outline}
        
    except Exception as e:
        logger.exception(f"生成线稿失败: {e}")
        raise HTTPException(status_code=500, detail=f"生成线稿失败: {e}")


@app.get("/api/workspaces/{workspace_path:path}/outlines")
async def list_outlines(workspace_path: str, shot_id: str):
    """获取镜头的所有线稿图列表"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    
    shot_label = str(shot_id).strip()
    outlines_dir = os.path.join(workspace_path, "assets", "outlines", shot_label)
    
    if not os.path.exists(outlines_dir):
        return {"outlines": []}
    
    outlines = []
    for fname in sorted(os.listdir(outlines_dir), reverse=True):
        if fname.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
            outlines.append(f"/api/workspaces/{workspace_path}/assets/outlines/{shot_label}/{fname}")
    
    return {"outlines": outlines}


@app.delete("/api/workspaces/{workspace_path:path}/outlines/{shot_id}/{filename}")
async def delete_outline(workspace_path: str, shot_id: str, filename: str):
    """删除线稿图"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    
    shot_label = str(shot_id).strip()
    outline_path = os.path.join(workspace_path, "assets", "outlines", shot_label, filename)
    
    if not os.path.exists(outline_path):
        raise HTTPException(status_code=404, detail="线稿图不存在")
    
    try:
        os.remove(outline_path)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"删除失败: {e}")


@app.get("/api/workspaces/{workspace_path:path}/outline-config")
async def get_outline_config(workspace_path: str):
    """获取线稿配置"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    
    config_path = os.path.join(workspace_path, "outline_config.json")
    if not os.path.exists(config_path):
        return OutlineConfigModel().dict()
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return OutlineConfigModel().dict()


@app.put("/api/workspaces/{workspace_path:path}/outline-config")
async def save_outline_config(workspace_path: str, config: OutlineConfigModel):
    """保存线稿配置"""
    if not os.path.exists(workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")
    
    config_path = os.path.join(workspace_path, "outline_config.json")
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config.dict(), f, ensure_ascii=False, indent=2)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"保存失败: {e}")
