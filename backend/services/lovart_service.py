"""
Lovart.ai 视频生成服务
- 集成到 FastAPI 后端
- 提供 API 接口
- 任务队列管理
"""
import os
import json
import asyncio
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

# 导入自动化模块
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.account_pool import AccountPool
from automation.batch_video import BatchVideoGenerator, VideoTask


class VideoGenerationRequest(BaseModel):
    """视频生成请求"""
    image_path: str
    prompt: str
    output_path: Optional[str] = None


class VideoTaskResponse(BaseModel):
    """视频任务响应"""
    task_id: str
    status: str
    image_path: str
    prompt: str
    output_path: str
    video_url: Optional[str] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None


class LovartService:
    """Lovart 视频生成服务"""
    
    def __init__(self, output_dir: str = "generated_videos"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        
        # 初始化账号池和批量生成器
        self.account_pool = AccountPool()
        self.batch_generator = BatchVideoGenerator(
            self.account_pool,
            tasks_file=os.path.join(output_dir, "video_tasks.json")
        )
        
        # 后台任务状态
        self._processing = False
        self._process_task = None
    
    def get_account_stats(self) -> dict:
        """获取账号统计"""
        return self.account_pool.get_stats()
    
    def get_task_stats(self) -> dict:
        """获取任务统计"""
        return self.batch_generator.get_stats()
    
    def add_video_task(self, request: VideoGenerationRequest) -> VideoTaskResponse:
        """添加视频生成任务"""
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
        
        # 添加任务
        task = self.batch_generator.add_task(
            image_path=request.image_path,
            prompt=request.prompt,
            output_path=output_path
        )
        
        return self._task_to_response(task)
    
    def add_video_tasks_batch(self, requests: List[VideoGenerationRequest]) -> List[VideoTaskResponse]:
        """批量添加任务"""
        tasks_data = []
        for req in requests:
            if not req.output_path:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                filename = f"video_{timestamp}.mp4"
                output_path = os.path.join(self.output_dir, filename)
            else:
                output_path = req.output_path
            
            tasks_data.append({
                'image': req.image_path,
                'prompt': req.prompt,
                'output': output_path
            })
        
        tasks = self.batch_generator.add_tasks_from_list(tasks_data)
        return [self._task_to_response(t) for t in tasks]
    
    def get_task(self, task_id: str) -> Optional[VideoTaskResponse]:
        """获取任务详情"""
        for task in self.batch_generator.tasks:
            if task.task_id == task_id:
                return self._task_to_response(task)
        return None
    
    def get_all_tasks(self, status: Optional[str] = None) -> List[VideoTaskResponse]:
        """获取所有任务"""
        tasks = self.batch_generator.tasks
        if status:
            tasks = [t for t in tasks if t.status == status]
        return [self._task_to_response(t) for t in tasks]
    
    def start_processing(self, interval: int = 60):
        """开始后台处理任务"""
        if self._processing:
            return {"status": "already_running"}
        
        self._processing = True
        # 注意：这是同步处理，实际生产环境应使用 Celery 等任务队列
        return {"status": "started", "interval": interval}
    
    def stop_processing(self):
        """停止后台处理"""
        self._processing = False
        return {"status": "stopped"}
    
    def _task_to_response(self, task: VideoTask) -> VideoTaskResponse:
        """转换任务为响应"""
        return VideoTaskResponse(
            task_id=task.task_id,
            status=task.status,
            image_path=task.image_path,
            prompt=task.prompt,
            output_path=task.output_path,
            video_url=task.video_url,
            error=task.error,
            created_at=task.created_at,
            completed_at=task.completed_at or None
        )


# 全局服务实例
_service: Optional[LovartService] = None


def get_lovart_service() -> LovartService:
    """获取服务实例"""
    global _service
    if _service is None:
        _service = LovartService(
            output_dir=os.path.join(
                os.path.dirname(os.path.dirname(__file__)),
                "generated_videos"
            )
        )
    return _service
