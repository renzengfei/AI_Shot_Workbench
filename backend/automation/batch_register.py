#!/usr/bin/env python
"""
Lovart.ai 批量注册工具
- 自动生成中文拼音邮箱
- 自动获取验证码
- 随机间隔 1-5 分钟
- 保存账号到 accounts.json
"""
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
import time
import random
import json
import os
import sys
from datetime import datetime

# 添加父目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.account_pool import AccountPool
from automation.email_receiver import EmailReceiver


class BatchRegister:
    """批量注册 Lovart 账号"""
    
    BASE_URL = "https://www.lovart.ai/zh"
    
    def __init__(self, account_pool: AccountPool):
        self.account_pool = account_pool
        self.email_receiver = EmailReceiver(account_pool.imap_config)
        self.driver = None
        self.registered_count = 0
        self.failed_count = 0
    
    def launch_browser(self):
        """启动浏览器"""
        print("启动浏览器...")
        self.driver = uc.Chrome(headless=False)
        self.driver.set_window_size(1280, 800)
    
    def close_browser(self):
        """关闭浏览器"""
        if self.driver:
            self.driver.quit()
            self.driver = None
    
    def register_single(self, email: str, password: str) -> bool:
        """注册单个账号"""
        print(f"\n{'='*50}")
        print(f"注册账号: {email}")
        print(f"{'='*50}")
        
        try:
            # 1. 打开页面
            print("1. 打开 Lovart.ai")
            self.driver.get(self.BASE_URL)
            time.sleep(5)
            
            # 2. 点击注册
            print("2. 点击注册按钮")
            self.driver.execute_script('''
                for (const btn of document.querySelectorAll('button')) {
                    if (btn.textContent.includes('注册')) { btn.click(); break; }
                }
            ''')
            time.sleep(3)
            
            # 3. 输入邮箱
            print("3. 输入邮箱")
            inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input')
            email_filled = False
            for inp in inputs:
                placeholder = inp.get_attribute('placeholder')
                if placeholder and '邮箱' in placeholder:
                    inp.clear()
                    inp.send_keys(email)
                    email_filled = True
                    print(f"   ✓ 邮箱: {email}")
                    break
            
            if not email_filled:
                print("   ✗ 未找到邮箱输入框")
                return False
            
            # 4. 等待 Cloudflare
            print("4. 等待 Cloudflare 验证...")
            for i in range(30):
                page_source = self.driver.page_source
                if '成功' in page_source:
                    print("   ✓ Cloudflare 验证通过")
                    break
                if '失败' in page_source:
                    print("   ✗ Cloudflare 验证失败，重试...")
                    time.sleep(2)
                    # 刷新页面重试
                    self.driver.refresh()
                    time.sleep(3)
                    return False
                time.sleep(1)
            else:
                print("   ✗ Cloudflare 验证超时")
                return False
            
            # 5. 点击继续
            print("5. 点击「使用邮箱继续」")
            time.sleep(2)
            btns = self.driver.find_elements(By.CSS_SELECTOR, 'button')
            clicked = False
            for btn in btns:
                if '使用邮箱继续' in btn.text:
                    disabled = btn.get_attribute('disabled')
                    if not disabled:
                        btn.click()
                        clicked = True
                        print("   ✓ 已点击")
                        break
            
            if not clicked:
                print("   ✗ 按钮不可点击")
                return False
            
            time.sleep(3)
            
            # 6. 获取验证码
            print("6. 等待验证码邮件...")
            self.email_receiver.connect()
            code = self.email_receiver.wait_for_verification_code(
                to_email=email,
                timeout=120,
                poll_interval=5
            )
            
            if not code or len(code) != 6:
                print(f"   ✗ 验证码获取失败: {code}")
                return False
            
            print(f"   ✓ 收到验证码: {code}")
            
            # 7. 填写验证码
            print("7. 填写验证码")
            inputs = self.driver.find_elements(By.CSS_SELECTOR, 'input')
            code_inputs = [i for i in inputs if i.get_attribute('maxlength') == '1']
            
            if len(code_inputs) >= 6:
                for i, digit in enumerate(code):
                    code_inputs[i].send_keys(digit)
                    time.sleep(0.1)
            else:
                # 备选方案
                for i in range(6):
                    try:
                        inp = self.driver.find_element(
                            By.CSS_SELECTOR, f'input[data-testid="undefined-input-{i}"]'
                        )
                        inp.send_keys(code[i])
                    except:
                        pass
            
            print("   ✓ 验证码已填写")
            
            # 8. 等待注册完成
            print("8. 等待注册完成...")
            time.sleep(5)
            
            # 检查是否成功（进入了工作台）
            page_source = self.driver.page_source
            if 'AI设计师' in page_source or 'canvas' in self.driver.current_url:
                print("   ✓ 注册成功！")
                
                # 保存账号
                self.account_pool.add_account(email, password)
                return True
            else:
                print("   ✗ 注册可能失败")
                return False
            
        except Exception as e:
            print(f"   ✗ 注册出错: {e}")
            return False
        finally:
            self.email_receiver.disconnect()
    
    def batch_register(self, count: int, min_interval: int = 60, max_interval: int = 300):
        """
        批量注册账号
        
        Args:
            count: 要注册的账号数量
            min_interval: 最小间隔（秒），默认 60 秒 = 1 分钟
            max_interval: 最大间隔（秒），默认 300 秒 = 5 分钟
        """
        print(f"\n{'#'*60}")
        print(f"# Lovart 批量注册")
        print(f"# 目标数量: {count}")
        print(f"# 间隔: {min_interval//60}-{max_interval//60} 分钟")
        print(f"{'#'*60}\n")
        
        self.launch_browser()
        
        try:
            for i in range(count):
                print(f"\n[{i+1}/{count}] {datetime.now().strftime('%H:%M:%S')}")
                
                # 生成账号
                email = self.account_pool.generate_email()
                password = self.account_pool.generate_password()
                
                # 注册
                success = self.register_single(email, password)
                
                if success:
                    self.registered_count += 1
                    print(f"\n✓ 成功 ({self.registered_count}/{i+1})")
                else:
                    self.failed_count += 1
                    print(f"\n✗ 失败 ({self.failed_count}/{i+1})")
                
                # 间隔（除了最后一个）
                if i < count - 1:
                    interval = random.randint(min_interval, max_interval)
                    print(f"\n⏳ 等待 {interval//60} 分 {interval%60} 秒后继续...")
                    time.sleep(interval)
        
        finally:
            self.close_browser()
            
            # 打印统计
            print(f"\n{'='*60}")
            print(f"批量注册完成")
            print(f"  成功: {self.registered_count}")
            print(f"  失败: {self.failed_count}")
            print(f"  账号保存在: accounts.json")
            print(f"{'='*60}")


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Lovart 批量注册工具')
    parser.add_argument('-n', '--count', type=int, default=5, help='注册数量（默认 5）')
    parser.add_argument('--min', type=int, default=60, help='最小间隔秒数（默认 60）')
    parser.add_argument('--max', type=int, default=300, help='最大间隔秒数（默认 300）')
    
    args = parser.parse_args()
    
    # 初始化
    pool = AccountPool()
    print(f"当前账号数: {pool.get_stats()['total_accounts']}")
    
    # 开始注册
    batch = BatchRegister(pool)
    batch.batch_register(
        count=args.count,
        min_interval=args.min,
        max_interval=args.max
    )


if __name__ == "__main__":
    main()
