'use client';
/* eslint-disable @next/next/no-img-element */

import { useTimelineStore } from '@/lib/stores/timelineStore';
import { formatSeconds } from '@/lib/utils/formatTime';
import { Image as ImageIcon, Loader2 } from 'lucide-react';

export default function FramePreview() {
    const {
        previewFrameUrl,
        previewFramePrevUrl,
        previewFrameNextUrl,
        isFrameLoading,
        frameError,
        previewFrameTime,
        previewFramePrevTime,
        previewFrameNextTime,
        selectedCutPoint,
    } = useTimelineStore();

    const displayTime = previewFrameTime ?? selectedCutPoint;

    return (
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-4 border border-white/20">
            <div className="flex items-center gap-2 mb-3">
                <ImageIcon size={18} className="text-purple-400" />
                <h3 className="text-sm font-semibold">帧预览</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 items-start">
                {/* Prev */}
                <div className="flex flex-col items-center gap-1">
                    <div className="relative bg-black/50 rounded-lg overflow-hidden w-full" style={{ aspectRatio: '9/16' }}>
                        {previewFramePrevUrl ? (
                            <img src={previewFramePrevUrl} alt="Prev frame" className="w-full h-full object-contain opacity-85" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">上一帧</div>
                        )}
                    </div>
                    <div className="text-center text-[11px] text-gray-400">
                        上一帧 · {previewFramePrevTime != null ? formatSeconds(previewFramePrevTime) : '--:--'}
                    </div>
                </div>

                {/* Current */}
                <div className="flex flex-col items-center gap-1">
                    <div className="relative bg-black/80 rounded-lg overflow-hidden w-full ring-2 ring-sky-400/90 shadow-lg" style={{ aspectRatio: '9/16' }}>
                        {isFrameLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Loader2 className="animate-spin text-purple-400" size={28} />
                            </div>
                        ) : frameError ? (
                            <div className="absolute inset-0 flex items-center justify-center text-red-400 text-sm">
                                {frameError}
                            </div>
                        ) : previewFrameUrl ? (
                            <img
                                src={previewFrameUrl}
                                alt="Frame preview"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
                                点击时间轴查看帧预览
                            </div>
                        )}
                    </div>
                    <div className="text-center text-[12px] text-sky-400 font-semibold drop-shadow-sm">
                        当前帧 · {displayTime !== null ? formatSeconds(displayTime) : '未选择'}
                    </div>
                </div>

                {/* Next */}
                <div className="flex flex-col items-center gap-1">
                    <div className="relative bg-black/50 rounded-lg overflow-hidden w-full" style={{ aspectRatio: '9/16' }}>
                        {previewFrameNextUrl ? (
                            <img src={previewFrameNextUrl} alt="Next frame" className="w-full h-full object-contain opacity-85" />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">下一帧</div>
                        )}
                    </div>
                    <div className="text-center text-[11px] text-gray-400">
                        下一帧 · {previewFrameNextTime != null ? formatSeconds(previewFrameNextTime) : '--:--'}
                    </div>
                </div>
            </div>
        </div>
    );
}
