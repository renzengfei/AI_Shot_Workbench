'use client';

import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

export default function Step2_Analysis() {
    const { project, setShotAnalysis } = useWorkflowStore();
    const { nextStep } = useStepNavigator();
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    if (!project) return null;

    const handleAnalyzeAll = async () => {
        setIsAnalyzing(true);

        try {
            // TODO: Call backend API
            const mockAnalysis = project.cuts.slice(0, -1).map((startTime, index) => ({
                shotId: index + 1,
                startTime,
                endTime: project.cuts[index + 1],
                description: `镜头 ${index + 1} 的内容描述...`,
                emotions: ['平静'],
                viralElements: [],
                visualElements: ['人物', '场景'],
                suggestedDuration: project.cuts[index + 1] - startTime,
            }));

            setShotAnalysis(mockAnalysis);
        } catch (error) {
            console.error('Analysis failed:', error);
            alert('分析失败');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const hasAnalysis = project.shotAnalysis.length > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                <h2 className="apple-headline" style={{ marginBottom: 'var(--spacing-sm)' }}>
                    AI 原片拆解
                </h2>
                <p className="apple-caption">
                    AI 将分析每个镜头的内容、情绪、爆点元素等信息
                </p>
            </div>

            {/* Analysis Button */}
            {!hasAnalysis && (
                <div className="glass-card text-center" style={{ padding: 'var(--spacing-3xl)' }}>
                    <Sparkles className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-blue-500)' }} />
                    <h3 className="apple-headline" style={{ marginBottom: 'var(--spacing-md)' }}>
                        准备开始 AI 分析
                    </h3>
                    <p className="apple-caption" style={{ marginBottom: 'var(--spacing-lg)' }}>
                        共 {project.cuts.length - 1} 个镜头待分析
                    </p>
                    <button
                        onClick={handleAnalyzeAll}
                        disabled={isAnalyzing}
                        className="apple-button-primary"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            opacity: isAnalyzing ? 0.5 : 1
                        }}
                    >
                        {isAnalyzing ? (
                            <>
                                <Loader2 className="animate-spin" size={20} />
                                <span>分析中...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={20} />
                                <span>开始 AI 分析</span>
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* Analysis Results */}
            {hasAnalysis && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {project.shotAnalysis.map((shot) => (
                            <div
                                key={shot.shotId}
                                className="glass-card"
                                style={{ padding: 'var(--spacing-md)' }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-lg">镜头 {shot.shotId}</h3>
                                    <span className="apple-caption">
                                        {shot.startTime.toFixed(2)}s - {shot.endTime.toFixed(2)}s
                                    </span>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div>
                                        <span className="apple-caption">描述:</span>
                                        <p className="apple-body mt-1">{shot.description}</p>
                                    </div>

                                    <div>
                                        <span className="apple-caption">情绪:</span>
                                        <div className="flex flex-wrap gap-2 mt-1">
                                            {shot.emotions.map((emotion) => (
                                                <span
                                                    key={emotion}
                                                    className="apple-badge"
                                                    style={{ background: 'var(--color-blue-glass)' }}
                                                >
                                                    {emotion}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {shot.viralElements.length > 0 && (
                                        <div>
                                            <span className="apple-caption">爆点:</span>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {shot.viralElements.map((element) => (
                                                    <span
                                                        key={element}
                                                        className="apple-badge"
                                                        style={{ background: 'rgba(255, 59, 48, 0.1)' }}
                                                    >
                                                        {element}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Next Button */}
                    <div className="flex justify-end">
                        <button
                            onClick={() => nextStep()}
                            className="apple-button-primary"
                            style={{ padding: '14px 32px', fontSize: '17px' }}
                        >
                            分析完成，开始优化 →
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
