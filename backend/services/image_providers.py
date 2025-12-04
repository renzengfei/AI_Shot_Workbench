"""
Image Provider Abstraction Layer

支持多个生图供应商：
- RabbitProvider: 使用 OpenAI 兼容格式（流式）
- CandyProvider: 使用自定义 Nano 协议（非流式）
"""

from __future__ import annotations

import base64
import json
import os
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

import httpx


class ProviderType(str, Enum):
    """供应商类型"""
    RABBIT = "rabbit"
    CANDY = "candy"
    GEMINI = "gemini"


@dataclass
class ProviderConfig:
    """供应商配置"""
    id: str
    name: str
    type: ProviderType
    api_key: str
    endpoint: str
    model: str
    is_default: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "api_key": self.api_key,
            "endpoint": self.endpoint,
            "model": self.model,
            "is_default": self.is_default,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ProviderConfig":
        return cls(
            id=data["id"],
            name=data["name"],
            type=ProviderType(data["type"]),
            api_key=data["api_key"],
            endpoint=data["endpoint"],
            model=data["model"],
            is_default=data.get("is_default", False),
        )
    
    def to_safe_dict(self) -> Dict[str, Any]:
        """返回安全的字典（API Key 脱敏）"""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value,
            "api_key_preview": self.api_key[:8] + "..." if len(self.api_key) > 8 else "***",
            "endpoint": self.endpoint,
            "model": self.model,
            "is_default": self.is_default,
        }


@dataclass
class GenerateResult:
    """生图结果"""
    image_urls: List[str]  # 可以是 data URL 或 http URL
    text_response: str = ""
    effective_prompt: str = ""


class ImageProvider(ABC):
    """生图供应商抽象基类"""
    
    def __init__(self, config: ProviderConfig):
        self.config = config
    
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        reference_data_urls: Optional[List[str]] = None,
        aspect_ratio: str = "9:16",
        **kwargs,
    ) -> GenerateResult:
        """
        生成图片
        
        Args:
            prompt: 提示词
            reference_data_urls: 参考图片的 data URL 列表
            aspect_ratio: 宽高比
            **kwargs: 其他参数
            
        Returns:
            GenerateResult: 生成结果
        """
        pass
    
    @staticmethod
    def create(config: ProviderConfig) -> "ImageProvider":
        """工厂方法：根据配置创建对应的 Provider"""
        if config.type == ProviderType.RABBIT:
            return RabbitProvider(config)
        elif config.type == ProviderType.CANDY:
            return CandyProvider(config)
        elif config.type == ProviderType.GEMINI:
            return GeminiProvider(config)
        else:
            raise ValueError(f"Unknown provider type: {config.type}")


