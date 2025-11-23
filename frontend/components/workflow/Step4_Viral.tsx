'use client';

import { ArrowRight, Zap, TrendingUp, Copy, Terminal } from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

export default function Step4_Viral() {
    const { currentWorkspace } = useWorkspace();
    const { nextStep } = useStepNavigator();

    // Mock shots with viral data
    const mockShots = [
        {
            id: '1',
            description: '开场：展示产品全貌',
            viralTags: ['黄金3秒', '视觉冲击'],
            densityScore: 85
        },
        {
            id: '2',
            description: '特写：按键细节',
            viralTags: ['ASMR'],
            densityScore: 60
        },
        {
            id: '3',
            description: '展示：屏幕亮起',
            viralTags: ['期待感'],
            densityScore: 90
        },
    ];

    const copyContext = () => {
        const context = `
Project Path: ${currentWorkspace?.path}
Task: Add viral tags and increase density score in shots.json.
        `;
        navigator.clipboard.writeText(context);
        alert('Context copied!');
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="apple-headline text-2xl">爆款密度</h2>
                    <p className="apple-body text-[var(--color-text-secondary)]">
                        注入爆款元素，提升视频完播率和互动率。
                    </p>
                </div>
                <button onClick={nextStep} className="apple-button-primary flex items-center gap-2">
                    下一步：画面提示词 <ArrowRight size={16} />
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: Agent Context */}
                <div className="glass-card p-6 lg:col-span-1 space-y-6">
                    <div className="flex items-center gap-2 text-yellow-500 font-semibold">
                        <Terminal size={20} />
                        <h3>AI Agent 协同</h3>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        让 AI 分析分镜，自动添加爆款标签并优化尾部信息密度。
                    </p>
                    <button onClick={copyContext} className="apple-button-secondary w-full justify-center gap-2">
                        <Copy size={16} /> 复制上下文
                    </button>
                </div>

                {/* Right: Viral Analysis */}
                <div className="lg:col-span-2 space-y-4">
                    {mockShots.map((shot, index) => (
                        <div key={shot.id} className="glass-card p-4 flex items-center gap-6">
                            <div className="w-8 h-8 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center font-mono text-sm font-bold text-[var(--color-text-tertiary)]">
                                {index + 1}
                            </div>

                            <div className="flex-1">
                                <p className="font-medium mb-2">{shot.description}</p>
                                <div className="flex gap-2">
                                    {shot.viralTags.map(tag => (
                                        <span key={tag} className="text-xs bg-yellow-500/10 text-yellow-600 px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-500/20">
                                            <Zap size={10} /> {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-xs text-[var(--color-text-tertiary)] mb-1">信息密度</div>
                                <div className="flex items-center gap-2">
                                    <TrendingUp size={16} className={shot.densityScore > 80 ? 'text-green-500' : 'text-yellow-500'} />
                                    <span className="font-mono font-bold text-lg">{shot.densityScore}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
