import { useRef, useState, useEffect, type ChangeEvent } from 'react';
import { Play, Pause, ChevronLeft, ChevronRight, Maximize } from 'lucide-react';

interface PreviewVideoPlayerProps {
    src: string;
    volume?: number;
    muted?: boolean;
    className?: string;
    aspectRatio?: string;
    poster?: string;
    lazy?: boolean;
    onPlay?: () => void;  // 播放时回调（用于清除 NEW 标识）
}

export const PreviewVideoPlayer = ({
    src,
    volume = 1,
    muted = false,
    className,
    aspectRatio = "aspect-[9/16]",
    poster,
    lazy = true,
    onPlay,
}: PreviewVideoPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [rate, setRate] = useState(2.5);
    const [shouldLoad, setShouldLoad] = useState(() => {
        if (!lazy) return true;
        if (typeof window === 'undefined') return false;
        return typeof IntersectionObserver === 'undefined' ? true : false;
    });

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = muted;
        }
    }, [volume, muted]);

    useEffect(() => {
        if (!lazy || shouldLoad) return;
        const el = containerRef.current;
        if (!el || typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    setShouldLoad(true);
                    observer.disconnect();
                }
            });
        }, { rootMargin: '200px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [lazy, shouldLoad]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onLoadedMetadata = () => setDuration(video.duration);
        const onPlayEvent = () => {
            setPlaying(true);
            onPlay?.();  // 调用外部回调
        };
        const onPause = () => setPlaying(false);
        const onEnded = () => setPlaying(false);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('play', onPlayEvent);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('play', onPlayEvent);
            video.removeEventListener('pause', onPause);
            video.removeEventListener('ended', onEnded);
        };
    }, [onPlay]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (playing) videoRef.current.pause();
            else videoRef.current.play();
        }
    };

    const handleSeek = (e: ChangeEvent<HTMLInputElement>) => {
        const time = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = time;
            setCurrentTime(time);
        }
    };

    const changeRate = (newRate: number) => {
        setRate(newRate);
        if (videoRef.current) videoRef.current.playbackRate = newRate;
    };

    const stepFrame = (direction: number) => {
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime += direction * 0.033;
        }
    };

    const toggleFullscreen = () => {
        if (containerRef.current) {
            if (!document.fullscreenElement) {
                containerRef.current.requestFullscreen();
            } else {
                document.exitFullscreen();
            }
        }
    };

    const formatTime = (time: number) => {
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const ms = Math.floor((time % 1) * 100);
        return `${minutes}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    };

    return (
        <div ref={containerRef} className={`flex flex-col gap-2 w-full relative ${className || ''}`}>
            {/* Video Area - Matches Image Card Style */}
            <div className={`relative ${aspectRatio} bg-transparent rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-lg cursor-pointer group`} onClick={togglePlay}>
                <video
                    ref={videoRef}
                    src={shouldLoad ? src : undefined}
                    className="w-full h-full object-cover"
                    playsInline
                    preload={shouldLoad ? "metadata" : "none"}
                    poster={poster}
                />
            </div>

            {/* Controls Area */}
            <div className="flex flex-col gap-2 px-1 bg-[var(--glass-bg-light)] p-2 rounded-xl border border-[var(--glass-border)]">
                {/* Progress Bar */}
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] font-mono">
                    <span className="w-10 text-right">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.01}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                    />
                    <span className="w-10">{formatTime(duration)}</span>
                </div>

                {/* Buttons Row */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <button onClick={togglePlay} className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]">
                            {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                        </button>

                        <div className="w-px h-4 bg-[var(--glass-border)] mx-1" />

                        <button onClick={() => stepFrame(-1)} className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]" title="上一帧">
                            <ChevronLeft size={14} />
                        </button>
                        <button onClick={() => stepFrame(1)} className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]" title="下一帧">
                            <ChevronRight size={14} />
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-[var(--color-bg-secondary)]/50 rounded p-0.5">
                            {[1, 2, 2.5, 3, 4].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => changeRate(r)}
                                    className={`text-xs px-1 py-0.5 rounded transition ${rate === r
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                        }`}
                                >
                                    {r}x
                                </button>
                            ))}
                        </div>
                        <button onClick={toggleFullscreen} className="p-1.5 hover:bg-[var(--color-bg-secondary)] rounded text-[var(--color-text-primary)]">
                            <Maximize size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
