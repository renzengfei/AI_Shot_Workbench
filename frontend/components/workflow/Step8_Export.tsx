'use client';

import { FileOutput, Film, Download } from 'lucide-react';
import { useState } from 'react';

export default function Step8_Export() {
    const [exporting, setExporting] = useState<string | null>(null);

    const handleExport = (type: string) => {
        setExporting(type);
        setTimeout(() => {
            setExporting(null);
            alert(`${type} Exported Successfully!`);
        }, 2000);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
                <h2 className="apple-headline text-2xl">导出剪辑</h2>
                <p className="apple-body text-[var(--color-text-secondary)]">
                    将最终的视频序列导出为 XML (Premiere Pro) 或直接渲染为视频文件。
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* XML Export Card */}
                <div className="glass-card p-8 flex flex-col items-center text-center space-y-6 hover:border-blue-500/50 transition-colors group">
                    <div className="w-20 h-20 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300">
                        <FileOutput size={40} />
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold mb-2">Premiere Pro XML</h3>
                        <p className="text-[var(--color-text-secondary)] text-sm max-w-xs mx-auto">
                            导出包含所有分镜、音频和视频素材的时间轴文件，可在 Pr 中继续精细剪辑。
                        </p>
                    </div>

                    <button
                        onClick={() => handleExport('XML')}
                        disabled={!!exporting}
                        className="apple-button-primary w-full justify-center py-3"
                    >
                        {exporting === 'XML' ? 'Exporting...' : 'Export XML Sequence'}
                    </button>
                </div>

                {/* Video Render Card */}
                <div className="glass-card p-8 flex flex-col items-center text-center space-y-6 hover:border-purple-500/50 transition-colors group">
                    <div className="w-20 h-20 rounded-2xl bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform duration-300">
                        <Film size={40} />
                    </div>

                    <div>
                        <h3 className="text-xl font-semibold mb-2">Final Video Render</h3>
                        <p className="text-[var(--color-text-secondary)] text-sm max-w-xs mx-auto">
                            直接渲染最终成片 (MP4, H.264)，适用于快速预览或直接发布。
                        </p>
                    </div>

                    <button
                        onClick={() => handleExport('Video')}
                        disabled={!!exporting}
                        className="apple-button-secondary w-full justify-center py-3"
                    >
                        {exporting === 'Video' ? 'Rendering...' : 'Render Video (MP4)'}
                    </button>
                </div>
            </div>

            {/* Export History (Mock) */}
            <div className="glass-card p-6 mt-8">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Download size={18} /> Export History
                </h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--glass-border)]">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <FileOutput size={16} />
                            </div>
                            <div>
                                <p className="font-medium text-sm">project_v1.xml</p>
                                <p className="text-xs text-[var(--color-text-tertiary)]">Today, 10:23 AM</p>
                            </div>
                        </div>
                        <button className="text-blue-500 hover:text-blue-600 text-sm font-medium">Download</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
