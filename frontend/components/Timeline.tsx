'use client';

import { useMemo, useRef } from 'react';
import { useTimelineStore } from '@/lib/stores/timelineStore';
import { useFramePreview } from '@/lib/hooks/useFramePreview';
import '@/app/timeline.css';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface TimelineProps {
    onSeek: (seconds: number) => void;
}

const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

export default function Timeline({ onSeek }: TimelineProps) {
    const trackRef = useRef<HTMLDivElement | null>(null);

    const {
        durationSeconds,
        cutPoints,
        manualCutPoints,
        hiddenSegments,
        playheadSeconds,
        selectedCutPoint,
        setSelectedCutPoint,
        sessionId,
    } = useTimelineStore();
    const { requestFrameTriplet } = useFramePreview();

    const resolvedDuration = useMemo(() => {
        if (durationSeconds && durationSeconds > 0) {
            return durationSeconds;
        }
        if (cutPoints.length === 0) {
            return 0;
        }
        return Math.max(...cutPoints);
    }, [durationSeconds, cutPoints]);

    const markers = useMemo(() => {
        if (resolvedDuration <= 0) {
            return [] as Array<{ time: number; kind: 'auto' | 'manual' }>;
        }

        const filtered = cutPoints
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value) && value >= 0 && value <= resolvedDuration)
            .sort((a, b) => a - b);

        if (filtered.length === 0) {
            return [] as Array<{ time: number; kind: 'auto' | 'manual' }>;
        }

        const unique: number[] = [filtered[0]];
        const EPSILON = 1e-4;

        for (let index = 1; index < filtered.length; index += 1) {
            const current = filtered[index];
            const last = unique[unique.length - 1];
            if (Math.abs(current - last) >= EPSILON) {
                unique.push(current);
            }
        }

        const manualKeys = new Set(manualCutPoints.map((value) => value.toFixed(3)));

        return unique.map((time) => ({
            time,
            kind: manualKeys.has(time.toFixed(3)) ? 'manual' as const : 'auto' as const
        }));
    }, [cutPoints, manualCutPoints, resolvedDuration]);

    const playheadLeft = useMemo(() => {
        if (!resolvedDuration) {
            return '0%';
        }
        const clamped = clamp(playheadSeconds, 0, resolvedDuration);
        return `${(clamped / resolvedDuration) * 100}%`;
    }, [playheadSeconds, resolvedDuration]);

    const handleTrackClick = (event: React.MouseEvent<HTMLDivElement>): void => {
        if (!trackRef.current || !resolvedDuration) {
            return;
        }
        const rect = trackRef.current.getBoundingClientRect();
        const width = rect.width || trackRef.current.offsetWidth;
        if (!width) {
            return;
        }
        const offsetX = event.clientX - rect.left;
        const ratio = clamp(offsetX / width, 0, 1);
        const target = ratio * resolvedDuration;
        onSeek(target);
        if (sessionId) {
            requestFrameTriplet(target);
        }
    };

    const handleMarkerClick = (
        event: React.MouseEvent<HTMLButtonElement>,
        value: number
    ): void => {
        event.stopPropagation();
        onSeek(value);
        setSelectedCutPoint(value);
        if (sessionId) {
            requestFrameTriplet(value);
        }
    };

    return (
        <TooltipProvider>
            <div className="timeline" aria-label="时间轴">
                <div
                    ref={trackRef}
                    className="timeline__bar"
                    role="button"
                    tabIndex={0}
                    onClick={handleTrackClick}
                    style={{ position: 'relative' }}
                >
                    {/* Segment backgrounds */}
                    {(() => {
                        if (!resolvedDuration || cutPoints.length < 2) return null;
                        const hidden = new Set(hiddenSegments.map((t) => t.toFixed(3)));
                        const segments: Array<{ leftPct: number; widthPct: number; hidden: boolean }> = [];
                        for (let i = 0; i < cutPoints.length - 1; i += 1) {
                            const start = cutPoints[i];
                            const end = cutPoints[i + 1];
                            const leftPct = (start / resolvedDuration) * 100;
                            const widthPct = ((end - start) / resolvedDuration) * 100;
                            const isHidden = hidden.has(start.toFixed(3));
                            segments.push({ leftPct, widthPct, hidden: isHidden });
                        }
                        return segments.map((seg, idx) => (
                            <div
                                key={`seg-${idx}`}
                                className={`timeline__segment${seg.hidden ? ' hidden' : ''}`}
                                style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%` }}
                            />
                        ));
                    })()}

                    <div className="timeline__progress" style={{ width: playheadLeft }} />
                    <div className="timeline__playhead" style={{ left: playheadLeft }}>
                        <span />
                    </div>

                    {markers.map(({ time, kind }, idx) => {
                        const isSelected = selectedCutPoint != null && Math.abs(selectedCutPoint - time) < 1e-3;
                        const start = time;
                        const end = idx < cutPoints.length - 1 ? cutPoints[idx + 1] : null;
                        const hidden = hiddenSegments.some((t) => Math.abs(t - time) < 1e-3);
                        return (
                            <Tooltip key={time}>
                                <TooltipTrigger asChild>
                                    <button
                                        type="button"
                                        className={`timeline__marker${isSelected ? ' selected' : ''}`}
                                        style={{ left: `${(time / resolvedDuration) * 100}%` }}
                                        onClick={(event) => handleMarkerClick(event, time)}
                                        data-marker-kind={kind}
                                        data-marker-time={time.toFixed(3)}
                                    >
                                        {kind === 'manual' ? "'" : '^'}
                                    </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" align="center">
                                    <div className="text-xs space-y-1">
                                        <div className="font-semibold">切点 {time.toFixed(3)}s</div>
                                        {end !== null && (
                                            <div className="text-[11px] text-[var(--color-text-tertiary)]">
                                                片段：{start.toFixed(3)}s ~ {end.toFixed(3)}s
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-[11px]">
                                            <span className="text-[var(--color-text-tertiary)]">状态:</span>
                                            <span className={hidden ? 'text-amber-500' : 'text-green-500'}>
                                                {hidden ? '已隐藏' : '可见'}
                                            </span>
                                        </div>
                                    </div>
                                </TooltipContent>
                            </Tooltip>
                        );
                    })}
                </div>
            </div>
        </TooltipProvider>
    );
}
