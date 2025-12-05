import { useRef, useState, useEffect, type ChangeEvent, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Maximize } from 'lucide-react';

interface PreviewVideoPlayerProps {
    src: string;
    volume?: number;
    muted?: boolean;
    className?: string;
    aspectRatio?: string;
    poster?: string;
    lazy?: boolean;
    onPlay?: () => void;  // 播放时回调（用于清除 NEW 标识）
    defaultRate?: number;  // 默认播放速度，原片用 1，生成视频用 2.5
    leftAction?: ReactNode;  // 控制栏左侧的自定义按钮
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
    defaultRate = 1,
    leftAction,
}: PreviewVideoPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [rate, setRate] = useState(defaultRate);
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

    // 当 src 变化时，重置播放器状态
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        // 暂停当前播放
        video.pause();
        setPlaying(false);
        setCurrentTime(0);
        setDuration(0);

        // 重新加载视频
        if (shouldLoad && src) {
            video.load();
        }
    }, [src, shouldLoad]);

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
        const onLoadedMetadata = () => {
            setDuration(video.duration);
            video.playbackRate = rate;  // 视频加载后应用默认倍速
        };
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

            {/* Controls Area - Liquid Glass Style */}
            <div className="flex flex-col gap-2 px-2 py-2.5 rounded-xl bg-white/40 backdrop-blur-sm border border-[var(--lg-glass-border)]">
                {/* Progress Bar */}
                <div className="flex items-center gap-2 text-xs text-[var(--lg-text-tertiary)] font-mono">
                    <span className="w-10 text-right">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min={0}
                        max={duration || 100}
                        step={0.01}
                        value={currentTime}
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[var(--lg-blue)]"
                    />
                    <span className="w-10">{formatTime(duration)}</span>
                </div>

                {/* Buttons Row - Liquid Glass Style */}
                <div className="flex items-center justify-between gap-2">
                    {/* Left Action Slot */}
                    <div className="flex items-center">{leftAction}</div>
                    {/* Right Controls */}
                    <div className="flex items-center gap-2">
                    {/* Playback Rate Selector - Liquid Glass Pill Style */}
                    <div className="flex items-center rounded-lg bg-white/50 border border-[var(--lg-glass-border)] p-0.5">
                        {[1, 2, 2.5, 3, 4].map((r) => (
                            <button
                                key={r}
                                onClick={() => changeRate(r)}
                                className={`text-xs px-1.5 py-0.5 rounded-md font-medium transition-all ${rate === r
                                    ? 'bg-[var(--lg-blue)] text-white shadow-sm'
                                    : 'text-[var(--lg-text-secondary)] hover:text-[var(--lg-text-primary)] hover:bg-white/60'
                                    }`}
                            >
                                {r}x
                            </button>
                        ))}
                    </div>
                    {/* Frame Step Buttons */}
                    <div className="flex items-center gap-0.5">
                        <button onClick={() => stepFrame(-1)} className="p-1.5 rounded-lg hover:bg-white/60 text-[var(--lg-text-primary)] transition-colors" title="上一帧">
                            <ChevronLeft size={14} />
                        </button>
                        <button onClick={() => stepFrame(1)} className="p-1.5 rounded-lg hover:bg-white/60 text-[var(--lg-text-primary)] transition-colors" title="下一帧">
                            <ChevronRight size={14} />
                        </button>
                    </div>
                    <button onClick={toggleFullscreen} className="p-1.5 rounded-lg hover:bg-white/60 text-[var(--lg-text-primary)] transition-colors">
                        <Maximize size={14} />
                    </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
