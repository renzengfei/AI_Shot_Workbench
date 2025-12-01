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
    
    LOVART_URL = "https://www.lovart.ai"
    CANVAS_URL = "https://www.lovart.ai/canvas?agent=1"
    
    # 页面元素选择器（根据实际页面调整）
    SELECTORS = {
        # 登录/注册
        "login_button": 'button:has-text("Log in"), button:has-text("登录")',
        "email_input": 'input[type="email"], input[name="email"]',
        "password_input": 'input[type="password"], input[name="password"]',
        "verification_code_input": 'input[placeholder*="code"], input[placeholder*="验证码"]',
        "submit_button": 'button[type="submit"]',
        "send_code_button": 'button:has-text("Send"), button:has-text("发送")',
        
        # Canvas 页面
        "chat_input": 'textarea[placeholder], div[contenteditable="true"]',
        "send_message_button": 'button[aria-label="send"], button:has-text("Send")',
        "attachment_button": 'svg[d^="M21.44"], button:has(svg)',
        "file_input": 'input[type="file"]',
        
        # 视频结果
        "video_element": 'video',
        "download_button": 'button:has-text("Download"), a[download]',
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
    
    async def launch_browser(self):
        """启动浏览器（带指纹伪装）"""
        playwright = await async_playwright().start()
        
        # 指纹配置
        user_agents = [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
        ]
        
        self.browser = await playwright.chromium.launch(
            headless=self.headless,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
            ]
        )
        
        self.context = await self.browser.new_context(
            user_agent=random.choice(user_agents),
            viewport={"width": 1920, "height": 1080},
            locale="en-US",
            timezone_id="America/New_York",
        )
        
        # 注入反检测脚本
        await self.context.add_init_script("""
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        """)
        
        self.page = await self.context.new_page()
        return self.page
    
    async def close(self):
        """关闭浏览器"""
        if self.context:
            await self.context.close()
        if self.browser:
            await self.browser.close()
        if self.email_receiver:
            self.email_receiver.disconnect()
    
    async def navigate_to_canvas(self):
        """导航到 Canvas 页面"""
        await self.page.goto(self.CANVAS_URL, wait_until="networkidle")
        await asyncio.sleep(2)
    
    async def is_logged_in(self) -> bool:
        """检查是否已登录"""
        await self.page.goto(self.CANVAS_URL, wait_until="networkidle")
        await asyncio.sleep(2)
        
        # 检查是否有登录按钮（未登录状态）
        login_btn = await self.page.query_selector(self.SELECTORS["login_button"])
        return login_btn is None
    
    async def login(self, account: Account) -> bool:
        """登录账号"""
        print(f"登录账号: {account.email}")
        
        await self.page.goto(self.LOVART_URL, wait_until="networkidle")
        
        # 点击登录按钮
        login_btn = await self.page.wait_for_selector(self.SELECTORS["login_button"], timeout=10000)
        await login_btn.click()
        await asyncio.sleep(1)
        
        # 输入邮箱
        email_input = await self.page.wait_for_selector(self.SELECTORS["email_input"], timeout=5000)
        await email_input.fill(account.email)
        
        # 输入密码
        password_input = await self.page.wait_for_selector(self.SELECTORS["password_input"], timeout=5000)
        await password_input.fill(account.password)
        
        # 点击提交
        submit_btn = await self.page.wait_for_selector(self.SELECTORS["submit_button"], timeout=5000)
        await submit_btn.click()
        
        await asyncio.sleep(3)
        
        # 验证登录成功
        return await self.is_logged_in()
    
    async def register(self, account: Account) -> bool:
        """注册新账号"""
        print(f"注册新账号: {account.email}")
        
        await self.page.goto(self.LOVART_URL, wait_until="networkidle")
        
        # 点击注册/登录按钮
        login_btn = await self.page.wait_for_selector(self.SELECTORS["login_button"], timeout=10000)
        await login_btn.click()
        await asyncio.sleep(1)
        
        # 输入邮箱
        email_input = await self.page.wait_for_selector(self.SELECTORS["email_input"], timeout=5000)
        await email_input.fill(account.email)
        
        # 点击发送验证码
        send_code_btn = await self.page.wait_for_selector(self.SELECTORS["send_code_button"], timeout=5000)
        await send_code_btn.click()
        
        print("等待验证码邮件...")
        
        # 从邮箱获取验证码
        if self.email_receiver:
            self.email_receiver.connect()
            code = self.email_receiver.wait_for_verification_code(
                to_email=account.email,
                timeout=120,
                poll_interval=5
            )
            
            if not code:
                print("✗ 获取验证码超时")
                return False
            
            # 输入验证码
            code_input = await self.page.wait_for_selector(
                self.SELECTORS["verification_code_input"], timeout=5000
            )
            await code_input.fill(code)
        
        # 输入密码
        password_input = await self.page.wait_for_selector(self.SELECTORS["password_input"], timeout=5000)
        await password_input.fill(account.password)
        
        # 点击提交
        submit_btn = await self.page.wait_for_selector(self.SELECTORS["submit_button"], timeout=5000)
        await submit_btn.click()
        
        await asyncio.sleep(3)
        
        # 验证注册成功
        success = await self.is_logged_in()
        if success:
            print(f"✓ 注册成功: {account.email}")
            # 保存到账号池
            self.account_pool.add_account(account.email, account.password)
        
        return success
    
    async def upload_image(self, image_path: str):
        """上传图片到 Canvas"""
        print(f"上传图片: {image_path}")
        
        # 找到文件输入元素
        file_input = await self.page.query_selector(self.SELECTORS["file_input"])
        if file_input:
            await file_input.set_input_files(image_path)
        else:
            # 点击附件按钮触发文件选择
            attach_btn = await self.page.wait_for_selector(self.SELECTORS["attachment_button"], timeout=5000)
            async with self.page.expect_file_chooser() as fc_info:
                await attach_btn.click()
            file_chooser = await fc_info.value
            await file_chooser.set_files(image_path)
        
        await asyncio.sleep(2)
    
    async def send_prompt(self, prompt: str):
        """发送提示词"""
        print(f"发送提示词: {prompt[:50]}...")
        
        chat_input = await self.page.wait_for_selector(self.SELECTORS["chat_input"], timeout=5000)
        await chat_input.fill(prompt)
        
        send_btn = await self.page.wait_for_selector(self.SELECTORS["send_message_button"], timeout=5000)
        await send_btn.click()
        
        await asyncio.sleep(1)
    
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
                # 尝试登录
                existing = self.account_pool.get_account_by_email(account.email)
                if existing:
                    success = await self.login(existing)
                else:
                    success = await self.register(account)
                
                if not success:
                    print("✗ 登录/注册失败")
                    return None
            
            # 导航到 Canvas
            await self.navigate_to_canvas()
            
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
