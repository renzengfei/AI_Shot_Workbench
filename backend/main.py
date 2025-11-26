from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import os
import shutil
import uuid
import base64
import json
import re
import requests
import time
from services.scene_detector import SceneDetector
from services.exporter import Exporter
from services.youtube_downloader import YouTubeDownloader
from services.frame_service import FrameService, FrameServiceError
from services.asset_generator import AssetGenerator, AssetGenerationError

from services.workspace_manager import WorkspaceManager
from services.file_watcher import FileWatcher

from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

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
    shot_id: Optional[int] = None


class CategoryPromptRequest(BaseModel):
    category: str
    prompt: Optional[str] = None


class CategoryCreateRequest(BaseModel):
    name: str


class CategoryRenameRequest(BaseModel):
    name: str

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


# Generate image via Gemini API (stream)
@app.post("/api/generate-image")
async def generate_image(request: GenerateImageRequest):
    api_key = os.getenv("GEMINI_IMAGE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_IMAGE_API_KEY 未配置")

    base_url = os.getenv("GEMINI_IMAGE_BASE_URL", "https://api.tu-zi.com/v1")
    model_name = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3-pro-image-preview-4")

    if not os.path.exists(request.workspace_path):
        raise HTTPException(status_code=404, detail="workspace_path 不存在")

    # Prepare images as base64 data URLs
    image_data_urls = []
    for img_id in request.reference_image_ids or []:
        path = get_reference_image_path(img_id)
        if not path or not os.path.exists(path):
            continue
        with open(path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode("utf-8")
            # best-effort mime guess
            mime = "image/png"
            if path.lower().endswith(".jpg") or path.lower().endswith(".jpeg"):
                mime = "image/jpeg"
            elif path.lower().endswith(".webp"):
                mime = "image/webp"
            image_data_urls.append(f"data:{mime};base64,{encoded}")

    # Build messages per OpenAI-compatible format
    content = [{"type": "text", "text": request.prompt}]
    for data_url in image_data_urls:
        content.append({"type": "image_url", "image_url": {"url": data_url}})
    messages = [{"role": "user", "content": content}]

    payload = {
        "model": model_name,
        "messages": messages,
        "stream": True,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    try:
        resp = requests.post(
            f"{base_url}/chat/completions",
            headers=headers,
            json=payload,
            stream=True,
            timeout=120,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"请求生成接口失败: {e}")

    if resp.status_code >= 400:
        detail = resp.text
        raise HTTPException(status_code=resp.status_code, detail=f"生成接口错误: {detail}")

    text_parts = []
    image_candidates = []
    for line in resp.iter_lines():
        if not line:
            continue
        line_str = line.decode("utf-8")
        if not line_str.startswith("data: "):
            continue
        data_str = line_str[6:]
        if data_str.strip() == "[DONE]":
            break
        try:
            chunk = json.loads(data_str)
        except json.JSONDecodeError:
            continue
        if "choices" in chunk and len(chunk["choices"]) > 0:
            delta = chunk["choices"][0].get("delta", {})
            content_delta = delta.get("content")
            if isinstance(content_delta, list):
                for part in content_delta:
                    if isinstance(part, dict):
                        if part.get("type") == "text" and "text" in part:
                            text_parts.append(part["text"])
                        elif part.get("type") == "image_url" and "image_url" in part:
                            url = part["image_url"].get("url")
                            if url:
                                image_candidates.append(url)
            elif isinstance(content_delta, str):
                text_parts.append(content_delta)

    # Save outputs
    saved_images = []
    workspace_path = request.workspace_path
    shot_id = request.shot_id or "unknown"
    generated_dir = os.path.join(workspace_path, "generated", "shots", str(shot_id))
    os.makedirs(generated_dir, exist_ok=True)

    # Determine next index to avoid overwrite
    existing_max_idx = 0
    for fname in os.listdir(generated_dir):
        m = re.search(r'image(?:_url)?_(\d+)\.', fname)
        if m:
            try:
                existing_max_idx = max(existing_max_idx, int(m.group(1)))
            except ValueError:
                continue
    idx = existing_max_idx + 1

    def save_base64_img(data_url: str, index: int):
        try:
            header, b64data = data_url.split(",", 1)
        except ValueError:
            return
        ext = "png"
        if "jpeg" in header or "jpg" in header:
            ext = "jpg"
        elif "webp" in header:
            ext = "webp"
        filename = f"image_{index}.{ext}"
        path = os.path.join(generated_dir, filename)
        with open(path, "wb") as f:
            f.write(base64.b64decode(b64data))
        saved_images.append(filename)

    def save_from_url(url: str, index: int):
        try:
            r = requests.get(url, timeout=60)
            r.raise_for_status()
            ext = "png"
            ctype = r.headers.get("content-type", "")
            if "jpeg" in ctype or "jpg" in ctype:
                ext = "jpg"
            elif "webp" in ctype:
                ext = "webp"
            filename = f"image_url_{index}.{ext}"
            path = os.path.join(generated_dir, filename)
            with open(path, "wb") as f:
                f.write(r.content)
            saved_images.append(filename)
            return True
        except Exception:
            return False

    # Extract images from explicit candidates
    for candidate in image_candidates:
        if isinstance(candidate, str):
            if candidate.startswith("data:image/"):
                save_base64_img(candidate, idx)
                idx += 1
            elif candidate.startswith("http"):
                if save_from_url(candidate, idx):
                    idx += 1

    # Fallback: regex scan over concatenated text in case URLs are embedded
    full_content_text = "".join(text_parts)
    base64_pattern = r"data:image/[^;]+;base64,[A-Za-z0-9+/=]+"
    url_pattern = r"https?://[^\s<>\")']+\.(?:png|jpg|jpeg|webp|gif)"
    md_image_pattern = r"!\[[^\]]*\]\((https?://[^\s<>\")']+)\)"
    for m in re.finditer(base64_pattern, full_content_text):
        save_base64_img(m.group(0), idx)
        idx += 1
    for m in re.finditer(url_pattern, full_content_text, re.IGNORECASE):
        if save_from_url(m.group(0), idx):
            idx += 1
    for m in re.finditer(md_image_pattern, full_content_text, re.IGNORECASE):
        url = m.group(1)
        if url and save_from_url(url, idx):
            idx += 1

    # Persist text and pick a fallback image (first URL if images empty)
    text_path = os.path.join(generated_dir, "content.txt")
    with open(text_path, "w", encoding="utf-8") as f:
        f.write("\n".join(text_parts))

    if not saved_images:
        # try to save first url candidate
        for candidate in image_candidates:
            if isinstance(candidate, str) and candidate.startswith("http"):
                if save_from_url(candidate, idx):
                    idx += 1
                    break

    rel_base = os.path.relpath(generated_dir, os.path.abspath(WORKSPACES_DIR))
    image_urls = [f"/workspaces/{rel_base}/{fname}" for fname in saved_images]

    return {"text": "\n".join(text_parts), "images": image_urls}

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
