'use client';

import { ArrowRight, Video, Play, Loader2, CheckCircle2, Cloud, Bot, RefreshCw, AlertCircle, Image } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';
import { useWorkspace } from '@/components/WorkspaceContext';
import { useVideoGenStore, VideoTask } from '@/lib/stores/videoGenStore';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

interface ShotWithTasks {
    shotId: string;
    description: string;
    imagePath: string;
    prompt: string;
    task?: VideoTask;
}

export default function Step7_VideoGen() {
    const { nextStep } = useStepNavigator();
    const { currentWorkspace } = useWorkspace();
    const workspaceId = currentWorkspace?.path?.split('/').pop() || '';
    const videoRef = useRef<HTMLVideoElement>(null);
    const [playingVideo, setPlayingVideo] = useState<string | null>(null);
    
    const { 
        config, 
        configLoading, 
        loadConfig,
        tasks,
        activeTasks,
        addTask,
        runTask,
        retryTask,
    } = useVideoGenStore();
    
    const [shots, setShots] = useState<ShotWithTasks[]>([]);
    const [shotsLoading, setShotsLoading] = useState(true);

    // Load config and shots on mount
    useEffect(() => {
        loadConfig();
    }, [loadConfig]);
    
    // Load shots from deconstruction data
    const loadShots = useCallback(async () => {
        if (!workspaceId) return;
        setShotsLoading(true);
        
        try {
            const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/deconstruction.json`);
            if (res.ok) {
                const data = await res.json();
                const loadedShots: ShotWithTasks[] = [];
                
                // 获取生成的图片目录
                const projectName = data.project_name || 'generated';
                
                if (data.shots) {
                    for (const [shotId, shotData] of Object.entries(data.shots as Record<string, any>)) {
                        // 图片路径基于 workspace 结构
                        const imagePath = `${API_BASE}/workspaces/${workspaceId}/${projectName}/shots/${shotId}/image_url_1.png`;
                        
                        loadedShots.push({
                            shotId,
                            description: shotData.description || `镜头 ${shotId}`,
                            imagePath,
                            prompt: shotData.video_prompt || shotData.motion_prompt || 'camera movement, cinematic',
                        });
                    }
                }
                
                // 按 shotId 排序
                loadedShots.sort((a, b) => {
                    const aNum = parseFloat(a.shotId) || 0;
                    const bNum = parseFloat(b.shotId) || 0;
                    return aNum - bNum;
                });
                
                setShots(loadedShots);
            }
        } catch (e) {
            console.error('Failed to load shots:', e);
            // 使用 mock 数据作为备用
            setShots([
                { shotId: '1.0', description: '开场镜头', imagePath: '', prompt: 'camera push in, cinematic' },
                { shotId: '2.0', description: '特写镜头', imagePath: '', prompt: 'slow zoom, focus shift' },
            ]);
        } finally {
            setShotsLoading(false);
        }
    }, [workspaceId]);
    
    useEffect(() => {
        loadShots();
    }, [loadShots]);

    const handleGenerate = async (shot: ShotWithTasks) => {
        if (config?.mode === 'yunwu') {
            const task = await addTask(shot.shotId, shot.imagePath, shot.prompt);
            if (task) {
                await runTask(task.task_id);
            }
        } else {
            // Lovart 模式
            try {
                const res = await fetch(`${API_BASE}/api/video/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_path: shot.imagePath,
                        prompt: shot.prompt,
                    }),
                });
                if (res.ok) {
                    console.log('Lovart 任务已添加');
                }
            } catch (e) {
                console.error('Lovart 任务添加失败:', e);
            }
        }
    };

    const handleRetry = async (taskId: string) => {
        await retryTask(taskId);
    };

    const getTaskForShot = (shotId: string): VideoTask | undefined => {
        return Object.values(tasks).find(t => t.image_path.includes(shotId));
    };

    const handlePlayVideo = (videoUrl: string) => {
        setPlayingVideo(videoUrl);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Status Bar */}
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        {config?.mode === 'yunwu' ? (
                            <Cloud size={18} className="text-blue-500" />
                        ) : (
                            <Bot size={18} className="text-violet-500" />
                        )}
                        <span className="text-sm font-medium">
                            {configLoading ? '加载中...' : config?.mode === 'yunwu' ? '云雾 API' : 'Lovart 自动化'}
                        </span>
                    </div>
                    {config?.mode === 'yunwu' && (
                        <>
                            <div className="h-4 w-px bg-slate-300" />
                            <span className="text-xs text-slate-500">
                                模型: {config.model} | 尺寸: {config.size} | 比例: {config.aspectRatio}
                            </span>
                        </>
                    )}
                </div>
                <div className="text-xs text-slate-400">
                    在 Step3「生视频配置」中切换模式
                </div>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="apple-headline text-2xl">视频生成</h2>
                    <p className="apple-body text-[var(--color-text-secondary)]">
                        将静态画面转化为动态视频
                    </p>
                </div>
                <button onClick={nextStep} className="apple-button-primary flex items-center gap-2">
                    下一步：导出剪辑 <ArrowRight size={16} />
                </button>
            </div>

            {/* Shots Grid */}
            {shotsLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 size={32} className="animate-spin text-blue-500" />
                </div>
            ) : shots.length === 0 ? (
                <div className="glass-card p-12 text-center">
                    <Image size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-slate-500">暂无镜头数据</p>
                    <p className="text-xs text-slate-400 mt-2">请先在 Step6 生成图片</p>
                </div>
            ) : (
                <div className="grid gap-6">
                    {shots.map((shot) => {
                        const task = getTaskForShot(shot.shotId);
                        const isProcessing = task && activeTasks.includes(task.task_id);
                        const status = task?.status || 'pending';
                        
                        return (
                            <div key={shot.shotId} className="glass-card p-6 flex gap-6">
                                {/* Preview */}
                                <div className="w-64 aspect-video bg-black/90 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-[var(--glass-border)] relative group">
                                    {status === 'completed' && task?.video_url ? (
                                        <>
                                            <video 
                                                src={task.video_url} 
                                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                                controls={playingVideo === task.video_url}
                                                onClick={() => handlePlayVideo(task.video_url!)}
                                            />
                                            {playingVideo !== task.video_url && (
                                                <div className="absolute inset-0 flex items-center justify-center cursor-pointer" onClick={() => handlePlayVideo(task.video_url!)}>
                                                    <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                                        <Play size={24} fill="currentColor" />
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    ) : status === 'processing' || isProcessing ? (
                                        <div className="flex flex-col items-center gap-2 text-blue-500">
                                            <Loader2 size={24} className="animate-spin" />
                                            <span className="text-xs font-medium">生成中...</span>
                                            {task?.progress !== undefined && (
                                                <span className="text-xs">{task.progress}%</span>
                                            )}
                                        </div>
                                    ) : status === 'failed' ? (
                                        <div className="flex flex-col items-center gap-2 text-red-500">
                                            <AlertCircle size={24} />
                                            <span className="text-xs font-medium">生成失败</span>
                                        </div>
                                    ) : shot.imagePath ? (
                                        <img 
                                            src={shot.imagePath} 
                                            alt={shot.description}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <div className="text-[var(--color-text-tertiary)] flex flex-col items-center gap-2">
                                            <Video size={24} />
                                            <span className="text-xs">待生成</span>
                                        </div>
                                    )}
                                </div>

                                {/* Controls */}
                                <div className="flex-1 flex flex-col justify-between py-1">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="font-semibold text-lg">镜头 {shot.shotId}: {shot.description}</h3>
                                            {status === 'completed' && (
                                                <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full flex items-center gap-1">
                                                    <CheckCircle2 size={12} /> 完成
                                                </span>
                                            )}
                                            {status === 'failed' && (
                                                <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded-full flex items-center gap-1">
                                                    <AlertCircle size={12} /> 失败
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--glass-border)]">
                                            {shot.prompt}
                                        </p>
                                        {task?.error && (
                                            <p className="text-xs text-red-500 mt-2">{task.error}</p>
                                        )}
                                    </div>

                                    <div className="flex justify-end gap-3 mt-4">
                                        {status === 'failed' && task && (
                                            <button
                                                onClick={() => handleRetry(task.task_id)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
                                            >
                                                <RefreshCw size={14} /> 重试
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleGenerate(shot)}
                                            disabled={isProcessing || status === 'processing'}
                                            className="apple-button-primary disabled:opacity-50"
                                        >
                                            {status === 'completed' ? '重新生成' : status === 'processing' || isProcessing ? '生成中...' : '开始生成'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Video Preview Modal */}
            {playingVideo && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
                    onClick={() => setPlayingVideo(null)}
                >
                    <video 
                        ref={videoRef}
                        src={playingVideo} 
                        className="max-w-4xl max-h-[80vh] rounded-xl"
                        controls
                        autoPlay
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </div>
    );
}
