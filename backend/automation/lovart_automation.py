# lovart_automation.py - Lovart.ai 自动化（Playwright）
import asyncio
import os
import random
from typing import Optional
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

from .account_pool import AccountPool, Account
from .email_receiver import EmailReceiver


class LovartAutomation:
    """Lovart.ai 网页自动化：注册、登录、视频生成"""
    
    BASE_URL = "https://www.lovart.ai/zh"
    HOME_URL = "https://www.lovart.ai/zh/home"
    
    # 页面元素选择器（来自文档）
    SELECTORS = {
        # 登录/注册
        "register_button": 'button:has(span.mantine-Button-label:text("注册"))',
        "email_input": 'input[type="email"]',
        "success_text": '#success-text',
        "continue_button": 'button:has(span.mantine-Button-label:text("使用邮箱继续"))',
        # 验证码输入框（6位）
        "code_input_0": 'input[data-testid="undefined-input-0"]',
        "code_input_1": 'input[data-testid="undefined-input-1"]',
        "code_input_2": 'input[data-testid="undefined-input-2"]',
        "code_input_3": 'input[data-testid="undefined-input-3"]',
        "code_input_4": 'input[data-testid="undefined-input-4"]',
        "code_input_5": 'input[data-testid="undefined-input-5"]',
        
        # Canvas 页面
        "message_input": 'div[data-testid="agent-message-input"]',
        "attachment_button": 'button.rounded-full:has(svg path[d^="M16 1.1"])',
        "file_input": 'input[type="file"]',
        
        # 视频结果
        "video_element": 'video',
        "download_button": 'button:has(svg path[d*="M7.858 2.023"])',
    }
    
    def __init__(self, account_pool: AccountPool, headless: bool = False):
        self.account_pool = account_pool
        self.headless = headless
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.email_receiver: Optional[EmailReceiver] = None
        
        if account_pool.imap_config:
            self.email_receiver = EmailReceiver(account_pool.imap_config)
    
    async def launch_browser(self, user_data_dir: str = None):
        """
        启动浏览器（使用持久化配置文件绕过 Cloudflare）
        
        Args:
            user_data_dir: Chrome 用户数据目录，用于保存登录状态和绕过 Cloudflare
        """
        self._playwright = await async_playwright().start()
        
        # 默认用户数据目录
        if not user_data_dir:
            import os
            user_data_dir = os.path.join(os.path.dirname(__file__), "chrome_profile")
            os.makedirs(user_data_dir, exist_ok=True)
        
        # 使用持久化上下文（保存 cookies 和 Cloudflare 验证状态）
        self.context = await self._playwright.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=self.headless,
            channel="chrome",
            viewport={"width": 1920, "height": 1080},
            locale="zh-CN",
            timezone_id="Asia/Shanghai",
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        
        # 注入反检测脚本
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
        """)
        
        # 使用现有页面或创建新页面
        pages = self.context.pages
        self.page = pages[0] if pages else await self.context.new_page()
        self.browser = None  # persistent context 没有单独的 browser
        
        return self.page
    
    async def close(self):
        """关闭浏览器"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if hasattr(self, '_playwright') and self._playwright:
            await self._playwright.stop()
        if self.email_receiver:
            self.email_receiver.disconnect()
    
    async def navigate_to_home(self):
        """导航到首页"""
        await self.page.goto(self.HOME_URL, wait_until="networkidle")
        await asyncio.sleep(2)
    
    async def is_logged_in(self) -> bool:
        """检查是否已登录"""
        await self.page.goto(self.HOME_URL, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # 检查是否有注册按钮（未登录状态）
        register_btn = await self.page.query_selector(self.SELECTORS["register_button"])
        return register_btn is None
    
    async def login_or_register(self, account: Account) -> bool:
        """登录或注册流程"""
        print(f"开始登录/注册: {account.email}")
        
        await self.page.goto(self.BASE_URL, wait_until="networkidle")
        await asyncio.sleep(1)
        
        # 点击注册按钮
        try:
            register_btn = await self.page.wait_for_selector(
                self.SELECTORS["register_button"], timeout=10000
            )
            await register_btn.click()
            await asyncio.sleep(1)
        except Exception as e:
            print(f"找不到注册按钮: {e}")
            return False
        
        # 输入邮箱
        email_input = await self.page.wait_for_selector(
            self.SELECTORS["email_input"], timeout=5000
        )
        await email_input.fill(account.email)
        await asyncio.sleep(1)
        
        # 等待邮箱验证成功标识
        try:
            await self.page.wait_for_selector(
                self.SELECTORS["success_text"], timeout=30000
            )
            print("✓ 邮箱验证成功")
        except:
            print("✗ 等待邮箱验证超时")
            return False
        
        # 点击"使用邮箱继续"
        continue_btn = await self.page.wait_for_selector(
            self.SELECTORS["continue_button"], timeout=5000
        )
        await continue_btn.click()
        await asyncio.sleep(2)
        
        # 等待并获取验证码
        print("等待验证码邮件...")
        if self.email_receiver:
            self.email_receiver.connect()
            code = self.email_receiver.wait_for_verification_code(
                to_email=account.email,
                timeout=120,
                poll_interval=5
            )
            
            if not code or len(code) != 6:
                print(f"✗ 获取验证码失败: {code}")
                return False
            
            print(f"✓ 获取验证码: {code}")
            
            # 逐个输入验证码（6个输入框）
            for i, digit in enumerate(code):
                input_selector = self.SELECTORS[f"code_input_{i}"]
                code_input = await self.page.wait_for_selector(input_selector, timeout=5000)
                await code_input.fill(digit)
                await asyncio.sleep(0.1)
        
        await asyncio.sleep(3)
        
        # 验证登录成功
        success = await self.is_logged_in()
        if success:
            print(f"✓ 登录成功: {account.email}")
            # 保存到账号池
            self.account_pool.add_account(account.email, account.password)
        else:
            print(f"✗ 登录失败: {account.email}")
        
        return success
    
    async def upload_image(self, image_path: str):
        """上传图片到 Canvas"""
        print(f"上传图片: {image_path}")
        
        # 点击附件按钮触发文件选择
        try:
            attach_btn = await self.page.wait_for_selector(
                self.SELECTORS["attachment_button"], timeout=5000
            )
            async with self.page.expect_file_chooser() as fc_info:
                await attach_btn.click()
            file_chooser = await fc_info.value
            await file_chooser.set_files(image_path)
            print("✓ 图片已上传")
        except Exception as e:
            print(f"✗ 上传图片失败: {e}")
            # 尝试直接找文件输入
            file_input = await self.page.query_selector(self.SELECTORS["file_input"])
            if file_input:
                await file_input.set_input_files(image_path)
        
        await asyncio.sleep(2)
    
    async def send_prompt(self, prompt: str):
        """发送提示词到对话框"""
        print(f"发送提示词: {prompt[:50]}...")
        
        # 使用 contenteditable div
        chat_input = await self.page.wait_for_selector(
            self.SELECTORS["message_input"], timeout=5000
        )
        await chat_input.click()
        await chat_input.fill(prompt)
        
        # 按 Enter 发送
        await self.page.keyboard.press("Enter")
        
        await asyncio.sleep(1)
        print("✓ 提示词已发送")
    
    async def wait_for_video(self, timeout: int = 300) -> Optional[str]:
        """等待视频生成完成，返回视频 URL"""
        print(f"等待视频生成 (最长 {timeout}s)...")
        
        try:
            video_element = await self.page.wait_for_selector(
                self.SELECTORS["video_element"],
                timeout=timeout * 1000
            )
            
            video_url = await video_element.get_attribute("src")
            print(f"✓ 视频生成完成: {video_url[:50]}...")
            return video_url
            
        except Exception as e:
            print(f"✗ 等待视频超时: {e}")
            return None
    
    async def download_video(self, video_url: str, save_path: str) -> bool:
        """下载视频"""
        print(f"下载视频到: {save_path}")
        
        try:
            # 使用 Playwright 的请求功能下载
            response = await self.page.request.get(video_url)
            
            if response.ok:
                content = await response.body()
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                with open(save_path, "wb") as f:
                    f.write(content)
                print(f"✓ 视频已保存: {save_path}")
                return True
            else:
                print(f"✗ 下载失败: {response.status}")
                return False
                
        except Exception as e:
            print(f"✗ 下载出错: {e}")
            return False
    
    async def generate_video(
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
            prompt: 视频生成提示词
            output_path: 输出视频路径
            account: 指定账号（可选，默认从池中获取）
        
        Returns:
            成功返回视频路径，失败返回 None
        """
        # 获取账号
        if not account:
            account = self.account_pool.get_available_account()
            if not account:
                # 没有可用账号，创建新账号
                email = self.account_pool.generate_email()
                password = self.account_pool.generate_password()
                account = Account(email=email, password=password)
        
        try:
            # 启动浏览器
            await self.launch_browser()
            
            # 检查登录状态
            if not await self.is_logged_in():
                success = await self.login_or_register(account)
                if not success:
                    print("✗ 登录/注册失败")
                    return None
            
            # 导航到首页
            await self.navigate_to_home()
            
            # 上传图片
            await self.upload_image(image_path)
            
            # 发送提示词
            await self.send_prompt(prompt)
            
            # 等待视频生成
            video_url = await self.wait_for_video()
            
            if not video_url:
                return None
            
            # 下载视频
            success = await self.download_video(video_url, output_path)
            
            if success:
                # 标记账号已使用
                self.account_pool.mark_used(account)
                return output_path
            
            return None
            
        finally:
            await self.close()


# 测试
async def test():
    pool = AccountPool()
    automation = LovartAutomation(pool, headless=False)
    
    print("=== Lovart 自动化测试 ===")
    print(f"账号池: {pool.get_stats()}")
    print(f"IMAP: {pool.imap_config.server if pool.imap_config else 'N/A'}")
    
    # 测试邮箱生成
    test_email = pool.generate_email()
    test_password = pool.generate_password()
    print(f"\n测试账号: {test_email}")
    print(f"测试密码: {test_password}")


if __name__ == "__main__":
    asyncio.run(test())
