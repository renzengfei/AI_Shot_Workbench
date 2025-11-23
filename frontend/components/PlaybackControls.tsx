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
        <div
            className="apple-card"
            style={{
                padding: 'var(--spacing-md)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                flexWrap: 'wrap'
            }}
        >
            {/* Left cluster: Play/Pause + Speed */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <button
                    onClick={() => setPlaying(!isPlaying)}
                    className="apple-button-primary"
                    style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        padding: 0,
                        display: 'grid',
                        placeItems: 'center'
                    }}
                >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>

                <button
                    onClick={() => cyclePlaybackRate()}
                    className="apple-button-secondary"
                    style={{
                        padding: '10px 18px',
                        fontSize: '15px',
                        fontWeight: '600',
                        fontVariantNumeric: 'tabular-nums',
                        height: '48px'
                    }}
                >
                    {playbackRate}×
                </button>
            </div>

            {/* Spacer */}
            <div style={{ flex: 1 }} />

            {/* Right cluster: add / delete / hide */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <button
                    onClick={() => addManualCutPoint(playheadSeconds)}
                    className="apple-button-secondary"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: '10px 18px',
                        fontSize: '15px',
                        height: '44px'
                    }}
                >
                    <Plus size={18} />
                    <span>添加切点</span>
                </button>

                <button
                    onClick={() => selectedCutPoint !== null && removeCutPoint(selectedCutPoint)}
                    disabled={!canDelete}
                    className="apple-button-secondary"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: '10px 18px',
                        fontSize: '15px',
                        height: '44px',
                        opacity: canDelete ? 1 : 0.4,
                        cursor: canDelete ? 'pointer' : 'not-allowed'
                    }}
                >
                    <Trash2 size={18} />
                    <span>删除</span>
                </button>

                <button
                    onClick={() => selectedCutPoint !== null && toggleHideSegmentAtCut(selectedCutPoint)}
                    disabled={!canHide}
                    className="apple-button-secondary"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-xs)',
                        padding: '10px 18px',
                        fontSize: '15px',
                        height: '44px',
                        opacity: canHide ? 1 : 0.4,
                        cursor: canHide ? 'pointer' : 'not-allowed'
                    }}
                >
                    {isHidden ? <Eye size={18} /> : <EyeOff size={18} />}
                    <span>{isHidden ? '显示' : '隐藏'}</span>
                </button>
            </div>
        </div>
    );
}
