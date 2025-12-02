# browser_utils.py - 浏览器工具函数
import subprocess
import sys


def hide_chrome_window():
    """使用 AppleScript 隐藏 Chrome 窗口（仅 macOS）"""
    if sys.platform != 'darwin':
        return  # 仅在 macOS 上生效
    
    subprocess.run([
        'osascript', '-e',
        'tell application "System Events" to set visible of process "Google Chrome" to false'
    ], capture_output=True)


def show_chrome_window():
    """显示 Chrome 窗口"""
    if sys.platform != 'darwin':
        return
    
    subprocess.run([
        'osascript', '-e',
        'tell application "Google Chrome" to activate'
    ], capture_output=True)
