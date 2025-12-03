import { create } from 'zustand';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export interface VideoGenConfig {
    mode: 'lovart' | 'yunwu';
    apiKey: string;
    model: string;
    size: string;
    aspectRatio: string;
    videosPerShot: number;
    concurrency: number;
    pollInterval: number;
}

export interface VideoTask {
    task_id: string;
    api_task_id?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    image_path: string;
    prompt: string;
    output_path: string;
    aspect_ratio: string;
    size: string;
    model: string;
    video_url?: string;
    error?: string;
    created_at: string;
    completed_at?: string;
    progress?: number;
}

export interface ShotData {
    shotId: string;
    description: string;
    imagePath: string;
    prompt: string;
    tasks: VideoTask[];
}

interface VideoGenState {
    // Config
    config: VideoGenConfig | null;
    configLoading: boolean;
    
    // Shots from Step6
    shots: ShotData[];
    shotsLoading: boolean;
    
    // Tasks
    tasks: Record<string, VideoTask>;
    activeTasks: string[]; // task_ids being processed
    
    // Actions
    loadConfig: () => Promise<void>;
    saveConfig: (config: VideoGenConfig) => Promise<void>;
    loadShots: (workspaceId: string) => Promise<void>;
    addTask: (shotId: string, imagePath: string, prompt: string) => Promise<VideoTask | null>;
    runTask: (taskId: string) => Promise<void>;
    updateTask: (taskId: string, updates: Partial<VideoTask>) => void;
    retryTask: (taskId: string) => Promise<void>;
    subscribeToProgress: (taskId: string) => void;
}

export const useVideoGenStore = create<VideoGenState>((set, get) => ({
    config: null,
    configLoading: true,
    shots: [],
    shotsLoading: false,
    tasks: {},
    activeTasks: [],
    
    loadConfig: async () => {
        set({ configLoading: true });
        try {
            const res = await fetch(`${API_BASE}/api/video-gen/config`);
            if (res.ok) {
                const data = await res.json();
                set({ config: data });
            }
        } catch (e) {
            console.error('Failed to load config:', e);
        } finally {
            set({ configLoading: false });
        }
    },
    
    saveConfig: async (config: VideoGenConfig) => {
        try {
            const res = await fetch(`${API_BASE}/api/video-gen/config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            if (res.ok) {
                set({ config });
            }
        } catch (e) {
            console.error('Failed to save config:', e);
        }
    },
    
    loadShots: async (workspaceId: string) => {
        set({ shotsLoading: true });
        try {
            // 从 Step6 的生成结果加载镜头数据
            const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/deconstruction.json`);
            if (res.ok) {
                const data = await res.json();
                const shots: ShotData[] = [];
                
                // 解析拆解数据，提取镜头和对应的图片
                if (data.shots) {
                    for (const [shotId, shotData] of Object.entries(data.shots as Record<string, any>)) {
                        // 查找该镜头的生成图片
                        const imagePath = `${API_BASE}/workspaces/${workspaceId}/generated/shots/${shotId}/image_url_1.png`;
                        
                        shots.push({
                            shotId,
                            description: shotData.description || `镜头 ${shotId}`,
                            imagePath,
                            prompt: shotData.video_prompt || shotData.prompt || '',
                            tasks: [],
                        });
                    }
                }
                
                set({ shots });
            }
        } catch (e) {
            console.error('Failed to load shots:', e);
        } finally {
            set({ shotsLoading: false });
        }
    },
    
    addTask: async (shotId: string, imagePath: string, prompt: string) => {
        const { config } = get();
        if (!config || config.mode !== 'yunwu') return null;
        
        try {
            const res = await fetch(`${API_BASE}/api/yunwu/tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image_path: imagePath,
                    prompt,
                    aspect_ratio: config.aspectRatio,
                    size: config.size,
                    model: config.model,
                }),
            });
            
            if (res.ok) {
                const { task } = await res.json();
                set(state => ({
                    tasks: { ...state.tasks, [task.task_id]: task },
                }));
                return task;
            }
        } catch (e) {
            console.error('Failed to add task:', e);
        }
        return null;
    },
    
    runTask: async (taskId: string) => {
        set(state => ({
            activeTasks: [...state.activeTasks, taskId],
        }));
        
        try {
            const res = await fetch(`${API_BASE}/api/yunwu/tasks/${taskId}/run`, {
                method: 'POST',
            });
            
            if (res.ok) {
                // 开始订阅进度
                get().subscribeToProgress(taskId);
            }
        } catch (e) {
            console.error('Failed to run task:', e);
            set(state => ({
                activeTasks: state.activeTasks.filter(id => id !== taskId),
            }));
        }
    },
    
    updateTask: (taskId: string, updates: Partial<VideoTask>) => {
        set(state => ({
            tasks: {
                ...state.tasks,
                [taskId]: { ...state.tasks[taskId], ...updates },
            },
        }));
    },
    
    retryTask: async (taskId: string) => {
        const task = get().tasks[taskId];
        if (!task) return;
        
        // 重置状态并重新执行
        get().updateTask(taskId, { status: 'pending', error: undefined });
        await get().runTask(taskId);
    },
    
    subscribeToProgress: (taskId: string) => {
        const { config } = get();
        const pollInterval = config?.pollInterval || 10;
        
        const eventSource = new EventSource(`${API_BASE}/api/yunwu/tasks/${taskId}/progress`);
        
        eventSource.addEventListener('progress', (e) => {
            const data = JSON.parse(e.data);
            get().updateTask(taskId, data);
        });
        
        eventSource.addEventListener('done', (e) => {
            const data = JSON.parse(e.data);
            get().updateTask(taskId, data);
            set(state => ({
                activeTasks: state.activeTasks.filter(id => id !== taskId),
            }));
            eventSource.close();
        });
        
        eventSource.addEventListener('error', (e) => {
            console.error('SSE error:', e);
            // 如果 SSE 失败，降级到轮询
            eventSource.close();
            
            const poll = async () => {
                try {
                    const res = await fetch(`${API_BASE}/api/yunwu/tasks/${taskId}`);
                    if (res.ok) {
                        const { task } = await res.json();
                        get().updateTask(taskId, task);
                        
                        if (task.status === 'completed' || task.status === 'failed') {
                            set(state => ({
                                activeTasks: state.activeTasks.filter(id => id !== taskId),
                            }));
                            return;
                        }
                    }
                    setTimeout(poll, pollInterval * 1000);
                } catch (err) {
                    console.error('Polling error:', err);
                }
            };
            poll();
        });
    },
}));
