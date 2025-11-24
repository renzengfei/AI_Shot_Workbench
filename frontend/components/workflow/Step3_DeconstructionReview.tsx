'use client';
/* eslint-disable @next/next/no-img-element */

import { AlertCircle, ArrowRight, Check, ChevronRight, Copy, Film, Layout, MessageSquare, Music, Play, Clock, Pause, ChevronLeft, Maximize, Volume2, VolumeX, Zap, Box, BookOpen, GitBranch, Anchor, Users, Sun, Palette, Image as ImageIcon, Layers, Heart, Sparkles, GitFork, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import { useWorkspace } from '@/components/WorkspaceContext';
import { parseRound1, parseRound2, parseStoredDeconstruction } from '@/lib/services/deconstruction';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';
type ReviewMode = 'review' | 'revision' | 'final';

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

interface Round1Skeleton {
    story_summary?: string;
    logic_chain?: string;
    skeleton_nodes?: string[];
    viral_elements_found?: {
        category?: string;
        element?: string;
        timestamp?: string;
        description?: string;
    }[];
}

interface Round1Hook {
    visual_hook?: string;
    audio_hook?: string;
    retention_strategy?: string;
    beat1_reference?: string;
}

interface Round1Data {
    round1_skeleton?: Round1Skeleton;
    round1_hook?: Round1Hook;
}

interface Round2Shot {
    id?: number;
    original_id?: number;
    modification_info?: {
        type?: string;
        reason?: string;
    };
    mission?: string;
    timestamp?: string;
    end_time?: string;
    duration?: string | number;
    keyframe?: string;
    initial_frame?: string | StructuredInitialFrame;
    visual_changes?: string;
    camera?: string;
    audio?: string;
    beat?: string;
    viral_element?: string;
    emotion?: string;
    logic_mapping?: string;
    modification?: {
        type?: string;
        reason?: string;
    };
}

interface Round2Data {
    characters?: Record<string, string>;
    shots?: Round2Shot[];
}

interface FrameCharacter {
    tag?: string;
    pose?: string;
    expression?: string;
}

interface FrameLayer {
    characters?: Array<FrameCharacter | string>;
    objects?: string[];
}

interface StructuredInitialFrame {
    foreground?: FrameLayer;
    midground?: FrameLayer;
    background?: {
        environment?: string;
        depth?: string;
    };
    lighting?: string;
    color_palette?: string;
}

type AnnotationMap = Record<string, string>;
interface OptimizedStoryboardPayload {
    round1?: Round1Data | string | null;
    round2?: Round2Data | string | null;
    metadata?: Record<string, unknown>;
    deconstruction?: {
        skeleton?: Round1Data | Record<string, unknown> | null;
        shots?: Round2Shot[];
        deleted_shots?: DeletedShot[];
        modified_assets?: {
            type?: string;
            original?: string;
            replacement?: string;
            reason?: string;
            affected_shots?: number[];
            element_type?: string;
        }[];
    };
    optimization_analysis?: {
        summary?: string;
        knowledge_base_applied?: string[];
    };
}

interface DeletedShot {
    original_id?: number;
    reason?: string;
    type?: string;
}

const VideoPlayer = ({ src, volume = 1, muted = false, className, aspectRatio = "aspect-[9/16]" }: { src: string; volume?: number; muted?: boolean; className?: string; aspectRatio?: string }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [rate, setRate] = useState(1.0);

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
                    src={src}
                    className="w-full h-full object-cover"
                    loop
                    playsInline
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
                            {[0.25, 0.5, 1.0].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => changeRate(r)}
                                    className={`text-xs px-1.5 py-0.5 rounded transition ${rate === r
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

export default function Step3_DeconstructionReview() {
    const { project, updateDeconstruction } = useWorkflowStore();
    const { saveDeconstruction, currentWorkspace } = useWorkspace();
    const { nextStep } = useStepNavigator();
    const [mode, setMode] = useState<ReviewMode>('review');
    const [assets, setAssets] = useState<AssetItem[]>([]);
    const [round1Data, setRound1Data] = useState<Round1Data | string | null>(null);
    const [round2Data, setRound2Data] = useState<Round2Data | string | null>(null);
    const [round1Error, setRound1Error] = useState<string | null>(null);
    const [round2Error, setRound2Error] = useState<string | null>(null);
    const [round1Text, setRound1Text] = useState('');
    const [round2Text, setRound2Text] = useState('');
    const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [annotations, setAnnotations] = useState<AnnotationMap>({});
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'empty' | 'error'>('idle');
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);
    const [promptRaw, setPromptRaw] = useState('');
    const [promptCopyStatus, setPromptCopyStatus] = useState<'idle' | 'loading' | 'copied' | 'error'>('idle');
    const [optimizedStoryboard, setOptimizedStoryboard] = useState<OptimizedStoryboardPayload | null>(null);
    const [optimizedError, setOptimizedError] = useState<string | null>(null);
    const [optimizedMetadata, setOptimizedMetadata] = useState<Record<string, unknown> | null>(null);
    const [optimizedAnalysis, setOptimizedAnalysis] = useState<{ summary?: string; knowledge_base_applied?: string[] } | null>(null);
    const [deletedShots, setDeletedShots] = useState<DeletedShot[]>([]);
    const [modifiedAssets, setModifiedAssets] = useState<
        Array<{
            type?: string;
            original?: string;
            replacement?: string;
            reason?: string;
            affected_shots?: number[];
            element_type?: string;
        }>
    >([]);

    // Global Volume State
    const [globalVolume, setGlobalVolume] = useState(1);
    const [isGlobalMuted, setIsGlobalMuted] = useState(false);
    const canEdit = mode === 'review';
    const allowAnnotations = mode === 'review';
    const modeOptions: { key: ReviewMode; label: string; helper: string }[] = [
        { key: 'review', label: '原片审验', helper: '可编辑 + 批注' },
        { key: 'revision', label: '原片修订', helper: '对比终版改动，只读' },
        { key: 'final', label: '全新剧本', helper: '终版剧本纯展示' },
    ];
    const modeSubtitleMap: Record<ReviewMode, string> = {
        review: '确认原片拆解，并可编辑/批注',
        revision: '对照修改记录查看修订版，只读',
        final: '查看全新剧本终版，只读',
    };

    const toggleGlobalMute = () => setIsGlobalMuted(!isGlobalMuted);
    const handleGlobalVolumeChange = (e: ChangeEvent<HTMLInputElement>) => {
        const vol = parseFloat(e.target.value);
        setGlobalVolume(vol);
        setIsGlobalMuted(vol === 0);
    };

    const workspaceSlug = currentWorkspace?.path
        ? (() => {
            const marker = '/workspaces/';
            const idx = currentWorkspace.path.lastIndexOf(marker);
            if (idx >= 0) return currentWorkspace.path.substring(idx + marker.length);
            return currentWorkspace.path.split('/').pop() || currentWorkspace.path;
        })()
        : null;
    const deconstructionPath = currentWorkspace?.path ? `${currentWorkspace.path}/deconstruction.md` : '';

    useEffect(() => {
        const fetchAssets = async () => {
            if (!workspaceSlug) return;
            try {
                const resp = await fetch(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/report.json`);
                if (!resp.ok) return;
                const data = await resp.json();
                setAssets(Array.isArray(data.report) ? data.report : []);
            } catch (err) {
                console.error('加载资产报告失败', err);
            }
        };
        fetchAssets();
    }, [workspaceSlug]);

    useEffect(() => {
        const loadPrompt = async () => {
            setPromptCopyStatus('loading');
            try {
                const resp = await fetch('/api/production-prompt');
                if (!resp.ok) throw new Error(`status ${resp.status}`);
                const text = await resp.text();
                setPromptRaw(text);
                setPromptCopyStatus('idle');
            } catch (err) {
                console.error('加载 productionStoryboardPrompt 失败', err);
                setPromptCopyStatus('error');
            }
        };
        loadPrompt();
    }, []);

    const loadOptimized = useCallback(async () => {
        if (!workspaceSlug) return;
        setOptimizedStoryboard(null);
        setOptimizedError(null);
        setOptimizedMetadata(null);
        setOptimizedAnalysis(null);
        setDeletedShots([]);
        setModifiedAssets([]);
        try {
            const resp = await fetch(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/optimized_storyboard.json`, { cache: 'no-store' });
            if (!resp.ok) {
                setOptimizedError(`未找到 optimized_storyboard.json（${resp.status}）`);
                setOptimizedStoryboard(null);
                return;
            }
            const data = await resp.json();
            if (data.metadata) setOptimizedMetadata(data.metadata as Record<string, unknown>);
            if (data.optimization_analysis) setOptimizedAnalysis(data.optimization_analysis as { summary?: string; knowledge_base_applied?: string[] });
            if (data.deconstruction?.deleted_shots) setDeletedShots(data.deconstruction.deleted_shots as DeletedShot[]);
            if (data.deconstruction?.modified_assets) setModifiedAssets(data.deconstruction.modified_assets);
            setOptimizedStoryboard({
                round1: (data as OptimizedStoryboardPayload).round1 ?? null,
                round2: (data as OptimizedStoryboardPayload).round2 ?? null,
                metadata: data.metadata,
                deconstruction: (data as OptimizedStoryboardPayload).deconstruction,
                optimization_analysis: data.optimization_analysis,
            });
        } catch (err) {
            console.error('加载 optimized_storyboard 失败', err);
            setOptimizedError('加载 optimized_storyboard.json 失败');
            setOptimizedStoryboard(null);
        }
    }, [workspaceSlug]);

    useEffect(() => {
        loadOptimized();
    }, [loadOptimized]);

    const optimizedMapped = useMemo(() => {
        if (!optimizedStoryboard) return { r1: null as Round1Data | null, r2: null as Round2Data | null };
        if (optimizedStoryboard.round1 || optimizedStoryboard.round2) {
            return { r1: optimizedStoryboard.round1 as Round1Data, r2: optimizedStoryboard.round2 as Round2Data };
        }
        if (optimizedStoryboard.deconstruction) {
            const skeleton = optimizedStoryboard.deconstruction.skeleton ?? null;
            const shots = optimizedStoryboard.deconstruction.shots ?? null;
            const r1 = skeleton
                ? (Array.isArray((skeleton as Round1Data)?.round1_skeleton?.skeleton_nodes) || (skeleton as Round1Data)?.round1_hook
                    ? (skeleton as Round1Data)
                    : ({ round1_skeleton: skeleton } as Round1Data))
                : null;
            const r2 = shots ? ({ shots } as Round2Data) : null;
            return { r1, r2 };
        }
        return { r1: null, r2: null };
    }, [optimizedStoryboard]);

    // Load/save annotations per workspace
    useEffect(() => {
        if (!workspaceSlug) return;
        const raw = localStorage.getItem(`annotations:${workspaceSlug}`);
        if (raw) {
            try {
                setAnnotations(JSON.parse(raw));
            } catch {
                setAnnotations({});
            }
        } else {
            setAnnotations({});
        }
    }, [workspaceSlug]);

    const persistAnnotations = (next: AnnotationMap) => {
        if (!workspaceSlug) return;
        localStorage.setItem(`annotations:${workspaceSlug}`, JSON.stringify(next));
    };

    const updateAnnotation = (key: string, value: string) => {
        setAnnotations((prev) => {
            const next = { ...prev, [key]: value };
            persistAnnotations(next);
            return next;
        });
    };

    const clearAnnotation = (key: string) => {
        setAnnotations((prev) => {
            const next = { ...prev };
            delete next[key];
            persistAnnotations(next);
            return next;
        });
        setEditingKey(key); // keep open but empty
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const openAnnotation = (key: string, label: string) => {
        void label;
        setEditingKey(key);
        setTimeout(() => textareaRef.current?.focus(), 0);
    };

    const handleCopyPrompt = async () => {
        if (!promptRaw || !deconstructionPath) {
            setPromptCopyStatus('error');
            setTimeout(() => setPromptCopyStatus('idle'), 1500);
            return;
        }
        const filled = promptRaw.replace(
            /\*\*文件路径\*\*:\s*【请在此处填入完整的文件路径】/g,
            `**文件路径**: ${deconstructionPath}`
        );
        try {
            await navigator.clipboard.writeText(filled);
            setPromptCopyStatus('copied');
            setTimeout(() => setPromptCopyStatus('idle'), 1500);
        } catch (err) {
            console.error('复制提示词失败', err);
            setPromptCopyStatus('error');
            setTimeout(() => setPromptCopyStatus('idle'), 1500);
        }
    };

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.closest('.annotation-popover') || target.closest('.annotation-btn')) return;
            setEditingKey(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const renderAnnotationControl = (id: string, label: string) => {
        if (!allowAnnotations) return null;
        const value = annotations[id] || '';
        const isOpen = editingKey === id;
        return (
            <div className="relative inline-block annotation-wrapper">
                <button
                    className={`annotation-btn text-xs px-3 py-1 rounded-lg border transition shadow-sm ${value ? 'border-blue-500/50 text-blue-400 bg-blue-500/15' : 'border-[var(--glass-border)] text-[var(--color-text-tertiary)] bg-[var(--glass-bg-light)]/60 hover:text-[var(--color-text-primary)]'}`}
                    onClick={() => openAnnotation(id, label)}
                >
                    批注
                </button>
                {isOpen && (
                    <div className="annotation-popover absolute z-[9999] -top-2 right-0 translate-y-[-100%] w-72 glass-card border border-[var(--glass-border)] shadow-2xl p-3 rounded-xl">
                        <div className="flex items-center justify-between mb-2 text-xs text-[var(--color-text-primary)]">
                            <span className="font-semibold">{label}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => clearAnnotation(id)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--glass-border)] hover:border-red-400 hover:text-red-400 text-[var(--color-text-tertiary)] transition"
                                >
                                    <Trash2 size={12} /> 清空
                                </button>
                                <button
                                    onClick={() => setEditingKey(null)}
                                    className="px-2 py-0.5 rounded border border-[var(--glass-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                                >
                                    关闭
                                </button>
                            </div>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => updateAnnotation(id, e.target.value)}
                            className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-lg p-2 text-xs text-[var(--color-text-primary)] min-h-[100px] focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20"
                            placeholder={`填写对「${label}」的批注...`}
                        />
                    </div>
                )}
            </div>
        );
    };

    const copyAllAnnotations = async () => {
        const labelMap: Record<string, string> = {
            story_summary: '故事概要',
            logic_chain: '底层逻辑链',
            hooks: '前3秒钩子分析',
            viral: '爆款元素',
            characters: '角色库',
        };
        const shotFieldMap: Record<string, string> = {
            mission: '使命',
            initial_frame: '首帧描述',
            visual_changes: '画面变化',
            camera: '镜头',
            audio: '音频',
            emotion: '节奏/情绪',
            beat: 'Beat',
        };

        const lines: string[] = [];
        Object.entries(annotations).forEach(([key, val]) => {
            if (!val?.trim()) return;
            if (labelMap[key]) {
                lines.push(`${labelMap[key]}：${val.trim()}`);
                return;
            }
            const match = key.match(/^shot-(.+?)-(.*)$/);
            if (match) {
                const shotId = match[1];
                const field = match[2];
                const fieldLabel = shotFieldMap[field] || field;
                lines.push(`Shot #${shotId} ${fieldLabel}：${val.trim()}`);
            }
        });

        if (!lines.length) {
            setCopyStatus('empty');
            setTimeout(() => setCopyStatus('idle'), 1500);
            return;
        }
        try {
            await navigator.clipboard.writeText(lines.join('\n'));
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 1500);
        } catch {
            setCopyStatus('error');
            setTimeout(() => setCopyStatus('idle'), 1500);
        }
    };

    const renderFieldWithRevision = (
        originalNode: ReactNode,
        label: string,
        originalVal?: string,
        optimizedVal?: string,
    ) => {
        if (mode !== 'revision') return originalNode;
        const nextVal = optimizedVal;
        const origVal = originalVal ?? '';
        if (!nextVal || nextVal === origVal) return originalNode;

        const isMissing = !origVal;
        const panelClass = isMissing
            ? 'border-blue-400/50 bg-blue-500/10 text-[var(--color-text-primary)]'
            : 'border-red-400/50 bg-red-500/10 text-[var(--color-text-primary)]';
        const labelClass = isMissing ? 'text-blue-300' : 'text-red-300';

        return (
            <div className="space-y-2">
                <div>{originalNode}</div>
                <div className={`border rounded-lg p-3 text-sm ${panelClass}`}>
                    <div className={`flex items-center gap-2 text-xs uppercase font-semibold mb-1 ${labelClass}`}>
                        <span>{label}</span>
                        <span className={`px-2 py-0.5 rounded-full border ${isMissing ? 'border-blue-300/60 text-blue-300' : 'border-red-300/60 text-red-300'}`}>
                            新
                        </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed">{nextVal}</div>
                </div>
            </div>
        );
    };

    const modTypeClass = (modType?: string) => {
        const upper = (modType || '').toUpperCase();
        if (upper === 'DELETE') return 'text-red-300';
        if (upper === 'REPLACE') return 'text-amber-300';
        if (upper === 'ADD' || upper === 'INSERT') return 'text-emerald-300';
        return 'text-blue-300';
    };

    // 修订模式下，当前已不再展示缺失镜头列表，保持占位防止运行时错误
    const missingModifiedShots: Array<{ id?: number; action?: string; reason?: string; changes?: Record<string, unknown>; backup?: unknown }> = [];

    const getOptimizedShot = useCallback(
        (shot: Round2Shot, idx: number) => {
            if (mode !== 'revision') return null;
            if (!optimizedMapped.r2 || typeof optimizedMapped.r2 === 'string') return null;
            const optimizedShots = optimizedMapped.r2.shots || [];
            const id = shot.id ?? idx + 1;
            return (
                optimizedShots.find((s) => (s.original_id ?? s.id) === id) ||
                optimizedShots[idx] ||
                null
            );
        },
        [mode, optimizedMapped.r2],
    );

    useEffect(() => {
        if (mode === 'final') {
            if (optimizedMapped.r1 || optimizedMapped.r2) {
                setRound1Data(optimizedMapped.r1 as Round1Data);
                setRound2Data(optimizedMapped.r2 as Round2Data);
                setRound1Error(optimizedError);
                setRound2Error(optimizedError);
                setRound1Text(optimizedMapped.r1 ? (typeof optimizedMapped.r1 === 'string' ? optimizedMapped.r1 : JSON.stringify(optimizedMapped.r1, null, 2)) : '');
                setRound2Text(optimizedMapped.r2 ? (typeof optimizedMapped.r2 === 'string' ? optimizedMapped.r2 : JSON.stringify(optimizedMapped.r2, null, 2)) : '');
            } else {
                setRound1Data(null);
                setRound2Data(null);
                setRound1Error(optimizedError || '未找到 optimized_storyboard.json');
                setRound2Error(optimizedError || '未找到 optimized_storyboard.json');
                setRound1Text('');
                setRound2Text('');
            }
            setSavingState('idle');
            return;
        }

        if (!project?.deconstructionText) {
            setRound1Data(null);
            setRound2Data(null);
            setRound1Error(null);
            setRound2Error(null);
            setRound1Text('');
            setRound2Text('');
            setSavingState(mode === 'review' ? 'idle' : 'idle');
            return;
        }

        const result = parseStoredDeconstruction(project.deconstructionText);
        setRound1Data(result.round1 as Round1Data);
        setRound2Data(result.round2 as Round2Data);
        setRound1Error(result.errorsRound1.length ? result.errorsRound1.join('；') : null);
        setRound2Error(result.errorsRound2.length ? result.errorsRound2.join('；') : null);
        setRound1Text(result.round1 ? (typeof result.round1 === 'string' ? result.round1 : JSON.stringify(result.round1, null, 2)) : '');
        setRound2Text(result.round2 ? (typeof result.round2 === 'string' ? result.round2 : JSON.stringify(result.round2, null, 2)) : '');
        if (mode !== 'review') {
            setSavingState('idle');
        }
    }, [mode, optimizedMapped.r1, optimizedMapped.r2, optimizedError, project?.deconstructionText]);

    useEffect(() => {
        if (mode === 'revision' || mode === 'final') {
            loadOptimized();
        }
    }, [mode, loadOptimized]);

    const scheduleSave = (nextRound1: string, nextRound2: string) => {
        if (!canEdit) return;
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        setSavingState('saving');
        saveTimeoutRef.current = setTimeout(async () => {
            const parsed1 = parseRound1(nextRound1);
            const parsed2 = parseRound2(nextRound2);
            setRound1Error(parsed1.error);
            setRound2Error(parsed2.error);

            const payload = JSON.stringify(
                {
                    round1: parsed1.data ?? (nextRound1.trim() ? nextRound1 : undefined),
                    round2: parsed2.data ?? (nextRound2.trim() ? nextRound2 : undefined),
                },
                null,
                2,
            );

            updateDeconstruction(payload);
            try {
                await saveDeconstruction(payload);
                setSavingState('saved');
            } catch (err) {
                console.error('保存拆解 JSON 失败', err);
                setSavingState('error');
            }

            const refreshed = parseStoredDeconstruction(payload);
            setRound1Data(refreshed.round1 as Round1Data);
            setRound2Data(refreshed.round2 as Round2Data);
        }, 400);
    };

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (!canEdit) {
            setSavingState('idle');
        }
    }, [canEdit]);

    const mutateRound1 = (updater: (draft: Round1Data) => void) => {
        if (!canEdit || !round1Data || typeof round1Data === 'string') return;
        const draft: Round1Data = {
            round1_skeleton: { ...round1Data.round1_skeleton },
            round1_hook: { ...round1Data.round1_hook },
        };
        updater(draft);
        setRound1Data(draft);
        const text = JSON.stringify(draft, null, 2);
        setRound1Text(text);
        scheduleSave(text, round2Text);
    };

    const mutateRound2 = (updater: (draft: Round2Data) => void) => {
        if (!canEdit || !round2Data || typeof round2Data === 'string') return;
        const draft: Round2Data = {
            characters: round2Data.characters ? { ...round2Data.characters } : undefined,
            shots: round2Data.shots ? round2Data.shots.map((s) => ({ ...s })) : undefined,
        };
        updater(draft);
        setRound2Data(draft);
        const text = JSON.stringify(draft, null, 2);
        setRound2Text(text);
        scheduleSave(round1Text, text);
    };

    const clipMap = useMemo(() => {
        const map = new Map<string, string>();
        assets.forEach((asset) => {
            if (asset.frame && asset.clip) {
                map.set(asset.frame, asset.clip);
            }
            if (asset.clip) {
                map.set(`ordinal-${asset.ordinal}`, asset.clip);
            }
        });
        return map;
    }, [assets]);
    const frameMap = useMemo(() => {
        const map = new Map<number, string>();
        assets.forEach((asset) => {
            if (asset.frame) {
                map.set(asset.ordinal, asset.frame);
            }
        });
        return map;
    }, [assets]);
    const frameNameSet = useMemo(() => {
        const set = new Set<string>();
        assets.forEach((asset) => {
            if (asset.frame) set.add(asset.frame);
        });
        return set;
    }, [assets]);

    return (
        <div className="space-y-12 pb-32">
            {/* Header */}
            <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                        <Film size={24} className="text-blue-400" />
                        剧本重构
                    </h2>
                    <button
                        onClick={nextStep}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium text-sm shadow-lg shadow-blue-500/20"
                    >
                        下一步: 生产剧本 <ArrowRight size={16} />
                    </button>
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                    {modeSubtitleMap[mode]}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    {modeOptions.map(({ key, label, helper }) => (
                        <button
                            key={key}
                            onClick={() => setMode(key)}
                            className={`
                                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                                ${mode === key
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20 ring-2 ring-blue-400/50'
                                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] border border-[var(--glass-border)]'}
                            `}
                        >
                            <div className="flex flex-col items-start gap-0.5">
                                <span>{label}</span>
                                <span className="text-xs opacity-70">{helper}</span>
                            </div>
                        </button>
                    ))}
                    <div className="flex-1" />
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--glass-border)]">
                        <div className={`w-2 h-2 rounded-full ${savingState === 'saved' ? 'bg-green-500' : savingState === 'saving' ? 'bg-yellow-500 animate-pulse' : 'bg-slate-500'}`} />
                        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                            {savingState === 'saving' ? '保存中...' : savingState === 'saved' ? '已保存' : '待编辑'}
                        </span>
                    </div>
                    <button
                        onClick={handleCopyPrompt}
                        disabled={promptCopyStatus === 'loading'}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${promptCopyStatus === 'copied'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : promptCopyStatus === 'error'
                                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                    : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20'}
                        `}
                    >
                        {promptCopyStatus === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                        <span>{promptCopyStatus === 'loading' ? '加载中...' : promptCopyStatus === 'copied' ? '已复制' : '复制剧本优化提示词'}</span>
                    </button>
                    <button
                        onClick={copyAllAnnotations}
                        className={`
                            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                            ${copyStatus === 'copied'
                                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                : copyStatus === 'empty'
                                    ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                    : copyStatus === 'error'
                                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                        : 'bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20'}
                        `}
                    >
                        {copyStatus === 'copied' ? <Check size={14} /> : <MessageSquare size={14} />}
                        <span>
                            {copyStatus === 'copied'
                                ? '已复制批注'
                                : copyStatus === 'empty'
                                    ? '批注为空'
                                    : copyStatus === 'error'
                                        ? '复制失败'
                                        : '复制批注'}
                        </span>
                    </button>
                </div>
                {/* Global Volume Control */}
                <div className="flex items-center gap-4 p-3 rounded-lg bg-[var(--color-bg-secondary)]/50 border border-[var(--glass-border)]">
                    <button
                        onClick={toggleGlobalMute}
                        className="p-1.5 hover:bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-primary)]"
                    >
                        {isGlobalMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={isGlobalMuted ? 0 : globalVolume}
                        onChange={handleGlobalVolumeChange}
                        className="flex-1 h-1 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                    />
                    <span className="text-xs text-[var(--color-text-tertiary)] w-8 text-right">
                        {Math.round((isGlobalMuted ? 0 : globalVolume) * 100)}%
                    </span>
                </div>
            </div>

            <div className="mx-auto px-8 py-6 space-y-8 relative">

                {/* Final Mode Metadata & Analysis */}
                {(mode === 'final' || mode === 'revision') && (
                    <div className="glass-card p-5 border border-purple-500/20 bg-[var(--glass-bg-light)] space-y-3">
                        <div className="flex items-center gap-2 text-purple-300">
                            <Zap size={16} />
                            <span className="text-sm font-semibold">{mode === 'final' ? '优化摘要' : '修订摘要（对比终版）'}</span>
                        </div>
                        {optimizedMetadata && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--color-text-secondary)]">
                                {Object.entries(optimizedMetadata).map(([k, v]) => (
                                    <div key={k} className="p-3 rounded-lg bg-[var(--color-bg-secondary)]/50 border border-[var(--glass-border)]">
                                        <div className="text-xs uppercase text-[var(--color-text-tertiary)]">{k}</div>
                                        <div className="text-[var(--color-text-primary)] break-words">{String(v)}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {optimizedAnalysis?.summary && (
                            <div className="text-sm text-[var(--color-text-primary)] leading-relaxed bg-[var(--glass-bg-light)]/70 p-3 rounded-lg border border-[var(--glass-border)]">
                                {optimizedAnalysis.summary}
                            </div>
                        )}
                        {optimizedAnalysis?.knowledge_base_applied && optimizedAnalysis.knowledge_base_applied.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {optimizedAnalysis.knowledge_base_applied.map((k) => (
                                    <span key={k} className="px-2 py-1 rounded-full text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                        {k}
                                    </span>
                                ))}
                            </div>
                        )}
                        {!optimizedMetadata && !optimizedAnalysis?.summary && (
                            <div className="text-xs text-[var(--color-text-tertiary)]">未提供优化元数据。</div>
                        )}

                        {deletedShots && deletedShots.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-red-300 flex items-center gap-2">
                                    <Trash2 size={12} /> 已删除镜头
                                </div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {deletedShots.map((d, idx) => (
                                        <div key={`${d.original_id ?? idx}`} className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs space-y-1">
                                            <div className="font-semibold text-[var(--color-text-primary)]">Shot #{d.original_id ?? idx + 1}</div>
                                            {d.reason && <div className="text-[var(--color-text-secondary)] leading-relaxed">{d.reason}</div>}
                                            {d.type && <div className="text-xs uppercase text-red-300">类型: {d.type}</div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {Array.isArray(modifiedAssets) && modifiedAssets.length > 0 && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-[var(--color-text-primary)]">元素替换</div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {modifiedAssets.map((m, idx) => (
                                        <div key={`${m.original ?? idx}-${idx}`} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-light)]/70 text-xs space-y-1">
                                            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                                                <span className="line-through text-[var(--color-text-tertiary)]">{m.original}</span>
                                                <ArrowRight size={10} className="text-[var(--color-text-secondary)]" />
                                                <span className="text-emerald-400 font-semibold">{m.replacement}</span>
                                            </div>
                                            {m.type && <div className={`text-xs uppercase ${modTypeClass(m.type)}`}>{m.type}</div>}
                                            {m.element_type && <div className="text-xs text-amber-300 uppercase">{m.element_type}</div>}
                                            {m.reason && <div className="text-[var(--color-text-secondary)] leading-relaxed">{m.reason}</div>}
                                            {m.affected_shots && m.affected_shots.length > 0 && (
                                                <div className="text-xs text-[var(--color-text-tertiary)]">影响镜头: {m.affected_shots.join(', ')}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
                }

                {/* Round 1 Section - Bento Grid Layout */}
                <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
                                <Box size={20} />
                            </div>
                            Round 1: 宏观骨架 & 钩子
                        </h3>
                        {round1Error && (
                            <span className="text-xs text-amber-400 flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 backdrop-blur-md">
                                <AlertCircle size={14} /> 解析错误
                            </span>
                        )}
                    </div>

                    {/* NEW: Macro Optimization Analysis for Round 1 */}
                    {mode === 'revision' && (
                        <div className="glass-card p-6 border-l-4 border-l-emerald-500 bg-emerald-500/5 space-y-4 rounded-2xl shadow-lg shadow-emerald-900/10">
                            <div className="flex items-center gap-3 text-emerald-400">
                                <div className="p-1.5 rounded-md bg-emerald-500/20">
                                    <Zap size={18} />
                                </div>
                                <span className="font-bold text-lg tracking-tight">宏观优化分析 (Macro Analysis)</span>
                            </div>
                            {/* ... content ... */}
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                        {/* Left Column: Narrative Flow (7/12) */}
                        <div className="xl:col-span-7 space-y-8">
                            {/* Story Summary */}
                            <div className="glass-card p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

                                <div className="flex items-center gap-3 text-blue-400 mb-6 relative z-10">
                                    <div className="p-2 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                                        <BookOpen size={20} />
                                    </div>
                                    <span className="font-bold text-lg text-slate-700">故事概要</span>
                                    {renderAnnotationControl('story_summary', '故事概要')}
                                </div>
                                {typeof round1Data === 'string' ? (
                                    <p className="text-sm text-white/40 italic">JSON 解析失败</p>
                                ) : (
                                    <textarea
                                        value={round1Data?.round1_skeleton?.story_summary || ''}
                                        onChange={(e) =>
                                            mutateRound1((draft) => {
                                                draft.round1_skeleton = { ...(draft.round1_skeleton || {}), story_summary: e.target.value };
                                            })
                                        }
                                        readOnly={!canEdit}
                                        className="w-full bg-black/5 border border-black/10 rounded-2xl p-6 text-base text-slate-700 min-h-[160px] focus:outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 leading-relaxed resize-y placeholder:text-slate-400 shadow-inner"
                                        placeholder="输入故事概要..."
                                    />
                                )}
                            </div>

                            {/* Logic Chain */}
                            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/5 to-purple-500/5 backdrop-blur-xl shadow-xl">
                                <div className="flex items-center gap-3 text-white/90 mb-4">
                                    <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                                        <GitBranch size={16} />
                                    </div>
                                    <span className="font-bold text-sm tracking-wide uppercase text-indigo-500/80">底层逻辑链</span>
                                    {renderAnnotationControl('logic_chain', '底层逻辑链')}
                                </div>
                                <textarea
                                    value={typeof round1Data !== 'string' ? round1Data?.round1_skeleton?.logic_chain || '' : ''}
                                    onChange={(e) =>
                                        mutateRound1((draft) => {
                                            draft.round1_skeleton = { ...(draft.round1_skeleton || {}), logic_chain: e.target.value };
                                        })
                                    }
                                    readOnly={!canEdit}
                                    className="w-full bg-black/5 border border-black/10 rounded-xl p-4 text-sm text-indigo-700 min-h-[80px] focus:outline-none focus:border-indigo-500/30 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-y italic font-medium shadow-inner placeholder:text-indigo-400"
                                    placeholder="输入逻辑链..."
                                />
                            </div>

                            {/* Skeleton Timeline */}
                            <div className="glass-card p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
                                <div className="flex items-center gap-3 text-purple-400 mb-8">
                                    <div className="p-2 rounded-xl bg-purple-500/10 ring-1 ring-purple-500/20">
                                        <Layout size={20} />
                                    </div>
                                    <span className="font-bold text-lg text-slate-700">骨架节点 (Timeline)</span>
                                </div>
                                <div className="space-y-0 relative pl-4">
                                    {/* Timeline Line */}
                                    <div className="absolute left-[27px] top-4 bottom-8 w-0.5 bg-gradient-to-b from-purple-500/40 via-purple-500/20 to-transparent" />

                                    {typeof round1Data !== 'string' && (round1Data?.round1_skeleton?.skeleton_nodes || []).map((node, idx) => (
                                        <div key={idx} className="relative pl-12 pb-8 last:pb-0 group">
                                            {/* Timeline Dot */}
                                            <div className="w-14 h-14 flex items-center justify-center z-10 absolute left-0 top-4">
                                                <div className="w-10 h-10 rounded-full bg-[#1a1a2e] border-2 border-purple-500/40 text-purple-300 flex items-center justify-center text-sm font-bold shadow-[0_0_15px_rgba(168,85,247,0.2)] group-hover:scale-110 group-hover:border-purple-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300">
                                                    {idx + 1}
                                                </div>
                                            </div>

                                            <textarea
                                                value={node || ''}
                                                onChange={(e) =>
                                                    mutateRound1((draft) => {
                                                        const list = [...(draft.round1_skeleton?.skeleton_nodes || [])];
                                                        list[idx] = e.target.value;
                                                        draft.round1_skeleton = { ...(draft.round1_skeleton || {}), skeleton_nodes: list };
                                                    })
                                                }
                                                readOnly={!canEdit}
                                                className="w-full bg-black/5 border border-black/10 rounded-xl p-4 text-sm text-slate-700 min-h-[70px] focus:outline-none focus:border-purple-500/30 focus:ring-2 focus:ring-purple-500/10 transition-all resize-y shadow-sm hover:bg-black/10"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Mechanics & Analysis (5/12) */}
                        <div className="xl:col-span-5 space-y-8">
                            {/* Hooks Analysis */}
                            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-pink-500/5 to-transparent backdrop-blur-xl shadow-xl">
                                <div className="flex items-center gap-3 text-pink-400 mb-6">
                                    <div className="p-1.5 rounded-lg bg-pink-500/20">
                                        <Anchor size={18} />
                                    </div>
                                    <span className="font-bold text-base text-slate-700">前3秒钩子分析</span>
                                    {renderAnnotationControl('hooks', '前3秒钩子分析')}
                                </div>
                                <div className="space-y-5">
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-pink-500/60 uppercase tracking-wider ml-1">视觉钩子</div>
                                        <input
                                            value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.visual_hook || '' : ''}
                                            onChange={(e) =>
                                                mutateRound1((draft) => {
                                                    draft.round1_hook = { ...(draft.round1_hook || {}), visual_hook: e.target.value };
                                                })
                                            }
                                            readOnly={!canEdit}
                                            className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/10 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-pink-500/60 uppercase tracking-wider ml-1">音频钩子</div>
                                        <input
                                            value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.audio_hook || '' : ''}
                                            onChange={(e) =>
                                                mutateRound1((draft) => {
                                                    draft.round1_hook = { ...(draft.round1_hook || {}), audio_hook: e.target.value };
                                                })
                                            }
                                            readOnly={!canEdit}
                                            className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/10 transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-pink-500/60 uppercase tracking-wider ml-1">留存策略</div>
                                        <textarea
                                            value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.retention_strategy || '' : ''}
                                            onChange={(e) =>
                                                mutateRound1((draft) => {
                                                    draft.round1_hook = { ...(draft.round1_hook || {}), retention_strategy: e.target.value };
                                                })
                                            }
                                            readOnly={!canEdit}
                                            className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/10 min-h-[80px] resize-y transition-all"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Viral Elements */}
                            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-gradient-to-b from-amber-500/5 to-transparent backdrop-blur-xl shadow-xl">
                                <div className="flex items-center gap-3 text-amber-400 mb-6">
                                    <div className="p-1.5 rounded-lg bg-amber-500/20">
                                        <Zap size={18} />
                                    </div>
                                    <span className="font-bold text-base text-slate-700">爆款元素</span>
                                    {renderAnnotationControl('viral', '爆款元素')}
                                </div>
                                <div className="space-y-4">
                                    {typeof round1Data !== 'string' && (round1Data?.round1_skeleton?.viral_elements_found || []).map((v, idx) => (
                                        <div key={idx} className="bg-black/5 p-4 rounded-xl border border-black/10 space-y-3 hover:border-amber-500/20 hover:bg-black/10 transition-all duration-300 group">
                                            <div className="flex gap-3 border-b border-black/5 pb-2">
                                                <input
                                                    value={v.category || ''}
                                                    onChange={(e) =>
                                                        mutateRound1((draft) => {
                                                            const list = [...(draft.round1_skeleton?.viral_elements_found || [])];
                                                            list[idx] = { ...(list[idx] || {}), category: e.target.value };
                                                            draft.round1_skeleton = { ...(draft.round1_skeleton || {}), viral_elements_found: list };
                                                        })
                                                    }
                                                    readOnly={!canEdit}
                                                    className="w-1/3 text-xs font-bold text-amber-400 bg-transparent border-none focus:ring-0 px-0 placeholder:text-amber-400/30"
                                                    placeholder="类别"
                                                />
                                                <div className="w-px bg-black/10" />
                                                <input
                                                    value={v.element || ''}
                                                    onChange={(e) =>
                                                        mutateRound1((draft) => {
                                                            const list = [...(draft.round1_skeleton?.viral_elements_found || [])];
                                                            list[idx] = { ...(list[idx] || {}), element: e.target.value };
                                                            draft.round1_skeleton = { ...(draft.round1_skeleton || {}), viral_elements_found: list };
                                                        })
                                                    }
                                                    readOnly={!canEdit}
                                                    className="flex-1 text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 px-0 placeholder:text-slate-400"
                                                    placeholder="元素"
                                                />
                                            </div>
                                            <textarea
                                                value={v.description || ''}
                                                onChange={(e) =>
                                                    mutateRound1((draft) => {
                                                        const list = [...(draft.round1_skeleton?.viral_elements_found || [])];
                                                        list[idx] = { ...(list[idx] || {}), description: e.target.value };
                                                        draft.round1_skeleton = { ...(draft.round1_skeleton || {}), viral_elements_found: list };
                                                    })
                                                }
                                                readOnly={!canEdit}
                                                className="w-full text-xs text-slate-500 bg-transparent border-none focus:ring-0 p-0 resize-none min-h-[40px] placeholder:text-slate-400"
                                                placeholder="详细描述..."
                                            />
                                        </div>
                                    ))}
                                    {(typeof round1Data === 'string' || !round1Data?.round1_skeleton?.viral_elements_found?.length) && (
                                        <span className="text-xs text-white/20 italic pl-2">暂无数据</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Round 2 Section */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                            <Film className="w-5 h-5 text-purple-500" />
                            Round 2: 分镜头分析
                        </h3>
                        {round2Error && (
                            <span className="text-xs text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                                <AlertCircle size={12} /> 解析错误
                            </span>
                        )}
                    </div>

                    {/* Characters */}
                    {/* Characters */}
                    {typeof round2Data !== 'string' && round2Data?.characters && Object.keys(round2Data.characters).length > 0 && (
                        <div className="space-y-6">
                            {/* Enhanced Title Section */}
                            <div className="relative">
                                <div className="flex items-center gap-3 px-2">
                                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                        <Users size={20} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-600">
                                            角色库
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-0.5">Character Library · {Object.keys(round2Data.characters).length} 位角色</p>
                                    </div>
                                    {renderAnnotationControl('characters', '角色库')}
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                            </div>

                            {/* Enhanced Character Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {Object.entries(round2Data.characters).map(([name, desc], index) => (
                                    <div
                                        key={index}
                                        className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/30 backdrop-blur-sm transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 hover:border-blue-300/50"
                                    >
                                        {/* Gradient Overlay on Hover */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                        {/* Shine Effect */}
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

                                        <div className="relative z-10 p-6 space-y-4">
                                            {/* Avatar Circle */}
                                            <div className="flex items-start justify-between">
                                                <div className="relative">
                                                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center text-3xl font-bold text-slate-700 group-hover:scale-110 transition-all duration-300 shadow-md ring-2 ring-white/50">
                                                        {name[0]}
                                                    </div>
                                                    {/* Badge Decoration */}
                                                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center shadow-lg">
                                                        <Users size={12} className="text-white" />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Character Name */}
                                            <div>
                                                <h4 className="text-xl font-bold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors duration-300">
                                                    {name}
                                                </h4>
                                                <div className="h-1 w-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mt-2 group-hover:w-full transition-all duration-500" />
                                            </div>

                                            {/* Character Description */}
                                            <textarea
                                                value={typeof desc === 'string' ? desc : JSON.stringify(desc)}
                                                onChange={(e) =>
                                                    mutateRound2((draft) => {
                                                        if (!draft.characters) draft.characters = {};
                                                        draft.characters[name] = e.target.value;
                                                    })
                                                }
                                                readOnly={!canEdit}
                                                className="w-full bg-transparent border-none p-0 text-sm text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors focus:ring-0 focus:outline-none resize-none min-h-[80px]"
                                                placeholder="输入角色描述..."
                                            />
                                        </div>

                                        {/* Bottom Gradient Bar */}
                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Shot List - Apple Glass Style */}
                    <div className="space-y-12">
                        {typeof round2Data !== 'string' && round2Data?.shots && round2Data.shots.map((shot: Round2Shot, index: number) => {
                            const shotId = shot.id ?? index + 1;
                            const modType = shot.modification?.type;
                            const optimizedShot = getOptimizedShot(shot, index);

                            const originalInitialFrame = shot.initial_frame;
                            const optimizedInitialFrame = optimizedShot?.initial_frame;
                            const structuredFrameOriginal = typeof originalInitialFrame === 'object' && originalInitialFrame !== null && !Array.isArray(originalInitialFrame)
                                ? originalInitialFrame as StructuredInitialFrame
                                : null;
                            const structuredFrameOptimized = typeof optimizedInitialFrame === 'object' && optimizedInitialFrame !== null && !Array.isArray(optimizedInitialFrame)
                                ? optimizedInitialFrame as StructuredInitialFrame
                                : null;
                            const initialFrameText = typeof originalInitialFrame === 'string'
                                ? originalInitialFrame
                                : '';
                            const initialFrameTextOptimized = typeof optimizedInitialFrame === 'string'
                                ? optimizedInitialFrame
                                : optimizedInitialFrame
                                    ? JSON.stringify(optimizedInitialFrame, null, 2)
                                    : '';

                            const baseMission = shot.mission ?? '';
                            const optMission = optimizedShot?.mission;
                            const missionVal = mode === 'revision' ? baseMission : (shot.mission ?? optMission ?? '');

                            const baseVisual = shot.visual_changes ?? '';
                            const optVisual = optimizedShot?.visual_changes;
                            const visualVal = mode === 'revision' ? baseVisual : (shot.visual_changes ?? optVisual ?? '');

                            const baseAudio = shot.audio ?? '';
                            const optAudio = optimizedShot?.audio;
                            const audioVal = mode === 'revision' ? baseAudio : (shot.audio ?? optAudio ?? '');

                            const baseCamera = shot.camera ?? '';
                            const optCamera = optimizedShot?.camera;
                            const cameraVal = mode === 'revision' ? baseCamera : (shot.camera ?? optCamera ?? '');

                            const baseBeat = shot.beat ?? '';
                            const optBeat = optimizedShot?.beat ?? '';
                            const beatVal = mode === 'revision' ? baseBeat : (shot.beat ?? optBeat ?? '');

                            const baseViral = shot.viral_element ?? '';
                            const optViral = optimizedShot?.viral_element ?? '';
                            const viralVal = mode === 'revision' ? baseViral : (shot.viral_element ?? optViral ?? '');

                            const baseEmotion = shot.emotion ?? '';
                            const optEmotion = optimizedShot?.emotion ?? '';
                            const emotionVal = mode === 'revision' ? baseEmotion : (shot.emotion ?? optEmotion ?? '');

                            const baseLogic = shot.logic_mapping ?? '';
                            const optLogic = optimizedShot?.logic_mapping ?? '';
                            const logicVal = mode === 'revision' ? baseLogic : (shot.logic_mapping ?? optLogic ?? '');

                            const originalModificationInfo = shot.modification_info;
                            const optimizedModificationInfo = optimizedShot?.modification_info;
                            const modificationInfo = originalModificationInfo ?? optimizedModificationInfo;
                            const hasOriginalMod = !!originalModificationInfo;
                            const hasOptimizedMod = !!optimizedModificationInfo;
                            const modIsDiff = hasOriginalMod && hasOptimizedMod && JSON.stringify(originalModificationInfo) !== JSON.stringify(optimizedModificationInfo);
                            let modBadgeClass = 'border-amber-400/50 bg-amber-500/10';
                            if (!hasOriginalMod && hasOptimizedMod) {
                                modBadgeClass = 'border-blue-400/50 bg-blue-500/10';
                            } else if (modIsDiff) {
                                modBadgeClass = 'border-red-400/50 bg-red-500/10';
                            }

                            // Determine border color based on modification
                            let borderColor = "border-white/10";
                            let glowColor = "";

                            if (mode === 'revision') {
                                if (modType === 'delete') {
                                    borderColor = "border-red-500/30";
                                    glowColor = "shadow-red-500/5";
                                } else if (modType === 'add') {
                                    borderColor = "border-green-500/30";
                                    glowColor = "shadow-green-500/5";
                                } else if (modType === 'modify') {
                                    borderColor = "border-amber-500/30";
                                    glowColor = "shadow-amber-500/5";
                                }
                            }

                            const preferredKeyframe = shot.keyframe && frameNameSet.has(shot.keyframe) ? shot.keyframe : null;
                            const frameName =
                                preferredKeyframe ||
                                (shot.original_id ? frameMap.get(shot.original_id) : undefined) ||
                                frameMap.get(shot.id ?? index + 1) ||
                                null;
                            const frameUrl =
                                workspaceSlug && frameName
                                    ? `${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/frames/${frameName}`
                                    : null;
                            const clipFromAssets =
                                workspaceSlug &&
                                ((shot.keyframe ? clipMap.get(shot.keyframe) : undefined) ||
                                    (shot.original_id ? clipMap.get(`ordinal-${shot.original_id}`) : undefined) ||
                                    clipMap.get(`ordinal-${shot.id ?? index + 1}`));
                            const clipUrl =
                                workspaceSlug && clipFromAssets
                                    ? `${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/videos/${clipFromAssets}`
                                    : null;

                            return (
                                <div
                                    key={index}
                                    id={`shot-${index}`}
                                    className={`relative group p-8 rounded-[2.5rem] border ${borderColor} bg-white/5 backdrop-blur-2xl transition-all duration-500 hover:border-white/20 shadow-2xl ${glowColor}`}
                                >
                                    {/* Glass Reflection Effect */}
                                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-50 rounded-[2.5rem] pointer-events-none" />

                                    {/* Header: Shot Number & Duration */}
                                    <div className="relative z-10 flex items-center justify-between mb-8">
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <div className="px-4 py-1.5 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-500/25 via-cyan-500/20 to-purple-500/25 text-white/90 border border-white/20 shadow-sm">
                                                SHOT {shotId}
                                            </div>
                                            <div className="relative">
                                                <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/10 tracking-tighter">
                                                    {String(index + 1).padStart(2, '0')}
                                                </span>
                                                <div className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full opacity-50 blur-sm" />
                                            </div>
                                        </div>

                                        {shot.timestamp && (
                                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                                <Clock size={14} />
                                                <span className="font-mono">{shot.timestamp}</span>
                                                {shot.end_time && <span className="font-mono">— {shot.end_time}</span>}
                                                {shot.duration && <span className="ml-2 px-2 py-0.5 rounded-full bg-white/5 text-xs">({shot.duration}s)</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Grid Layout for Shot Details */}
                                    <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-6">
                                        {/* Left Column: Video/Frame Display (1/4 width = 25%) */}
                                        <div className="space-y-3">
                                            {clipUrl ? (
                                                <VideoPlayer
                                                    src={clipUrl}
                                                    volume={globalVolume}
                                                    muted={isGlobalMuted}
                                                    className="w-full"
                                                    aspectRatio="aspect-[9/16]"
                                                />
                                            ) : frameUrl ? (
                                                <div className="relative aspect-[9/16] bg-slate-900 rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-lg">
                                                    <img
                                                        src={frameUrl}
                                                        alt={`Shot ${index + 1} frame`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <div className="relative aspect-[9/16] bg-slate-900/50 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-sm">
                                                    No media
                                                </div>
                                            )}
                                        </div>

                                        {/* Right Column: All Content Fields (3/4 width = 75%) */}
                                        <div className="md:col-span-3 space-y-6">
                                            {modificationInfo && (
                                                <div className={`p-4 rounded-2xl text-sm border ${modBadgeClass} space-y-2`}>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Sparkles size={16} className="text-amber-300" />
                                                        <span className="text-[var(--color-text-primary)] font-semibold text-xs uppercase">优化概述</span>
                                                        {modificationInfo.type && (
                                                            <span className={`px-2 py-0.5 rounded-full border ${modTypeClass(modificationInfo.type)}`}>
                                                                {modificationInfo.type}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {modificationInfo.reason && (
                                                        <div className="text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
                                                            {modificationInfo.reason}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Mission */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400/80 pl-1">
                                                    <span>任务 / 目标</span>
                                                    {renderAnnotationControl(`shot-${shot.id ?? index}-mission`, `Shot #${shot.id ?? index + 1} Mission`)}
                                                </div>
                                                {renderFieldWithRevision(
                                                    <textarea
                                                        value={missionVal}
                                                        onChange={(e) =>
                                                            mutateRound2((draft) => {
                                                                const list = draft.shots ? [...draft.shots] : [];
                                                                list[index] = { ...(list[index] || {}), mission: e.target.value };
                                                                draft.shots = list;
                                                            })
                                                        }
                                                        readOnly={!canEdit}
                                                        className="w-full p-4 rounded-xl bg-black/5 border border-black/10 text-slate-700 leading-relaxed hover:bg-black/10 transition-colors focus:outline-none focus:border-blue-500/30 min-h-[80px] placeholder:text-slate-400"
                                                        placeholder="未定义任务"
                                                    />,
                                                    '任务 / 目标',
                                                    baseMission,
                                                    optMission,
                                                )}
                                            </div>

                                            {/* Initial Frame Details */}
                                            {structuredFrameOriginal || structuredFrameOptimized ? (
                                                <div className="space-y-3 pb-4 border-b border-white/5">
                                                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-600 pl-1">
                                                        <span>初始帧设定 / Initial Frame</span>
                                                        {renderAnnotationControl(`shot-${shot.id ?? index}-initial`, `Shot #${shot.id ?? index + 1} Initial Frame`)}
                                                    </div>
                                                    {structuredFrameOriginal && (
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-black/5 border border-black/10 text-sm text-slate-700">
                                                            {/* Foreground */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                                                    <Users size={12} className="text-blue-500" />
                                                                    前景 / Foreground
                                                                </div>
                                                                <div className="space-y-1 pl-2 border-l-2 border-blue-500/20">
                                                                    {Array.isArray(structuredFrameOriginal.foreground?.characters) && structuredFrameOriginal.foreground.characters.length > 0 ? (
                                                                        structuredFrameOriginal.foreground.characters.map((char, idx) => (
                                                                            <div key={idx} className="text-xs">
                                                                                {typeof char === 'string' ? (
                                                                                    <span className="text-slate-800">{char}</span>
                                                                                ) : (
                                                                                    <>
                                                                                        <span className="font-medium text-slate-800">{char.tag}</span>
                                                                                        {char.pose && ` · ${char.pose}`}
                                                                                        {char.expression && ` · ${char.expression}`}
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-slate-400 italic">无角色</div>
                                                                    )}
                                                                    {Array.isArray(structuredFrameOriginal.foreground?.objects) && structuredFrameOriginal.foreground.objects.length > 0 ? (
                                                                        structuredFrameOriginal.foreground.objects.map((obj, idx) => (
                                                                            <div key={idx} className="text-xs text-slate-600">• {obj}</div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-slate-400 italic">无道具</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Midground */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                                                    <Layers size={12} className="text-purple-500" />
                                                                    中景 / Midground
                                                                </div>
                                                                <div className="space-y-1 pl-2 border-l-2 border-purple-500/20">
                                                                    {Array.isArray(structuredFrameOriginal.midground?.characters) && structuredFrameOriginal.midground.characters.length > 0 ? (
                                                                        structuredFrameOriginal.midground.characters.map((char, idx) => (
                                                                            <div key={idx} className="text-xs">
                                                                                {typeof char === 'string' ? char : char.tag || '-'}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-slate-400 italic">无角色</div>
                                                                    )}
                                                                    {Array.isArray(structuredFrameOriginal.midground?.objects) && structuredFrameOriginal.midground.objects.length > 0 ? (
                                                                        structuredFrameOriginal.midground.objects.map((obj, idx) => (
                                                                            <div key={idx} className="text-xs text-slate-600">• {obj}</div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-slate-400 italic">无道具</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Background */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                                                    <ImageIcon size={12} className="text-pink-500" />
                                                                    背景 / Background
                                                                </div>
                                                                <div className="space-y-1 pl-2 border-l-2 border-pink-500/20">
                                                                    <div className="text-xs"><span className="text-slate-500">环境:</span> {structuredFrameOriginal.background?.environment || '-'}</div>
                                                                    <div className="text-xs"><span className="text-slate-500">景深:</span> {structuredFrameOriginal.background?.depth || '-'}</div>
                                                                </div>
                                                            </div>

                                                            {/* Lighting & Palette */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                                                    <Sun size={12} className="text-amber-500" />
                                                                    光影与色调 / Lighting & Palette
                                                                </div>
                                                                <div className="space-y-1 pl-2 border-l-2 border-amber-500/20">
                                                                    <div className="flex items-center gap-1 text-xs">
                                                                        <span className="text-slate-500">光照:</span>
                                                                        <span>{structuredFrameOriginal.lighting || '-'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-xs">
                                                                        <Palette size={10} className="text-slate-400" />
                                                                        <span className="text-slate-500">色调:</span>
                                                                        <span>{structuredFrameOriginal.color_palette || '-'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                    {structuredFrameOptimized && (!structuredFrameOriginal || JSON.stringify(structuredFrameOriginal) !== JSON.stringify(structuredFrameOptimized)) && (
                                                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl text-sm ${structuredFrameOriginal ? 'bg-red-500/5 border border-red-400/30' : 'bg-blue-500/5 border border-blue-400/30'}`}>
                                                            {/* Foreground */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                                                    <Users size={12} className="text-blue-400" />
                                                                    优化前景
                                                                </div>
                                                                <div className="space-y-1 pl-2 border-l-2 border-blue-400/30">
                                                                    {Array.isArray(structuredFrameOptimized.foreground?.characters) && structuredFrameOptimized.foreground.characters.length > 0 ? (
                                                                        structuredFrameOptimized.foreground.characters.map((char, idx) => (
                                                                            <div key={idx} className="text-xs text-slate-800">
                                                                                {typeof char === 'string' ? char : [char.tag, char.pose, char.expression].filter(Boolean).join(' · ')}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-slate-500 italic">无角色</div>
                                                                    )}
                                                                    {Array.isArray(structuredFrameOptimized.foreground?.objects) && structuredFrameOptimized.foreground.objects.length > 0 ? (
                                                                        structuredFrameOptimized.foreground.objects.map((obj, idx) => (
                                                                            <div key={idx} className="text-xs text-slate-700">• {obj}</div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-slate-500 italic">无道具</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Midground */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                                                    <Layers size={12} className="text-purple-400" />
                                                                    优化中景
                                                                </div>
                                                                <div className="space-y-1 pl-2 border-l-2 border-purple-400/30">
                                                                    {Array.isArray(structuredFrameOptimized.midground?.characters) && structuredFrameOptimized.midground.characters.length > 0 ? (
                                                                        structuredFrameOptimized.midground.characters.map((char, idx) => (
                                                                            <div key={idx} className="text-xs text-slate-800">
                                                                                {typeof char === 'string' ? char : char.tag || '-'}
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-slate-500 italic">无角色</div>
                                                                    )}
                                                                    {Array.isArray(structuredFrameOptimized.midground?.objects) && structuredFrameOptimized.midground.objects.length > 0 ? (
                                                                        structuredFrameOptimized.midground.objects.map((obj, idx) => (
                                                                            <div key={idx} className="text-xs text-slate-700">• {obj}</div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="text-xs text-slate-500 italic">无道具</div>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Background */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                                                    <ImageIcon size={12} className="text-pink-400" />
                                                                    优化背景
                                                                </div>
                                                                <div className="space-y-1 pl-2 border-l-2 border-pink-400/30">
                                                                    <div className="text-xs text-slate-800"><span className="text-slate-500">环境:</span> {structuredFrameOptimized.background?.environment || '-'}</div>
                                                                    <div className="text-xs text-slate-800"><span className="text-slate-500">景深:</span> {structuredFrameOptimized.background?.depth || '-'}</div>
                                                                </div>
                                                            </div>

                                                            {/* Lighting & Palette */}
                                                            <div className="space-y-2">
                                                                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                                                    <Sun size={12} className="text-amber-400" />
                                                                    优化光影/色调
                                                                </div>
                                                                <div className="space-y-1 pl-2 border-l-2 border-amber-400/30">
                                                                    <div className="flex items-center gap-1 text-xs text-slate-800">
                                                                        <span className="text-slate-500">光照:</span>
                                                                        <span>{structuredFrameOptimized.lighting || '-'}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1 text-xs text-slate-800">
                                                                        <Palette size={10} className="text-slate-400" />
                                                                        <span className="text-slate-500">色调:</span>
                                                                        <span>{structuredFrameOptimized.color_palette || '-'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : initialFrameText || initialFrameTextOptimized ? (
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 pl-1">
                                                        <ImageIcon size={12} className="text-blue-500" />
                                                        <span>首帧描述</span>
                                                        {renderAnnotationControl(`shot-${shot.id ?? index}-initial`, `Shot #${shot.id ?? index + 1} Initial Frame`)}
                                                    </div>
                                                    {renderFieldWithRevision(
                                                        <textarea
                                                            value={initialFrameText}
                                                            onChange={(e) =>
                                                                mutateRound2((draft) => {
                                                                    const list = draft.shots ? [...draft.shots] : [];
                                                                    list[index] = { ...(list[index] || {}), initial_frame: e.target.value };
                                                                    draft.shots = list;
                                                                })
                                                            }
                                                            readOnly={!canEdit}
                                                            className="w-full p-4 rounded-xl bg-black/5 border border-black/10 text-slate-700 leading-relaxed hover:bg-black/10 transition-colors focus:outline-none focus:border-blue-500/30 min-h-[80px] placeholder:text-slate-400"
                                                            placeholder="首帧描述..."
                                                        />,
                                                        '首帧描述',
                                                        initialFrameText,
                                                        initialFrameTextOptimized,
                                                    )}
                                                </div>
                                            ) : null}

                                            {/* Visual - Full Width */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400/80 pl-1">
                                                    <span>视频描述</span>
                                                    {renderAnnotationControl(`shot-${shot.id ?? index}-visual`, `Shot #${shot.id ?? index + 1} Visual`)}
                                                </div>
                                                {renderFieldWithRevision(
                                                    <textarea
                                                        value={visualVal}
                                                        onChange={(e) =>
                                                            mutateRound2((draft) => {
                                                                const list = draft.shots ? [...draft.shots] : [];
                                                                list[index] = { ...(list[index] || {}), visual_changes: e.target.value };
                                                                draft.shots = list;
                                                            })
                                                        }
                                                        readOnly={!canEdit}
                                                        className="w-full p-4 rounded-xl bg-black/5 border border-black/10 text-slate-700 leading-relaxed hover:bg-black/10 transition-colors focus:outline-none focus:border-purple-500/30 min-h-[100px] placeholder:text-slate-400"
                                                        placeholder="画面描述..."
                                                    />,
                                                    '视频描述',
                                                    baseVisual,
                                                    optVisual
                                                )}
                                            </div>

                                            {/* Audio & Camera side by side on desktop */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-pink-400/80 pl-1">
                                                        <span>音频 / 对白</span>
                                                        {renderAnnotationControl(`shot-${shot.id ?? index}-audio`, `Shot #${shot.id ?? index + 1} Audio`)}
                                                    </div>
                                                    {renderFieldWithRevision(
                                                        <textarea
                                                            value={audioVal}
                                                            onChange={(e) =>
                                                                mutateRound2((draft) => {
                                                                    const list = draft.shots ? [...draft.shots] : [];
                                                                    list[index] = { ...(list[index] || {}), audio: e.target.value };
                                                                    draft.shots = list;
                                                                })
                                                            }
                                                            readOnly={!canEdit}
                                                            className="w-full p-4 rounded-xl bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors min-h-[80px] focus:outline-none focus:border-pink-500/30 placeholder:text-slate-400"
                                                            placeholder="音频..."
                                                        />,
                                                        '音频 / 对白',
                                                        baseAudio,
                                                        optAudio
                                                    )}
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cyan-400/80 pl-1">
                                                        <span>运镜 / 动作</span>
                                                        {renderAnnotationControl(`shot-${shot.id ?? index}-camera`, `Shot #${shot.id ?? index + 1} Camera`)}
                                                    </div>
                                                    {renderFieldWithRevision(
                                                        <textarea
                                                            value={cameraVal}
                                                            onChange={(e) =>
                                                                mutateRound2((draft) => {
                                                                    const list = draft.shots ? [...draft.shots] : [];
                                                                    list[index] = { ...(list[index] || {}), camera: e.target.value };
                                                                    draft.shots = list;
                                                                })
                                                            }
                                                            readOnly={!canEdit}
                                                            className="w-full p-4 rounded-xl bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors min-h-[80px] focus:outline-none focus:border-cyan-500/30 placeholder:text-slate-400"
                                                            placeholder="运镜..."
                                                        />,
                                                        '运镜 / 动作',
                                                        baseCamera,
                                                        optCamera
                                                    )}
                                                </div>
                                            </div>

                                            {/* Additional Info Grid */}
                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                                                {/* Beat */}
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 pl-1">
                                                        <Music size={12} className="text-green-500" />
                                                        节拍 / Beat
                                                    </div>
                                                    {renderFieldWithRevision(
                                                        <div className="p-3 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm">
                                                            {beatVal || '-'}
                                                        </div>,
                                                        '节拍 / Beat',
                                                        baseBeat,
                                                        optBeat,
                                                    )}
                                                </div>

                                                {/* Viral Element */}
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 pl-1">
                                                        <Sparkles size={12} className="text-amber-500" />
                                                        病毒元素 / Viral Element
                                                    </div>
                                                    {renderFieldWithRevision(
                                                        <div className="p-3 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm">
                                                            {viralVal || '-'}
                                                        </div>,
                                                        '病毒元素 / Viral Element',
                                                        baseViral,
                                                        optViral,
                                                    )}
                                                </div>

                                                {/* Emotion */}
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 pl-1">
                                                        <Heart size={12} className="text-red-500" />
                                                        情绪 / Emotion
                                                    </div>
                                                    {renderFieldWithRevision(
                                                        <div className="p-3 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm">
                                                            {emotionVal || '-'}
                                                        </div>,
                                                        '情绪 / Emotion',
                                                        baseEmotion,
                                                        optEmotion,
                                                    )}
                                                </div>

                                                {/* Logic Mapping */}
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 pl-1">
                                                        <GitFork size={12} className="text-blue-500" />
                                                        逻辑映射 / Logic Mapping
                                                    </div>
                                                    {renderFieldWithRevision(
                                                        <div className="p-3 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm">
                                                            {logicVal || '-'}
                                                        </div>,
                                                        '逻辑映射 / Logic Mapping',
                                                        baseLogic,
                                                        optLogic,
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {typeof round2Data === 'string' && (
                            <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5">
                                <div className="text-amber-400 text-base font-medium mb-3 flex items-center gap-2">
                                    <AlertCircle size={20} /> JSON 解析失败
                                </div>
                                <pre className="text-sm text-amber-200/70 whitespace-pre-wrap font-mono overflow-x-auto">
                                    {round2Data}
                                </pre>
                            </div>
                        )}
                        {mode === 'revision' && missingModifiedShots.length > 0 && (
                            <div className="glass-card p-5 border border-purple-500/20 bg-[var(--glass-bg-light)]/80 space-y-3">
                                <div className="text-sm font-semibold text-[var(--color-text-primary)]">修订日志中的其他镜头</div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {missingModifiedShots.map((m, idx) => (
                                        <div key={`missing-${m.id}-${idx}`} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--color-bg-secondary)]/50 space-y-2">
                                            <div className="flex items-center justify-between">
                                                <div className="text-sm font-semibold text-[var(--color-text-primary)]">Shot #{m.id}</div>
                                                <span className="text-xs px-2 py-1 rounded-full border border-purple-500/30 text-purple-300 bg-purple-500/10 uppercase">
                                                    {m.action || 'CHANGE'}
                                                </span>
                                            </div>
                                            {m.reason && <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{m.reason}</div>}
                                            {m.changes && Object.keys(m.changes).length > 0 && (
                                                <div className="text-xs text-[var(--color-text-tertiary)]">变更字段: {Object.keys(m.changes).join(', ')}</div>
                                            )}
                                            {m.backup && (
                                                <pre className="text-[11px] whitespace-pre-wrap bg-[var(--glass-bg-light)]/60 p-2 rounded border border-[var(--glass-border)]">
                                                    {JSON.stringify(m.backup, null, 2)}
                                                </pre>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div >
    );
}
