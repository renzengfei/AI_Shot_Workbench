#!/usr/bin/env python
"""
并行批量注册 - 每次注册使用独立指纹
"""
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
import time
import random
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import Optional

from .account_pool import AccountPool
from .email_receiver import EmailReceiver
from .fingerprint_manager import get_fingerprint_manager

# 全局浏览器启动锁（确保串行启动）
_browser_launch_lock = threading.Lock()


class ParallelRegister:
    """
    并行批量注册
    - 多个 Chrome 实例并行
    - 线程安全的账号分配
    - 统一的验证码接收
    """
    
    BASE_URL = "https://www.lovart.ai/zh"
    
    def __init__(
        self, 
        max_workers: int = 3,
        min_interval: int = 30,
        max_interval: int = 60
    ):
        """
        Args:
            max_workers: 最大并行数
            min_interval: 最小间隔（秒）
            max_interval: 最大间隔（秒）
        """
        self.max_workers = max_workers
        self.min_interval = min_interval
        self.max_interval = max_interval
        
        self.account_pool = AccountPool()
        self.email_receiver = EmailReceiver(self.account_pool.imap_config)
        self.fingerprint_manager = get_fingerprint_manager()
        
        # 线程安全计数
        self.lock = threading.Lock()
        self.email_lock = threading.Lock()  # 单独的邮件锁
        self.success_count = 0
        self.fail_count = 0
        self.email_index = 0
        self._worker_id = 0
    
    def _get_next_email(self) -> str:
        """线程安全地获取下一个邮箱"""
        with self.lock:
            email = self.account_pool.generate_email()
            self.email_index += 1
            return email
    
    def _get_worker_id(self) -> int:
        """线程安全地获取 worker ID"""
        with self.lock:
            wid = self._worker_id
            self._worker_id += 1
            return wid
    
    def _launch_browser(self, email: str):
        """启动带指纹的浏览器"""
        fingerprint = self.fingerprint_manager.get_or_create(email)
        print(f"   🔐 指纹: {fingerprint.fingerprint_id}")
        
        options = self.fingerprint_manager.get_chrome_options(fingerprint)
        
        # 串行启动浏览器避免冲突
        with _browser_launch_lock:
            driver = uc.Chrome(options=options, headless=False, use_subprocess=True)
            time.sleep(3)
        
        # 注入指纹 JS
        driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
            'source': self.fingerprint_manager.get_fingerprint_js(fingerprint)
        })
        
        driver.set_window_size(1280, 800)
        return driver
    
    def _close_browser(self, driver):
        """安全关闭浏览器"""
        try:
            if driver:
                driver.quit()
        except:
            pass
    
    def _register_single(self, driver, worker_id: int, email: str) -> bool:
        """
        使用指定浏览器注册单个账号
        """
        try:
            print(f"\n[Worker-{worker_id}] 开始注册: {email}")
            
            # 1. 打开页面
            driver.get(self.BASE_URL)
            time.sleep(5)
            
            # 2. 点击注册
            driver.execute_script('''
                for (const btn of document.querySelectorAll('button')) {
                    if (btn.textContent.includes('注册')) { btn.click(); break; }
                }
            ''')
            time.sleep(3)
            
            # 3. 输入邮箱
            inputs = driver.find_elements(By.CSS_SELECTOR, 'input')
            for inp in inputs:
                placeholder = inp.get_attribute('placeholder')
                if placeholder and '邮箱' in placeholder:
                    inp.clear()
                    inp.send_keys(email)
                    break
            time.sleep(1)
            
            # 4. 等待 Cloudflare
            print(f"[Worker-{worker_id}] 等待 Cloudflare...")
            for _ in range(30):
                if '成功' in driver.page_source:
                    break
                time.sleep(1)
            
            # 5. 点击继续
            time.sleep(2)
            btns = driver.find_elements(By.CSS_SELECTOR, 'button')
            for btn in btns:
                if '使用邮箱继续' in btn.text:
                    if not btn.get_attribute('disabled'):
                        btn.click()
                        break
            time.sleep(3)
            
            # 6. 获取验证码（使用单独的邮件锁）
            print(f"[Worker-{worker_id}] 获取验证码...")
            with self.email_lock:
                self.email_receiver.connect()
                code = self.email_receiver.wait_for_verification_code(
                    to_email=email,
                    timeout=120,
                    poll_interval=5
                )
                self.email_receiver.disconnect()
            
            if not code:
                print(f"[Worker-{worker_id}] ✗ 验证码失败")
                return False
            
            print(f"[Worker-{worker_id}] ✓ 验证码: {code}")
            
            # 7. 填写验证码
            inputs = driver.find_elements(By.CSS_SELECTOR, 'input')
            code_inputs = [i for i in inputs if i.get_attribute('maxlength') == '1']
            if len(code_inputs) >= 6:
                for i, digit in enumerate(code):
                    code_inputs[i].send_keys(digit)
                    time.sleep(0.1)
            
            time.sleep(5)
            
            # 8. 检查成功
            if 'AI设计师' in driver.page_source or 'canvas' in driver.current_url:
                # 保存账号（关联指纹）
                password = f"Lovart{random.randint(1000,9999)}!"
                fingerprint = self.fingerprint_manager.get_or_create(email)
                self.account_pool.add_account(email, password, fingerprint.fingerprint_id)
                
                with self.lock:
                    self.success_count += 1
                
                print(f"[Worker-{worker_id}] ✓ 注册成功: {email}")
                return True
            
            print(f"[Worker-{worker_id}] ✗ 注册失败")
            return False
            
        except Exception as e:
            print(f"[Worker-{worker_id}] ✗ 异常: {e}")
            return False
    
    def _worker(self, task_index: int):
        """
        工作线程 - 每次启动新浏览器（独立指纹），完成后关闭
        """
        email = self._get_next_email()
        worker_id = self._get_worker_id()
        driver = None
        
        try:
            # 启动带指纹的浏览器
            print(f"\n[Worker-{worker_id}] 🌐 启动浏览器...")
            driver = self._launch_browser(email)
            
            # 执行注册
            success = self._register_single(driver, worker_id, email)
            
            if not success:
                with self.lock:
                    self.fail_count += 1
        except Exception as e:
            print(f"[Worker-{worker_id}] ✗ 任务异常: {e}")
            with self.lock:
                self.fail_count += 1
        finally:
            # 无论成功失败，都关闭浏览器
            print(f"[Worker-{worker_id}] 🔒 关闭浏览器")
            self._close_browser(driver)
        
        # 随机间隔（在关闭浏览器后等待）
        interval = random.randint(self.min_interval, self.max_interval)
        print(f"[Worker-{worker_id}] 等待 {interval}s...")
        time.sleep(interval)
    
    def run(self, count: int):
        """
        并行注册指定数量的账号
        
        Args:
            count: 要注册的账号数量
        """
        print(f"\n{'#'*60}")
        print(f"# 并行批量注册")
        print(f"# 目标: {count} 个账号")
        print(f"# 并行数: {self.max_workers}")
        print(f"# 间隔: {self.min_interval}-{self.max_interval}s")
        print(f"{'#'*60}\n")
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = [executor.submit(self._worker, i) for i in range(count)]
            
            for future in as_completed(futures):
                try:
                    future.result()
                except Exception as e:
                    print(f"任务异常: {e}")
        
        # 统计
        elapsed = time.time() - start_time
        print(f"\n{'='*60}")
        print(f"并行注册完成")
        print(f"  总数: {count}")
        print(f"  成功: {self.success_count}")
        print(f"  失败: {self.fail_count}")
        print(f"  耗时: {elapsed/60:.1f} 分钟")
        print(f"  效率: {count/(elapsed/60):.1f} 个/分钟")
        print(f"{'='*60}")


# CLI
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='并行批量注册')
    parser.add_argument('-n', '--count', type=int, default=10, help='注册数量')
    parser.add_argument('-w', '--workers', type=int, default=3, help='并行数（1-5）')
    parser.add_argument('--min', type=int, default=30, help='最小间隔（秒）')
    parser.add_argument('--max', type=int, default=60, help='最大间隔（秒）')
    
    args = parser.parse_args()
    
    # 限制并行数
    workers = min(max(args.workers, 1), 5)
    
    register = ParallelRegister(
        max_workers=workers,
        min_interval=args.min,
        max_interval=args.max
    )
    
    register.run(args.count)
