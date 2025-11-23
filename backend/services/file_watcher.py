import asyncio
from watchfiles import awatch
from typing import List, Callable, Dict
import os

class FileWatcher:
    def __init__(self):
        self.active_connections: List[Callable] = []
        self.watching_path: str = None
        self._stop_event = asyncio.Event()
        self._watch_task = None

    async def connect(self, websocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def start_watching(self, path: str):
        """Start watching a directory for changes"""
        if self._watch_task:
            self._stop_event.set()
            await self._watch_task
        
        self.watching_path = path
        self._stop_event.clear()
        self._watch_task = asyncio.create_task(self._watch_loop())

    async def _watch_loop(self):
        if not self.watching_path or not os.path.exists(self.watching_path):
            return

        print(f"Started watching: {self.watching_path}")
        try:
            async for changes in awatch(self.watching_path, stop_event=self._stop_event):
                for change in changes:
                    change_type, file_path = change
                    # Only notify for relevant files
                    filename = os.path.basename(file_path)
                    if filename in ['project.json', 'segmentation.json', 'shots.json', 'deconstruction.md']:
                        await self._broadcast({
                            "type": "file_change",
                            "file": filename,
                            "change_type": change_type.name
                        })
        except Exception as e:
            print(f"Watch error: {e}")

    async def _broadcast(self, message: Dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except:
                self.disconnect(connection)
