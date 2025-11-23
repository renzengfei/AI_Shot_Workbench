'use client';

import { ArrowRight, Video, Play, Loader2, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

export default function Step7_VideoGen() {
    const { nextStep } = useStepNavigator();
    const [generating, setGenerating] = useState<string | null>(null);

    // Mock video assets
    const mockVideos = [
        {
            shotId: '1',
            description: '开场：展示产品全貌',
            status: 'done',
            videoUrl: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4',
            prompt: 'cinematic shot, camera push in, slow motion'
        },
        {
            shotId: '2',
            description: '特写：按键细节',
            status: 'generating',
            videoUrl: null,
            prompt: 'macro shot, finger pressing button, tactile feel'
        },
        {
            shotId: '3',
            description: '展示：屏幕亮起',
            status: 'pending',
            videoUrl: null,
            prompt: 'screen glowing, holographic UI appearing'
        }
    ];

    const handleGenerate = (id: string) => {
        setGenerating(id);
        setTimeout(() => setGenerating(null), 3000);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="apple-headline text-2xl">视频生成</h2>
                    <p className="apple-body text-[var(--color-text-secondary)]">
                        将静态画面转化为动态视频 (Runway/Pika/Luma)。
                    </p>
                </div>
                <button onClick={nextStep} className="apple-button-primary flex items-center gap-2">
                    下一步：导出剪辑 <ArrowRight size={16} />
                </button>
            </div>

            <div className="grid gap-6">
                {mockVideos.map((video) => (
                    <div key={video.shotId} className="glass-card p-6 flex gap-6">
                        {/* Video Preview / Placeholder */}
                        <div className="w-64 aspect-video bg-black/90 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-[var(--glass-border)] relative group">
                            {video.status === 'done' ? (
                                <>
                                    <video src={video.videoUrl!} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100">
                                            <Play size={20} fill="currentColor" />
                                        </div>
                                    </div>
                                </>
                            ) : video.status === 'generating' || generating === video.shotId ? (
                                <div className="flex flex-col items-center gap-2 text-blue-500">
                                    <Loader2 size={24} className="animate-spin" />
                                    <span className="text-xs font-medium">Generating...</span>
                                </div>
                            ) : (
                                <div className="text-[var(--color-text-tertiary)] flex flex-col items-center gap-2">
                                    <Video size={24} />
                                    <span className="text-xs">Ready to Generate</span>
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex-1 flex flex-col justify-between py-1">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-lg">Shot {video.shotId}: {video.description}</h3>
                                    {video.status === 'done' && (
                                        <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full flex items-center gap-1">
                                            <CheckCircle2 size={12} /> Completed
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-[var(--color-text-secondary)] font-mono bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--glass-border)]">
                                    Prompt: {video.prompt}
                                </p>
                            </div>

                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    onClick={() => handleGenerate(video.shotId)}
                                    disabled={video.status === 'generating' || generating === video.shotId}
                                    className="apple-button-primary"
                                >
                                    {video.status === 'done' ? '重新生成' : '开始生成'}
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
