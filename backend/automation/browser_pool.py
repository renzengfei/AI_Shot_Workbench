#!/usr/bin/env python
"""
浏览器实例池 - 支持多 Chrome 并行
"""
import undetected_chromedriver as uc
import threading
import queue
import time
from typing import Optional, List
from dataclasses import dataclass
from contextlib import contextmanager


@dataclass
class BrowserInstance:
    """浏览器实例"""
    id: int
    driver: uc.Chrome
    in_use: bool = False
    created_at: float = 0
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = time.time()


class BrowserPool:
    """
    浏览器实例池
    - 支持多个 Chrome 实例并行
    - 自动分配和回收
    - 线程安全
    """
    
    def __init__(self, max_size: int = 3, headless: bool = False):
        """
        Args:
            max_size: 最大并行浏览器数
            headless: 是否无头模式
        """
        self.max_size = max_size
        self.headless = headless
        self.instances: List[BrowserInstance] = []
        self.available = queue.Queue()
        self.lock = threading.Lock()
        self._next_id = 0
    
    def _create_instance(self) -> BrowserInstance:
        """创建新浏览器实例"""
        print(f"🌐 创建浏览器实例 #{self._next_id}...")
        
        options = uc.ChromeOptions()
        # 不用 headless 模式，改用隐藏窗口来绕过 Cloudflare 检测
        
        # 每个实例使用不同的用户数据目录
        user_data_dir = f"/tmp/chrome_pool_{self._next_id}"
        options.add_argument(f'--user-data-dir={user_data_dir}')
        
        # 使用 subprocess 避免冲突
        driver = uc.Chrome(options=options, headless=False, use_subprocess=True)
        
        # 等待浏览器稳定
        time.sleep(3)
        
        driver.set_window_size(1400, 900)
        
        # 隐藏窗口（想看时点击 Dock 上的 Chrome 图标）
        if self.headless:
            from .browser_utils import hide_chrome_window
            hide_chrome_window()
        
        instance = BrowserInstance(
            id=self._next_id,
            driver=driver
        )
        self._next_id += 1
        
        return instance
    
    def acquire(self, timeout: float = 300) -> Optional[BrowserInstance]:
        """
        获取一个可用的浏览器实例
        
        Args:
            timeout: 等待超时（秒）
        
        Returns:
            BrowserInstance 或 None
        """
        start = time.time()
        
        while time.time() - start < timeout:
            with self.lock:
                # 1. 尝试获取空闲实例
                for inst in self.instances:
                    if not inst.in_use:
                        inst.in_use = True
                        print(f"♻️ 复用浏览器 #{inst.id}")
                        return inst
                
                # 2. 如果没有达到上限，创建新实例
                if len(self.instances) < self.max_size:
                    inst = self._create_instance()
                    inst.in_use = True
                    self.instances.append(inst)
                    return inst
            
            # 3. 等待有实例释放
            time.sleep(1)
        
        print("⚠️ 获取浏览器超时")
        return None
    
    def release(self, instance: BrowserInstance):
        """释放浏览器实例"""
        with self.lock:
            instance.in_use = False
            print(f"🔓 释放浏览器 #{instance.id}")
    
    @contextmanager
    def get_browser(self, timeout: float = 300):
        """
        上下文管理器方式获取浏览器
        
        Usage:
            with pool.get_browser() as browser:
                browser.driver.get("https://...")
        """
        instance = self.acquire(timeout)
        if not instance:
            raise RuntimeError("无法获取浏览器实例")
        
        try:
            yield instance
        finally:
            self.release(instance)
    
    def close_all(self):
        """关闭所有浏览器"""
        with self.lock:
            for inst in self.instances:
                try:
                    inst.driver.quit()
                    print(f"✓ 关闭浏览器 #{inst.id}")
                except:
                    pass
            self.instances.clear()
    
    def stats(self) -> dict:
        """获取池状态"""
        with self.lock:
            return {
                "total": len(self.instances),
                "in_use": sum(1 for i in self.instances if i.in_use),
                "available": sum(1 for i in self.instances if not i.in_use),
                "max_size": self.max_size
            }


# 全局浏览器池
_pool: Optional[BrowserPool] = None


def get_browser_pool(max_size: int = 3) -> BrowserPool:
    """获取全局浏览器池"""
    global _pool
    if _pool is None:
        _pool = BrowserPool(max_size=max_size)
    return _pool
