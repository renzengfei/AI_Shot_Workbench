#!/usr/bin/env python
"""
Lovart.ai 批量注册工具 (Camoufox 版)
- 使用 Camoufox 真正的指纹隔离
- 每个账号独立浏览器实例
- 支持代理 IP
"""
import time
import random
import os
import sys
from datetime import datetime

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from camoufox.sync_api import Camoufox
from automation.account_pool import AccountPool
from automation.email_receiver import EmailReceiver
from automation.proxy_manager import get_proxy_manager


class CamoufoxRegister:
    """使用 Camoufox 批量注册 Lovart 账号"""
    
    BASE_URL = "https://www.lovart.ai/zh"
    
    def __init__(self, account_pool: AccountPool):
        self.account_pool = account_pool
        self.email_receiver = EmailReceiver(account_pool.imap_config)
        self.proxy_manager = get_proxy_manager()
        self.browser = None
        self.page = None
        self.registered_count = 0
        self.failed_count = 0
    
    def launch_browser(self, email: str = None):
        """启动 Camoufox 浏览器（自动生成独立指纹）"""
        self.close_browser()
        
        # 获取代理
        proxy = None
        proxy_url = self.proxy_manager.get_proxy_url(email)
        if proxy_url:
            # Camoufox 代理格式
            proxy = {"server": proxy_url}
            print(f"   🌐 代理: {proxy_url[:40]}...")
        
        # 启动 Camoufox（自动生成唯一指纹）
        self.browser = Camoufox(
            headless=False,
            proxy=proxy,
            # 随机化配置
            humanize=True,  # 人类化行为
            os=random.choice(['windows', 'macos', 'linux']),
        ).__enter__()
        
        self.page = self.browser.new_page()
        print(f"🔐 Camoufox 浏览器已启动（独立指纹）")
    
    def close_browser(self):
        """关闭浏览器"""
        if self.browser:
            try:
                self.browser.__exit__(None, None, None)
            except:
                pass
            self.browser = None
            self.page = None
    
    def register_single(self, email: str, password: str) -> bool:
        """注册单个账号"""
        print(f"\n{'='*50}")
        print(f"注册账号: {email}")
        print(f"{'='*50}")
        
        try:
            # 1. 打开页面
            print("1. 打开 Lovart.ai")
            self.page.goto(self.BASE_URL, timeout=30000)
            time.sleep(random.uniform(2, 4))
            
            # 2. 点击登录按钮
            print("2. 点击登录按钮")
            login_btn = self.page.locator('button:has-text("登录"), button:has-text("Log in"), a:has-text("登录")')
            if login_btn.count() > 0:
                login_btn.first.click()
                time.sleep(random.uniform(1, 2))
            
            # 3. 切换到注册
            print("3. 切换到注册页面")
            register_link = self.page.locator('text=注册, text=Sign up, text=创建账号')
            if register_link.count() > 0:
                register_link.first.click()
                time.sleep(random.uniform(1, 2))
            
            # 4. 填写邮箱
            print("4. 填写邮箱")
            email_input = self.page.locator('input[type="email"], input[name="email"], input[placeholder*="邮箱"], input[placeholder*="email" i]')
            if email_input.count() > 0:
                email_input.first.fill(email)
                time.sleep(random.uniform(0.5, 1))
            else:
                print("   ✗ 找不到邮箱输入框")
                return False
            
            # 5. 填写密码
            print("5. 填写密码")
            pwd_inputs = self.page.locator('input[type="password"]')
            if pwd_inputs.count() > 0:
                pwd_inputs.first.fill(password)
                time.sleep(random.uniform(0.5, 1))
                if pwd_inputs.count() > 1:
                    pwd_inputs.nth(1).fill(password)
                    time.sleep(random.uniform(0.5, 1))
            
            # 6. 点击发送验证码
            print("6. 发送验证码")
            send_code_btn = self.page.locator('button:has-text("发送"), button:has-text("获取"), button:has-text("Send"), button:has-text("验证码")')
            if send_code_btn.count() > 0:
                send_code_btn.first.click()
                time.sleep(2)
            
            # 7. 等待验证码邮件
            print("7. 等待验证码邮件...")
            code = self.email_receiver.wait_for_code(email, timeout=120)
            if not code:
                print("   ✗ 未收到验证码")
                return False
            print(f"   ✓ 收到验证码: {code}")
            
            # 8. 填写验证码
            print("8. 填写验证码")
            code_input = self.page.locator('input[placeholder*="验证码"], input[placeholder*="code" i], input[name="code"]')
            if code_input.count() > 0:
                code_input.first.fill(code)
                time.sleep(random.uniform(0.5, 1))
            else:
                # 尝试逐个输入（有些是多个输入框）
                code_inputs = self.page.locator('input[maxlength="1"]')
                if code_inputs.count() >= len(code):
                    for i, digit in enumerate(code):
                        code_inputs.nth(i).fill(digit)
                        time.sleep(0.1)
            
            # 9. 点击注册按钮
            print("9. 点击注册按钮")
            register_btn = self.page.locator('button:has-text("注册"), button:has-text("Sign up"), button:has-text("创建"), button[type="submit"]')
            if register_btn.count() > 0:
                register_btn.first.click()
                time.sleep(3)
            
            # 10. 检查是否注册成功
            print("10. 检查注册结果...")
            time.sleep(3)
            
            # 检查是否跳转到首页或显示成功
            if '/home' in self.page.url or '欢迎' in self.page.content() or 'welcome' in self.page.content().lower():
                print("   ✓ 注册成功！")
                # 保存账号
                self.account_pool.add_account(email, password)
                return True
            
            # 检查错误信息
            error = self.page.locator('.error, .alert-error, [class*="error"]')
            if error.count() > 0:
                print(f"   ✗ 注册失败: {error.first.text_content()}")
                return False
            
            # 不确定结果，假设成功
            print("   ? 结果不确定，假设成功")
            self.account_pool.add_account(email, password)
            return True
            
        except Exception as e:
            print(f"   ✗ 注册异常: {e}")
            return False
    
    def batch_register(self, count: int = 5, min_interval: int = 120, max_interval: int = 360):
        """批量注册"""
        print(f"\n{'#'*60}")
        print(f"# Lovart 批量注册（Camoufox 指纹隔离版）")
        print(f"# 目标数量: {count}")
        print(f"# 间隔: {min_interval//60}-{max_interval//60} 分钟")
        print(f"# 代理: {self.proxy_manager.stats()['type']}")
        print(f"{'#'*60}\n")
        
        for i in range(count):
            print(f"\n[{i+1}/{count}] {datetime.now().strftime('%H:%M:%S')}")
            
            # 生成账号
            email = self.account_pool.generate_email()
            password = self.account_pool.generate_password()
            
            try:
                # 每个账号启动独立浏览器（独立指纹）
                self.launch_browser(email)
                
                # 注册
                success = self.register_single(email, password)
                
                if success:
                    self.registered_count += 1
                    print(f"\n✓ 成功 ({self.registered_count}/{i+1})")
                else:
                    self.failed_count += 1
                    print(f"\n✗ 失败 ({self.failed_count}/{i+1})")
                    
            except Exception as e:
                print(f"\n✗ 浏览器异常: {e}")
                self.failed_count += 1
                
            finally:
                self.close_browser()
            
            # 间隔
            if i < count - 1:
                interval = random.randint(min_interval, max_interval)
                print(f"\n⏳ 等待 {interval//60} 分 {interval%60} 秒后继续...")
                time.sleep(interval)
        
        # 统计
        print(f"\n{'='*60}")
        print(f"批量注册完成 (Camoufox)")
        print(f"  成功: {self.registered_count}")
        print(f"  失败: {self.failed_count}")
        print(f"{'='*60}")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Lovart 批量注册 (Camoufox)')
    parser.add_argument('-n', '--count', type=int, default=5, help='注册数量（默认 5）')
    parser.add_argument('--min', type=int, default=120, help='最小间隔秒数（默认 120）')
    parser.add_argument('--max', type=int, default=360, help='最大间隔秒数（默认 360）')
    
    args = parser.parse_args()
    
    pool = AccountPool()
    print(f"当前账号数: {pool.get_stats()['total_accounts']}")
    print(f"代理状态: {get_proxy_manager().stats()}")
    
    register = CamoufoxRegister(pool)
    register.batch_register(
        count=args.count,
        min_interval=args.min,
        max_interval=args.max
    )


if __name__ == "__main__":
    main()
