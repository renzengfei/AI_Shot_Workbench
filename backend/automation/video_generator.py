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
    HOME_URL = "https://www.lovart.ai/zh/home"
    
    # 视频生成提示词前缀（使用 Hailuo 2.3 首尾帧功能）
    VIDEO_PROMPT_PREFIX = "请严格采用Hailuo 2.3模型中的首尾帧功能，生成6秒的高清视频，请严格按照视频提示词进行生成："
    
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
        
        try:
            # 打开页面
            self.driver.get(self.BASE_URL)
            time.sleep(5)
            
            # 检查是否已登录（指纹浏览器可能保存了 session）
            page = self.driver.page_source
            if '升级' in page or '积分' in page or 'home' in self.driver.current_url:
                print("   ✓ 已登录（session 有效）")
                self.close_popups()  # 关闭可能的弹窗
                self.current_account = account
                return True
            
            # 点击注册/登录
            self.driver.execute_script('''
                for (const btn of document.querySelectorAll('button')) {
                    if (btn.textContent.includes('注册')) { btn.click(); break; }
                }
            ''')
            time.sleep(5)
            
            # 输入邮箱（多种选择器尝试）
            email_entered = False
            for _ in range(10):
                try:
                    # 方法1: type="email"
                    email_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="email"]')
                    email_input.clear()
                    email_input.send_keys(account.email)
                    email_entered = True
                    print(f"   邮箱已输入: {account.email}")
                    break
                except:
                    pass
                
                # 方法2: placeholder 包含邮箱
                inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input')
                for inp in inputs:
                    try:
                        placeholder = inp.get_attribute('placeholder') or ''
                        input_type = inp.get_attribute('type') or ''
                        if '邮箱' in placeholder or 'email' in input_type.lower():
                            inp.clear()
                            inp.send_keys(account.email)
                            email_entered = True
                            print(f"   邮箱已输入: {account.email}")
                            break
                    except:
                        pass
                if email_entered:
                    break
                time.sleep(1)
            
            if not email_entered:
                print("   ⚠️ 未找到邮箱输入框")
            
            # 等待 Cloudflare
            print("等待 Cloudflare...")
            cf_passed = False
            for _ in range(60):
                page = self.driver.page_source
                if '验证成功' in page or '成功' in page:
                    cf_passed = True
                    print("   ✓ Cloudflare 通过")
                    break
                time.sleep(1)
            
            if not cf_passed:
                print("   ⚠️ Cloudflare 超时，继续尝试...")
            
            # 点击继续按钮（记录时间戳用于过滤旧邮件）
            time.sleep(2)
            request_time = time.time()  # 记录请求时间
            clicked = False
            for _ in range(10):
                btns = self.driver.find_elements(By.CSS_SELECTOR, 'button')
                for btn in btns:
                    try:
                        if '使用邮箱继续' in btn.text and not btn.get_attribute('disabled'):
                            self.driver.execute_script("arguments[0].click()", btn)
                            clicked = True
                            print("   ✓ 点击继续")
                            break
                    except:
                        pass
                if clicked:
                    break
                time.sleep(1)
            
            time.sleep(3)
            
            # 获取验证码（只接受请求时间之后的邮件）
            print("获取验证码...")
            self.email_receiver.connect()
            code = self.email_receiver.wait_for_verification_code(
                to_email=account.email,
                timeout=120,
                poll_interval=5,
                request_timestamp=request_time
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
                for i, digit in enumerate(code[:6]):
                    code_inputs[i].send_keys(digit)
                    time.sleep(0.15)
                print("   ✓ 验证码已填写")
            else:
                # 备选：尝试其他输入框
                for i in range(6):
                    try:
                        inp = self.driver.find_element(
                            By.CSS_SELECTOR, f'input[data-testid="undefined-input-{i}"]'
                        )
                        inp.send_keys(code[i])
                        time.sleep(0.1)
                    except:
                        pass
            
            # 等待登录完成
            print("等待登录...")
            time.sleep(8)
            
            # 检查登录成功（多种检测方式）
            page = self.driver.page_source
            url = self.driver.current_url
            
            if any([
                'AI设计师' in page,
                'canvas' in url,
                '立即设计' in page,
                '工作台' in page
            ]):
                print("✓ 登录成功")
                self.current_account = account
                return True
            
            # 截图调试
            try:
                self.driver.save_screenshot('/tmp/lovart_login_debug.png')
                print("   调试截图: /tmp/lovart_login_debug.png")
            except:
                pass
            
            print("✗ 登录失败")
            return False
            
        except Exception as e:
            print(f"✗ 登录异常: {e}")
            return False
    
    def close_popups(self):
        """关闭可能的弹窗"""
        try:
            self.driver.execute_script('''
                // 点击"放弃免费积分"或关闭按钮
                const btns = document.querySelectorAll('button');
                for (const btn of btns) {
                    if (btn.textContent.includes('放弃')) {
                        btn.click(); return;
                    }
                }
                // 点击 X 关闭
                const closeBtn = document.querySelector('[class*="close"]');
                if (closeBtn) closeBtn.click();
            ''')
            time.sleep(0.5)
        except:
            pass
    
    def navigate_to_home(self):
        """导航到 Home 页面（视频生成入口）"""
        print("打开 Home 页面...")
        self.close_popups()
        
        # 检查是否已在 home
        if '/home' in self.driver.current_url:
            print("   已在 Home 页面")
            self.close_popups()
            time.sleep(2)
            return
        
        # 直接访问 home 页面
        print(f"   访问: {self.HOME_URL}")
        self.driver.get(self.HOME_URL)
        time.sleep(5)
        
        # 关闭可能的弹窗
        self.close_popups()
        time.sleep(1)
    
    def upload_image(self, image_path: str) -> bool:
        """上传图片（点击附件按钮后上传）"""
        print(f"上传图片: {image_path}")
        
        # 先关闭弹窗
        self.close_popups()
        time.sleep(1)
        
        abs_path = os.path.abspath(image_path)
        if not os.path.exists(abs_path):
            print(f"✗ 文件不存在: {abs_path}")
            return False
        
        try:
            # 方法1: 直接找隐藏的 file input
            file_inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input[type="file"]')
            for fi in file_inputs:
                try:
                    fi.send_keys(abs_path)
                    print("   ✓ 直接上传成功")
                    time.sleep(3)
                    return True
                except:
                    pass
            
            # 方法2: 点击附件按钮（回形针图标）
            print("   尝试点击附件按钮...")
            clicked = self.driver.execute_script('''
                // 方法A: 找输入框附近的附件图标
                const inputArea = document.querySelector('[contenteditable="true"]') || 
                                  document.querySelector('input[placeholder*="Lovart"]') ||
                                  document.querySelector('[data-testid="agent-message-input"]');
                if (inputArea) {
                    const parent = inputArea.closest('div');
                    if (parent) {
                        const btns = parent.querySelectorAll('button, [role="button"]');
                        for (const btn of btns) {
                            if (btn.querySelector('svg')) {
                                btn.click();
                                return true;
                            }
                        }
                    }
                }
                
                // 方法B: 找所有带 svg 的按钮
                const allBtns = document.querySelectorAll('button');
                for (const btn of allBtns) {
                    const svg = btn.querySelector('svg');
                    if (svg && btn.className.includes('rounded')) {
                        btn.click();
                        return true;
                    }
                }
                
                // 方法C: 找附件图标（回形针）
                const attachIcons = document.querySelectorAll('svg');
                for (const svg of attachIcons) {
                    const path = svg.querySelector('path');
                    if (path && path.getAttribute('d')?.startsWith('M16')) {
                        svg.parentElement.click();
                        return true;
                    }
                }
                return false;
            ''')
            
            if clicked:
                time.sleep(1)
                # 现在应该有 file input 可见了
                file_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="file"]')
                file_input.send_keys(abs_path)
                print("   ✓ 通过附件按钮上传成功")
                time.sleep(3)
                return True
            
            # 方法3: 遍历所有 file input（包括隐藏的）
            print("   尝试查找隐藏的 file input...")
            all_inputs = self.driver.execute_script('''
                const inputs = document.querySelectorAll('input[type="file"]');
                return inputs.length;
            ''')
            print(f"   找到 {all_inputs} 个 file input")
            
            if all_inputs > 0:
                # 使 file input 可见并发送文件
                self.driver.execute_script('''
                    const inputs = document.querySelectorAll('input[type="file"]');
                    for (const inp of inputs) {
                        inp.style.display = 'block';
                        inp.style.visibility = 'visible';
                        inp.style.opacity = '1';
                        inp.style.position = 'fixed';
                        inp.style.top = '0';
                        inp.style.left = '0';
                        inp.style.zIndex = '99999';
                    }
                ''')
                time.sleep(0.5)
                file_input = self.driver.find_element(By.CSS_SELECTOR, 'input[type="file"]')
                file_input.send_keys(abs_path)
                print("   ✓ 隐藏 input 上传成功")
                time.sleep(3)
                return True
            
            # 方法4: 分析页面结构，调试输出
            print("   分析页面结构...")
            page_info = self.driver.execute_script('''
                const info = {
                    url: window.location.href,
                    fileInputs: document.querySelectorAll('input[type="file"]').length,
                    buttons: [],
                    editables: []
                };
                
                // 找所有按钮
                document.querySelectorAll('button').forEach(btn => {
                    if (btn.querySelector('svg')) {
                        info.buttons.push({
                            text: btn.textContent?.slice(0, 30),
                            class: btn.className?.slice(0, 50)
                        });
                    }
                });
                
                // 找可编辑区域
                document.querySelectorAll('[contenteditable="true"], textarea').forEach(el => {
                    info.editables.push({
                        tag: el.tagName,
                        class: el.className?.slice(0, 50)
                    });
                });
                
                return info;
            ''')
            print(f"   页面 URL: {page_info.get('url', 'N/A')}")
            print(f"   file inputs: {page_info.get('fileInputs', 0)}")
            print(f"   SVG 按钮: {len(page_info.get('buttons', []))}")
            for btn in page_info.get('buttons', [])[:5]:
                print(f"      - {btn}")
            
            # 方法5: 点击输入框旁边的第一个按钮
            print("   尝试点击输入框旁的按钮...")
            self.driver.execute_script('''
                // 找到输入区域
                const input = document.querySelector('[contenteditable="true"]') ||
                              document.querySelector('textarea') ||
                              document.querySelector('[placeholder*="Lovart"]');
                if (input) {
                    // 向上找父容器
                    let container = input.parentElement;
                    for (let i = 0; i < 5 && container; i++) {
                        const btns = container.querySelectorAll('button');
                        if (btns.length > 0) {
                            btns[0].click();  // 点击第一个按钮（通常是附件）
                            return true;
                        }
                        container = container.parentElement;
                    }
                }
                return false;
            ''')
            time.sleep(1)
            
            # 再次尝试找 file input
            file_inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input[type="file"]')
            if file_inputs:
                file_inputs[0].send_keys(abs_path)
                print("   ✓ 点击按钮后上传成功")
                time.sleep(3)
                return True
            
        except Exception as e:
            print(f"✗ 上传异常: {e}")
        
        # 最终: 截图调试
        try:
            self.driver.save_screenshot('/tmp/lovart_upload_debug.png')
            print(f"   调试截图: /tmp/lovart_upload_debug.png")
            
            # 保存页面 HTML 用于分析
            html = self.driver.page_source
            with open('/tmp/lovart_page.html', 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"   页面 HTML: /tmp/lovart_page.html")
        except:
            pass
        
        print("✗ 所有上传方法均失败")
        return False
    
    def send_prompt(self, prompt: str, add_video_prefix: bool = True) -> bool:
        """
        发送提示词
        
        Args:
            prompt: 视频动作描述
            add_video_prefix: 是否添加 Hailuo 2.3 视频生成前缀
        """
        # 构建完整提示词
        if add_video_prefix:
            full_prompt = f"{self.VIDEO_PROMPT_PREFIX}{prompt}"
        else:
            full_prompt = prompt
        
        print(f"发送提示词: {full_prompt[:80]}...")
        
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
            
            # 方法4: placeholder 包含 Lovart
            if not input_box:
                try:
                    inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input, textarea')
                    for inp in inputs:
                        placeholder = inp.get_attribute('placeholder') or ''
                        if 'Lovart' in placeholder or '设计' in placeholder:
                            input_box = inp
                            break
                except:
                    pass
            
            if input_box:
                input_box.click()
                time.sleep(0.5)
                
                # 使用 JS 输入（更可靠）
                tag_name = input_box.tag_name.lower()
                if tag_name in ['input', 'textarea']:
                    input_box.clear()
                    input_box.send_keys(full_prompt)
                else:
                    # contenteditable div
                    self.driver.execute_script(
                        "arguments[0].innerText = arguments[1]", 
                        input_box, full_prompt
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
            
            # 直接访问 Home 页面
            self.navigate_to_home()
            time.sleep(2)
            
            # 上传图片（在输入提示词前上传）
            if not self.upload_image(image_path):
                return None
            
            # 发送提示词（自动添加 Hailuo 2.3 前缀）
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