class RabbitProvider(ImageProvider):
    """
    Rabbit 供应商实现
    使用 OpenAI 兼容格式，支持流式响应
    """
    
    async def generate(
        self,
        prompt: str,
        reference_data_urls: Optional[List[str]] = None,
        aspect_ratio: str = "9:16",
        **kwargs,
    ) -> GenerateResult:
        content = [{"type": "text", "text": prompt}]
        for data_url in (reference_data_urls or []):
            content.append({"type": "image_url", "image_url": {"url": data_url}})
        
        # 构建 imageConfig 用于比例控制（gemini-2.5-flash-image 兼容）
        image_config = {"aspectRatio": aspect_ratio}
        image_config_json = json.dumps({"imageConfig": image_config})
        
        # 添加 system message 用于比例控制
        messages = [
            {"role": "system", "content": image_config_json},
            {"role": "user", "content": content},
        ]
        
        payload = {
            "model": self.config.model,
            "messages": messages,
            "stream": True,
            # extra_body 用于某些 API 代理的兼容
            "extra_body": {"imageConfig": image_config},
        }
        
        headers = {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }
        
        text_parts: List[str] = []
        image_candidates: List[str] = []
        
        timeout = httpx.Timeout(connect=30.0, read=300.0, write=300.0, pool=None)
        async with httpx.AsyncClient(timeout=timeout) as client:
            endpoint = self.config.endpoint.rstrip("/")
            # 如果端点已包含 /chat/completions，不再追加
            if not endpoint.endswith("/chat/completions"):
                endpoint = f"{endpoint}/chat/completions"
            async with client.stream(
                "POST",
                endpoint,
                headers=headers,
                json=payload,
            ) as resp:
                if resp.status_code >= 400:
                    detail = await resp.aread()
                    raise RuntimeError(f"[Rabbit] 生成接口错误 ({resp.status_code}): {detail.decode('utf-8', errors='ignore')}")
                
                async for line_str in resp.aiter_lines():
                    if not line_str:
                        continue
                    if not line_str.startswith("data: "):
                        continue
                    data_str = line_str[6:]
                    if data_str.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    
                    if "choices" in chunk and len(chunk["choices"]) > 0:
                        delta = chunk["choices"][0].get("delta", {})
                        content_delta = delta.get("content")
                        if isinstance(content_delta, list):
                            for part in content_delta:
                                if isinstance(part, dict):
                                    if part.get("type") == "text" and "text" in part:
                                        text_parts.append(part["text"])
                                    elif part.get("type") == "image_url" and "image_url" in part:
                                        url = part["image_url"].get("url")
                                        if url:
                                            image_candidates.append(url)
                        elif isinstance(content_delta, str):
                            text_parts.append(content_delta)
        
        return GenerateResult(
            image_urls=image_candidates,
            text_response="".join(text_parts),
            effective_prompt=prompt,
        )


