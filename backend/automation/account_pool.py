# account_pool.py - 账号池管理
import json
import os
import threading
from datetime import date
from typing import Optional, Set
from dataclasses import dataclass, asdict
import random
import string

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "accounts.json")

@dataclass
class Account:
    email: str
    password: str
    daily_used: int = 0
    last_used_date: str = ""
    status: str = "active"  # active, banned, cooldown
    fingerprint_id: str = ""  # 关联的浏览器指纹 ID
    created_at: str = ""  # 创建时间

@dataclass
class ImapConfig:
    server: str
    port: int
    username: str
    password: str

class AccountPool:
    DAILY_LIMIT = 3  # 每账号每天最多生成 3 个视频
    
    def __init__(self, config_path: str = CONFIG_PATH):
        self.config_path = config_path
        self.accounts: list[Account] = []
        self.imap_config: Optional[ImapConfig] = None
        self.email_domain: str = ""
        self._lock = threading.Lock()  # 线程锁
        self._in_use: Set[str] = set()  # 正在使用的账号 email
        self._load()
    
    def _load(self):
        """从 JSON 文件加载配置"""
        if not os.path.exists(self.config_path):
            return
        
        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        self.email_domain = data.get("email_domain", "")
        
        if "imap_config" in data:
            cfg = data["imap_config"]
            self.imap_config = ImapConfig(
                server=cfg["server"],
                port=cfg["port"],
                username=cfg["username"],
                password=cfg["password"]
            )
        
        self.accounts = [
            Account(**acc) for acc in data.get("accounts", [])
        ]
    
    def _save(self):
        """保存配置到 JSON 文件"""
        data = {
            "imap_config": asdict(self.imap_config) if self.imap_config else {},
            "email_domain": self.email_domain,
            "accounts": [asdict(acc) for acc in self.accounts]
        }
        with open(self.config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def get_available_account(self) -> Optional[Account]:
        """获取一个可用账号（未超过每日限额）"""
        today = date.today().isoformat()
        
        for acc in self.accounts:
            if acc.status != "active":
                continue
            
            # 日期变了，重置计数
            if acc.last_used_date != today:
                acc.daily_used = 0
                acc.last_used_date = today
            
            if acc.daily_used < self.DAILY_LIMIT:
                return acc
        
        return None
    
    def acquire_account(self) -> Optional[Account]:
        """线程安全地获取并锁定一个账号"""
        with self._lock:
            today = date.today().isoformat()
            
            for acc in self.accounts:
                # 跳过正在使用的账号
                if acc.email in self._in_use:
                    continue
                if acc.status != "active":
                    continue
                
                # 日期变了，重置计数
                if acc.last_used_date != today:
                    acc.daily_used = 0
                    acc.last_used_date = today
                
                if acc.daily_used < self.DAILY_LIMIT:
                    self._in_use.add(acc.email)
                    print(f"   🔒 锁定账号: {acc.email}")
                    return acc
            
            return None
    
    def release_account(self, account: Account):
        """释放账号锁定"""
        with self._lock:
            if account.email in self._in_use:
                self._in_use.discard(account.email)
                print(f"   🔓 释放账号: {account.email}")
    
    def mark_used(self, account: Account):
        """标记账号已使用一次"""
        today = date.today().isoformat()
        account.last_used_date = today
        account.daily_used += 1
        self._save()
    
    def mark_no_credits(self, account: Account):
        """标记账号积分耗尽"""
        account.status = "no_credits"
        self._save()
        print(f"   ⚠️ 账号 {account.email} 积分耗尽，已标记")
    
    def get_available_account_excluding(self, exclude_emails: list) -> Optional[Account]:
        """获取可用账号，排除指定账号（线程安全）"""
        with self._lock:
            today = date.today().isoformat()
            
            for acc in self.accounts:
                if acc.email in exclude_emails:
                    continue
                # 跳过正在使用的账号
                if acc.email in self._in_use:
                    continue
                if acc.status != "active":
                    continue
                
                # 日期变了，重置计数
                if acc.last_used_date != today:
                    acc.daily_used = 0
                    acc.last_used_date = today
                
                if acc.daily_used < self.DAILY_LIMIT:
                    # 锁定新账号
                    self._in_use.add(acc.email)
                    print(f"   🔒 锁定账号: {acc.email}")
                    return acc
        
        return None
    
    def add_account(self, email: str, password: str, fingerprint_id: str = "") -> Account:
        """添加新账号"""
        from datetime import datetime
        acc = Account(
            email=email, 
            password=password,
            fingerprint_id=fingerprint_id,
            created_at=datetime.now().isoformat()
        )
        self.accounts.append(acc)
        self._save()
        return acc
    
    # 常用中文姓名拼音库
    SURNAMES = [
        "wang", "li", "zhang", "liu", "chen", "yang", "zhao", "huang", "zhou", "wu",
        "xu", "sun", "hu", "zhu", "gao", "lin", "he", "guo", "ma", "luo", "liang",
        "song", "zheng", "xie", "han", "tang", "feng", "yu", "dong", "xiao", "cheng",
        "cao", "yuan", "deng", "pan", "du", "ye", "jiang", "wei", "su", "lu", "ren",
        "shen", "peng", "fan", "fang", "shi", "xiong", "jin", "qin", "dai", "tan"
    ]
    GIVEN_NAMES = [
        "wei", "fang", "na", "jing", "lei", "jun", "yong", "jie", "ping", "gang",
        "qiang", "ming", "hua", "lin", "yan", "hong", "chao", "xin", "bo", "hao",
        "yu", "tao", "peng", "feng", "bin", "kai", "long", "zhi", "chen", "rui",
        "yi", "ning", "ting", "wen", "xuan", "yang", "ze", "jia", "xiang", "dong",
        "zeng", "fei", "yun", "qing", "hai", "shan", "lan", "mei", "xue", "li"
    ]
    
    def generate_email(self, prefix: str = "") -> str:
        """生成一个新的邮箱地址（用于注册），使用中文姓名拼音"""
        if not prefix:
            surname = random.choice(self.SURNAMES)
            given1 = random.choice(self.GIVEN_NAMES)
            given2 = random.choice(self.GIVEN_NAMES)
            # 随机选择格式：姓名 或 名姓 或 姓名+数字
            formats = [
                f"{surname}{given1}{given2}",      # zhangjunwei
                f"{given1}{given2}{surname}",     # junweizhang
                f"{surname}{given1}",              # zhangjun
                f"{given1}{surname}",              # junzhang
                f"{surname}{given1}{random.randint(1, 99)}",  # zhangjun88
            ]
            prefix = random.choice(formats)
        return f"{prefix}@{self.email_domain}"
    
    def generate_password(self, length: int = 12) -> str:
        """生成随机密码"""
        chars = string.ascii_letters + string.digits + "!@#$%"
        return "".join(random.choices(chars, k=length))
    
    def get_account_by_email(self, email: str) -> Optional[Account]:
        """根据邮箱查找账号"""
        for acc in self.accounts:
            if acc.email == email:
                return acc
        return None
    
    def get_stats(self) -> dict:
        """获取账号池统计信息"""
        today = date.today().isoformat()
        total = len(self.accounts)
        active = sum(1 for a in self.accounts if a.status == "active")
        
        available_today = 0
        used_today = 0
        for acc in self.accounts:
            if acc.status != "active":
                continue
            if acc.last_used_date == today:
                used_today += acc.daily_used
                if acc.daily_used < self.DAILY_LIMIT:
                    available_today += self.DAILY_LIMIT - acc.daily_used
            else:
                available_today += self.DAILY_LIMIT
        
        return {
            "total_accounts": total,
            "active_accounts": active,
            "videos_available_today": available_today,
            "videos_used_today": used_today
        }


# 测试
if __name__ == "__main__":
    pool = AccountPool()
    print("账号池统计:", pool.get_stats())
    print("IMAP 配置:", pool.imap_config)
    print("邮箱域名:", pool.email_domain)
    
    # 生成示例
    print("\n生成新邮箱:", pool.generate_email())
    print("生成新密码:", pool.generate_password())
