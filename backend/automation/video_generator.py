#!/usr/bin/env python
"""
Lovart.ai 视频生成模块
- 登录已有账号（复用注册时的指纹）
- 上传图片
- 输入提示词
- 等待视频生成
- 下载视频
"""
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os
import requests
from typing import Optional
from datetime import datetime

from .account_pool import AccountPool, Account
from .email_receiver import EmailReceiver
from .fingerprint_manager import get_fingerprint_manager, BrowserFingerprint


class VideoGenerator:
    """Lovart.ai 视频生成器"""
    
    BASE_URL = "https://www.lovart.ai/zh"
    CANVAS_URL = "https://www.lovart.ai/canvas"
    
    def __init__(self, account_pool: AccountPool):
        self.account_pool = account_pool
        self.email_receiver = EmailReceiver(account_pool.imap_config)
        self.fingerprint_manager = get_fingerprint_manager()
        self.driver = None
        self.current_account: Optional[Account] = None
        self.current_fingerprint: Optional[BrowserFingerprint] = None
    
    def launch_browser(self, account: Account = None):
        """启动浏览器（使用账号对应的指纹）"""
        self.close()
        
        if account:
            # 获取账号对应的指纹
            self.current_fingerprint = self.fingerprint_manager.get_or_create(account.email)
            print(f"🔐 使用指纹: {self.current_fingerprint.fingerprint_id}")
            
            options = self.fingerprint_manager.get_chrome_options(self.current_fingerprint)
            self.driver = uc.Chrome(options=options, headless=False)
            
            # 注入指纹 JS
            self.driver.execute_cdp_cmd('Page.addScriptToEvaluateOnNewDocument', {
                'source': self.fingerprint_manager.get_fingerprint_js(self.current_fingerprint)
            })
        else:
            print("启动浏览器...")
            self.driver = uc.Chrome(headless=False)
        
        self.driver.set_window_size(1400, 900)
    
    def close(self):
        """关闭浏览器"""
        if self.driver:
            self.driver.quit()
            self.driver = None
    
    def login(self, account: Account) -> bool:
        """登录已有账号"""
        print(f"\n登录账号: {account.email}")
        
        # 打开页面
        self.driver.get(self.BASE_URL)
        time.sleep(5)
        
        # 点击注册/登录
        self.driver.execute_script('''
            for (const btn of document.querySelectorAll('button')) {
                if (btn.textContent.includes('注册')) { btn.click(); break; }
            }
        ''')
        time.sleep(3)
        
        # 输入邮箱
        inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input')
        for inp in inputs:
            placeholder = inp.get_attribute('placeholder')
            if placeholder and '邮箱' in placeholder:
                inp.send_keys(account.email)
                break
        
        # 等待 Cloudflare
        print("等待 Cloudflare...")
        for _ in range(30):
            if '成功' in self.driver.page_source:
                break
            time.sleep(1)
        
        # 点击继续
        time.sleep(2)
        btns = self.driver.find_elements(By.CSS_SELECTOR, 'button')
        for btn in btns:
            if '使用邮箱继续' in btn.text:
                if not btn.get_attribute('disabled'):
                    btn.click()
                    break
        
        time.sleep(3)
        
        # 获取验证码
        print("获取验证码...")
        self.email_receiver.connect()
        code = self.email_receiver.wait_for_verification_code(
            to_email=account.email,
            timeout=120,
            poll_interval=5
        )
        self.email_receiver.disconnect()
        
        if not code:
            print("✗ 验证码获取失败")
            return False
        
        print(f"✓ 验证码: {code}")
        
        # 填写验证码
        inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input')
        code_inputs = [i for i in inputs if i.get_attribute('maxlength') == '1']
        if len(code_inputs) >= 6:
            for i, digit in enumerate(code):
                code_inputs[i].send_keys(digit)
                time.sleep(0.1)
        
        time.sleep(5)
        
        # 检查登录成功
        if 'AI设计师' in self.driver.page_source or 'canvas' in self.driver.current_url:
            print("✓ 登录成功")
            self.current_account = account
            return True
        
        print("✗ 登录失败")
        return False
    
    def navigate_to_canvas(self):
        """导航到画布页面"""
        print("打开画布...")
        # 点击"立即设计"或直接访问 canvas
        try:
            btns = self.driver.find_elements(By.CSS_SELECTOR, 'button')
            for btn in btns:
                if '立即设计' in btn.text or '开始' in btn.text:
                    btn.click()
                    time.sleep(3)
                    return
        except:
            pass
        
        # 直接访问
        self.driver.get(self.CANVAS_URL)
        time.sleep(5)
    
    def upload_image(self, image_path: str) -> bool:
        """上传图片"""
        print(f"上传图片: {image_path}")
        
        if not os.path.exists(image_path):
            print(f"✗ 文件不存在: {image_path}")
            return False
        
        # 找到文件输入
        try:
            file_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="file"]')
            file_input.send_keys(os.path.abspath(image_path))
            print("✓ 图片已上传")
            time.sleep(3)
            return True
        except:
            pass
        
        # 备选：点击上传按钮
        try:
            # 找附件/上传按钮
            self.driver.execute_script('''
                const btns = document.querySelectorAll('button');
                for (const btn of btns) {
                    if (btn.querySelector('svg') && btn.className.includes('rounded')) {
                        btn.click();
                        break;
                    }
                }
            ''')
            time.sleep(1)
            
            file_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="file"]')
            file_input.send_keys(os.path.abspath(image_path))
            print("✓ 图片已上传（备选方案）")
            time.sleep(3)
            return True
        except Exception as e:
            print(f"✗ 上传失败: {e}")
            return False
    
    def send_prompt(self, prompt: str) -> bool:
        """发送提示词"""
        print(f"发送提示词: {prompt[:50]}...")
        
        try:
            # 找到输入框 (contenteditable div 或 textarea)
            input_box = None
            
            # 方法1: data-testid
            try:
                input_box = self.driver.find_element(
                    By.CSS_SELECTOR, 'div[data-testid="agent-message-input"]'
                )
            except:
                pass
            
            # 方法2: contenteditable
            if not input_box:
                try:
                    input_box = self.driver.find_element(
                        By.CSS_SELECTOR, '[contenteditable="true"]'
                    )
                except:
                    pass
            
            # 方法3: textarea
            if not input_box:
                try:
                    input_box = self.driver.find_element(By.CSS_SELECTOR, 'textarea')
                except:
                    pass
            
            if input_box:
                input_box.click()
                time.sleep(0.5)
                
                # 使用 JS 输入（更可靠）
                self.driver.execute_script(
                    "arguments[0].innerText = arguments[1]", 
                    input_box, prompt
                )
                time.sleep(0.5)
                
                # 按 Enter 发送
                from selenium.webdriver.common.keys import Keys
                input_box.send_keys(Keys.ENTER)
                
                print("✓ 提示词已发送")
                return True
            
            print("✗ 未找到输入框")
            return False
            
        except Exception as e:
            print(f"✗ 发送失败: {e}")
            return False
    
    def wait_for_video(self, timeout: int = 300) -> Optional[str]:
        """
        等待视频生成完成
        
        Returns:
            视频 URL 或 None
        """
        print(f"等待视频生成 (最长 {timeout}s)...")
        
        start = time.time()
        while time.time() - start < timeout:
            try:
                # 查找 video 元素
                videos = self.driver.find_elements(By.CSS_SELECTOR, 'video')
                for video in videos:
                    src = video.get_attribute('src')
                    if src and 'blob:' not in src:
                        print(f"✓ 视频已生成")
                        return src
                
                # 查找视频链接
                links = self.driver.find_elements(By.CSS_SELECTOR, 'a[href*=".mp4"]')
                for link in links:
                    href = link.get_attribute('href')
                    if href:
                        print(f"✓ 找到视频链接")
                        return href
                
            except:
                pass
            
            # 显示进度
            elapsed = int(time.time() - start)
            if elapsed % 30 == 0:
                print(f"   等待中... {elapsed}s")
            
            time.sleep(5)
        
        print("✗ 视频生成超时")
        return None
    
    def download_video(self, video_url: str, output_path: str) -> bool:
        """下载视频"""
        print(f"下载视频到: {output_path}")
        
        try:
            # 如果是相对路径，转为绝对路径
            if not os.path.isabs(output_path):
                output_path = os.path.abspath(output_path)
            
            # 确保目录存在
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            
            # 下载
            response = requests.get(video_url, stream=True, timeout=60)
            response.raise_for_status()
            
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            
            print(f"✓ 视频已保存: {output_path}")
            return True
            
        except Exception as e:
            print(f"✗ 下载失败: {e}")
            return False
    
    def generate_video(
        self,
        image_path: str,
        prompt: str,
        output_path: str,
        account: Optional[Account] = None
    ) -> Optional[str]:
        """
        完整的视频生成流程
        
        Args:
            image_path: 输入图片路径
            prompt: 视频提示词
            output_path: 输出视频路径
            account: 使用的账号（可选，默认从池中获取）
        
        Returns:
            成功返回视频路径，失败返回 None
        """
        print(f"\n{'='*60}")
        print(f"视频生成任务")
        print(f"  图片: {image_path}")
        print(f"  提示词: {prompt[:50]}...")
        print(f"  输出: {output_path}")
        print(f"{'='*60}\n")
        
        # 获取账号
        if not account:
            account = self.account_pool.get_available_account()
            if not account:
                print("✗ 没有可用账号")
                return None
        
        try:
            # 启动浏览器（使用账号对应的指纹）
            self.launch_browser(account)
            
            # 登录
            if not self.login(account):
                return None
            
            # 导航到画布
            self.navigate_to_canvas()
            time.sleep(3)
            
            # 上传图片
            if not self.upload_image(image_path):
                return None
            
            # 发送提示词
            if not self.send_prompt(prompt):
                return None
            
            # 等待视频生成
            video_url = self.wait_for_video(timeout=300)
            if not video_url:
                return None
            
            # 下载视频
            if not self.download_video(video_url, output_path):
                return None
            
            # 标记账号已使用
            self.account_pool.mark_used(account)
            
            print(f"\n✓ 视频生成成功: {output_path}")
            return output_path
            
        except Exception as e:
            print(f"\n✗ 生成失败: {e}")
            return None
            
        finally:
            self.close()


# 测试
if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Lovart 视频生成')
    parser.add_argument('-i', '--image', required=True, help='输入图片路径')
    parser.add_argument('-p', '--prompt', required=True, help='视频提示词')
    parser.add_argument('-o', '--output', required=True, help='输出视频路径')
    
    args = parser.parse_args()
    
    pool = AccountPool()
    generator = VideoGenerator(pool)
    
    result = generator.generate_video(
        image_path=args.image,
        prompt=args.prompt,
        output_path=args.output
    )
    
    if result:
        print(f"\n成功！视频: {result}")
    else:
        print("\n失败！")
