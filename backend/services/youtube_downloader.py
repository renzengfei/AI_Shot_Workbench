import os
from pathlib import Path
from typing import Optional

import yt_dlp
from yt_dlp.utils import DownloadError

class YouTubeDownloader:
    def __init__(
        self,
        output_dir: str = "uploads",
        cookies_from_browser: Optional[str] = None,
        cookies_file: Optional[str] = None,
    ):
        self.output_dir = output_dir
        self.cookies_from_browser = cookies_from_browser or os.getenv("YTDLP_COOKIES_FROM_BROWSER")
        self.cookies_file = cookies_file or os.getenv("YTDLP_COOKIES_FILE")

        # Allow a drop-in cookies.txt (Netscape format) placed at backend/cookies.txt
        default_cookie_path = Path(__file__).resolve().parent.parent / "cookies.txt"
        if not self.cookies_file and default_cookie_path.exists():
            self.cookies_file = str(default_cookie_path)

        os.makedirs(output_dir, exist_ok=True)

    def download(self, url: str, filename: str = None) -> dict:
        """
        Download YouTube video.
        Returns: {
            'video_path': str,
            'title': str,
            'duration': float,
            'thumbnail': str
        }
        """
        ydl_opts = self._build_opts(filename, quiet=False, no_warnings=False)

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                video_path = ydl.prepare_filename(info)

                return {
                    'video_path': video_path,
                    'title': info.get('title', 'Unknown'),
                    'duration': info.get('duration', 0),
                    'thumbnail': info.get('thumbnail', ''),
                    'uploader': info.get('uploader', 'Unknown'),
                }
        except DownloadError as exc:
            hint = self._build_cookies_hint()
            raise RuntimeError(f"{exc}; {hint}") from exc

    def get_video_info(self, url: str) -> dict:
        """
        Get video info without downloading.
        """
        ydl_opts = self._build_opts(quiet=True, no_warnings=True)

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'thumbnail': info.get('thumbnail', ''),
                'uploader': info.get('uploader', 'Unknown'),
            }

    def _build_opts(self, filename: Optional[str] = None, quiet: Optional[bool] = None, no_warnings: Optional[bool] = None) -> dict:
        """
        Build yt-dlp options with optional cookies support.
        Environment overrides:
        - YTDLP_COOKIES_FROM_BROWSER: browser name for cookies-from-browser (e.g., chrome, safari, edge)
        - YTDLP_COOKIES_FILE: path to a Netscape-format cookies file
        - backend/cookies.txt: drop-in cookies file used if present
        """
        ydl_opts = {
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'outtmpl': os.path.join(self.output_dir, '%(title)s.%(ext)s'),
        }

        if quiet is not None:
            ydl_opts['quiet'] = quiet
        if no_warnings is not None:
            ydl_opts['no_warnings'] = no_warnings

        if filename:
            ydl_opts['outtmpl'] = os.path.join(self.output_dir, filename)

        if self.cookies_from_browser:
            # Equivalent to --cookies-from-browser <browser>; profile and keyring left as defaults
            ydl_opts['cookiesfrombrowser'] = (self.cookies_from_browser, None, None, None)
        if self.cookies_file:
            # Equivalent to --cookies <cookies.txt>
            ydl_opts['cookiefile'] = self.cookies_file

        return ydl_opts

    def _build_cookies_hint(self) -> str:
        base_hint = "建议提供登录 cookies 以通过 YouTube 的机器人校验"

        # If cookies were already supplied, suggest refreshing them
        if self.cookies_from_browser or self.cookies_file:
            return f"{base_hint}，请确认 cookies 未过期"

        default_cookie_path = Path(__file__).resolve().parent.parent / "cookies.txt"
        hints = [
            "设置环境变量 YTDLP_COOKIES_FROM_BROWSER=chrome (或 safari/edge/firefox)",
            "或者设置 YTDLP_COOKIES_FILE=/path/to/cookies.txt (Netscape 格式)",
        ]
        if default_cookie_path.exists():
            hints.append(f"已检测到默认 cookies 文件: {default_cookie_path}")
        else:
            hints.append(f"也可以将 cookies.txt 放在 {default_cookie_path} 位置")

        return f"{base_hint}：" + "；".join(hints)
