# test_imap.py - 测试 IMAP 连接
import imaplib
import email
from email.header import decode_header

# 配置
IMAP_SERVER = "imap.qq.com"
USERNAME = "303364682@qq.com"
APP_PASSWORD = "ktlqkgleetjgbgdf"

def test_connection():
    print("连接到 IMAP 服务器...")
    mail = imaplib.IMAP4_SSL(IMAP_SERVER)
    
    print("登录中...")
    mail.login(USERNAME, APP_PASSWORD)
    print("✓ 登录成功！")
    
    # 选择收件箱
    status, count = mail.select("INBOX")
    if status != "OK":
        print(f"✗ 选择 INBOX 失败: {count}")
        # 尝试列出所有文件夹
        print("可用文件夹:")
        status, folders = mail.list()
        for folder in folders:
            print(f"  {folder}")
        mail.logout()
        return
    print(f"✓ 选择收件箱成功，邮件数: {count}")
    
    # 搜索最近的邮件
    status, messages = mail.search(None, "ALL")
    msg_ids = messages[0].split()
    print(f"收件箱共有 {len(msg_ids)} 封邮件")
    
    # 读取最新 3 封
    if msg_ids:
        print("\n最近 3 封邮件:")
        for msg_id in msg_ids[-3:]:
            status, msg_data = mail.fetch(msg_id, "(RFC822)")
            raw_email = msg_data[0][1]
            msg = email.message_from_bytes(raw_email)
            
            subject = decode_header(msg["Subject"])[0][0]
            if isinstance(subject, bytes):
                try:
                    subject = subject.decode('utf-8')
                except:
                    subject = subject.decode('gbk', errors='ignore')
            to_addr = msg["To"]
            from_addr = msg["From"]
            
            print(f"  ---")
            print(f"  From: {from_addr}")
            print(f"  To: {to_addr}")
            print(f"  Subject: {subject}")
    
    mail.logout()
    print("\n✓ IMAP 测试完成！")

if __name__ == "__main__":
    test_connection()
