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
            # 中文支持
            locale='zh-CN',
            fonts=['Arial', 'PingFang SC', 'Microsoft YaHei', 'SimHei'],
            # 随机化配置
            humanize=True,  # 人类化行为
            os=random.choice(['windows', 'macos']),  # Linux 字体支持差
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
            self.page.set_viewport_size({'width': 1400, 'height': 900})
            self.page.goto(self.BASE_URL, timeout=30000)
            time.sleep(2)
            
            # 缩小页面以适应屏幕
            self.page.evaluate('document.body.style.zoom = "0.8"')
            time.sleep(random.uniform(1, 2))
            
            # 2. 点击注册按钮
            print("2. 点击注册按钮")
            self.page.evaluate('''
                const btns = document.querySelectorAll('button, span');
                for (const btn of btns) {
                    if (btn.textContent.includes('注册')) {
                        btn.click();
                        break;
                    }
                }
            ''')
            time.sleep(random.uniform(2, 3))
            
            # 3. 点击"使用邮箱继续"（按钮可能是 disabled 状态，直接 JS 点击）
            print("3. 点击使用邮箱继续")
            clicked = self.page.evaluate('''() => {
                const btn = document.getElementById('emailLogin');
                if (btn) {
                    btn.disabled = false;
                    btn.click();
                    return true;
                }
                const btns = document.querySelectorAll('button');
                for (const b of btns) {
                    if (b.textContent.includes('使用邮箱继续')) {
                        b.disabled = false;
                        b.click();
                        return true;
                    }
                }
                return false;
            }''')
            print(f"   ✓ 点击: {clicked}")
            time.sleep(random.uniform(2, 3))
            
            # 4. 等待邮箱输入表单
            print("4. 等待邮箱表单...")
            self.page.wait_for_selector('input[type="email"], input[placeholder*="邮箱"]', timeout=10000)
            time.sleep(1)
            
            # 5. 填写邮箱
            print("5. 填写邮箱")
            inputs = self.page.locator('input').all()
            if len(inputs) >= 1:
                inputs[0].fill(email)
                time.sleep(random.uniform(0.5, 1))
            else:
                print("   ✗ 找不到输入框")
                return False
            
            # 6. 填写密码
            print("6. 填写密码")
            pwd_inputs = self.page.locator('input[type="password"]')
            if pwd_inputs.count() > 0:
                pwd_inputs.first.fill(password)
                time.sleep(random.uniform(0.5, 1))
                if pwd_inputs.count() > 1:
                    pwd_inputs.nth(1).fill(password)
                    time.sleep(random.uniform(0.5, 1))
            
            # 7. 点击发送验证码
            print("7. 发送验证码")
            send_btn = self.page.locator('button:has-text("发送"), button:has-text("获取"), button:has-text("Send")')
            if send_btn.count() > 0:
                send_btn.first.click(force=True)
                time.sleep(2)
            
            # 8. 等待验证码邮件
            print("8. 等待验证码邮件...")
            code = self.email_receiver.wait_for_verification_code(email, timeout=120)
            if not code:
                print("   ✗ 未收到验证码")
                return False
            print(f"   ✓ 收到验证码: {code}")
            
            # 9. 填写验证码
            print("9. 填写验证码")
            # 尝试多个输入框（6位验证码）
            code_inputs = self.page.locator('input[maxlength="1"]')
            if code_inputs.count() >= len(code):
                for i, digit in enumerate(code):
                    code_inputs.nth(i).fill(digit)
                    time.sleep(0.1)
            else:
                # 单个输入框
                code_input = self.page.locator('input[placeholder*="验证码"], input[placeholder*="code" i]')
                if code_input.count() > 0:
                    code_input.first.fill(code)
            time.sleep(1)
            
            # 10. 点击注册/提交按钮
            print("10. 点击提交")
            submit_btn = self.page.locator('button[type="submit"], button:has-text("注册"), button:has-text("确认")')
            if submit_btn.count() > 0:
                submit_btn.first.click(force=True)
            time.sleep(3)
            
            # 11. 检查是否注册成功
            print("11. 检查注册结果...")
            time.sleep(3)
            
            # 检查是否跳转到首页
            if '/home' in self.page.url:
                print("   ✓ 注册成功！")
                self.account_pool.add_account(email, password)
                return True
            
            # 检查页面内容
            content = self.page.content().lower()
            if '欢迎' in content or 'welcome' in content or '成功' in content:
                print("   ✓ 注册成功！")
                self.account_pool.add_account(email, password)
                return True
            
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