class CandyProvider(ImageProvider):
    """
    Candy 供应商实现（基于 NanoClient 参考代码）
    使用自定义 Nano 协议，非流式响应
    """
    
    @staticmethod
    def _strip_think_blocks(text: Optional[str]) -> str:
        """移除 <think> 标签"""
        if not text:
            return ""
        try:
            return str(text).replace("</think>", "").replace("<think>", "")
        except Exception:
            return str(text or "")
    
    @staticmethod
    def _strip_module_placeholders(text: Optional[str]) -> str:
        """移除模块占位符"""
        if not text:
            return ""
        try:
            t = str(text)
            t = re.sub(r"<[^>]+>", "", t)
            t = re.sub(r"\{[^}]+\}", "", t)
            t = re.sub(r"[\s\n]{2,}", "\n", t)
            return t.strip()
        except Exception:
            return str(text or "")
    
    @staticmethod
    def _parse_image_url_from_markdown(content: str) -> Optional[str]:
        """从响应内容中提取图片 URL"""
        if not content or not isinstance(content, str):
            return None
        # 1) Markdown 图片
        m = re.search(r"!\[image\]\((https?://[^)]+)\)", content)
        if m:
            return m.group(1)
        # 2) 明文图片 URL（带扩展名优先）
        m2 = re.search(r"(https?://[^\s)]+\.(?:png|jpe?g|webp|gif))", content, re.IGNORECASE)
        if m2:
            return m2.group(1)
        # 3) data:image/*;base64
        m3 = re.search(r"(data:image/[^;]+;base64,[A-Za-z0-9+/=]+)", content)
        if m3:
            return m3.group(1)
        # 4) 任意 http(s) URL（退而求其次）
        m4 = re.search(r"(https?://[^\s)]+)", content)
        if m4:
            return m4.group(1)
        return None
    
    def _build_messages(
        self,
        prompt: str,
        aspect_ratio: str = "9:16",
        reference_data_urls: Optional[List[str]] = None,
        enforce_full_bleed: bool = True,
    ) -> List[Dict]:
        """构建 Nano 协议的消息格式，支持多张参考图"""
        system_content = json.dumps({"imageConfig": {"aspectRatio": aspect_ratio}}, ensure_ascii=False)
        user_parts: List[Dict] = []
        
        main_text = self._strip_module_placeholders(self._strip_think_blocks(prompt or ""))
        if main_text:
            user_parts.append({"type": "text", "text": main_text})
        
        if enforce_full_bleed:
            user_parts.append({
                "type": "text",
                "text": "画面需充满画布（full-bleed，edge-to-edge），禁止任何边框、留白、相框/海报外框、黑白描边；允许主体被裁切，不要求完整人物；禁止自动外延或补全画面外内容。"
            })
        
        # 支持多张参考图
        if reference_data_urls:
            for url in reference_data_urls:
                user_parts.append({
                    "type": "image_url",
                    "image_url": {"url": url},
                })
        
        return [
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_parts},
        ]
    
    async def generate(
        self,
        prompt: str,
        reference_data_urls: Optional[List[str]] = None,
        aspect_ratio: str = "9:16",
        **kwargs,
    ) -> GenerateResult:
        messages = self._build_messages(
            prompt,
            aspect_ratio=aspect_ratio,
            reference_data_urls=reference_data_urls,
            enforce_full_bleed=kwargs.get("enforce_full_bleed", True),
        )
        
        body = {
            "extra_body": {"imageConfig": {"aspectRatio": aspect_ratio}},
            "model": self.config.model,
            "messages": messages,
            "max_tokens": int(kwargs.get("max_tokens", 150)),
            "temperature": float(kwargs.get("temperature", 0.7)),
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
        }
        
        timeout = httpx.Timeout(connect=30.0, read=120.0, write=30.0, pool=None)
        
        # 确保端点包含 /chat/completions
        endpoint = self.config.endpoint.rstrip("/")
        if not endpoint.endswith("/chat/completions"):
            endpoint = f"{endpoint}/chat/completions"
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            # 第一次尝试
            try:
                res = await client.post(endpoint, headers=headers, json=body)
            except Exception as e:
                # 网络错误：重试一次
                res = await client.post(endpoint, headers=headers, json=body)
            
            if res.status_code == 429:
                # 速率限制：等待后重试
                import asyncio
                await asyncio.sleep(0.6)
                res = await client.post(endpoint, headers=headers, json=body)
            
            if not res.is_success:
                msg = res.reason_phrase or "Unknown error"
                try:
                    data = res.json()
                    msg = data.get("error", {}).get("message", msg)
                except Exception:
                    pass
                if res.status_code in (401, 403):
                    msg = f"{msg}（请检查 API Key 权限/有效期）"
                raise RuntimeError(f"[Candy] API 错误 ({res.status_code}): {msg}")
            
            data = res.json()
            
            # 解析响应，兼容多种返回格式
            msg = (((data or {}).get("choices") or [{}])[0] or {}).get("message", {})
            content = msg.get("content", "")
            url: Optional[str] = None
            
            # a) content 为字符串
            if isinstance(content, str):
                # 尝试 JSON 字符串里包含 imageUrl
                try:
                    maybe = json.loads(content)
                    if isinstance(maybe, dict) and isinstance(maybe.get("imageUrl"), str):
                        url = maybe.get("imageUrl")
                except Exception:
                    pass
                if not url:
                    url = self._parse_image_url_from_markdown(content)
            # b) content 为列表（OpenAI 风格富文本）
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict):
                        if part.get("type") == "image_url":
                            u = ((part.get("image_url") or {}).get("url"))
                            if isinstance(u, str):
                                url = u
                                break
                        if part.get("type") == "text" and isinstance(part.get("text"), str):
                            u2 = self._parse_image_url_from_markdown(part.get("text"))
                            if u2:
                                url = u2
                                break
            # c) 顶层容器直接有 imageUrl
            if not url and isinstance(data, dict) and isinstance(data.get("imageUrl"), str):
                url = data.get("imageUrl")
            
            if not url:
                raise RuntimeError("[Candy] 无法从响应中提取图像 URL")
            
            # 构建有效提示词
            effective_prompt_parts = []
            try:
                parts = messages[1].get("content") or []
                for p in parts:
                    if (p or {}).get("type") == "text":
                        effective_prompt_parts.append(p.get("text") or "")
            except Exception:
                pass
            
            return GenerateResult(
                image_urls=[url],
                text_response=content if isinstance(content, str) else json.dumps(content),
                effective_prompt="\n---\n".join([t for t in effective_prompt_parts if t]),
            )


