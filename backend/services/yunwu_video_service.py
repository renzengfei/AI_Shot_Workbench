"""
云雾 API 视频生成服务
- 使用 yunwu.ai API 生成视频
- 支持 grok-video-3 模型
- 图片使用 base64 格式传输
"""
import os
import json
import base64
import asyncio
import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel
import logging

logger = logging.getLogger("yunwu-video")

# API 配置
YUNWU_API_BASE = "https://yunwu.ai"
YUNWU_API_KEY_ENV = "YUNWU_API_KEY"

# Workspaces 根目录
WORKSPACES_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'workspaces'))


def path_to_url(file_path: str) -> str:
    """将绝对文件路径转换为 HTTP URL"""
    if not file_path:
        return file_path
    abs_path = os.path.abspath(file_path)
    if abs_path.startswith(WORKSPACES_DIR):
        rel_path = os.path.relpath(abs_path, WORKSPACES_DIR)
        return f'/workspaces/{rel_path}'
    return file_path


class YunwuVideoRequest(BaseModel):
    """视频生成请求"""
    image_path: str
    prompt: str
    output_path: Optional[str] = None
    aspect_ratio: str = "9:16"  # 默认竖屏
    size: str = "1080P"
    model: str = "grok-video-3"


class YunwuVideoTask(BaseModel):
    """视频任务记录"""
    task_id: str  # 本地任务 ID
    api_task_id: Optional[str] = None  # 云雾 API 返回的任务 ID
    status: str = "pending"  # pending, processing, completed, failed
    image_path: str
    prompt: str
    output_path: str
    aspect_ratio: str = "9:16"
    size: str = "1080P"
    model: str = "grok-video-3"
    video_url: Optional[str] = None
    error: Optional[str] = None
    created_at: str = ""
    completed_at: Optional[str] = None
    api_response: Optional[Dict[str, Any]] = None


