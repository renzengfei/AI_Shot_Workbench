'use client';

import { ArrowRight, Image as ImageIcon, Wand2, Copy } from 'lucide-react';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

export default function Step5_ImagePrompts() {
    const { nextStep } = useStepNavigator();

    // Mock prompts
    const mockPrompts = [
        {
            id: '1',
            description: '开场：展示产品全貌',
            prompt: 'cinematic shot of a futuristic gadget, sleek design, glowing blue lights, dark background, 8k resolution, unreal engine 5 render --ar 16:9'
        },
        {
            id: '2',
            description: '特写：按键细节',
            prompt: 'macro photography of a finger pressing a tactile button, shallow depth of field, bokeh effect, high detail, professional lighting --ar 16:9'
        },
        {
            id: '3',
            description: '展示：屏幕亮起',
            prompt: 'medium shot of a device screen turning on, displaying vibrant colors, holographic interface, sci-fi atmosphere --ar 16:9'
        }
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="apple-headline text-2xl">画面提示词</h2>
                    <p className="apple-body text-[var(--color-text-secondary)]">
                        为每个分镜生成高质量的 AI 绘画提示词 (Midjourney/Stable Diffusion)。
                    </p>
                </div>
                <button onClick={nextStep} className="apple-button-primary flex items-center gap-2">
                    下一步：画面生成 <ArrowRight size={16} />
                </button>
            </div>

            <div className="grid gap-4">
                {mockPrompts.map((item, index) => (
                    <div key={item.id} className="glass-card p-6 flex gap-6 group">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-500 shrink-0">
                            <ImageIcon size={24} />
                        </div>

                        <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-lg">Shot {index + 1}: {item.description}</h3>
                                <button className="apple-button-secondary text-xs py-1 px-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Wand2 size={12} /> 重新生成
                                </button>
                            </div>

                            <div className="bg-[var(--color-bg-secondary)] p-4 rounded-xl border border-[var(--glass-border)] relative group/prompt">
                                <p className="font-mono text-sm text-[var(--color-text-secondary)] leading-relaxed">
                                    {item.prompt}
                                </p>
                                <button
                                    onClick={() => navigator.clipboard.writeText(item.prompt)}
                                    className="absolute top-2 right-2 p-2 rounded-lg bg-[var(--glass-bg-light)] hover:bg-white/20 transition-colors opacity-0 group-hover/prompt:opacity-100"
                                    title="Copy Prompt"
                                >
                                    <Copy size={14} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
