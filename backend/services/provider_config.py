"""
Image Provider Configuration Manager

负责管理生图供应商配置的持久化存储和读取
- 全局配置存储在用户主目录下
- 工作空间级配置存储在 project.json 中
"""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Dict, List, Optional

from services.image_providers import ProviderConfig, ProviderType


class ProviderConfigManager:
    """供应商配置管理器"""
    
    def __init__(self, config_dir: Optional[str] = None):
        """
        初始化配置管理器
        
        Args:
            config_dir: 配置目录路径，默认为 ~/.ai_shot_workbench/
        """
        if config_dir:
            self.config_dir = Path(config_dir)
        else:
            self.config_dir = Path.home() / ".ai_shot_workbench"
        
        self.config_file = self.config_dir / "providers.json"
        self._ensure_config_dir()
        self._migrate_from_env()
    
    def _ensure_config_dir(self):
        """确保配置目录存在"""
        self.config_dir.mkdir(parents=True, exist_ok=True)
    
    def _migrate_from_env(self):
        """从环境变量迁移配置（首次启动兼容）"""
        if self.config_file.exists():
            return
        
        # 检查是否有环境变量配置
        api_key = os.getenv("GEMINI_IMAGE_API_KEY")
        if not api_key:
            return
        
        base_url = os.getenv("GEMINI_IMAGE_BASE_URL", "https://api.tu-zi.com/v1")
        model = os.getenv("GEMINI_IMAGE_MODEL", "gemini-3-pro-image-preview-4")
        
        # 创建默认的 Rabbit 供应商配置
        default_provider = ProviderConfig(
            id=str(uuid.uuid4()),
            name="Rabbit (Env)",
            type=ProviderType.RABBIT,
            api_key=api_key,
            endpoint=base_url,
            model=model,
            is_default=True,
        )
        
        self._save_providers([default_provider])
    
    def _load_providers(self) -> List[ProviderConfig]:
        """加载所有供应商配置"""
        if not self.config_file.exists():
            return []
        
        try:
            with open(self.config_file, "r", encoding="utf-8") as f:
                data = json.load(f)
            return [ProviderConfig.from_dict(p) for p in data.get("providers", [])]
        except Exception as e:
            print(f"[ProviderConfigManager] 加载配置失败: {e}")
            return []
    
    def _save_providers(self, providers: List[ProviderConfig]):
        """保存所有供应商配置"""
        data = {"providers": [p.to_dict() for p in providers]}
        with open(self.config_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def list_providers(self) -> List[Dict]:
        """列出所有供应商（安全版本，API Key 脱敏）"""
        providers = self._load_providers()
        return [p.to_safe_dict() for p in providers]
    
    def get_provider(self, provider_id: str) -> Optional[ProviderConfig]:
        """获取指定供应商配置"""
        providers = self._load_providers()
        for p in providers:
            if p.id == provider_id:
                return p
        return None
    
    def get_default_provider(self) -> Optional[ProviderConfig]:
        """获取默认供应商配置"""
        providers = self._load_providers()
        for p in providers:
            if p.is_default:
                return p
        # 如果没有默认的，返回第一个
        return providers[0] if providers else None
    
    def add_provider(
        self,
        name: str,
        provider_type: ProviderType,
        api_key: str,
        endpoint: str,
        model: str,
        is_default: bool = False,
    ) -> ProviderConfig:
        """添加新供应商"""
        providers = self._load_providers()
        
        # 如果设置为默认，清除其他默认标记
        if is_default:
            for p in providers:
                p.is_default = False
        
        new_provider = ProviderConfig(
            id=str(uuid.uuid4()),
            name=name,
            type=provider_type,
            api_key=api_key,
            endpoint=endpoint,
            model=model,
            is_default=is_default or len(providers) == 0,  # 第一个自动设为默认
        )
        
        providers.append(new_provider)
        self._save_providers(providers)
        return new_provider
    
    def update_provider(
        self,
        provider_id: str,
        name: Optional[str] = None,
        api_key: Optional[str] = None,
        endpoint: Optional[str] = None,
        model: Optional[str] = None,
        is_default: Optional[bool] = None,
    ) -> Optional[ProviderConfig]:
        """更新供应商配置"""
        providers = self._load_providers()
        updated = None
        
        for p in providers:
            if p.id == provider_id:
                if name is not None:
                    p.name = name
                if api_key is not None:
                    p.api_key = api_key
                if endpoint is not None:
                    p.endpoint = endpoint
                if model is not None:
                    p.model = model
                if is_default is not None:
                    if is_default:
                        # 清除其他默认标记
                        for other in providers:
                            other.is_default = False
                    p.is_default = is_default
                updated = p
                break
        
        if updated:
            self._save_providers(providers)
        return updated
    
    def delete_provider(self, provider_id: str) -> bool:
        """删除供应商"""
        providers = self._load_providers()
        original_count = len(providers)
        providers = [p for p in providers if p.id != provider_id]
        
        if len(providers) < original_count:
            # 如果删除的是默认供应商，设置新的默认
            if providers and not any(p.is_default for p in providers):
                providers[0].is_default = True
            self._save_providers(providers)
            return True
        return False
    
    def set_default_provider(self, provider_id: str) -> bool:
        """设置默认供应商"""
        return self.update_provider(provider_id, is_default=True) is not None


# 全局单例
provider_config_manager = ProviderConfigManager()
