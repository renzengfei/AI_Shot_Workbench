# lovart_uc.py - 使用 undetected_chromedriver 绕过 Cloudflare
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os
from typing import Optional

from .account_pool import AccountPool, Account
from .email_receiver import EmailReceiver


class LovartUC:
    """Lovart.ai 自动化（使用 undetected_chromedriver 绕过 Cloudflare）"""
    
    BASE_URL = "https://www.lovart.ai/zh"
    HOME_URL = "https://www.lovart.ai/zh/home"
    
    def __init__(self, account_pool: AccountPool, headless: bool = False):
        self.account_pool = account_pool
        self.headless = headless
        self.driver: Optional[uc.Chrome] = None
        self.email_receiver: Optional[EmailReceiver] = None
        
        if account_pool.imap_config:
            self.email_receiver = EmailReceiver(account_pool.imap_config)
    
    def launch_browser(self):
        """启动 undetected Chrome"""
        options = uc.ChromeOptions()
        if self.headless:
            options.add_argument('--headless')
        
        self.driver = uc.Chrome(options=options, headless=self.headless)
        self.driver.set_window_size(1280, 800)
        return self.driver
    
    def close(self):
        """关闭浏览器"""
        if self.driver:
            self.driver.quit()
        if self.email_receiver:
            self.email_receiver.disconnect()
    
    def navigate_to_home(self):
        """导航到首页"""
        self.driver.get(self.BASE_URL)
        time.sleep(3)
    
    def click_register(self):
        """点击注册按钮"""
        self.driver.execute_script('''
            for (const btn of document.querySelectorAll('button')) {
                if (btn.textContent.includes('注册')) { btn.click(); break; }
            }
        ''')
        time.sleep(2)
    
    def fill_email(self, email: str):
        """填写邮箱"""
        inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input')
        for inp in inputs:
            placeholder = inp.get_attribute('placeholder')
            if placeholder and '邮箱' in placeholder:
                inp.clear()
                inp.send_keys(email)
                print(f"✓ 邮箱已输入: {email}")
                return True
        return False
    
    def wait_for_cloudflare(self, timeout: int = 30) -> bool:
        """等待 Cloudflare 验证完成"""
        print("等待 Cloudflare 验证...")
        start = time.time()
        while time.time() - start < timeout:
            # 检查是否有"成功"标识
            page_source = self.driver.page_source
            if '成功' in page_source:
                print("✓ Cloudflare 验证成功")
                return True
            time.sleep(1)
        print("✗ Cloudflare 验证超时")
        return False
    
    def click_continue_with_email(self) -> bool:
        """点击「使用邮箱继续」"""
        btns = self.driver.find_elements(By.CSS_SELECTOR, 'button')
        for btn in btns:
            if '使用邮箱继续' in btn.text:
                disabled = btn.get_attribute('disabled')
                if not disabled:
                    btn.click()
                    print("✓ 点击「使用邮箱继续」")
                    time.sleep(2)
                    return True
        return False
    
    def fill_verification_code(self, code: str):
        """填写 6 位验证码"""
        print(f"填写验证码: {code}")
        # 找到 6 个验证码输入框
        for i, digit in enumerate(code):
            selector = f'input[data-testid="undefined-input-{i}"]'
            try:
                inp = self.driver.find_element(By.CSS_SELECTOR, selector)
                inp.send_keys(digit)
                time.sleep(0.1)
            except:
                # 备选：直接找所有小输入框
                inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input')
                small_inputs = [i for i in inputs if i.get_attribute('maxlength') == '1']
                if len(small_inputs) >= 6:
                    small_inputs[i].send_keys(digit)
        print("✓ 验证码已填写")
    
    def login_or_register(self, account: Account) -> bool:
        """完整的登录/注册流程"""
        print(f"\n=== 开始登录/注册: {account.email} ===\n")
        
        # 1. 打开页面
        self.navigate_to_home()
        
        # 2. 点击注册
        self.click_register()
        
        # 3. 填写邮箱
        if not self.fill_email(account.email):
            print("✗ 填写邮箱失败")
            return False
        
        # 4. 等待 Cloudflare
        if not self.wait_for_cloudflare():
            return False
        
        # 5. 点击继续
        if not self.click_continue_with_email():
            print("✗ 按钮不可点击")
            return False
        
        # 6. 获取验证码
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
            
            # 7. 填写验证码
            self.fill_verification_code(code)
            time.sleep(3)
        
        # 8. 保存账号
        self.account_pool.add_account(account.email, account.password)
        print(f"\n✓ 登录/注册成功: {account.email}\n")
        return True


# 测试
if __name__ == "__main__":
    from .account_pool import AccountPool
    
    pool = AccountPool()
    automation = LovartUC(pool, headless=False)
    
    try:
        automation.launch_browser()
        
        # 生成测试账号
        email = pool.generate_email()
        password = pool.generate_password()
        account = Account(email=email, password=password)
        
        print(f"测试账号: {email}")
        automation.login_or_register(account)
        
    finally:
        automation.close()
