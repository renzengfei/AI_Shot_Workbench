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
# Lovart.ai 视频生成 API
# ============================================================

from services.lovart_service import get_lovart_service, VideoGenerationRequest


@app.get("/api/lovart/stats")
async def lovart_stats():
    """获取 Lovart 账号和任务统计"""
    service = get_lovart_service()
    return {
        "accounts": service.get_account_stats(),
        "tasks": service.get_task_stats()
    }


@app.post("/api/lovart/tasks")
async def lovart_add_task(request: VideoGenerationRequest):
    """添加视频生成任务"""
    service = get_lovart_service()
    task = service.add_video_task(request)
    return {"success": True, "task": task}


@app.post("/api/lovart/tasks/batch")
async def lovart_add_tasks_batch(requests: List[VideoGenerationRequest]):
    """批量添加视频生成任务"""
    service = get_lovart_service()
    tasks = service.add_video_tasks_batch(requests)
    return {"success": True, "tasks": tasks, "count": len(tasks)}


@app.get("/api/lovart/tasks")
async def lovart_list_tasks(status: Optional[str] = None):
    """获取任务列表"""
    service = get_lovart_service()
    tasks = service.get_all_tasks(status)
    return {"tasks": tasks, "count": len(tasks)}


@app.get("/api/lovart/tasks/{task_id}")
async def lovart_get_task(task_id: str):
    """获取任务详情"""
    service = get_lovart_service()
    task = service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"task": task}


@app.post("/api/lovart/tasks/{task_id}/run")
async def lovart_run_task(task_id: str):
    """执行单个视频生成任务（同步执行，会阻塞）"""
    import threading
    
    service = get_lovart_service()
    task = service.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    if task.status not in ["pending", "failed"]:
        raise HTTPException(status_code=400, detail=f"任务状态不允许执行: {task.status}")
    
    # 在后台线程执行（避免阻塞 API）
    def run_task():
        batch = service.batch_generator
        for t in batch.tasks:
            if t.task_id == task_id:
                batch.process_single_task(t)
                break
    
    thread = threading.Thread(target=run_task)
    thread.start()
    
    return {"success": True, "message": "任务已开始执行", "task_id": task_id}


@app.post("/api/lovart/process")
async def lovart_start_processing():
    """启动后台任务处理（处理所有待处理任务）"""
    import threading
    
    service = get_lovart_service()
    stats = service.get_task_stats()
    
    if stats['pending'] == 0:
        return {"success": False, "message": "没有待处理任务"}
    
    # 在后台线程执行
    def process_all():
        service.batch_generator.process_all(interval=60)
    
    thread = threading.Thread(target=process_all, daemon=True)
    thread.start()
    
    return {
        "success": True,
        "message": f"开始处理 {stats['pending']} 个任务",
        "stats": stats
    }
