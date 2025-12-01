# email_receiver.py - IMAP 邮件接收器（验证码提取）
import imaplib
import email
import re
import time
from email.header import decode_header
from typing import Optional
from datetime import datetime, timedelta

from .account_pool import AccountPool, ImapConfig


class EmailReceiver:
    """从 IMAP 邮箱接收并提取验证码"""
    
    def __init__(self, imap_config: ImapConfig):
        self.config = imap_config
        self.mail: Optional[imaplib.IMAP4_SSL] = None
    
    def connect(self):
        """连接到 IMAP 服务器"""
        self.mail = imaplib.IMAP4_SSL(self.config.server, self.config.port)
        self.mail.login(self.config.username, self.config.password)
        self.mail.select("INBOX")
    
    def disconnect(self):
        """断开连接"""
        if self.mail:
            try:
                self.mail.logout()
            except:
                pass
            self.mail = None
    
    def _decode_header_value(self, value: str) -> str:
        """解码邮件头"""
        if not value:
            return ""
        decoded_parts = decode_header(value)
        result = []
        for part, charset in decoded_parts:
            if isinstance(part, bytes):
                try:
                    result.append(part.decode(charset or "utf-8", errors="ignore"))
                except:
                    result.append(part.decode("utf-8", errors="ignore"))
            else:
                result.append(part)
        return "".join(result)
    
    def _get_email_body(self, msg) -> str:
        """提取邮件正文"""
        body = ""
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == "text/plain":
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body += payload.decode(charset, errors="ignore")
                elif content_type == "text/html" and not body:
                    payload = part.get_payload(decode=True)
                    if payload:
                        charset = part.get_content_charset() or "utf-8"
                        body += payload.decode(charset, errors="ignore")
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                charset = msg.get_content_charset() or "utf-8"
                body = payload.decode(charset, errors="ignore")
        return body
    
    def extract_verification_code(self, body: str) -> Optional[str]:
        """从邮件正文提取 6 位验证码"""
        patterns = [
            r'验证码[：:]\s*(\d{6})',
            r'verification code[：:\s]+(\d{6})',
            r'code[：:\s]+(\d{6})',
            r'Your code is[：:\s]+(\d{6})',
            r'\b(\d{6})\b',  # 兜底：匹配任意 6 位数字
        ]
        
        for pattern in patterns:
            match = re.search(pattern, body, re.IGNORECASE)
            if match:
                return match.group(1)
        
        return None
    
    def wait_for_verification_code(
        self, 
        to_email: str, 
        timeout: int = 120,
        poll_interval: int = 5,
        since_minutes: int = 5
    ) -> Optional[str]:
        """
        等待并获取发送到指定邮箱的验证码
        
        Args:
            to_email: 目标邮箱地址（如 user001@aigoogle.top）
            timeout: 超时时间（秒）
            poll_interval: 轮询间隔（秒）
            since_minutes: 只搜索最近 N 分钟内的邮件
        
        Returns:
            验证码字符串，或 None（超时）
        """
        if not self.mail:
            self.connect()
        
        start_time = time.time()
        since_date = (datetime.now() - timedelta(minutes=since_minutes)).strftime("%d-%b-%Y")
        
        while time.time() - start_time < timeout:
            try:
                # 刷新邮箱
                self.mail.select("INBOX")
                
                # 搜索发给目标邮箱的邮件
                # QQ 邮箱可能不支持 TO 搜索，改用 SINCE + 遍历
                search_criteria = f'(SINCE "{since_date}")'
                status, messages = self.mail.search(None, search_criteria)
                
                if status != "OK":
                    time.sleep(poll_interval)
                    continue
                
                msg_ids = messages[0].split()
                
                # 从最新的邮件开始检查
                for msg_id in reversed(msg_ids[-20:]):  # 只检查最近 20 封
                    status, msg_data = self.mail.fetch(msg_id, "(RFC822)")
                    if status != "OK":
                        continue
                    
                    raw_email = msg_data[0][1]
                    msg = email.message_from_bytes(raw_email)
                    
                    # 检查收件人是否匹配
                    to_header = self._decode_header_value(msg.get("To", ""))
                    if to_email.lower() not in to_header.lower():
                        continue
                    
                    # 提取验证码
                    body = self._get_email_body(msg)
                    code = self.extract_verification_code(body)
                    
                    if code:
                        print(f"✓ 找到验证码: {code} (发送到 {to_email})")
                        return code
                
            except Exception as e:
                print(f"轮询邮件时出错: {e}")
            
            time.sleep(poll_interval)
        
        print(f"✗ 等待验证码超时 ({timeout}s)")
        return None


# 测试
if __name__ == "__main__":
    pool = AccountPool()
    if pool.imap_config:
        receiver = EmailReceiver(pool.imap_config)
        receiver.connect()
        
        # 测试：查找最近发送到 @aigoogle.top 的邮件
        print("搜索最近的邮件...")
        receiver.mail.select("INBOX")
        status, messages = receiver.mail.search(None, "ALL")
        msg_ids = messages[0].split()
        
        print(f"共 {len(msg_ids)} 封邮件")
        
        # 检查最近几封
        for msg_id in msg_ids[-5:]:
            status, msg_data = receiver.mail.fetch(msg_id, "(RFC822)")
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            to_addr = receiver._decode_header_value(msg.get("To", ""))
            subject = receiver._decode_header_value(msg.get("Subject", ""))
            
            if "aigoogle.top" in to_addr:
                print(f"\n📧 发送到域名的邮件:")
                print(f"   To: {to_addr}")
                print(f"   Subject: {subject}")
                body = receiver._get_email_body(msg)
                code = receiver.extract_verification_code(body)
                if code:
                    print(f"   验证码: {code}")
        
        receiver.disconnect()
        print("\n✓ 测试完成")
    else:
        print("未配置 IMAP")
