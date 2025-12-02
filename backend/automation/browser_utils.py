# browser_utils.py - 浏览器工具函数
"""
Chrome 窗口管理工具（macOS）

使用方式：
- hide_chrome_window(): 最小化 Chrome 窗口到 Dock
- show_chrome_window(): 恢复显示 Chrome 窗口

用户想查看窗口时，只需点击 Dock 上的 Chrome 图标即可。
"""
import subprocess
import sys
import time


def hide_chrome_window(delay: float = 0.5):
    """
    最小化 Chrome 窗口到 Dock（仅 macOS）
    
    Args:
        delay: 执行前的延迟秒数，确保窗口已完全加载
    """
    if sys.platform != 'darwin':
        return  # 仅在 macOS 上生效
    
    if delay > 0:
        time.sleep(delay)
    
    # 方案1: 最小化所有 Chrome 窗口（最稳定）
    script = '''
        tell application "System Events"
            tell process "Google Chrome"
                -- 确保 Chrome 正在运行
                if exists then
                    -- 最小化所有窗口
                    set windowList to every window
                    repeat with w in windowList
                        try
                            click button 2 of w  -- 最小化按钮
                        end try
                    end repeat
                end if
            end tell
        end tell
    '''
    
    result = subprocess.run(
        ['osascript', '-e', script],
        capture_output=True,
        text=True
    )
    
    # 如果上面失败，使用备用方案：隐藏应用
    if result.returncode != 0:
        subprocess.run([
            'osascript', '-e',
            'tell application "System Events" to set visible of process "Google Chrome" to false'
        ], capture_output=True)


def show_chrome_window():
    """恢复显示 Chrome 窗口"""
    if sys.platform != 'darwin':
        return
    
    subprocess.run([
        'osascript', '-e',
        'tell application "Google Chrome" to activate'
    ], capture_output=True)


def minimize_chrome_window():
    """最小化当前 Chrome 窗口到 Dock（用户点击 Dock 图标可恢复）"""
    if sys.platform != 'darwin':
        return
    
    script = '''
        tell application "Google Chrome"
            if (count of windows) > 0 then
                set miniaturized of front window to true
            end if
        end tell
    '''
    subprocess.run(['osascript', '-e', script], capture_output=True)
