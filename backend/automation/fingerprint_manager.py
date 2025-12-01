#!/usr/bin/env python
"""
浏览器指纹管理器
- 为每个账号生成唯一指纹
- 持久化存储浏览器配置
- 复用指纹进行后续操作
"""
import os
import json
import random
import string
import hashlib
from typing import Optional, Dict, List
from dataclasses import dataclass, asdict, field
from datetime import datetime


# 常见的 User-Agent 列表
USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
]

# 屏幕分辨率
SCREEN_RESOLUTIONS = [
    (1920, 1080),
    (2560, 1440),
    (1680, 1050),
    (1440, 900),
    (1366, 768),
    (1536, 864),
    (1280, 800),
]

# 时区
TIMEZONES = [
    "Asia/Shanghai",
    "Asia/Hong_Kong",
    "Asia/Tokyo",
    "Asia/Singapore",
    "America/Los_Angeles",
    "America/New_York",
    "Europe/London",
]

# 语言
LANGUAGES = [
    ["zh-CN", "zh", "en-US", "en"],
    ["zh-TW", "zh", "en-US", "en"],
    ["en-US", "en"],
    ["ja-JP", "ja", "en-US", "en"],
]

# WebGL 渲染器
WEBGL_VENDORS = ["Google Inc. (NVIDIA)", "Google Inc. (Intel)", "Google Inc. (AMD)"]
WEBGL_RENDERERS = [
    "ANGLE (NVIDIA GeForce RTX 3080 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (AMD Radeon RX 6800 XT Direct3D11 vs_5_0 ps_5_0)",
    "ANGLE (Apple M1 Pro)",
    "ANGLE (Apple M2)",
]


@dataclass
class BrowserFingerprint:
    """浏览器指纹"""
    fingerprint_id: str
    user_agent: str
    screen_width: int
    screen_height: int
    timezone: str
    languages: List[str]
    webgl_vendor: str
    webgl_renderer: str
    platform: str
    hardware_concurrency: int  # CPU 核心数
    device_memory: int  # 内存 GB
    color_depth: int
    pixel_ratio: float
    canvas_hash: str  # 模拟的 canvas 指纹
    audio_hash: str  # 模拟的 audio 指纹
    profile_dir: str  # Chrome 用户数据目录
    created_at: str = ""
    
    def __post_init__(self):
        if not self.created_at:
            self.created_at = datetime.now().isoformat()
    
    def to_dict(self) -> dict:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: dict) -> 'BrowserFingerprint':
        return cls(**data)


