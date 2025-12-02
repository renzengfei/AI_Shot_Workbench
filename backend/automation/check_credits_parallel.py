#!/usr/bin/env python
"""并行检查所有账号的积分"""
import sys
import os
import time
import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.account_pool import AccountPool, Account
from automation.video_generator import VideoGenerator

# 线程安全的结果收集
results_lock = Lock()
results = {
    'has_credits': [],
    'no_credits': [],
    'failed': []
}
checked_count = 0


def check_single_account(acc: Account, pool: AccountPool, index: int, total: int) -> dict:
    """检查单个账号的积分"""
    global checked_count
    
    gen = VideoGenerator(pool)
    result = {'email': acc.email, 'status': 'unknown', 'credits': -1}
    
    try:
        # 启动浏览器
        gen.launch_browser(acc)
        
        # 登录
        if not gen.login(acc):
            result['status'] = 'login_failed'
            return result
        
        # 导航到首页
        gen.navigate_to_home()
        time.sleep(2)
        
        # 检查积分
        credits = gen.check_credits()
        result['credits'] = credits
        
        if credits > 0:
            result['status'] = 'has_credits'
        elif credits == 0:
            result['status'] = 'no_credits'
            pool.mark_no_credits(acc)
        else:
            result['status'] = 'check_failed'
            
    except Exception as e:
        result['status'] = 'error'
        result['error'] = str(e)
    finally:
        gen.close()
    
    # 更新计数并打印
    with results_lock:
        checked_count += 1
        status_icon = {
            'has_credits': f'✅ {result["credits"]}',
            'no_credits': '⚠️ 0',
            'login_failed': '❌ 登录失败',
            'check_failed': '❓ 无法获取',
            'error': '❌ 错误'
        }.get(result['status'], '❓')
        print(f"[{checked_count}/{total}] {acc.email} ... {status_icon}")
    
    return result


def check_all_credits_parallel(max_workers: int = 4):
    """并行检查所有账号积分"""
    global results, checked_count
    
    pool = AccountPool()
    accounts = pool.accounts
    total = len(accounts)
    
    print(f"并行检查 {total} 个账号的积分 (线程数: {max_workers})...\n")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {
            executor.submit(check_single_account, acc, pool, i, total): acc
            for i, acc in enumerate(accounts)
        }
        
        for future in as_completed(futures):
            result = future.result()
            with results_lock:
                if result['status'] == 'has_credits':
                    results['has_credits'].append({
                        'email': result['email'],
                        'credits': result['credits']
                    })
                elif result['status'] == 'no_credits':
                    results['no_credits'].append(result['email'])
                else:
                    results['failed'].append(result['email'])
    
    # 打印统计
    print(f"\n{'='*50}")
    print(f"检查完成!")
    print(f"  有积分: {len(results['has_credits'])} 个")
    print(f"  无积分: {len(results['no_credits'])} 个")
    print(f"  检查失败: {len(results['failed'])} 个")
    print(f"{'='*50}")
    
    # 按积分数量排序
    results['has_credits'].sort(key=lambda x: x['credits'], reverse=True)
    
    # 保存结果
    with open('credit_check_results.json', 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n结果已保存到 credit_check_results.json")
    
    return results


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='并行检查账号积分')
    parser.add_argument('-w', '--workers', type=int, default=3, help='并行线程数（默认 3）')
    args = parser.parse_args()
    
    check_all_credits_parallel(max_workers=args.workers)
