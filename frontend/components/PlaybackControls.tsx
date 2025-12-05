'use client';

import { Play, Pause, Plus, Trash2, EyeOff, Eye } from 'lucide-react';
import { useTimelineStore, PLAYBACK_RATES } from '@/lib/stores/timelineStore';

export default function PlaybackControls() {
    const {
        isPlaying,
        playheadSeconds,
        selectedCutPoint,
        cutPoints,
        hiddenSegments,
        durationSeconds,
        playbackRateIndex,
        setPlaying,
        addManualCutPoint,
        removeCutPoint,
        toggleHideSegmentAtCut,
        cyclePlaybackRate,
    } = useTimelineStore();

    const playbackRate = PLAYBACK_RATES[playbackRateIndex];

    const canDelete = selectedCutPoint !== null &&
        selectedCutPoint !== 0 &&
        (durationSeconds === null || Math.abs(selectedCutPoint - durationSeconds) > 0.001);

    const canHide = selectedCutPoint !== null &&
        cutPoints.findIndex(c => Math.abs(c - selectedCutPoint) < 0.001) < cutPoints.length - 1;

    const isHidden = selectedCutPoint !== null &&
        hiddenSegments.some(h => Math.abs(h - selectedCutPoint) < 0.001);

    return (
        <div className="lg-card-inset p-4 flex items-center gap-3 flex-wrap">
            {/* Left cluster: Play/Pause + Speed */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setPlaying(!isPlaying)}
                    className="lg-btn lg-btn-primary w-12 h-12 rounded-full p-0 flex items-center justify-center"
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <button
                    onClick={() => cyclePlaybackRate()}
                    className="lg-btn lg-btn-secondary h-12 px-4 text-[15px] font-semibold tabular-nums"
                >
                    {playbackRate}×
                </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right cluster: add / delete / hide */}
            <div className="flex items-center gap-2">
                <button
                    onClick={() => addManualCutPoint(playheadSeconds)}
                    className="lg-btn lg-btn-secondary lg-btn-sm flex items-center gap-1.5"
                >
                    <Plus size={16} />
                    <span>添加切点</span>
                </button>

                <button
                    onClick={() => selectedCutPoint !== null && removeCutPoint(selectedCutPoint)}
                    disabled={!canDelete}
                    className={`lg-btn lg-btn-secondary lg-btn-sm flex items-center gap-1.5 ${!canDelete ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    <Trash2 size={16} />
                    <span>删除</span>
                </button>

                <button
                    onClick={() => selectedCutPoint !== null && toggleHideSegmentAtCut(selectedCutPoint)}
                    disabled={!canHide}
                    className={`lg-btn lg-btn-secondary lg-btn-sm flex items-center gap-1.5 ${!canHide ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                    {isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                    <span>{isHidden ? '显示' : '隐藏'}</span>
                </button>
            </div>
        </div>
    );
}
