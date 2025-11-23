'use client';

import { useEffect, useMemo, useState, useRef, type ChangeEvent } from 'react';
import {
    Copy,
    Loader2,
    FileText,
    ShieldCheck,
    Sparkles,
    CheckCircle2,
    AlertTriangle,
    ArrowRight,
    LayoutDashboard,
    BookOpen,
    Zap,
    TrendingUp,
    History,
    Film,
    Music,
    Video,
    Camera,
    Play,
    Pause,
    Maximize,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import { PRODUCTION_STORYBOARD_PROMPT } from '@/data/productionStoryboardPrompt';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import { parseStoredDeconstruction } from '@/lib/services/deconstruction';

type Mode = 'initial' | 'revision' | 'final';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

interface AssetItem {
    ordinal: number;
    start: number;
    end: number;
    duration: number;
    frame: string;
    frame_status: string;
    clip?: string | null;
    clip_status?: string | null;
}

const VideoPlayer = ({ src, volume, muted }: { src: string; volume: number; muted: boolean }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = muted;
        }
    }, [volume, muted]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const onTimeUpdate = () => setCurrentTime(video.currentTime);
        const onLoadedMetadata = () => setDuration(video.duration);
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);

        video.addEventListener('timeupdate', onTimeUpdate);
        video.addEventListener('loadedmetadata', onLoadedMetadata);
        video.addEventListener('play', onPlay);
        video.addEventListener('pause', onPause);

        return () => {
            video.removeEventListener('timeupdate', onTimeUpdate);
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('play', onPlay);
            video.removeEventListener('pause', onPause);
        };
    }, []);

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

    const toggleFullscreen = () => {
        if (containerRef.current) {
            if (document.fullscreenElement) document.exitFullscreen();
            else containerRef.current.requestFullscreen();
        }
    };

    const formatTime = (t: number) => {
        const m = Math.floor(t / 60);
        const s = Math.floor(t % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    return (
        <div ref={containerRef} className="relative group rounded-lg overflow-hidden bg-black aspect-video border border-[var(--glass-border)] shadow-lg">
            <video
                ref={videoRef}
                src={src}
                className="w-full h-full object-contain"
                onClick={togglePlay}
            />

            {/* Controls Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                {/* Progress Bar */}
                <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 hover:[&::-webkit-slider-thumb]:scale-125 transition-all mb-2"
                />

                <div className="flex items-center justify-between text-white/90">
                    <div className="flex items-center gap-3">
                        <button onClick={togglePlay} className="hover:text-blue-400 transition-colors">
                            {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                        </button>
                        <span className="text-xs font-mono tracking-wider">
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                    </div>
                    <button onClick={toggleFullscreen} className="hover:text-blue-400 transition-colors">
                        <Maximize size={16} />
                    </button>
                </div>
            </div>

            {/* Center Play Button */}
            {!playing && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                        <Play size={24} fill="white" className="text-white ml-1" />
                    </div>
                </div>
            )}
        </div>
    );
};

interface Round1Data {
    round1_skeleton?: {
        story_summary?: string;
        logic_chain?: string;
        skeleton_nodes?: string[];
        viral_elements_found?: {
            category: string;
            element: string;
            timestamp: string;
            description: string;
        }[];
    };
    round1_hook?: {
        visual_hook?: string;
        audio_hook?: string;
        retention_strategy?: string;
    };
    [key: string]: any;
}

interface Round2Data {
    characters?: Record<string, string>;
    shots?: {
        id?: number;
        mission?: string;
        visual_changes?: string;
        initial_frame?: string;
        camera?: string;
        audio?: string;
        beat?: string;
        emotion?: string;
        viral_element?: string;
        [key: string]: any;
    }[];
    [key: string]: any;
}

interface ModificationLog {
    summary?: string;
    knowledge_base_applied?: string[];
    modified_assets_list?: {
        original: string;
        replacement: string;
        reason: string;
        element_type: string;
        affected_shots?: number[];
    }[];
    changes?: {
        shot_id: number;
        action: string;
        reason: string;
    }[];
    statistics?: {
        total_shots_before: number;
        total_shots_after: number;
        deleted: number;
        optimization_improvement_estimate: string;
    };
    [key: string]: unknown;
}

interface OptimizedStoryboard {
    round1?: Round1Data;
    round2?: Round2Data;
    summary?: string;
    shots?: {
        id?: number | string;
        mission?: string;
        initial_frame?: string;
        visual_changes?: string;
        camera?: string;
        audio?: string;
        beat?: string;
        emotion?: string;
        [key: string]: unknown;
    }[];
    [key: string]: unknown;
}

export default function Step4_ScriptRewrite() {
    const { currentWorkspace } = useWorkspace();
    const { project } = useWorkflowStore();
    const [mode, setMode] = useState<Mode>('initial');
    const [promptText, setPromptText] = useState('');
    const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

    const [deconstructionText, setDeconstructionText] = useState<string>('');
    const [modLog, setModLog] = useState<ModificationLog | null>(null);
    const [optimized, setOptimized] = useState<OptimizedStoryboard | null>(null);
    const [assets, setAssets] = useState<AssetItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const workspaceSlug = useMemo(() => {
        if (!currentWorkspace?.path) return null;
        const marker = '/workspaces/';
        const idx = currentWorkspace.path.lastIndexOf(marker);
        if (idx >= 0) return currentWorkspace.path.substring(idx + marker.length);
        return currentWorkspace.path.split('/').pop() || currentWorkspace.path;
    }, [currentWorkspace?.path]);

    const deconstructionPath = currentWorkspace?.path
        ? `${currentWorkspace.path.replace(/\\/g, '/')}/deconstruction.md`
        : '【请在此处填入完整的文件路径】';

    useEffect(() => {
        const filled = PRODUCTION_STORYBOARD_PROMPT.replace('【请在此处填入完整的文件路径】', deconstructionPath);
        setPromptText(filled.trim());
    }, [deconstructionPath]);

    const loadFiles = async () => {
        if (!workspaceSlug) return;
        setLoading(true);
        setError(null);
        try {
            const fetchText = async (path: string) => {
                const res = await fetch(path);
                if (!res.ok) throw new Error(`加载失败: ${res.statusText}`);
                return res.text();
            };
            const fetchJson = async (path: string) => {
                const res = await fetch(path);
                if (!res.ok) throw new Error(`加载失败: ${res.statusText}`);
                return res.json();
            };

            const [decon, mod, opt, assetData] = await Promise.allSettled([
                fetchText(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/deconstruction.md`),
                fetchText(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/modification_log.json`),
                fetchText(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/optimized_storyboard.json`),
                fetchJson(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/report.json`),
            ]);

            if (decon.status === 'fulfilled') setDeconstructionText(decon.value);
            if (mod.status === 'fulfilled') {
                try {
                    setModLog(JSON.parse(mod.value) as ModificationLog);
                } catch {
                    setModLog({ summary: mod.value });
                }
            }
            if (opt.status === 'fulfilled') {
                try {
                    setOptimized(JSON.parse(opt.value) as OptimizedStoryboard);
                } catch {
                    setOptimized({ summary: opt.value } as any);
                }
            }
            if (assetData.status === 'fulfilled') {
                const data = assetData.value as any;
                const list = Array.isArray(data?.report) ? data.report : (Array.isArray(data) ? data : []);
                setAssets(list);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '加载失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFiles();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceSlug]);

    const copyPrompt = async () => {
        try {
            await navigator.clipboard.writeText(promptText);
            setCopyState('copied');
            setTimeout(() => setCopyState('idle'), 1600);
        } catch (err) {
            alert('复制失败，请手动复制');
        }
    };

    const renderInitial = () => (
        <div className="glass-card p-8 space-y-6 border border-[var(--glass-border)] animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-blue-500" />
                        第一步：获取 AI 重构建议
                    </h3>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        复制下方提示词，发送给 AI 编程工具（如 Cursor / Windsurf），生成重构方案。
                    </p>
                </div>
                <button
                    onClick={copyPrompt}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm font-medium shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all hover:-translate-y-0.5"
                >
                    <Copy size={16} />
                    {copyState === 'copied' ? '已复制' : '复制提示词'}
                </button>
            </div>

            <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition duration-500" />
                <div className="relative bg-[var(--color-bg-secondary)]/50 rounded-xl border border-[var(--glass-border)] p-4 max-h-[300px] overflow-y-auto custom-scrollbar">
                    <pre className="text-xs text-[var(--color-text-primary)] font-mono whitespace-pre-wrap leading-relaxed">
                        {promptText}
                    </pre>
                </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] bg-blue-500/5 p-3 rounded-lg border border-blue-500/10">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                已自动填入当前工作空间路径：<span className="font-mono text-[var(--color-text-primary)]">{deconstructionPath}</span>
            </div>
        </div>
    );

    const renderRevision = () => {
        // Parse original shots from deconstruction text
        const { round1, round2 } = parseStoredDeconstruction(deconstructionText);
        const r1 = round1 as Round1Data;
        const r2 = round2 as Round2Data;
        const originalShots = r2?.shots || [];
        const characters = r2?.characters || {};

        // Helper to find modification info for a shot
        const getShotStatus = (shotId: number) => {
            const change = modLog?.changes?.find(c => c.shot_id === shotId);
            const assetChanges = modLog?.modified_assets_list?.filter(a => a.affected_shots?.includes(shotId));

            if (change?.action === 'DELETE') return { status: 'deleted', reason: change.reason };
            if (assetChanges && assetChanges.length > 0) return { status: 'modified', assets: assetChanges };
            return { status: 'unchanged' };
        };

        const getAsset = (ordinal: number) => assets.find(a => a.ordinal === ordinal);

        return (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* 1. Global Analysis Section */}
                {r1 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                            <LayoutDashboard size={18} className="text-blue-500" />
                            <span className="font-semibold">全局分析 (Global Analysis)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Story & Logic */}
                            <div className="glass-card p-5 border border-[var(--glass-border)] space-y-4">
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                        <BookOpen size={14} className="text-purple-500" /> 故事概要
                                    </h4>
                                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                                        {r1.round1_skeleton?.story_summary || '暂无概要'}
                                    </p>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                        <Zap size={14} className="text-amber-500" /> 底层逻辑链
                                    </h4>
                                    <div className="text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)] p-2 rounded border border-[var(--glass-border)]">
                                        {r1.round1_skeleton?.logic_chain || '暂无逻辑链'}
                                    </div>
                                </div>
                            </div>

                            {/* Hooks Analysis */}
                            <div className="glass-card p-5 border border-[var(--glass-border)] space-y-4">
                                <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                    <Sparkles size={14} className="text-pink-500" /> 前3秒钩子分析
                                </h4>
                                <div className="space-y-3">
                                    <div className="grid grid-cols-[80px_1fr] gap-2 text-xs">
                                        <span className="text-[var(--color-text-tertiary)]">视觉钩子:</span>
                                        <span className="text-[var(--color-text-secondary)]">{r1.round1_hook?.visual_hook || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] gap-2 text-xs">
                                        <span className="text-[var(--color-text-tertiary)]">听觉钩子:</span>
                                        <span className="text-[var(--color-text-secondary)]">{r1.round1_hook?.audio_hook || '-'}</span>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] gap-2 text-xs">
                                        <span className="text-[var(--color-text-tertiary)]">留存策略:</span>
                                        <span className="text-[var(--color-text-secondary)]">{r1.round1_hook?.retention_strategy || '-'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Viral Elements & Timeline */}
                        <div className="glass-card p-5 border border-[var(--glass-border)] space-y-4">
                            <div className="space-y-2">
                                <h4 className="text-sm font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                    <TrendingUp size={14} className="text-green-500" /> 爆款元素 & 骨架节点
                                </h4>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {r1.round1_skeleton?.viral_elements_found?.map((v, i) => (
                                        <div key={i} className="px-2 py-1 rounded bg-green-500/10 border border-green-500/20 text-green-500 text-xs flex items-center gap-1">
                                            <span className="font-bold">{v.element}</span>
                                            <span className="opacity-60">({v.category})</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-1">
                                    {r1.round1_skeleton?.skeleton_nodes?.map((node, i) => (
                                        <div key={i} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
                                            <span className="text-blue-500 font-mono min-w-[20px]">{i + 1}.</span>
                                            <span>{node}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Character Library */}
                {Object.keys(characters).length > 0 && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                            <ShieldCheck size={18} className="text-purple-500" />
                            <span className="font-semibold">角色库 (Character Library)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.entries(characters).map(([name, desc], idx) => (
                                <div key={idx} className="glass-card p-3 border border-[var(--glass-border)] flex items-start gap-3">
                                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-xs shrink-0">
                                        {name[0]}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-[var(--color-text-primary)] mb-1">{name}</div>
                                        <div className="text-[10px] text-[var(--color-text-secondary)] line-clamp-3 leading-relaxed">
                                            {desc}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 3. Modification Summary Dashboard */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass-card p-4 border border-[var(--glass-border)] flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><TrendingUp size={20} /></div>
                        <div>
                            <div className="text-xs text-[var(--color-text-secondary)]">预期提升</div>
                            <div className="font-bold text-[var(--color-text-primary)]">{modLog?.statistics?.optimization_improvement_estimate || '-'}</div>
                        </div>
                    </div>
                    <div className="glass-card p-4 border border-[var(--glass-border)] flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/10 text-red-500"><Video size={20} /></div>
                        <div>
                            <div className="text-xs text-[var(--color-text-secondary)]">删减镜头</div>
                            <div className="font-bold text-[var(--color-text-primary)]">-{modLog?.statistics?.deleted || 0}</div>
                        </div>
                    </div>
                    <div className="glass-card p-4 border border-[var(--glass-border)] flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500"><Zap size={20} /></div>
                        <div>
                            <div className="text-xs text-[var(--color-text-secondary)]">资产替换</div>
                            <div className="font-bold text-[var(--color-text-primary)]">{modLog?.modified_assets_list?.length || 0} 项</div>
                        </div>
                    </div>
                </div>

                {/* 4. Annotated Shot List (Rich Media) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 text-[var(--color-text-primary)] mb-2">
                        <History size={18} className="text-blue-500" />
                        <span className="font-semibold">修订对比视图 (Original + Diff)</span>
                    </div>

                    {originalShots.length > 0 ? (
                        <div className="grid grid-cols-1 gap-6">
                            {originalShots.map((shot, idx) => {
                                const shotId = shot.id ?? idx + 1;
                                const { status, reason, assets: modifiedAssets } = getShotStatus(shotId);
                                const asset = getAsset(shotId);
                                const isDeleted = status === 'deleted';
                                const isModified = status === 'modified';

                                return (
                                    <div key={idx} className={`glass-card p-0 border overflow-hidden transition-all duration-300 group
                                        ${isDeleted ? 'border-red-500/30 bg-red-500/5 opacity-80' :
                                            isModified ? 'border-amber-500/40 bg-amber-500/5 shadow-[0_0_15px_-3px_rgba(245,158,11,0.1)]' :
                                                'border-[var(--glass-border)] opacity-80 hover:opacity-100'
                                        }
                                    `}>
                                        {/* Header */}
                                        <div className={`px-4 py-3 border-b flex items-center justify-between
                                            ${isDeleted ? 'border-red-500/10 bg-red-500/10' :
                                                isModified ? 'border-amber-500/10 bg-amber-500/10' :
                                                    'border-[var(--glass-border)] bg-[var(--glass-bg-light)]'
                                            }
                                        `}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                                                    ${isDeleted ? 'bg-red-500/20 text-red-500' :
                                                        isModified ? 'bg-amber-500/20 text-amber-600' :
                                                            'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]'
                                                    }
                                                `}>
                                                    {shotId}
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] font-mono">
                                                    {asset && (
                                                        <>
                                                            <span>{asset.start.toFixed(2)}s - {asset.end.toFixed(2)}s</span>
                                                            <span className="w-1 h-1 rounded-full bg-[var(--color-text-tertiary)]" />
                                                            <span>{asset.duration.toFixed(2)}s</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {isDeleted && (
                                                    <span className="px-2 py-1 rounded bg-red-500 text-white text-[10px] font-bold shadow-sm">
                                                        DELETED
                                                    </span>
                                                )}
                                                {isModified && (
                                                    <span className="px-2 py-1 rounded bg-amber-500 text-white text-[10px] font-bold shadow-sm">
                                                        MODIFIED
                                                    </span>
                                                )}
                                                {shot.mission && (
                                                    <span className="px-2 py-1 rounded bg-[var(--color-bg-secondary)] border border-[var(--glass-border)] text-[var(--color-text-secondary)] text-xs font-medium">
                                                        {shot.mission}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Body */}
                                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
                                            {/* Left: Media */}
                                            <div className="lg:col-span-4 bg-black/20 border-r border-[var(--glass-border)] relative group/media">
                                                {asset ? (
                                                    <div className="aspect-video relative">
                                                        {asset.clip ? (
                                                            <VideoPlayer
                                                                src={`${API_BASE}/workspaces/${workspaceSlug}/${asset.clip}`}
                                                                volume={1}
                                                                muted={false}
                                                            />
                                                        ) : (
                                                            <img
                                                                src={`${API_BASE}/workspaces/${workspaceSlug}/${asset.frame}`}
                                                                alt={`Shot ${shotId}`}
                                                                className="w-full h-full object-contain"
                                                            />
                                                        )}
                                                        {isDeleted && (
                                                            <div className="absolute inset-0 bg-red-500/20 backdrop-grayscale-[0.5] flex items-center justify-center pointer-events-none">
                                                                <div className="transform -rotate-12 border-4 border-red-500 text-red-500 font-black text-4xl px-4 py-2 opacity-50">
                                                                    DELETED
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="aspect-video flex items-center justify-center text-[var(--color-text-tertiary)] text-xs">
                                                        无媒体资源
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: Info */}
                                            <div className="lg:col-span-8 p-5 space-y-4 relative">
                                                {/* Deletion Overlay for Info */}
                                                {isDeleted && (
                                                    <div className="absolute inset-0 bg-red-500/5 pointer-events-none z-0" />
                                                )}

                                                <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="space-y-4">
                                                        <div className="space-y-1">
                                                            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-medium">
                                                                <Video size={12} />
                                                                画面内容
                                                            </div>
                                                            <p className={`text-sm text-[var(--color-text-primary)] leading-relaxed ${isDeleted ? 'line-through opacity-60' : ''}`}>
                                                                {shot.visual_changes || shot.initial_frame}
                                                            </p>
                                                        </div>
                                                        {shot.camera && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-medium">
                                                                    <Camera size={12} />
                                                                    镜头
                                                                </div>
                                                                <p className={`text-xs text-[var(--color-text-secondary)] ${isDeleted ? 'line-through opacity-60' : ''}`}>
                                                                    {shot.camera}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {shot.viral_element && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-medium">
                                                                    <TrendingUp size={12} />
                                                                    爆款元素
                                                                </div>
                                                                <p className={`text-xs text-[var(--color-text-secondary)] ${isDeleted ? 'line-through opacity-60' : ''}`}>
                                                                    {shot.viral_element}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="space-y-4">
                                                        {shot.audio && (
                                                            <div className="space-y-1">
                                                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-medium">
                                                                    <Music size={12} />
                                                                    音频/旁白
                                                                </div>
                                                                <p className={`text-sm text-[var(--color-text-primary)] leading-relaxed opacity-90 ${isDeleted ? 'line-through opacity-60' : ''}`}>
                                                                    {shot.audio}
                                                                </p>
                                                            </div>
                                                        )}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {shot.emotion && (
                                                                <div className="space-y-1">
                                                                    <div className="text-[10px] text-[var(--color-text-tertiary)]">节奏/情绪</div>
                                                                    <div className={`text-xs text-[var(--color-text-secondary)] ${isDeleted ? 'line-through opacity-60' : ''}`}>{shot.emotion}</div>
                                                                </div>
                                                            )}
                                                            {shot.beat && (
                                                                <div className="space-y-1">
                                                                    <div className="text-[10px] text-[var(--color-text-tertiary)]">Beat</div>
                                                                    <div className={`text-xs text-[var(--color-text-secondary)] ${isDeleted ? 'line-through opacity-60' : ''}`}>{shot.beat}</div>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {/* Modification / Deletion Reason Block */}
                                                        {isDeleted && (
                                                            <div className="mt-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium animate-in fade-in zoom-in-95">
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <AlertTriangle size={12} />
                                                                    删除原因
                                                                </div>
                                                                {reason}
                                                            </div>
                                                        )}

                                                        {isModified && modifiedAssets && (
                                                            <div className="mt-2 space-y-2 animate-in fade-in zoom-in-95">
                                                                {modifiedAssets.map((asset, i) => (
                                                                    <div key={i} className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                                                                        <div className="flex items-center gap-2 text-xs">
                                                                            <span className="text-[var(--color-text-tertiary)] line-through decoration-amber-500/30">{asset.original}</span>
                                                                            <ArrowRight size={12} className="text-amber-500" />
                                                                            <span className="font-bold text-amber-600">{asset.replacement}</span>
                                                                        </div>
                                                                        <div className="text-[10px] text-amber-600/80 leading-relaxed">
                                                                            {asset.reason}
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-[var(--color-text-tertiary)]">
                            未找到原剧本数据，请确保已完成 Step 2 的拆解。
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderFinal = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                <CheckCircle2 size={18} className="text-green-500" />
                <span className="font-semibold">终版剧本 (optimized_storyboard.json)</span>
            </div>
            {optimized ? (
                <div className="space-y-6">
                    {optimized.title && <div className="text-2xl font-bold text-[var(--color-text-primary)]">{optimized.title}</div>}
                    {Array.isArray(optimized.shots) ? (
                        <div className="grid grid-cols-1 gap-4">
                            {optimized.shots.map((shot, idx) => (
                                <div key={idx} className="glass-card p-5 border border-[var(--glass-border)] hover:border-blue-500/30 transition-all duration-300 group">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-sm">
                                                {shot.id ?? idx + 1}
                                            </div>
                                            {shot.mission && (
                                                <span className="px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
                                                    {shot.mission}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {shot.beat && <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] border border-[var(--glass-border)]">{shot.beat}</span>}
                                            {shot.emotion && <span className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] border border-[var(--glass-border)]">{shot.emotion}</span>}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="space-y-3">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-medium">
                                                    <Video size={12} />
                                                    画面内容
                                                </div>
                                                <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                                                    {shot.visual_changes || shot.initial_frame}
                                                </p>
                                            </div>
                                            {shot.camera && (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-medium">
                                                        <Camera size={12} />
                                                        运镜
                                                    </div>
                                                    <p className="text-xs text-[var(--color-text-secondary)]">{shot.camera}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            {shot.audio && (
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] font-medium">
                                                        <Music size={12} />
                                                        音频/旁白
                                                    </div>
                                                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed opacity-90">
                                                        {shot.audio}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{JSON.stringify(optimized, null, 2)}</pre>
                    )}
                </div>
            ) : (
                <div className="text-sm text-[var(--color-text-tertiary)]">未找到 optimized_storyboard.json</div>
            )}
        </div>
    );

    return (
        <div className="space-y-8 pb-20">
            {/* Standard Header */}
            <div className="glass-card p-4 flex items-center justify-between border-b-4 border-b-blue-500/20">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        剧本重构
                    </h2>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                        合并分镜优化与爆款密度：初始复制提示词，修订查看修改日志，终版查看最终剧本。
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    {/* Segmented Control */}
                    <div className="flex items-center p-1 rounded-lg bg-[var(--color-bg-secondary)]/50 border border-[var(--glass-border)] backdrop-blur-md">
                        {(['initial', 'revision', 'final'] as const).map((m) => (
                            <button
                                key={m}
                                onClick={() => setMode(m)}
                                className={`
                                    relative px-4 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap
                                    ${mode === m
                                        ? 'bg-[var(--glass-bg-light)] text-[var(--color-text-primary)] shadow-sm border border-[var(--glass-border)]'
                                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                                    }
                                `}
                            >
                                {m === 'initial' ? '初始模式' : m === 'revision' ? '修订模式' : '终版模式'}
                            </button>
                        ))}
                    </div>

                    <div className="w-px h-4 bg-[var(--glass-border)]" />

                    <button
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-2"
                    >
                        下一步：爆款密度
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-12 text-sm text-[var(--color-text-secondary)] animate-pulse">
                    <Loader2 className="animate-spin mr-2" size={16} /> 正在加载工作空间文件...
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {!loading && !error && (
                <>
                    {mode === 'initial' && renderInitial()}
                    {mode === 'revision' && renderRevision()}
                    {mode === 'final' && renderFinal()}
                </>
            )}
        </div>
    );
}
