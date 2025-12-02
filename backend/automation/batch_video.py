#!/usr/bin/env python
"""
Lovart.ai 批量视频生成
- 读取任务列表（图片+提示词）
- 自动分配账号
- 并行/串行生成
- 失败重试
"""
import json
import os
import time
import random
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed

from .account_pool import AccountPool, Account
from .video_generator import VideoGenerator


@dataclass
class VideoTask:
    """视频生成任务"""
    task_id: str
    image_path: str
    prompt: str
    output_path: str
    status: str = "pending"  # pending, processing, completed, failed
    account_email: Optional[str] = None
    video_url: Optional[str] = None
    error: Optional[str] = None
    created_at: str = ""
    completed_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()


class BatchVideoGenerator:
    """批量视频生成器"""
    
    def __init__(self, account_pool: AccountPool, tasks_file: str = "video_tasks.json"):
        self.account_pool = account_pool
        self.tasks_file = tasks_file
        self.tasks: List[VideoTask] = []
        self.load_tasks()
    
    def load_tasks(self):
        """加载任务列表"""
        if os.path.exists(self.tasks_file):
            with open(self.tasks_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.tasks = [VideoTask(**t) for t in data.get('tasks', [])]
    
    def save_tasks(self):
        """保存任务列表"""
        with open(self.tasks_file, 'w', encoding='utf-8') as f:
            json.dump({
                'tasks': [asdict(t) for t in self.tasks],
                'updated_at': datetime.now().isoformat()
            }, f, ensure_ascii=False, indent=2)
    
    def add_task(self, image_path: str, prompt: str, output_path: str) -> VideoTask:
        """添加任务"""
        task_id = f"task_{len(self.tasks)+1}_{int(time.time())}"
        task = VideoTask(
            task_id=task_id,
            image_path=image_path,
            prompt=prompt,
            output_path=output_path
        )
        self.tasks.append(task)
        self.save_tasks()
        return task
    
    def add_tasks_from_list(self, tasks: List[Dict]) -> List[VideoTask]:
        """
        批量添加任务
        
        Args:
            tasks: [{"image": "path", "prompt": "xxx", "output": "path"}, ...]
        """
        added = []
        for t in tasks:
            task = self.add_task(
                image_path=t['image'],
                prompt=t['prompt'],
                output_path=t['output']
            )
            added.append(task)
        return added
    
    def get_pending_tasks(self) -> List[VideoTask]:
        """获取待处理任务"""
        return [t for t in self.tasks if t.status == 'pending']
    
    def get_failed_tasks(self) -> List[VideoTask]:
        """获取失败任务"""
        return [t for t in self.tasks if t.status == 'failed']
    
    def process_single_task(self, task: VideoTask) -> bool:
        """处理单个任务"""
        print(f"\n{'='*60}")
        print(f"处理任务: {task.task_id}")
        print(f"  图片: {task.image_path}")
        print(f"  提示词: {task.prompt[:50]}...")
        print(f"{'='*60}")
        
        # 获取可用账号
        account = self.account_pool.get_available_account()
        if not account:
            task.status = 'failed'
            task.error = "没有可用账号"
            self.save_tasks()
            return False
        
        task.status = 'processing'
        task.account_email = account.email
        self.save_tasks()
        
        # 创建生成器
        generator = VideoGenerator(self.account_pool)
        
        try:
            result = generator.generate_video(
                image_path=task.image_path,
                prompt=task.prompt,
                output_path=task.output_path,
                account=account
            )
            
            if result:
                task.status = 'completed'
                task.video_url = result
                task.completed_at = datetime.now().isoformat()
                print(f"✓ 任务完成: {task.task_id}")
                self.save_tasks()
                return True
            else:
                task.status = 'failed'
                task.error = "视频生成失败"
                self.save_tasks()
                return False
                
        except Exception as e:
            task.status = 'failed'
            task.error = str(e)
            self.save_tasks()
            return False
    
    def process_all(self, interval: int = 60, retry_failed: bool = True):
        """
        处理所有待处理任务
        
        Args:
            interval: 任务间隔（秒）
            retry_failed: 是否重试失败任务
        """
        tasks = self.get_pending_tasks()
        if retry_failed:
            tasks.extend(self.get_failed_tasks())
        
        if not tasks:
            print("没有待处理任务")
            return
        
        print(f"\n{'#'*60}")
        print(f"# 批量视频生成")
        print(f"# 任务数: {len(tasks)}")
        print(f"# 间隔: {interval}s")
        print(f"{'#'*60}\n")
        
        completed = 0
        failed = 0
        
        for i, task in enumerate(tasks):
            print(f"\n[{i+1}/{len(tasks)}] {datetime.now().strftime('%H:%M:%S')}")
            
            # 重置失败任务状态
            if task.status == 'failed':
                task.status = 'pending'
                task.error = None
            
            success = self.process_single_task(task)
            
            if success:
                completed += 1
            else:
                failed += 1
            
            # 间隔
            if i < len(tasks) - 1:
                wait = interval + random.randint(0, 30)
                print(f"\n等待 {wait}s...")
                time.sleep(wait)
        
        # 统计
        print(f"\n{'='*60}")
        print(f"批量生成完成")
        print(f"  成功: {completed}")
        print(f"  失败: {failed}")
        print(f"{'='*60}")
    
    def get_stats(self) -> Dict:
        """获取统计信息"""
        return {
            'total': len(self.tasks),
            'pending': len([t for t in self.tasks if t.status == 'pending']),
            'processing': len([t for t in self.tasks if t.status == 'processing']),
            'completed': len([t for t in self.tasks if t.status == 'completed']),
            'failed': len([t for t in self.tasks if t.status == 'failed']),
        }
    
    def process_parallel(self, max_workers: int = 3, retry_failed: bool = True):
        """
        并行处理多个任务（每个账号一个线程）
        
        Args:
            max_workers: 最大并行数（建议不超过可用账号数）
            retry_failed: 是否重试失败任务
        """
        tasks = self.get_pending_tasks()
        if retry_failed:
            tasks.extend(self.get_failed_tasks())
        
        if not tasks:
            print("没有待处理任务")
            return
        
        # 获取可用账号数
        available_accounts = len([a for a in self.account_pool.accounts if a.status == 'available'])
        actual_workers = min(max_workers, available_accounts, len(tasks))
        
        print(f"\n{'#'*60}")
        print(f"# 并行视频生成")
        print(f"# 任务数: {len(tasks)}")
        print(f"# 并行数: {actual_workers}")
        print(f"{'#'*60}\n")
        
        # 重置失败任务状态
        for task in tasks:
            if task.status == 'failed':
                task.status = 'pending'
                task.error = None
        self.save_tasks()
        
        completed = 0
        failed = 0
        
        with ThreadPoolExecutor(max_workers=actual_workers) as executor:
            # 提交所有任务
            future_to_task = {
                executor.submit(self.process_single_task, task): task 
                for task in tasks
            }
            
            # 收集结果
            for future in as_completed(future_to_task):
                task = future_to_task[future]
                try:
                    success = future.result()
                    if success:
                        completed += 1
                    else:
                        failed += 1
                except Exception as e:
                    print(f"任务 {task.task_id} 异常: {e}")
                    failed += 1
        
        print(f"\n{'='*60}")
        print(f"并行生成完成")
        print(f"  成功: {completed}")
        print(f"  失败: {failed}")
        print(f"{'='*60}")
    
    def process_tasks_by_ids(self, task_ids: List[str], parallel: bool = True, max_workers: int = 3) -> Dict:
        """
        处理指定的任务列表
        
        Args:
            task_ids: 任务ID列表
            parallel: 是否并行处理
            max_workers: 最大并行数
        
        Returns:
            处理结果统计
        """
        tasks = [t for t in self.tasks if t.task_id in task_ids and t.status in ['pending', 'failed']]
        
        if not tasks:
            return {'success': 0, 'failed': 0, 'skipped': len(task_ids)}
        
        # 重置状态
        for task in tasks:
            if task.status == 'failed':
                task.status = 'pending'
                task.error = None
        self.save_tasks()
        
        completed = 0
        failed = 0
        
        if parallel and len(tasks) > 1:
            available_accounts = len([a for a in self.account_pool.accounts if a.status == 'available'])
            actual_workers = min(max_workers, available_accounts, len(tasks))
            
            # 如果没有可用账号，回退到串行执行
            if actual_workers <= 0:
                print("⚠️ 没有可用账号，回退到串行执行")
                for task in tasks:
                    if self.process_single_task(task):
                        completed += 1
                    else:
                        failed += 1
                return {'success': completed, 'failed': failed, 'skipped': len(task_ids) - len(tasks)}
            
            with ThreadPoolExecutor(max_workers=actual_workers) as executor:
                future_to_task = {
                    executor.submit(self.process_single_task, task): task 
                    for task in tasks
                }
                for future in as_completed(future_to_task):
                    try:
                        if future.result():
                            completed += 1
                        else:
                            failed += 1
                    except:
                        failed += 1
        else:
            for task in tasks:
                if self.process_single_task(task):
                    completed += 1
                else:
                    failed += 1
        
        return {'success': completed, 'failed': failed, 'skipped': len(task_ids) - len(tasks)}


# CLI
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='批量视频生成')
    parser.add_argument('--add', nargs=3, metavar=('IMAGE', 'PROMPT', 'OUTPUT'),
                        help='添加单个任务')
    parser.add_argument('--add-json', type=str, help='从 JSON 文件添加任务')
    parser.add_argument('--process', action='store_true', help='处理所有任务')
    parser.add_argument('--interval', type=int, default=60, help='任务间隔秒数')
    parser.add_argument('--stats', action='store_true', help='显示统计')
    parser.add_argument('--list', action='store_true', help='列出所有任务')
    
    args = parser.parse_args()
    
    pool = AccountPool()
    batch = BatchVideoGenerator(pool)
    
    if args.add:
        task = batch.add_task(args.add[0], args.add[1], args.add[2])
        print(f"✓ 添加任务: {task.task_id}")
    
    elif args.add_json:
        with open(args.add_json, 'r', encoding='utf-8') as f:
            tasks_data = json.load(f)
        added = batch.add_tasks_from_list(tasks_data)
        print(f"✓ 添加 {len(added)} 个任务")
    
    elif args.process:
        batch.process_all(interval=args.interval)
    
    elif args.stats:
        stats = batch.get_stats()
        print(f"任务统计:")
        for k, v in stats.items():
            print(f"  {k}: {v}")
    
    elif args.list:
        for t in batch.tasks:
            print(f"[{t.status}] {t.task_id}: {t.image_path} -> {t.output_path}")
    
    else:
        parser.print_help()