class GeminiProvider(ImageProvider):
    """
    Gemini 原生 API 供应商实现
    使用 Google Gemini 原生格式（非 OpenAI 兼容格式）
    端点示例: https://yunwu.ai/v1beta/models/gemini-3-pro-image-preview:generateContent
    """
    
    async def generate(
        self,
        prompt: str,
        reference_data_urls: Optional[List[str]] = None,
        aspect_ratio: str = "9:16",
        **kwargs,
    ) -> GenerateResult:
        # 构建 contents 部分
        parts: List[Dict[str, Any]] = []
        
        # 添加文本提示
        parts.append({"text": prompt})
        
        # 添加参考图片（如果有）
        image_count = 0
        if reference_data_urls:
            for i, data_url in enumerate(reference_data_urls):
                # 解析 data URL: data:image/jpeg;base64,xxxxx
                if data_url.startswith("data:"):
                    try:
                        # 提取 mime_type 和 base64 数据
                        header, b64_data = data_url.split(",", 1)
                        mime_type = header.split(":")[1].split(";")[0]
                        parts.append({
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": b64_data
                            }
                        })
                        image_count += 1
                    except (ValueError, IndexError):
                        print(f"[GeminiProvider] 无法解析 data URL #{i+1}: {data_url[:50]}...")
        print(f"[GeminiProvider] 发送请求: prompt长度={len(prompt)}, 参考图数量={image_count}")
        
        # 构建请求体
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": parts
                }
            ],
            "generationConfig": {
                "responseModalities": ["TEXT", "IMAGE"],
                "imageConfig": {
                    "aspectRatio": aspect_ratio,
                    "imageSize": kwargs.get("image_size", "1K")
                }
            }
        }
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}"
        }
        
        # 构建端点 URL
        endpoint = self.config.endpoint.rstrip("/")
        # 如果端点不包含 :generateContent，则追加模型路径
        if ":generateContent" not in endpoint:
            model = self.config.model or "gemini-3-pro-image-preview"
            endpoint = f"{endpoint}/v1beta/models/{model}:generateContent"
        
        timeout = httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=None)
        
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(endpoint, headers=headers, json=payload)
            
            if resp.status_code >= 400:
                detail = resp.text
                raise RuntimeError(f"[Gemini] API 错误 ({resp.status_code}): {detail[:500]}")
            
            data = resp.json()
            
            # 解析 Gemini 原生响应格式
            # 结构: candidates[].content.parts[] 其中 parts 可能包含:
            # - {"text": "...", "thought": true}  思考过程
            # - {"text": "..."}  普通文本
            # - {"inline_data": {"mime_type": "image/png", "data": "base64..."}}  图片
            image_urls: List[str] = []
            text_parts: List[str] = []
            
            candidates = data.get("candidates", [])
            for candidate in candidates:
                content = candidate.get("content", {})
                parts_list = content.get("parts", [])
                
                for part in parts_list:
                    # 提取文本（跳过思考过程）
                    if "text" in part and not part.get("thought"):
                        text_parts.append(part["text"])
                    
                    # 提取图片 - 支持两种命名格式
                    # Gemini API 使用驼峰命名 inlineData，但也兼容蛇形命名 inline_data
                    inline = part.get("inlineData") or part.get("inline_data")
                    if inline:
                        # 同样支持两种命名格式
                        mime_type = inline.get("mimeType") or inline.get("mime_type", "image/png")
                        b64_data = inline.get("data", "")
                        if b64_data:
                            # 构建 data URL
                            data_url = f"data:{mime_type};base64,{b64_data}"
                            image_urls.append(data_url)
            
            if not image_urls:
                raise RuntimeError(f"[Gemini] 响应中未找到图片数据")
            
            return GenerateResult(
                image_urls=image_urls,
                text_response="\n".join(text_parts),
                effective_prompt=prompt,
            )