class YunwuVideoService:
    """云雾 API 视频生成服务"""
    
    def __init__(self, output_dir: str = "generated_videos", tasks_file: str = None):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        self.tasks_file = tasks_file or os.path.join(output_dir, "yunwu_video_tasks.json")
        self.tasks: List[YunwuVideoTask] = []
        self._load_tasks()
        
        # API Key - 优先使用动态设置的，否则从环境变量读取
        self._dynamic_api_key: Optional[str] = None
        self._env_api_key = os.getenv(YUNWU_API_KEY_ENV, "")
    
    @property
    def api_key(self) -> str:
        """获取 API Key，优先使用动态设置的"""
        return self._dynamic_api_key or self._env_api_key
    
    def set_api_key(self, api_key: str):
        """动态设置 API Key"""
        self._dynamic_api_key = api_key
        logger.info(f"已设置云雾 API Key: {api_key[:10]}...{api_key[-4:]}" if len(api_key) > 14 else "已设置云雾 API Key")
    
    def _load_tasks(self):
        """加载任务记录"""
        if os.path.exists(self.tasks_file):
            try:
                with open(self.tasks_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    self.tasks = [YunwuVideoTask(**t) for t in data]
            except Exception as e:
                logger.error(f"加载任务记录失败: {e}")
                self.tasks = []
    
    def _save_tasks(self):
        """保存任务记录"""
        try:
            with open(self.tasks_file, 'w', encoding='utf-8') as f:
                json.dump([t.model_dump() for t in self.tasks], f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"保存任务记录失败: {e}")
    
    def _get_headers(self) -> dict:
        """获取 API 请求头"""
        return {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
    
    def _image_to_base64(self, image_path: str) -> Optional[str]:
        """将图片转换为 base64 data URL"""
        # 处理 HTTP URL
        if image_path.startswith('http://') or image_path.startswith('https://'):
            from urllib.parse import urlparse, unquote
            parsed = urlparse(image_path)
            url_path = unquote(parsed.path)
            
            if '/workspaces/' in url_path:
                rel_path = url_path[url_path.index('/workspaces/') + 1:]
                project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                abs_path = os.path.join(project_root, rel_path)
            else:
                logger.error(f"无法解析 URL 路径: {image_path}")
                return None
        else:
            abs_path = os.path.abspath(image_path)
        
        if not os.path.exists(abs_path):
            logger.error(f"图片文件不存在: {abs_path}")
            return None
        
        try:
            with open(abs_path, 'rb') as f:
                data = base64.b64encode(f.read()).decode('utf-8')
            
            # 检测图片类型
            ext = os.path.splitext(abs_path)[1].lower()
            mime_map = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.webp': 'image/webp',
                '.gif': 'image/gif'
            }
            mime = mime_map.get(ext, 'image/png')
            
            return f"data:{mime};base64,{data}"
        except Exception as e:
            logger.error(f"图片转 base64 失败: {e}")
            return None
    
    def get_stats(self) -> dict:
        """获取任务统计"""
        stats = {
            "total": len(self.tasks),
            "pending": 0,
            "processing": 0,
            "completed": 0,
            "failed": 0
        }
        for task in self.tasks:
            if task.status in stats:
                stats[task.status] += 1
        return stats
    
    def add_task(self, request: YunwuVideoRequest) -> YunwuVideoTask:
        """添加视频生成任务"""
        import uuid
        
        # 生成输出路径
        if not request.output_path:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"video_{timestamp}.mp4"
            output_path = os.path.join(self.output_dir, filename)
        else:
            output_path = request.output_path
        
        # 确保输出目录存在
        output_dir = os.path.dirname(output_path)
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
        
        task = YunwuVideoTask(
            task_id=str(uuid.uuid4())[:8],
            status="pending",
            image_path=request.image_path,
            prompt=request.prompt,
            output_path=output_path,
            aspect_ratio=request.aspect_ratio,
            size=request.size,
            model=request.model,
            created_at=datetime.now().isoformat()
        )
        
        self.tasks.append(task)
        self._save_tasks()
        
        return task
    
    def get_task(self, task_id: str) -> Optional[YunwuVideoTask]:
        """获取任务详情"""
        for task in self.tasks:
            if task.task_id == task_id:
                return task
        return None
    
    def get_all_tasks(self, status: Optional[str] = None) -> List[YunwuVideoTask]:
        """获取所有任务"""
        if status:
            return [t for t in self.tasks if t.status == status]
        return self.tasks
    
    async def create_video(self, task: YunwuVideoTask) -> bool:
        """
        调用 API 创建视频任务
        
        返回: 是否成功提交任务
        """
        if not self.api_key:
            task.status = "failed"
            task.error = "未配置 YUNWU_API_KEY 环境变量"
            self._save_tasks()
            return False
        
        # 转换图片为 base64
        image_base64 = self._image_to_base64(task.image_path)
        if not image_base64:
            task.status = "failed"
            task.error = f"图片转换失败: {task.image_path}"
            self._save_tasks()
            return False
        
        # 构建请求
        payload = {
            "model": task.model,
            "prompt": task.prompt,
            "aspect_ratio": task.aspect_ratio,
            "size": task.size,
            "images": [image_base64]
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{YUNWU_API_BASE}/v1/video/create",
                    headers=self._get_headers(),
                    json=payload
                )
                
                if response.status_code == 200:
                    data = response.json()
                    task.api_task_id = data.get("id")
                    task.status = "processing"
                    task.api_response = data
                    self._save_tasks()
                    logger.info(f"任务创建成功: {task.task_id} -> API ID: {task.api_task_id}")
                    return True
                else:
                    task.status = "failed"
                    task.error = f"API 错误: {response.status_code} - {response.text}"
                    self._save_tasks()
                    logger.error(f"任务创建失败: {task.error}")
                    return False
                    
        except Exception as e:
            task.status = "failed"
            task.error = f"请求异常: {str(e)}"
            self._save_tasks()
            logger.error(f"任务创建异常: {e}")
            return False
    
    async def query_video(self, task: YunwuVideoTask) -> dict:
        """
        查询视频任务状态
        
        返回: API 响应数据
        """
        if not task.api_task_id:
            return {"error": "任务未提交到 API"}
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(
                    f"{YUNWU_API_BASE}/v1/video/query",
                    headers=self._get_headers(),
                    params={"id": task.api_task_id}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    task.api_response = data
                    
                    # 更新任务状态
                    api_status = data.get("status", "")
                    if api_status == "completed":
                        task.status = "completed"
                        task.video_url = data.get("video_url")
                        task.completed_at = datetime.now().isoformat()
                    elif api_status == "failed":
                        task.status = "failed"
                        task.error = data.get("error", "API 返回失败状态")
                    elif api_status in ["pending", "processing"]:
                        task.status = "processing"
                    
                    self._save_tasks()
                    return data
                else:
                    return {"error": f"API 错误: {response.status_code}"}
                    
        except Exception as e:
            logger.error(f"查询任务异常: {e}")
            return {"error": str(e)}
    
    async def download_video(self, task: YunwuVideoTask) -> bool:
        """下载视频到本地"""
        if not task.video_url:
            return False
        
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.get(task.video_url)
                
                if response.status_code == 200:
                    # 确保输出目录存在
                    os.makedirs(os.path.dirname(task.output_path), exist_ok=True)
                    
                    with open(task.output_path, 'wb') as f:
                        f.write(response.content)
                    
                    logger.info(f"视频下载成功: {task.output_path}")
                    return True
                else:
                    logger.error(f"视频下载失败: {response.status_code}")
                    return False
                    
        except Exception as e:
            logger.error(f"视频下载异常: {e}")
            return False
    
    async def process_task(self, task: YunwuVideoTask, poll_interval: int = 10, max_wait: int = 600) -> bool:
        """
        处理单个任务（创建 + 轮询 + 下载）
        
        Args:
            task: 任务对象
            poll_interval: 轮询间隔（秒）
            max_wait: 最大等待时间（秒）
        
        Returns:
            是否成功
        """
        # 1. 创建任务
        if task.status == "pending":
            success = await self.create_video(task)
            if not success:
                return False
        
        # 2. 轮询状态
        elapsed = 0
        while task.status == "processing" and elapsed < max_wait:
            await asyncio.sleep(poll_interval)
            elapsed += poll_interval
            
            result = await self.query_video(task)
            logger.info(f"任务 {task.task_id} 状态: {task.status} (已等待 {elapsed}s)")
            
            if task.status == "completed":
                break
            elif task.status == "failed":
                return False
        
        if task.status != "completed":
            task.status = "failed"
            task.error = f"超时等待 ({max_wait}s)"
            self._save_tasks()
            return False
        
        # 3. 下载视频
        if task.video_url:
            success = await self.download_video(task)
            if not success:
                task.error = "视频下载失败"
                self._save_tasks()
                return False
        
        return True
    
    def clear_all_tasks(self) -> dict:
        """清理所有未完成的任务"""
        cleared = 0
        for task in self.tasks:
            if task.status in ["pending", "processing"]:
                task.status = "cancelled"
                cleared += 1
        self._save_tasks()
        return {"cleared": cleared}
    
    def to_response(self, task: YunwuVideoTask) -> dict:
        """转换任务为 API 响应格式"""
        output_url = path_to_url(task.output_path) if task.status == "completed" else task.output_path
        
        return {
            "task_id": task.task_id,
            "api_task_id": task.api_task_id,
            "status": task.status,
            "image_path": task.image_path,
            "prompt": task.prompt,
            "output_path": output_url,
            "video_url": task.video_url,
            "error": task.error,
            "created_at": task.created_at,
            "completed_at": task.completed_at,
            "aspect_ratio": task.aspect_ratio,
            "size": task.size,
            "model": task.model
        }


# 全局服务实例
_yunwu_service: Optional[YunwuVideoService] = None


def get_yunwu_video_service() -> YunwuVideoService:
    """获取服务实例"""
    global _yunwu_service
    if _yunwu_service is None:
        _yunwu_service = YunwuVideoService(
            output_dir=os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                "generated_videos"
            )
        )
    return _yunwu_service
