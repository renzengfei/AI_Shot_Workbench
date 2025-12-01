#!/usr/bin/env python
"""
Lovart 自动化 CLI 工具
- 查看账号状态
- 查看指纹信息
- 管理任务队列
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.account_pool import AccountPool
from automation.fingerprint_manager import get_fingerprint_manager


def cmd_accounts(args):
    """查看账号列表"""
    pool = AccountPool()
    stats = pool.get_stats()
    
    print(f"\n📊 账号统计")
    print(f"{'='*50}")
    print(f"总数: {stats['total_accounts']}")
    print(f"活跃: {stats['active_accounts']}")
    print(f"今日可用视频数: {stats['videos_available_today']}")
    print(f"今日已用视频数: {stats['videos_used_today']}")
    
    if args.list:
        print(f"\n📋 账号列表")
        print(f"{'='*50}")
        for acc in pool.accounts:
            status_icon = "✓" if acc.status == "active" else "✗"
            fp_info = f" [{acc.fingerprint_id[:8]}]" if acc.fingerprint_id else ""
            print(f"{status_icon} {acc.email}{fp_info} | 今日: {acc.daily_used}/3 | {acc.status}")


def cmd_fingerprints(args):
    """查看指纹列表"""
    manager = get_fingerprint_manager()
    stats = manager.stats()
    
    print(f"\n🔐 指纹统计")
    print(f"{'='*50}")
    print(f"总数: {stats['total']}")
    print(f"存储: {stats['storage_dir']}")
    
    if args.list:
        print(f"\n📋 指纹列表")
        print(f"{'='*50}")
        for email, fp in manager.fingerprints.items():
            print(f"• {email}")
            print(f"  ID: {fp.fingerprint_id}")
            print(f"  UA: {fp.user_agent[:50]}...")
            print(f"  屏幕: {fp.screen_width}x{fp.screen_height}")
            print(f"  时区: {fp.timezone}")
            print()


def cmd_status(args):
    """查看整体状态"""
    pool = AccountPool()
    fp_manager = get_fingerprint_manager()
    
    acc_stats = pool.get_stats()
    fp_stats = fp_manager.stats()
    
    print(f"\n🚀 Lovart 自动化状态")
    print(f"{'='*50}")
    print(f"\n📊 账号")
    print(f"   总数: {acc_stats['total_accounts']}")
    print(f"   活跃: {acc_stats['active_accounts']}")
    print(f"   今日可用视频: {acc_stats['videos_available_today']}")
    
    print(f"\n🔐 指纹")
    print(f"   总数: {fp_stats['total']}")
    
    # 检查注册进程
    import subprocess
    result = subprocess.run(
        ["pgrep", "-f", "batch_register"],
        capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"\n⚙️ 批量注册: 运行中 (PID: {result.stdout.strip()})")
        
        # 读取最新日志
        log_path = os.path.join(os.path.dirname(__file__), "..", "batch_register.log")
        if os.path.exists(log_path):
            with open(log_path, 'r') as f:
                lines = f.readlines()
                # 找最后的进度
                for line in reversed(lines):
                    if '[' in line and '/' in line and ']' in line:
                        print(f"   进度: {line.strip()}")
                        break
    else:
        print(f"\n⚙️ 批量注册: 未运行")


def cmd_export(args):
    """导出账号和指纹"""
    pool = AccountPool()
    fp_manager = get_fingerprint_manager()
    
    data = {
        "accounts": [
            {
                "email": acc.email,
                "password": acc.password,
                "fingerprint_id": acc.fingerprint_id,
                "status": acc.status,
                "created_at": acc.created_at
            }
            for acc in pool.accounts
        ],
        "fingerprints": fp_manager.list_all()
    }
    
    output = args.output or "lovart_export.json"
    with open(output, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✓ 已导出到: {output}")
    print(f"  账号: {len(data['accounts'])}")
    print(f"  指纹: {len(data['fingerprints'])}")


def main():
    parser = argparse.ArgumentParser(
        description='Lovart 自动化 CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  python -m automation.cli status        # 查看整体状态
  python -m automation.cli accounts -l   # 列出所有账号
  python -m automation.cli fingerprints -l  # 列出所有指纹
  python -m automation.cli export        # 导出数据
'''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # status
    status_parser = subparsers.add_parser('status', help='查看整体状态')
    status_parser.set_defaults(func=cmd_status)
    
    # accounts
    accounts_parser = subparsers.add_parser('accounts', help='查看账号')
    accounts_parser.add_argument('-l', '--list', action='store_true', help='显示详细列表')
    accounts_parser.set_defaults(func=cmd_accounts)
    
    # fingerprints
    fp_parser = subparsers.add_parser('fingerprints', help='查看指纹')
    fp_parser.add_argument('-l', '--list', action='store_true', help='显示详细列表')
    fp_parser.set_defaults(func=cmd_fingerprints)
    
    # export
    export_parser = subparsers.add_parser('export', help='导出数据')
    export_parser.add_argument('-o', '--output', help='输出文件路径')
    export_parser.set_defaults(func=cmd_export)
    
    args = parser.parse_args()
    
    if args.command:
        args.func(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