class FingerprintManager:
    """指纹管理器"""
    
    def __init__(self, storage_dir: str = None):
        if storage_dir is None:
            storage_dir = os.path.join(
                os.path.dirname(__file__),
                "fingerprints"
            )
        self.storage_dir = storage_dir
        self.profiles_dir = os.path.join(storage_dir, "profiles")
        self.fingerprints_file = os.path.join(storage_dir, "fingerprints.json")
        
        os.makedirs(self.storage_dir, exist_ok=True)
        os.makedirs(self.profiles_dir, exist_ok=True)
        
        self.fingerprints: Dict[str, BrowserFingerprint] = {}
        self._load()
    
    def _load(self):
        """加载已保存的指纹"""
        if os.path.exists(self.fingerprints_file):
            with open(self.fingerprints_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for email, fp_data in data.items():
                    self.fingerprints[email] = BrowserFingerprint.from_dict(fp_data)
    
    def _save(self):
        """保存指纹"""
        data = {email: fp.to_dict() for email, fp in self.fingerprints.items()}
        with open(self.fingerprints_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def _generate_hash(self, seed: str) -> str:
        """生成伪随机哈希"""
        return hashlib.md5(seed.encode()).hexdigest()[:16]
    
    def generate_fingerprint(self, email: str) -> BrowserFingerprint:
        """
        为邮箱生成唯一指纹
        """
        # 用邮箱作为种子确保可复现
        random.seed(hash(email))
        
        # 生成指纹 ID
        fingerprint_id = ''.join(random.choices(string.ascii_lowercase + string.digits, k=12))
        
        # 选择随机值
        screen = random.choice(SCREEN_RESOLUTIONS)
        
        fingerprint = BrowserFingerprint(
            fingerprint_id=fingerprint_id,
            user_agent=random.choice(USER_AGENTS),
            screen_width=screen[0],
            screen_height=screen[1],
            timezone=random.choice(TIMEZONES),
            languages=random.choice(LANGUAGES),
            webgl_vendor=random.choice(WEBGL_VENDORS),
            webgl_renderer=random.choice(WEBGL_RENDERERS),
            platform=random.choice(["MacIntel", "Win32", "Linux x86_64"]),
            hardware_concurrency=random.choice([4, 6, 8, 12, 16]),
            device_memory=random.choice([4, 8, 16, 32]),
            color_depth=24,
            pixel_ratio=random.choice([1.0, 1.25, 1.5, 2.0]),
            canvas_hash=self._generate_hash(f"canvas_{email}"),
            audio_hash=self._generate_hash(f"audio_{email}"),
            profile_dir=os.path.join(self.profiles_dir, fingerprint_id)
        )
        
        # 重置随机种子
        random.seed()
        
        # 创建 profile 目录
        os.makedirs(fingerprint.profile_dir, exist_ok=True)
        
        # 保存
        self.fingerprints[email] = fingerprint
        self._save()
        
        return fingerprint
    
    def get_fingerprint(self, email: str) -> Optional[BrowserFingerprint]:
        """获取已有指纹"""
        return self.fingerprints.get(email)
    
    def get_or_create(self, email: str) -> BrowserFingerprint:
        """获取或创建指纹"""
        fp = self.get_fingerprint(email)
        if fp is None:
            fp = self.generate_fingerprint(email)
        return fp
    
    def get_chrome_options(self, fingerprint: BrowserFingerprint):
        """
        获取 Chrome 启动选项
        """
        import undetected_chromedriver as uc
        
        options = uc.ChromeOptions()
        
        # 使用指纹专属的用户数据目录
        options.add_argument(f'--user-data-dir={fingerprint.profile_dir}')
        
        # 设置窗口大小
        options.add_argument(f'--window-size={fingerprint.screen_width},{fingerprint.screen_height}')
        
        # 设置语言
        options.add_argument(f'--lang={fingerprint.languages[0]}')
        
        # 禁用一些自动化特征
        options.add_argument('--disable-blink-features=AutomationControlled')
        
        return options
    
    def get_fingerprint_js(self, fingerprint: BrowserFingerprint) -> str:
        """
        生成注入浏览器的 JavaScript 代码，用于覆盖指纹
        """
        return f'''
        // 覆盖 navigator 属性
        Object.defineProperty(navigator, 'platform', {{
            get: () => '{fingerprint.platform}'
        }});
        Object.defineProperty(navigator, 'hardwareConcurrency', {{
            get: () => {fingerprint.hardware_concurrency}
        }});
        Object.defineProperty(navigator, 'deviceMemory', {{
            get: () => {fingerprint.device_memory}
        }});
        Object.defineProperty(navigator, 'languages', {{
            get: () => {json.dumps(fingerprint.languages)}
        }});
        
        // 覆盖 screen 属性
        Object.defineProperty(screen, 'width', {{
            get: () => {fingerprint.screen_width}
        }});
        Object.defineProperty(screen, 'height', {{
            get: () => {fingerprint.screen_height}
        }});
        Object.defineProperty(screen, 'colorDepth', {{
            get: () => {fingerprint.color_depth}
        }});
        Object.defineProperty(window, 'devicePixelRatio', {{
            get: () => {fingerprint.pixel_ratio}
        }});
        
        // 覆盖 WebGL
        const getParameterProxyHandler = {{
            apply: function(target, thisArg, args) {{
                const param = args[0];
                const gl = thisArg;
                if (param === 37445) {{ // UNMASKED_VENDOR_WEBGL
                    return '{fingerprint.webgl_vendor}';
                }}
                if (param === 37446) {{ // UNMASKED_RENDERER_WEBGL
                    return '{fingerprint.webgl_renderer}';
                }}
                return Reflect.apply(target, thisArg, args);
            }}
        }};
        
        try {{
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {{
                gl.getParameter = new Proxy(gl.getParameter.bind(gl), getParameterProxyHandler);
            }}
        }} catch(e) {{}}
        
        console.log('[Fingerprint] Injected: {fingerprint.fingerprint_id}');
        '''
    
    def list_all(self) -> List[Dict]:
        """列出所有指纹"""
        return [
            {"email": email, **fp.to_dict()}
            for email, fp in self.fingerprints.items()
        ]
    
    def stats(self) -> Dict:
        """统计信息"""
        return {
            "total": len(self.fingerprints),
            "storage_dir": self.storage_dir
        }


# 全局实例
_manager: Optional[FingerprintManager] = None


def get_fingerprint_manager() -> FingerprintManager:
    """获取全局指纹管理器"""
    global _manager
    if _manager is None:
        _manager = FingerprintManager()
    return _manager
