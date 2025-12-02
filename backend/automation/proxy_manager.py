#!/usr/bin/env python
"""
代理 IP 管理器
支持多种代理服务商，为每个账号分配不同的代理 IP
"""
import os
import json
import random
import requests
from typing import Optional, List
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class ProxyConfig:
    """代理配置"""
    # 代理类型: 'static' (静态代理列表), 'rotating' (轮换代理API), 'none'
    proxy_type: str = 'none'
    
    # 静态代理列表 (格式: host:port 或 user:pass@host:port)
    static_proxies: List[str] = None
    
    # 轮换代理 API (如 BrightData, SmartProxy)
    rotating_api_url: str = ''
    rotating_api_key: str = ''
    
    # 代理协议: 'http', 'https', 'socks5'
    protocol: str = 'http'
    
    def __post_init__(self):
        if self.static_proxies is None:
            self.static_proxies = []


class ProxyManager:
    """代理管理器"""
    
    CONFIG_FILE = 'proxy_config.json'
    
    def __init__(self, config_path: str = None):
        self.config_path = config_path or os.path.join(
            os.path.dirname(__file__), self.CONFIG_FILE
        )
        self.config = self._load_config()
        self._used_proxies = set()  # 已使用的代理
        self._proxy_index = 0  # 静态代理轮换索引
    
    def _load_config(self) -> ProxyConfig:
        """加载配置"""
        if os.path.exists(self.config_path):
            try:
                with open(self.config_path) as f:
                    data = json.load(f)
                return ProxyConfig(**data)
            except Exception as e:
                print(f"加载代理配置失败: {e}")
        return ProxyConfig()
    
    def save_config(self):
        """保存配置"""
        with open(self.config_path, 'w') as f:
            json.dump(asdict(self.config), f, indent=2)
    
    def get_proxy_for_chrome(self, email: str = None) -> Optional[dict]:
        """
        获取用于 Chrome 的代理配置
        返回格式: {'http': 'http://...', 'https': 'http://...'}
        """
        proxy_url = self._get_next_proxy(email)
        if not proxy_url:
            return None
        
        return {
            'http': proxy_url,
            'https': proxy_url
        }
    
    def get_proxy_url(self, email: str = None) -> Optional[str]:
        """获取代理 URL（用于 Chrome 启动参数）"""
        return self._get_next_proxy(email)
    
    def _get_next_proxy(self, email: str = None) -> Optional[str]:
        """获取下一个代理"""
        if self.config.proxy_type == 'none':
            return None
        
        if self.config.proxy_type == 'static':
            return self._get_static_proxy()
        
        if self.config.proxy_type == 'rotating':
            return self._get_rotating_proxy(email)
        
        return None
    
    def _get_static_proxy(self) -> Optional[str]:
        """从静态列表获取代理（轮换）"""
        if not self.config.static_proxies:
            return None
        
        proxy = self.config.static_proxies[self._proxy_index]
        self._proxy_index = (self._proxy_index + 1) % len(self.config.static_proxies)
        
        # 格式化为完整 URL
        if not proxy.startswith(('http://', 'https://', 'socks5://')):
            proxy = f"{self.config.protocol}://{proxy}"
        
        return proxy
    
    def _get_rotating_proxy(self, email: str = None) -> Optional[str]:
        """从轮换代理 API 获取代理"""
        if not self.config.rotating_api_url:
            return None
        
        try:
            # 通用格式：直接返回代理地址
            # 可根据不同服务商定制
            headers = {}
            if self.config.rotating_api_key:
                headers['Authorization'] = f'Bearer {self.config.rotating_api_key}'
            
            resp = requests.get(
                self.config.rotating_api_url,
                headers=headers,
                timeout=10
            )
            
            if resp.status_code == 200:
                proxy = resp.text.strip()
                if not proxy.startswith(('http://', 'https://', 'socks5://')):
                    proxy = f"{self.config.protocol}://{proxy}"
                return proxy
                
        except Exception as e:
            print(f"获取轮换代理失败: {e}")
        
        return None
    
    def test_proxy(self, proxy_url: str) -> bool:
        """测试代理是否可用"""
        try:
            resp = requests.get(
                'https://httpbin.org/ip',
                proxies={'http': proxy_url, 'https': proxy_url},
                timeout=10
            )
            if resp.status_code == 200:
                ip = resp.json().get('origin', '')
                print(f"代理可用，IP: {ip}")
                return True
        except Exception as e:
            print(f"代理测试失败: {e}")
        return False
    
    def add_static_proxies(self, proxies: List[str]):
        """添加静态代理"""
        self.config.static_proxies.extend(proxies)
        self.config.proxy_type = 'static'
        self.save_config()
        print(f"已添加 {len(proxies)} 个代理，总计 {len(self.config.static_proxies)} 个")
    
    def set_rotating_api(self, api_url: str, api_key: str = ''):
        """设置轮换代理 API"""
        self.config.rotating_api_url = api_url
        self.config.rotating_api_key = api_key
        self.config.proxy_type = 'rotating'
        self.save_config()
        print(f"已设置轮换代理 API: {api_url}")
    
    def disable_proxy(self):
        """禁用代理"""
        self.config.proxy_type = 'none'
        self.save_config()
        print("已禁用代理")
    
    def stats(self) -> dict:
        """代理统计"""
        return {
            'type': self.config.proxy_type,
            'static_count': len(self.config.static_proxies),
            'has_rotating_api': bool(self.config.rotating_api_url)
        }


# 全局实例
_proxy_manager = None

def get_proxy_manager() -> ProxyManager:
    """获取代理管理器单例"""
    global _proxy_manager
    if _proxy_manager is None:
        _proxy_manager = ProxyManager()
    return _proxy_manager


if __name__ == "__main__":
    # 测试
    pm = get_proxy_manager()
    print(f"代理状态: {pm.stats()}")
    
    # 示例：添加静态代理
    # pm.add_static_proxies([
    #     'user:pass@proxy1.example.com:8080',
    #     'user:pass@proxy2.example.com:8080',
    # ])
    
    # 示例：设置轮换代理 API
    # pm.set_rotating_api('https://api.proxy-provider.com/get-proxy', 'your-api-key')
