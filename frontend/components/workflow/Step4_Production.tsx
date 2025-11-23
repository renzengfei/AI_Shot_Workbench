'use client';

import { useState } from 'react';
import { Wand2, Image as ImageIcon, Video, Download } from 'lucide-react';
import { useWorkflowStore } from '@/lib/stores/workflowStore';

export default function Step4_Production() {
    const { project, updateProductionConfig } = useWorkflowStore();
    const [isGenerating, setIsGenerating] = useState(false);

    if (!project) return null;

    const handleGeneratePrompts = async () => {
        setIsGenerating(true);
        setTimeout(() => setIsGenerating(false), 2000);
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                <h2 className="apple-headline" style={{ marginBottom: 'var(--spacing-sm)' }}>
                    视频生产
                </h2>
                <p className="apple-caption">
                    配置生产参数，生成最终视频内容
                </p>
            </div>

            {/* Production Config */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                <h3 className="font-semibold text-lg mb-4">生产配置</h3>

                <div className="space-y-4">
                    {/* Tail Density */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="apple-body font-medium">尾部密度填充</label>
                            <p className="apple-caption">延长关键片段的时长</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="checkbox"
                                checked={project.productionConfig.tailDensityEnabled}
                                onChange={(e) =>
                                    updateProductionConfig({ tailDensityEnabled: e.target.checked })
                                }
                                className="w-5 h-5"
                            />
                            {project.productionConfig.tailDensityEnabled && (
                                <input
                                    type="number"
                                    value={project.productionConfig.tailDensityDuration}
                                    onChange={(e) =>
                                        updateProductionConfig({ tailDensityDuration: Number(e.target.value) })
                                    }
                                    className="apple-input"
                                    style={{ width: '80px' }}
                                    min="0"
                                    step="0.5"
                                />
                            )}
                        </div>
                    </div>

                    {/* Viral Template */}
                    <div className="flex items-center justify-between">
                        <div>
                            <label className="apple-body font-medium">爆款模板</label>
                            <p className="apple-caption">选择视频风格模板</p>
                        </div>
                        <select
                            value={project.productionConfig.viralTemplate}
                            onChange={(e) => updateProductionConfig({ viralTemplate: e.target.value })}
                            className="apple-input"
                            style={{ width: '160px' }}
                        >
                            <option value="default">默认</option>
                            <option value="dramatic">戏剧化</option>
                            <option value="emotional">情感化</option>
                            <option value="suspense">悬念化</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Prompt Generation */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                <h3 className="font-semibold text-lg mb-4">提示词生成</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={handleGeneratePrompts}
                        disabled={isGenerating}
                        className="glass-button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '16px',
                            opacity: isGenerating ? 0.5 : 1
                        }}
                    >
                        <Wand2 size={20} />
                        <span>{isGenerating ? '生成中...' : '生成图片提示词'}</span>
                    </button>

                    <button
                        onClick={handleGeneratePrompts}
                        disabled={isGenerating}
                        className="glass-button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            padding: '16px',
                            opacity: isGenerating ? 0.5 : 1
                        }}
                    >
                        <Wand2 size={20} />
                        <span>{isGenerating ? '生成中...' : '生成视频提示词'}</span>
                    </button>
                </div>

                {/* Prompt List */}
                <div className="space-y-3">
                    {project.optimizedShots.slice(0, 3).map((shot) => (
                        <div
                            key={shot.shotId}
                            className="glass-card"
                            style={{ padding: 'var(--spacing-md)' }}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <span className="font-semibold">镜头 {shot.shotId}</span>
                                <span className="apple-caption">
                                    {shot.startTime.toFixed(2)}s
                                </span>
                            </div>
                            <p className="apple-body">
                                {shot.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Generation */}
            <div className="glass-card" style={{ padding: 'var(--spacing-lg)' }}>
                <h3 className="font-semibold text-lg mb-4">AI 生成</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button className="apple-button-primary" style={{ padding: '16px' }}>
                        <ImageIcon size={20} style={{ marginRight: '8px' }} />
                        <span>批量生成图片</span>
                    </button>

                    <button className="apple-button-primary" style={{ padding: '16px' }}>
                        <Video size={20} style={{ marginRight: '8px' }} />
                        <span>批量生成视频</span>
                    </button>
                </div>
            </div>

            {/* Download Button */}
            <div className="flex justify-end">
                <button className="apple-button-primary" style={{ padding: '14px 32px', fontSize: '17px' }}>
                    <Download size={20} style={{ marginRight: '8px' }} />
                    <span>下载全部资源</span>
                </button>
            </div>
        </div>
    );
}
