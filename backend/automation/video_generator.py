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
            # 更严格的检测：检查是否有"注册"按钮（未登录时显示）
            is_logged_in = self.driver.execute_script('''
                // 如果有"注册"按钮，说明未登录
                const btns = document.querySelectorAll('button');
                for (const btn of btns) {
                    if (btn.textContent.trim() === '注册') {
                        return false;  // 未登录
                    }
                }
                // 检查是否有用户头像或积分显示
                const hasAvatar = document.querySelector('img[alt*="avatar"], [class*="avatar"]');
                const hasCredits = document.querySelector('[class*="credit"], [class*="point"]');
                return hasAvatar || hasCredits || window.location.href.includes('/home');
            ''')
            
            if is_logged_in:
                print("   ✓ 已登录（session 有效）")
                self.close_popups()  # 关闭可能的弹窗
                self.current_account = account
                return True
            
            print("   未登录，执行登录流程...")
            
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
        """关闭可能的弹窗（新会员特惠、升级套餐等）"""
        from selenium.webdriver.common.keys import Keys
        from selenium.webdriver.common.action_chains import ActionChains
        
        # 方法0: 点击 paywall 关闭按钮（升级套餐弹窗）
        try:
            close_btn = self.driver.find_element(By.CSS_SELECTOR, '[data-testid="paywall-close"]')
            close_btn.click()
            print("   关闭弹窗: paywall-close")
            time.sleep(0.5)
            return  # 成功关闭，直接返回
        except:
            pass
        
        # 方法1: 按 ESC 关闭弹窗
        try:
            body = self.driver.find_element(By.TAG_NAME, 'body')
            body.send_keys(Keys.ESCAPE)
            time.sleep(0.3)
        except:
            pass
        
        # 方法2: 点击弹窗外部区域
        try:
            ActionChains(self.driver).move_by_offset(10, 10).click().perform()
            ActionChains(self.driver).move_by_offset(-10, -10).perform()  # 重置位置
            time.sleep(0.3)
        except:
            pass
        
        for _ in range(3):  # 多次尝试，可能有多个弹窗
            try:
                closed = self.driver.execute_script('''
                    // 1. 点击"放弃免费积分"
                    const btns = document.querySelectorAll('button');
                    for (const btn of btns) {
                        if (btn.textContent.includes('放弃')) {
                            btn.click();
                            return 'closed_abandon';
                        }
                    }
                    
                    // 2. 点击各种关闭按钮 (X 图标)
                    const closeSelectors = [
                        'button[aria-label="close"]',
                        'button[aria-label="Close"]',
                        '[class*="close"]',
                        '[class*="Close"]',
                        'svg[class*="close"]',
                        // 弹窗右上角的 X 按钮
                        'div[class*="modal"] button',
                        'div[class*="dialog"] button'
                    ];
                    
                    for (const sel of closeSelectors) {
                        const el = document.querySelector(sel);
                        if (el) {
                            el.click();
                            return 'closed_x';
                        }
                    }
                    
                    // 3. 查找并点击包含 X 或 × 的按钮
                    for (const btn of document.querySelectorAll('button')) {
                        if (btn.textContent.trim() === '×' || btn.textContent.trim() === 'X') {
                            btn.click();
                            return 'closed_x_text';
                        }
                    }
                    
                    // 4. 点击 SVG 关闭图标（X 形状的 path）
                    const svgs = document.querySelectorAll('svg');
                    for (const svg of svgs) {
                        const parent = svg.closest('button, [role="button"]');
                        if (parent && svg.querySelector('path[d*="M6"]')) {  // X 形状通常以 M6 开头
                            parent.click();
                            return 'closed_svg';
                        }
                    }
                    
                    return null;
                ''')
                
                if closed:
                    print(f"   关闭弹窗: {closed}")
                    time.sleep(0.5)
                else:
                    break  # 没有更多弹窗
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
        
        # 处理 HTTP URL：如果是本地服务的 URL，转换为本地文件路径
        if image_path.startswith('http://') or image_path.startswith('https://'):
            # 提取 URL 中的路径部分，例如 http://127.0.0.1:8000/workspaces/7/... -> workspaces/7/...
            from urllib.parse import urlparse, unquote
            parsed = urlparse(image_path)
            url_path = unquote(parsed.path)  # 解码 URL 编码的中文字符
            
            # 找到 workspaces 的位置并构建本地路径
            if '/workspaces/' in url_path:
                rel_path = url_path[url_path.index('/workspaces/') + 1:]  # 去掉开头的 /
                # 获取项目根目录（backend 的上一级）
                project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                abs_path = os.path.join(project_root, rel_path)
            else:
                print(f"✗ 无法解析 URL 路径: {image_path}")
                return False
        else:
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
            
            # 方法2: 使用 JavaScript 模拟拖拽上传
            print("   尝试 JS 拖拽上传...")
            try:
                # 读取图片文件为 base64
                import base64
                with open(abs_path, 'rb') as f:
                    file_data = base64.b64encode(f.read()).decode('utf-8')
                
                file_name = os.path.basename(abs_path)
                
                # 使用 JavaScript 模拟拖拽事件
                result = self.driver.execute_script('''
                    const base64Data = arguments[0];
                    const fileName = arguments[1];
                    
                    // 将 base64 转换为 Blob
                    const byteCharacters = atob(base64Data);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'image/png' });
                    
                    // 创建 File 对象
                    const file = new File([blob], fileName, { type: 'image/png' });
                    
                    // 找到输入框
                    const dropTarget = document.querySelector('[data-testid="agent-message-input"]');
                    if (!dropTarget) {
                        return 'target_not_found';
                    }
                    
                    // 创建 DataTransfer 对象
                    const dataTransfer = new DataTransfer();
                    dataTransfer.items.add(file);
                    
                    // 创建并触发 drop 事件
                    const dropEvent = new DragEvent('drop', {
                        bubbles: true,
                        cancelable: true,
                        dataTransfer: dataTransfer
                    });
                    
                    // 先触发 dragenter 和 dragover
                    const dragEnter = new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dataTransfer });
                    const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dataTransfer });
                    
                    dropTarget.dispatchEvent(dragEnter);
                    dropTarget.dispatchEvent(dragOver);
                    dropTarget.dispatchEvent(dropEvent);
                    
                    return 'drop_triggered';
                ''', file_data, file_name)
                
                print(f"   拖拽结果: {result}")
                
                if result == 'drop_triggered':
                    time.sleep(3)
                    print("   ✓ 拖拽上传完成")
                    return True
                    
            except Exception as e:
                print(f"   拖拽上传失败: {e}")
            
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
                time.sleep(0.3)
                
                from selenium.webdriver.common.keys import Keys
                import subprocess
                
                # 使用剪贴板粘贴（对 Lexical 编辑器更可靠）
                # 复制提示词到剪贴板
                subprocess.run(['pbcopy'], input=full_prompt.encode('utf-8'), check=True)
                
                # 移动到末尾（Cmd+End）
                input_box.send_keys(Keys.COMMAND + Keys.ARROW_DOWN)
                time.sleep(0.2)
                
                # 添加空格分隔
                input_box.send_keys(' ')
                
                # 粘贴（Cmd+V）
                input_box.send_keys(Keys.COMMAND + 'v')
                time.sleep(0.8)
                
                # 截图确认输入
                self.driver.save_screenshot('/tmp/before_send.png')
                
                # 点击发送按钮（输入框右边的蓝色圆形按钮）
                # 获取按钮坐标后使用 ActionChains 点击
                from selenium.webdriver.common.action_chains import ActionChains
                
                btn_info = self.driver.execute_script('''
                    // 找所有按钮，返回坐标信息
                    const btns = document.querySelectorAll('button');
                    const results = [];
                    for (const btn of btns) {
                        const rect = btn.getBoundingClientRect();
                        const style = window.getComputedStyle(btn);
                        results.push({
                            x: rect.x + rect.width/2,
                            y: rect.y + rect.height/2,
                            width: rect.width,
                            height: rect.height,
                            bg: style.backgroundColor,
                            className: btn.className,
                            hasSvg: !!btn.querySelector('svg')
                        });
                    }
                    return results;
                ''')
                
                # 找实心蓝色背景的圆形按钮（发送按钮）
                # 注意：半透明蓝色 rgba(61, 155, 255, 0.1) 是模型选择按钮，要跳过
                send_btn = None
                for btn in btn_info:
                    bg = btn.get('bg', '')
                    # 只找实心蓝色 rgb(...)，跳过半透明 rgba(..., 0.1)
                    if 'rgba' in bg and ', 0.' in bg:
                        continue  # 跳过半透明按钮
                    # 各种实心蓝色变体
                    if ('59, 130, 246' in bg or '37, 99, 235' in bg or 
                        '96, 165, 250' in bg or '14, 165, 233' in bg or
                        '61, 155, 255' in bg):  # Lovart 的蓝色
                        send_btn = btn
                        break
                
                clicked = False
                if send_btn:
                    print(f"   找到蓝色按钮: x={send_btn['x']}, y={send_btn['y']}, bg={send_btn['bg']}")
                    # 使用坐标点击
                    actions = ActionChains(self.driver)
                    actions.move_by_offset(int(send_btn['x']), int(send_btn['y'])).click().perform()
                    actions.reset_actions()
                    clicked = 'coord_click'
                else:
                    # 打印所有按钮信息用于调试
                    print(f"   未找到蓝色按钮，所有按钮: {len(btn_info)}")
                    for i, btn in enumerate(btn_info[:10]):
                        print(f"     {i}: bg={btn['bg'][:30]}, class={btn['className'][:30]}")
                
                print(f"   发送按钮点击: {clicked}")
                
                if not clicked:
                    # 备用: 按 Enter 发送
                    print("   使用 Enter 键发送")
                    input_box.send_keys(Keys.ENTER)
                
                time.sleep(2)
                
                # 检查是否有新标签页打开（Lovart 在新标签页生成视频）
                if len(self.driver.window_handles) > 1:
                    # 切换到最新的标签页
                    self.driver.switch_to.window(self.driver.window_handles[-1])
                    print("   ✓ 切换到新标签页（视频生成页）")
                    time.sleep(2)
                
                self.driver.save_screenshot('/tmp/after_send.png')
                
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
        print(f"   当前页面: {self.driver.current_url}")
        
        # 已知的教学/示例视频 URL 模式（需要排除）
        tutorial_patterns = ['tutorial', 'demo', 'example', 'guide', 'intro']
        
        # 记录初始的视频 URL（可能是教学视频）
        initial_video_urls = set()
        try:
            for video in self.driver.find_elements(By.CSS_SELECTOR, 'video'):
                src = video.get_attribute('src')
                if src:
                    initial_video_urls.add(src)
            print(f"   初始视频数量: {len(initial_video_urls)}")
        except:
            pass
        
        start = time.time()
        last_progress = None
        
        while time.time() - start < timeout:
            try:
                elapsed = int(time.time() - start)
                
                # 截图调试
                if elapsed % 30 == 0:
                    self.driver.save_screenshot(f'/tmp/video_wait_{elapsed}.png')
                
                # 检查是否还在生成中（查找进度指示器）
                generating = self.driver.execute_script('''
                    // 检查各种生成中的指示器
                    const loadingTexts = ['生成中', 'Generating', 'Loading', '处理中', 'Processing'];
                    const bodyText = document.body.innerText;
                    for (const text of loadingTexts) {
                        if (bodyText.includes(text)) return text;
                    }
                    
                    // 检查进度条
                    const progress = document.querySelector('[class*="progress"], [role="progressbar"]');
                    if (progress) {
                        const width = progress.style.width || progress.getAttribute('aria-valuenow');
                        if (width && width !== '100%' && width !== '100') {
                            return 'progress: ' + width;
                        }
                    }
                    
                    // 检查加载动画
                    const spinner = document.querySelector('[class*="spinner"], [class*="loading"], [class*="animate-spin"]');
                    if (spinner && spinner.offsetParent !== null) {
                        return 'spinner';
                    }
                    
                    return null;
                ''')
                
                if generating and generating != last_progress:
                    print(f"   生成状态: {generating}")
                    last_progress = generating
                
                # 如果还在生成中，继续等待
                if generating:
                    time.sleep(5)
                    continue
                
                # 查找新的视频元素（排除初始的教学视频）
                videos = self.driver.find_elements(By.CSS_SELECTOR, 'video')
                for video in videos:
                    src = video.get_attribute('src')
                    if not src:
                        continue
                    
                    # 跳过初始视频和教学视频
                    if src in initial_video_urls:
                        continue
                    if any(p in src.lower() for p in tutorial_patterns):
                        continue
                    
                    # 检查是否是生成的视频（通常包含 assets-persist 和唯一 ID）
                    if 'assets-persist' in src or 'generated' in src or len(src) > 100:
                        print(f"✓ 视频已生成: {src[:80]}...")
                        return src
                    
                    # blob URL 需要特殊处理
                    if 'blob:' in src:
                        sources = video.find_elements(By.CSS_SELECTOR, 'source')
                        for source in sources:
                            real_src = source.get_attribute('src')
                            if real_src and 'blob:' not in real_src:
                                if real_src not in initial_video_urls:
                                    print(f"✓ 视频已生成 (source)")
                                    return real_src
                
                # 查找下载按钮（生成完成后通常会显示）
                download_btns = self.driver.find_elements(By.CSS_SELECTOR, 
                    '[data-testid*="download"], button[class*="download"], a[download]')
                for btn in download_btns:
                    # 检查按钮是否可见
                    if not btn.is_displayed():
                        continue
                    href = btn.get_attribute('href')
                    if href and '.mp4' in href:
                        print(f"✓ 找到下载链接")
                        return href
                    # 尝试点击下载按钮获取链接
                    try:
                        onclick = btn.get_attribute('onclick')
                        if onclick and 'download' in onclick.lower():
                            btn.click()
                            time.sleep(1)
                    except:
                        pass
                
            except Exception as e:
                print(f"   检查异常: {e}")
            
            # 显示进度
            if elapsed % 30 == 0 and elapsed > 0:
                print(f"   等待中... {elapsed}s")
            
            time.sleep(5)
        
        print("✗ 视频生成超时")
        self.driver.save_screenshot('/tmp/video_timeout.png')
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
