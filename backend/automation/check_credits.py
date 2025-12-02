#!/usr/bin/env python
"""检查所有账号的积分"""
import sys
import os
import time
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from automation.account_pool import AccountPool
from automation.video_generator import VideoGenerator


def check_all_credits():
    """检查所有账号积分"""
    pool = AccountPool()
    gen = VideoGenerator(pool)
    
    results = {
        'has_credits': [],
        'no_credits': [],
        'failed': []
    }
    
    total = len(pool.accounts)
    print(f"开始检查 {total} 个账号的积分...\n")
    
    for i, acc in enumerate(pool.accounts):
        print(f"[{i+1}/{total}] {acc.email}", end=" ... ", flush=True)
        
        try:
            # 启动浏览器
            gen.launch_browser(acc)
            
            # 登录
            if not gen.login(acc):
                print("❌ 登录失败")
                results['failed'].append(acc.email)
                gen.close()
                continue
            
            # 导航到首页
            gen.navigate_to_home()
            time.sleep(2)
            
            # 检查积分
            credits = gen.check_credits()
            
            if credits > 0:
                print(f"✅ {credits} 积分")
                results['has_credits'].append({'email': acc.email, 'credits': credits})
            elif credits == 0:
                print("⚠️ 0 积分")
                results['no_credits'].append(acc.email)
                # 标记为无积分
                pool.mark_no_credits(acc)
            else:
                print("❓ 无法获取积分")
                results['failed'].append(acc.email)
                
        except Exception as e:
            print(f"❌ 错误: {e}")
            results['failed'].append(acc.email)
        finally:
            gen.close()
        
        # 短暂间隔
        time.sleep(1)
    
    # 打印统计
    print(f"\n{'='*50}")
    print(f"检查完成!")
    print(f"  有积分: {len(results['has_credits'])} 个")
    print(f"  无积分: {len(results['no_credits'])} 个")
    print(f"  检查失败: {len(results['failed'])} 个")
    print(f"{'='*50}")
    
    # 保存结果
    with open('credit_check_results.json', 'w') as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"\n结果已保存到 credit_check_results.json")
    
    return results


if __name__ == "__main__":
    check_all_credits()
