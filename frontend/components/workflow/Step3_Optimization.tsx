'use client';

import { ArrowRight, Sparkles, Copy, Terminal, RefreshCw } from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

export default function Step3_Optimization() {
    const { currentWorkspace } = useWorkspace();
    const { nextStep } = useStepNavigator();

    // Mock shots for demo
    const mockShots = [
        { id: '1', description: '开场：展示产品全貌', duration: 2, visuals: '全景镜头，缓慢推进' },
        { id: '2', description: '特写：按键细节', duration: 1.5, visuals: '微距镜头，手指按下' },
        { id: '3', description: '展示：屏幕亮起', duration: 3, visuals: '中景，屏幕内容变化' },
    ];

    const copyContext = () => {
        const context = `
Project Path: ${currentWorkspace?.path}
Files:
- deconstruction.md
- shots.json
Task: Optimize shots based on deconstruction.
        `;
        navigator.clipboard.writeText(context);
        alert('Context copied to clipboard!');
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="apple-headline text-2xl">分镜优化</h2>
                    <p className="apple-body text-[var(--color-text-secondary)]">
                        AI 智能优化分镜脚本，提升叙事节奏。
                    </p>
                </div>
                <button onClick={nextStep} className="apple-button-primary flex items-center gap-2">
                    下一步：爆款密度 <ArrowRight size={16} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Agent Context Panel */}
                <div className="glass-card p-6 lg:col-span-1 space-y-6">
                    <div className="flex items-center gap-2 text-purple-500 font-semibold">
                        <Terminal size={20} />
                        <h3>AI Agent 协同</h3>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        请复制以下上下文给 AI 编程工具，让其读取 `deconstruction.md` 并生成 `shots.json`。
                    </p>

                    <div className="bg-[var(--color-bg-secondary)] p-4 rounded-xl font-mono text-xs text-[var(--color-text-tertiary)] border border-[var(--glass-border)]">
                        <p>Project: {currentWorkspace?.name}</p>
                        <p className="truncate">Path: {currentWorkspace?.path}</p>
                        <p className="mt-2 text-blue-500">Waiting for shots.json updates...</p>
                    </div>

                    <button
                        onClick={copyContext}
                        className="apple-button-secondary w-full justify-center gap-2"
                    >
                        <Copy size={16} /> 复制上下文 (Copy Context)
                    </button>

                    <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-text-tertiary)]">
                        <RefreshCw size={12} className="animate-spin" />
                        正在监听文件变化...
                    </div>
                </div>

                {/* Right: Shot List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="font-semibold">分镜列表 ({mockShots.length})</h3>
                        <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded-full">
                            Auto-Refreshed
                        </span>
                    </div>

                    <div className="grid gap-4">
                        {mockShots.map((shot, index) => (
                            <div key={shot.id} className="glass-card p-4 flex gap-4 group hover:border-blue-500/30 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center font-mono text-sm font-bold text-[var(--color-text-tertiary)]">
                                    {index + 1}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <div className="flex justify-between">
                                        <p className="font-medium">{shot.description}</p>
                                        <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{shot.duration}s</span>
                                    </div>
                                    <p className="text-sm text-[var(--color-text-secondary)] flex items-center gap-2">
                                        <Sparkles size={12} className="text-purple-500" />
                                        {shot.visuals}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
