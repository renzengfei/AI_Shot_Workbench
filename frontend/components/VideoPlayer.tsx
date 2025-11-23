'use client';

import { useRef, useEffect } from 'react';
import { useTimelineStore, selectPlaybackRate } from '@/lib/stores/timelineStore';
import { useFramePreview } from '@/lib/hooks/useFramePreview';

interface VideoPlayerProps {
    videoUrl: string;
    onTimeUpdate?: (time: number) => void;
}

export default function VideoPlayer({ videoUrl, onTimeUpdate }: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const FRAME_STEP_SECONDS = 1 / 30; // assume 30fps for frame-step navigation

    const {
        isPlaying,
        playheadSeconds,
        setPlaying,
        setPlayhead,
        setDuration,
        sessionId,
        cutPoints,
        durationSeconds,
    } = useTimelineStore();

    const playbackRate = useTimelineStore(selectPlaybackRate);
    const { requestFrameTriplet } = useFramePreview();
    const lastTimeRef = useRef<number | null>(null);
    const lastAutoPausedCutRef = useRef<number | null>(null);

    // Sync playback state
    useEffect(() => {
        if (!videoRef.current) return;
        if (isPlaying) {
            videoRef.current.play();
        } else {
            videoRef.current.pause();
        }
        if (isPlaying) {
            // 新的播放开始，允许下一个切点再次触发自动暂停
            lastAutoPausedCutRef.current = null;
        }
    }, [isPlaying]);

    // Sync playback rate
    useEffect(() => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = playbackRate;
    }, [playbackRate]);

    // Seek to playhead
    useEffect(() => {
        if (!videoRef.current) return;
        const diff = Math.abs(videoRef.current.currentTime - playheadSeconds);
        if (diff > 0.1) {
            videoRef.current.currentTime = playheadSeconds;
        }
        lastTimeRef.current = playheadSeconds;
    }, [playheadSeconds]);

    const handleTimeUpdate = () => {
        if (!videoRef.current) return;
        const currentTime = videoRef.current.currentTime;
        const previousTime = lastTimeRef.current ?? currentTime;
        lastTimeRef.current = currentTime;

        // Auto-pause at cut points without flashing frames
        if (isPlaying && cutPoints.length > 0) {
            const sortedCuts = [...cutPoints].sort((a, b) => a - b);
            const margin = 0.02; // 20ms 提前量
            const nextCut = sortedCuts.find((c) => c > previousTime + 1e-3);
            if (
                nextCut !== undefined &&
                lastAutoPausedCutRef.current !== nextCut &&
                currentTime >= nextCut - margin
            ) {
                // 精确对齐切点
                const durationHint = durationSeconds ?? (videoRef.current?.duration ?? null);
                const safeCut = durationHint != null ? Math.min(nextCut, durationHint - margin) : nextCut;
                const target = safeCut;
                videoRef.current.currentTime = target;
                setPlayhead(target);
                setPlaying(false);
                lastAutoPausedCutRef.current = nextCut;
                if (sessionId) {
                    requestFrameTriplet(target);
                }
                return;
            }
        }

        setPlayhead(currentTime);
        onTimeUpdate?.(currentTime);
    };

    const handleLoadedMetadata = () => {
        if (!videoRef.current) return;
        setDuration(videoRef.current.duration);
        lastTimeRef.current = null;
    };

    const handleEnded = () => {
        setPlaying(false);
    };

    // Frame-step with ArrowLeft / ArrowRight when暂停
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;

            // Do not steal focus from form fields
            const target = event.target as HTMLElement | null;
            if (target) {
                const tag = target.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
                    return;
                }
            }

            const video = videoRef.current;
            if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;
            if (isPlaying || !video.paused) return;

            const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
            const current = Number.isFinite(video.currentTime) ? video.currentTime : 0;
            const delta = event.key === 'ArrowLeft' ? -FRAME_STEP_SECONDS : FRAME_STEP_SECONDS;
            let targetTime = current + delta;
            const durationHint = duration ?? durationSeconds ?? null;
            if (durationHint != null) {
                targetTime = Math.min(Math.max(targetTime, 0), durationHint - 0.02);
            } else {
                targetTime = Math.max(targetTime, 0);
            }

            video.pause();
            setPlaying(false);
            video.currentTime = targetTime;
            setPlayhead(targetTime);
            if (sessionId) {
                requestFrameTriplet(targetTime);
            }
            event.preventDefault();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, setPlayhead, setPlaying, FRAME_STEP_SECONDS, sessionId, requestFrameTriplet, durationSeconds]);

    return (
        <div className="w-full max-w-[34rem] mx-auto md:mx-0 aspect-[9/16] rounded-2xl overflow-hidden bg-gradient-to-b from-black/70 via-black/60 to-black/80 shadow-2xl ring-1 ring-white/10">
            <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full object-contain"
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
            />
        </div>
    );
}
