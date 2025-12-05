'use client';

import { useTimelineStore } from '@/lib/stores/timelineStore';
import { formatDuration } from '@/lib/utils/formatTime';
import { Film, Scissors, Clock } from 'lucide-react';

export default function StatusBar() {
    const {
        videoFileName,
        durationSeconds,
        cutPoints,
        hiddenSegments,
    } = useTimelineStore();

    if (!videoFileName) return null;

    const visibleCuts = cutPoints.length > 0 ? cutPoints.length - 1 : 0;
    const hiddenCount = hiddenSegments.length;

    return (
        <div className="flex items-center justify-between flex-wrap gap-4 px-1 py-3 text-[var(--lg-text-primary)]">
            {/* Video Info */}
            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                    <Film size={16} className="text-[var(--lg-blue)]" />
                    <span className="font-medium">{videoFileName}</span>
                </div>
                {durationSeconds && (
                    <div className="flex items-center gap-1.5 text-[var(--lg-text-secondary)]">
                        <Clock size={14} />
                        <span className="text-xs">{formatDuration(durationSeconds)}</span>
                    </div>
                )}
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-sm">
                <div className="flex items-center gap-1.5">
                    <Scissors size={16} className="text-[var(--lg-green)]" />
                    <span>{visibleCuts} 个镜头</span>
                </div>
                {hiddenCount > 0 && (
                    <span className="text-xs text-[var(--lg-text-secondary)]">已隐藏 {hiddenCount} 段</span>
                )}
            </div>
        </div>
    );
}
