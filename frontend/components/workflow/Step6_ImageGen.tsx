'use client';

import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

export default function Step6_ImageGen() {
    const { nextStep } = useStepNavigator();
    const [selectedImages, setSelectedImages] = useState<Record<string, number>>({});

    // Mock generated images
    const mockAssets = [
        {
            shotId: '1',
            description: '开场：展示产品全貌',
            images: [
                'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1535378437327-b7149b379bab?auto=format&fit=crop&w=800&q=80'
            ]
        },
        {
            shotId: '2',
            description: '特写：按键细节',
            images: [
                'https://images.unsplash.com/photo-1555664424-778a690323a3?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1526045612212-70caf35c14df?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=800&q=80',
                'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80'
            ]
        }
    ];

    const toggleSelection = (shotId: string, imgIndex: number) => {
        setSelectedImages(prev => ({
            ...prev,
            [shotId]: imgIndex
        }));
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="apple-headline text-2xl">画面生成</h2>
                    <p className="apple-body text-[var(--color-text-secondary)]">
                        从生成的图像中选择最佳画面，或者重新生成。
                    </p>
                </div>
                <button onClick={nextStep} className="apple-button-primary flex items-center gap-2">
                    下一步：视频生成 <ArrowRight size={16} />
                </button>
            </div>

            <div className="space-y-8">
                {mockAssets.map((asset) => (
                    <div key={asset.shotId} className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-lg flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center text-xs">
                                    {asset.shotId}
                                </span>
                                {asset.description}
                            </h3>
                            <button className="apple-button-secondary text-xs py-1 px-3 flex items-center gap-1">
                                <RefreshCw size={12} /> 重新生成 (4张)
                            </button>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {asset.images.map((img, idx) => {
                                const isSelected = selectedImages[asset.shotId] === idx;
                                return (
                                    <div
                                        key={idx}
                                        onClick={() => toggleSelection(asset.shotId, idx)}
                                        className={`
                                            relative group cursor-pointer rounded-xl overflow-hidden aspect-video border-2 transition-all duration-300
                                            ${isSelected ? 'border-blue-500 ring-4 ring-blue-500/20' : 'border-transparent hover:border-[var(--glass-border)]'}
                                        `}
                                    >
                                        <img src={img} alt={`Generated ${idx}`} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />

                                        {/* Selection Indicator */}
                                        <div className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${isSelected ? 'bg-blue-500 text-white scale-100' : 'bg-black/50 text-white/50 scale-90 opacity-0 group-hover:opacity-100'}`}>
                                            <CheckCircle2 size={14} />
                                        </div>

                                        {/* Overlay */}
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
