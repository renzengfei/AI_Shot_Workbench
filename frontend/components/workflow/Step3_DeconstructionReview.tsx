'use client';
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import { useWorkspace } from '@/components/WorkspaceContext';
import { parseRound1, parseRound2, parseStoredDeconstruction } from '@/lib/services/deconstruction';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';
import {
    BookOpen,
    GitBranch,
    Zap,
    Users,
    Film,
    AlertCircle,
    Layout,
    Music,
    Anchor,
    Box,
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Maximize,
    Volume2,
    VolumeX,
    ArrowRight,
    RefreshCw,
    Copy as CopyIcon,
    Trash2
} from 'lucide-react';

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
    mission?: string;
    timestamp?: string;
    end_time?: string;
    duration?: string | number;
    keyframe?: string;
    initial_frame?: string | {
        foreground?: string;
        midground?: string;
        background?: string;
        lighting?: string;
        color_palette?: string;
    };
    visual_changes?: string;
    camera?: string;
    audio?: string;
    beat?: string;
    viral_element?: string;
    emotion?: string;
    logic_mapping?: string;
}

interface Round2Data {
    characters?: Record<string, string>;
    shots?: Round2Shot[];
}

type AnnotationMap = Record<string, string>;
interface ModificationLog {
    summary?: string;
    knowledge_base_applied?: string[];
    modified_assets_list?: {
        original?: string;
        replacement?: string;
        reason?: string;
        affected_shots?: number[];
        element_type?: string;
    }[];
    modified_shots?: {
        id?: number;
        action?: string;
        reason?: string;
        knowledge_reference?: string;
        changes?: Record<string, { before?: string; after?: string }>;
        backup?: Record<string, unknown>;
    }[];
    changes?: {
        shot_id?: number;
        action?: string;
        reason?: string;
    }[]; // 兼容旧字段
    statistics?: {
        total_shots_before?: number;
        total_shots_after?: number;
        deleted?: number;
        merged?: number;
        added?: number;
        replaced?: number;
        duration_before?: string;
        duration_after?: string;
        optimization_improvement_estimate?: string;
    };
}

interface OptimizedStoryboardPayload {
    round1?: Round1Data | string | null;
    round2?: Round2Data | string | null;
    metadata?: Record<string, unknown>;
    deconstruction?: {
        skeleton?: Round1Data | Record<string, unknown> | null;
        shots?: Round2Shot[];
    };
}

const VideoPlayer = ({ src, volume, muted }: { src: string; volume: number; muted: boolean }) => {
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
        <div ref={containerRef} className="flex flex-col gap-2 w-full relative">
            {/* Video Area - Matches Image Card Style */}
            <div className="relative aspect-[9/16] bg-transparent rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-lg cursor-pointer group" onClick={togglePlay}>
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
                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] font-mono">
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
                                    className={`text-[10px] px-1.5 py-0.5 rounded transition ${rate === r
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
    const [modificationLog, setModificationLog] = useState<ModificationLog | null>(null);
    const [modLogError, setModLogError] = useState<string | null>(null);
    const [optimizedStoryboard, setOptimizedStoryboard] = useState<OptimizedStoryboardPayload | null>(null);
    const [optimizedError, setOptimizedError] = useState<string | null>(null);

    // Global Volume State
    const [globalVolume, setGlobalVolume] = useState(1);
    const [isGlobalMuted, setIsGlobalMuted] = useState(false);
    const canEdit = mode === 'review';
    const allowAnnotations = mode === 'review';
    const modeOptions: { key: ReviewMode; label: string; helper: string }[] = [
        { key: 'review', label: '原片审验', helper: '可编辑 + 批注' },
        { key: 'revision', label: '原片修订', helper: '对照修改记录，纯展示' },
        { key: 'final', label: '全新剧本', helper: '终版剧本纯展示' },
    ];
    const modeSubtitleMap: Record<ReviewMode, string> = {
        review: '确认原片拆解，并可编辑/批注',
        revision: '对照修改记录查看修订版，只读',
        final: '查看终版剧本，只读',
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
    const modifiedShotMap = useMemo(() => {
        const map = new Map<number, ModificationLog['modified_shots'][number]>();
        if (mode !== 'revision') return map;
        (modificationLog?.modified_shots || []).forEach((m) => {
            if (typeof m.id === 'number') map.set(m.id, m);
        });
        // 兼容旧字段 changes/shot_id
        (modificationLog?.changes || []).forEach((c) => {
            if (typeof c.shot_id === 'number' && !map.has(c.shot_id)) {
                map.set(c.shot_id, {
                    id: c.shot_id,
                    action: c.action,
                    reason: c.reason,
                });
            }
        });
        return map;
    }, [mode, modificationLog]);
    const missingModifiedShots = useMemo(() => {
        if (mode !== 'revision') return [];
        const presentIds = new Set<number>();
        if (round2Data && typeof round2Data !== 'string') {
            (round2Data.shots || []).forEach((s) => {
                if (typeof s.id === 'number') presentIds.add(s.id);
            });
        }
        return (modificationLog?.modified_shots || []).filter((m) => typeof m.id === 'number' && !presentIds.has(m.id as number));
    }, [mode, modificationLog, round2Data]);

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

    const loadModLog = useCallback(async () => {
        if (!workspaceSlug) return;
        setModificationLog(null);
        setModLogError(null);
        try {
            const resp = await fetch(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/modification_log.json`, { cache: 'no-store' });
            if (!resp.ok) {
                setModLogError(`未找到 modification_log.json（${resp.status}）`);
                setModificationLog(null);
                return;
            }
            const data = await resp.json();
            setModificationLog(data as ModificationLog);
        } catch (err) {
            console.error('加载 modification_log 失败', err);
            setModLogError('加载 modification_log.json 失败');
            setModificationLog(null);
        }
    }, [workspaceSlug]);

    const loadOptimized = useCallback(async () => {
        if (!workspaceSlug) return;
        setOptimizedStoryboard(null);
        setOptimizedError(null);
        try {
            const resp = await fetch(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/optimized_storyboard.json`, { cache: 'no-store' });
            if (!resp.ok) {
                setOptimizedError(`未找到 optimized_storyboard.json（${resp.status}）`);
                setOptimizedStoryboard(null);
                return;
            }
            const data = await resp.json();
            setOptimizedStoryboard({
                round1: (data as OptimizedStoryboardPayload).round1 ?? null,
                round2: (data as OptimizedStoryboardPayload).round2 ?? null,
            });
        } catch (err) {
            console.error('加载 optimized_storyboard 失败', err);
            setOptimizedError('加载 optimized_storyboard.json 失败');
            setOptimizedStoryboard(null);
        }
    }, [workspaceSlug]);

    useEffect(() => {
        loadModLog();
        loadOptimized();
    }, [loadModLog, loadOptimized]);

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
                    className={`annotation-btn text-[10px] px-2 py-0.5 rounded border transition ${value ? 'border-blue-500/40 text-blue-400 bg-blue-500/10' : 'border-[var(--glass-border)] text-[var(--color-text-tertiary)]'}`}
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
        change?: { before?: string; after?: string },
    ) => {
        if (!change || (!change.after && !change.before) || mode !== 'revision') return originalNode;
        return (
            <div className="space-y-2">
                <div>{originalNode}</div>
                {change.after && (
                    <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-3 text-sm text-[var(--color-text-primary)]">
                        <div className="text-[10px] uppercase text-emerald-300 mb-1">修订后</div>
                        <div className="whitespace-pre-wrap leading-relaxed">{change.after}</div>
                    </div>
                )}
                {!change.after && change.before && (
                    <div className="text-[10px] text-[var(--color-text-tertiary)]">修订日志未提供 after 内容</div>
                )}
            </div>
        );
    };

    useEffect(() => {
        if (mode === 'final') {
            if (optimizedStoryboard) {
                const mapOptimized = (data: OptimizedStoryboardPayload) => {
                    if (data.round1 || data.round2) {
                        return {
                            r1: data.round1 ?? null,
                            r2: data.round2 ?? null,
                        };
                    }
                    if (data.deconstruction) {
                        const skeleton = data.deconstruction.skeleton ?? null;
                        const shots = data.deconstruction.shots ?? null;
                        return {
                            r1: skeleton ? (skeleton as Round1Data) : null,
                            r2: shots ? ({ shots } as Round2Data) : null,
                        };
                    }
                    return { r1: null, r2: null };
                };

                const mapped = mapOptimized(optimizedStoryboard);
                setRound1Data(mapped.r1 as Round1Data);
                setRound2Data(mapped.r2 as Round2Data);
                setRound1Error(optimizedError);
                setRound2Error(optimizedError);
                setRound1Text(mapped.r1 ? (typeof mapped.r1 === 'string' ? mapped.r1 : JSON.stringify(mapped.r1, null, 2)) : '');
                setRound2Text(mapped.r2 ? (typeof mapped.r2 === 'string' ? mapped.r2 : JSON.stringify(mapped.r2, null, 2)) : '');
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
    }, [mode, optimizedStoryboard, optimizedError, project?.deconstructionText]);

    useEffect(() => {
        if (mode === 'revision') {
            loadModLog();
        } else if (mode === 'final') {
            loadOptimized();
        }
    }, [mode, loadModLog, loadOptimized]);

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

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            {/* Header */}
            <div className="glass-card p-4 flex items-center justify-between border-b-4 border-b-blue-500/20">
                <div className="flex items-center gap-6">
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                            剧本重构
                        </h2>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                            {modeSubtitleMap[mode]}
                        </p>
                        <div className="flex items-center gap-1 bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-full p-1 w-fit">
                            {modeOptions.map((opt) => (
                                <button
                                    key={opt.key}
                                    onClick={() => setMode(opt.key)}
                                    className={`px-3 py-1 rounded-full text-xs transition ${mode === opt.key
                                        ? 'bg-blue-500 text-white shadow-sm'
                                        : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                        }`}
                                >
                                    <div className="flex flex-col leading-tight items-center">
                                        <span className="font-semibold">{opt.label}</span>
                                        <span className="text-[10px] opacity-70">{opt.helper}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Global Volume Control */}
                    <div className="flex items-center gap-3 bg-[var(--color-bg-secondary)]/50 px-4 py-2 rounded-full border border-[var(--glass-border)]">
                        <span className="text-xs font-medium text-[var(--color-text-tertiary)]">全局音量</span>
                        <button onClick={toggleGlobalMute} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                            {isGlobalMuted || globalVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.1}
                            value={isGlobalMuted ? 0 : globalVolume}
                            onChange={handleGlobalVolumeChange}
                            className="w-24 h-1 bg-[var(--color-bg-secondary)] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                        />
                    </div>
                </div>

                <div className="text-xs flex items-center gap-2">
                    {canEdit ? (
                        <>
                            <span className="text-[var(--color-text-tertiary)]">自动保存</span>
                            {savingState === 'saving' && <span className="px-2 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">保存中…</span>}
                            {savingState === 'saved' && <span className="px-2 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">已保存</span>}
                            {savingState === 'error' && <span className="px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">保存失败</span>}
                            {savingState === 'idle' && <span className="px-2 py-1 rounded-full bg-white/5 text-[var(--color-text-tertiary)] border border-[var(--glass-border)]">待编辑</span>}
                        </>
                    ) : (
                        <span className="px-2 py-1 rounded-full bg-[var(--color-bg-secondary)]/60 text-[var(--color-text-secondary)] border border-[var(--glass-border)]">
                            当前模式为只读
                        </span>
                    )}

                    {mode === 'review' && (
                        <>
                            <div className="w-px h-4 bg-[var(--glass-border)] mx-2" />
                            <button
                                onClick={handleCopyPrompt}
                                disabled={promptCopyStatus === 'loading' || !deconstructionPath || promptCopyStatus === 'error'}
                                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[var(--color-text-secondary)] transition-colors ${promptCopyStatus === 'copied'
                                    ? 'border-green-500/50 text-green-400'
                                    : 'border-[var(--glass-border)] hover:text-[var(--color-text-primary)] hover:border-blue-500/30'
                                    } ${!deconstructionPath ? 'opacity-60 cursor-not-allowed' : ''}`}
                                title={deconstructionPath ? `自动填入: ${deconstructionPath}` : '未选择工作空间'}
                            >
                                <CopyIcon size={14} />
                                {promptCopyStatus === 'loading'
                                    ? '加载提示词...'
                                    : promptCopyStatus === 'copied'
                                        ? '已复制提示词'
                                        : '复制剧本优化提示词'}
                            </button>
                        </>
                    )}
                    {mode === 'revision' && (
                        <>
                            <div className="w-px h-4 bg-[var(--glass-border)] mx-2" />
                            <button
                                onClick={loadModLog}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-blue-500/30 transition-colors"
                            >
                                <RefreshCw size={14} />
                                刷新修订数据
                            </button>
                        </>
                    )}

                    {allowAnnotations && (
                        <>
                            <div className="w-px h-4 bg-[var(--glass-border)] mx-2" />

                            <button
                                onClick={copyAllAnnotations}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[var(--glass-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-blue-500/30 transition-colors"
                            >
                                <CopyIcon size={14} />
                                {copyStatus === 'copied' ? '已复制批注' : copyStatus === 'empty' ? '无批注可复制' : '复制批注'}
                            </button>
                        </>
                    )}

                    <div className="w-px h-4 bg-[var(--glass-border)] mx-2" />

                    <button
                        onClick={nextStep}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-2"
                    >
                        下一步：分镜优化
                        <ArrowRight size={16} />
                    </button>
                </div>
            </div>

            {mode === 'revision' && (
                <div className="glass-card p-5 border border-blue-500/20 bg-[var(--glass-bg-light)] space-y-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                            <div className="text-sm font-semibold text-[var(--color-text-primary)]">修订摘要</div>
                            <p className="text-sm text-[var(--color-text-secondary)]">
                                {modificationLog?.summary || modLogError || '未找到 modification_log.json'}
                            </p>
                        </div>
                        {modificationLog?.statistics && (
                            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-secondary)]">
                                <div className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                    <div className="text-[10px] uppercase tracking-wide">镜头数</div>
                                    <div className="font-semibold text-[var(--color-text-primary)]">
                                        {modificationLog.statistics.total_shots_before} → {modificationLog.statistics.total_shots_after}
                                    </div>
                                </div>
                                <div className="px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                                    <div className="text-[10px] uppercase tracking-wide">删除</div>
                                    <div className="font-semibold text-[var(--color-text-primary)]">
                                        {modificationLog.statistics.deleted ?? 0} 个镜头
                                    </div>
                                </div>
                                {typeof modificationLog.statistics.merged === 'number' && (
                                    <div className="px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                        <div className="text-[10px] uppercase tracking-wide">合并</div>
                                        <div className="font-semibold text-[var(--color-text-primary)]">
                                            {modificationLog.statistics.merged}
                                        </div>
                                    </div>
                                )}
                                {typeof modificationLog.statistics.added === 'number' && (
                                    <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                        <div className="text-[10px] uppercase tracking-wide">新增</div>
                                        <div className="font-semibold text-[var(--color-text-primary)]">
                                            {modificationLog.statistics.added}
                                        </div>
                                    </div>
                                )}
                                {typeof modificationLog.statistics.replaced === 'number' && (
                                    <div className="px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                        <div className="text-[10px] uppercase tracking-wide">替换</div>
                                        <div className="font-semibold text-[var(--color-text-primary)]">
                                            {modificationLog.statistics.replaced}
                                        </div>
                                    </div>
                                )}
                                {modificationLog.statistics.optimization_improvement_estimate && (
                                    <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 col-span-2">
                                        <div className="text-[10px] uppercase tracking-wide">提升</div>
                                        <div className="font-semibold text-[var(--color-text-primary)]">
                                            {modificationLog.statistics.optimization_improvement_estimate}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {modificationLog?.knowledge_base_applied && modificationLog.knowledge_base_applied.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {modificationLog.knowledge_base_applied.map((k) => (
                                <span key={k} className="px-2 py-1 rounded-full text-[10px] bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                    {k}
                                </span>
                            ))}
                        </div>
                    )}

                    {modificationLog?.modified_assets_list && modificationLog.modified_assets_list.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-[var(--color-text-primary)]">元素替换</div>
                            <div className="grid gap-3 md:grid-cols-2">
                                {modificationLog.modified_assets_list.map((item, idx) => (
                                    <div key={`${item.original}-${idx}`} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--color-bg-secondary)]/40 space-y-1">
                                        <div className="text-sm text-[var(--color-text-primary)]">
                                            {item.original} → <span className="text-blue-400">{item.replacement}</span>
                                        </div>
                                        {item.element_type && <div className="text-[10px] text-amber-300 uppercase">{item.element_type}</div>}
                                        {item.reason && <div className="text-xs text-[var(--color-text-secondary)]">{item.reason}</div>}
                                        {item.affected_shots && item.affected_shots.length > 0 && (
                                            <div className="text-[10px] text-[var(--color-text-tertiary)]">影响镜头: {item.affected_shots.join(', ')}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {modificationLog?.changes && modificationLog.changes.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-[var(--color-text-primary)]">镜头操作</div>
                            <div className="grid gap-2 md:grid-cols-2">
                                {modificationLog.changes.map((c, idx) => (
                                    <div key={`${c.shot_id}-${idx}`} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--color-bg-secondary)]/40 flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="text-sm text-[var(--color-text-primary)]">Shot #{c.shot_id}</div>
                                            {c.reason && <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{c.reason}</div>}
                                        </div>
                                        <span className="px-2 py-1 text-[10px] rounded-full border border-red-500/30 text-red-300 bg-red-500/10 uppercase">{c.action}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {modificationLog?.modified_shots && modificationLog.modified_shots.length > 0 && (
                        <div className="space-y-3">
                            <div className="text-xs font-semibold text-[var(--color-text-primary)]">镜头变更详情</div>
                            <div className="grid gap-3">
                                {modificationLog.modified_shots.map((m, idx) => (
                                    <div key={`${m.id}-${idx}`} className="p-4 rounded-lg border border-[var(--glass-border)] bg-[var(--color-bg-secondary)]/40 space-y-2">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <div className="text-sm text-[var(--color-text-primary)] font-semibold">Shot #{m.id}</div>
                                                {m.reason && <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed mt-1">{m.reason}</div>}
                                                {m.knowledge_reference && (
                                                    <div className="text-[10px] text-blue-300 mt-1">依据: {m.knowledge_reference}</div>
                                                )}
                                            </div>
                                            <span className="px-2 py-1 text-[10px] rounded-full border border-purple-500/30 text-purple-300 bg-purple-500/10 uppercase">
                                                {m.action || 'CHANGE'}
                                            </span>
                                        </div>
                                        {m.changes && Object.keys(m.changes).length > 0 && (
                                            <div className="grid gap-2 md:grid-cols-2">
                                                {Object.entries(m.changes).map(([field, diff]) => (
                                                    <div key={field} className="p-2 rounded border border-[var(--glass-border)] bg-[var(--glass-bg-light)]/50 text-xs space-y-1">
                                                        <div className="font-semibold text-[var(--color-text-primary)]">{field}</div>
                                                        {diff.before && (
                                                            <div className="text-[var(--color-text-tertiary)]">前: <span className="text-[var(--color-text-secondary)]">{diff.before}</span></div>
                                                        )}
                                                        {diff.after && (
                                                            <div className="text-[var(--color-text-tertiary)]">后: <span className="text-[var(--color-text-primary)]">{diff.after}</span></div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {m.backup && (
                                            <div className="text-[10px] text-[var(--color-text-tertiary)]">备份: {JSON.stringify(m.backup)}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Round 1 Section - Bento Grid Layout */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                        <Box className="w-5 h-5 text-blue-500" />
                        Round 1: 宏观骨架 & 钩子
                    </h3>
                    {round1Error && (
                        <span className="text-xs text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                            <AlertCircle size={12} /> 解析错误
                        </span>
                    )}
                </div>

                {/* Macro Optimization Analysis (Round 1 Log) */}
                {mode === 'revision' && modificationLog && (
                    <div className="glass-card p-5 border-l-4 border-l-emerald-500/50 bg-emerald-500/5 space-y-4">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <Zap size={18} />
                            <span className="font-bold text-base">宏观优化分析 (Macro Analysis)</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: Summary & Stats */}
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">优化摘要</div>
                                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed bg-[var(--glass-bg-light)]/50 p-3 rounded-lg border border-[var(--glass-border)]">
                                        {modificationLog.summary || '无摘要'}
                                    </p>
                                </div>

                                {modificationLog.statistics && (
                                    <div className="grid grid-cols-3 gap-2">
                                        <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-center">
                                            <div className="text-[10px] text-emerald-400/70 uppercase">潜力提升</div>
                                            <div className="text-sm font-bold text-emerald-400">{modificationLog.statistics.optimization_improvement_estimate || '-'}</div>
                                        </div>
                                        <div className="p-2 rounded bg-blue-500/10 border border-blue-500/20 text-center">
                                            <div className="text-[10px] text-blue-400/70 uppercase">镜头压缩</div>
                                            <div className="text-sm font-bold text-blue-400">
                                                {modificationLog.statistics.total_shots_before} → {modificationLog.statistics.total_shots_after}
                                            </div>
                                        </div>
                                        <div className="p-2 rounded bg-purple-500/10 border border-purple-500/20 text-center">
                                            <div className="text-[10px] text-purple-400/70 uppercase">时长优化</div>
                                            <div className="text-sm font-bold text-purple-400">
                                                {modificationLog.statistics.duration_before || '?'} → {modificationLog.statistics.duration_after || '?'}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Knowledge Base & Assets */}
                            <div className="space-y-4">
                                {modificationLog.knowledge_base_applied && modificationLog.knowledge_base_applied.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">应用方法论</div>
                                        <div className="flex flex-wrap gap-2">
                                            {modificationLog.knowledge_base_applied.map((k, i) => (
                                                <span key={i} className="px-2 py-1 rounded text-[10px] bg-blue-500/5 text-blue-300 border border-blue-500/10">
                                                    {k}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {modificationLog.modified_assets_list && modificationLog.modified_assets_list.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">关键元素替换</div>
                                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                                            {modificationLog.modified_assets_list.map((item, idx) => (
                                                <div key={idx} className="text-xs p-2 rounded bg-[var(--glass-bg-light)]/50 border border-[var(--glass-border)] flex flex-col gap-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[var(--color-text-tertiary)] line-through">{item.original}</span>
                                                        <ArrowRight size={10} className="text-[var(--color-text-secondary)]" />
                                                        <span className="text-emerald-400 font-medium">{item.replacement}</span>
                                                    </div>
                                                    {item.reason && <div className="text-[10px] text-[var(--color-text-secondary)] italic">{item.reason}</div>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                    {/* Left Column: Narrative Flow (7/12) */}
                    <div className="xl:col-span-7 space-y-6">
                        {/* Story Summary */}
                        <div className="glass-card p-6 border-l-4 border-l-blue-500/50">
                            <div className="flex items-center gap-2 text-blue-400 mb-4">
                                <BookOpen size={18} />
                                <span className="font-bold text-base">故事概要</span>
                                {renderAnnotationControl('story_summary', '故事概要')}
                            </div>
                            {typeof round1Data === 'string' ? (
                                <p className="text-sm text-[var(--color-text-secondary)]">JSON 解析失败</p>
                            ) : (
                                <textarea
                                    value={round1Data?.round1_skeleton?.story_summary || ''}
                                    onChange={(e) =>
                                        mutateRound1((draft) => {
                                            draft.round1_skeleton = { ...(draft.round1_skeleton || {}), story_summary: e.target.value };
                                        })
                                    }
                                    readOnly={!canEdit}
                                    className="w-full bg-[var(--color-bg-secondary)]/40 border border-[var(--glass-border)] rounded-xl p-4 text-base text-[var(--color-text-primary)] min-h-[140px] focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition leading-relaxed resize-y placeholder:text-[var(--color-text-tertiary)]"
                                    placeholder="输入故事概要..."
                                />
                            )}
                        </div>

                        {/* Logic Chain */}
                        <div className="glass-card p-5 bg-gradient-to-br from-blue-500/5 to-purple-500/5 border border-blue-500/20">
                            <div className="flex items-center gap-2 text-[var(--color-text-primary)] mb-3">
                                <GitBranch size={16} className="text-blue-400" />
                                <span className="font-bold text-sm">底层逻辑链</span>
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
                                className="w-full bg-[var(--glass-bg-light)] border border-[var(--glass-border)] rounded-lg p-3 text-sm text-[var(--color-text-primary)] min-h-[80px] focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition resize-y italic"
                                placeholder="输入逻辑链..."
                            />
                        </div>

                        {/* Skeleton Timeline */}
                        <div className="glass-card p-6 border-l-4 border-l-purple-500/50">
                            <div className="flex items-center gap-2 text-purple-400 mb-6">
                                <Layout size={18} />
                                <span className="font-bold text-base">骨架节点 (Timeline)</span>
                            </div>
                            <div className="space-y-0 relative pl-2">
                                {/* Timeline Line */}
                                <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-gradient-to-b from-purple-500/50 to-transparent" />

                                {typeof round1Data !== 'string' && (round1Data?.round1_skeleton?.skeleton_nodes || []).map((node, idx) => (
                                    <div key={idx} className="relative pl-10 pb-6 last:pb-0 group">
                                        {/* Timeline Dot */}
                                        <div className="absolute left-0 top-3 w-10 h-10 flex items-center justify-center z-10">
                                            <div className="w-8 h-8 rounded-full bg-[var(--glass-bg-light)] border-2 border-purple-500/30 text-purple-400 flex items-center justify-center text-xs font-bold shadow-lg group-hover:scale-110 group-hover:border-purple-500 transition-all">
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
                                            className="w-full bg-[var(--color-bg-secondary)]/40 border border-[var(--glass-border)] rounded-lg p-3 text-sm text-[var(--color-text-primary)] min-h-[60px] focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition resize-y"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Mechanics & Analysis (5/12) */}
                    <div className="xl:col-span-5 space-y-6">
                        {/* Hooks Analysis */}
                        <div className="glass-card p-5 border-t-4 border-t-pink-500/50">
                            <div className="flex items-center gap-2 text-pink-400 mb-4">
                                <Anchor size={16} />
                                <span className="font-bold text-sm">前3秒钩子分析</span>
                                {renderAnnotationControl('hooks', '前3秒钩子分析')}
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <div className="text-xs font-medium text-[var(--color-text-tertiary)] ml-1">视觉钩子</div>
                                    <input
                                        value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.visual_hook || '' : ''}
                                        onChange={(e) =>
                                            mutateRound1((draft) => {
                                                draft.round1_hook = { ...(draft.round1_hook || {}), visual_hook: e.target.value };
                                            })
                                        }
                                        readOnly={!canEdit}
                                        className="w-full bg-[var(--color-bg-secondary)]/40 border border-[var(--glass-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-xs font-medium text-[var(--color-text-tertiary)] ml-1">音频钩子</div>
                                    <input
                                        value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.audio_hook || '' : ''}
                                        onChange={(e) =>
                                            mutateRound1((draft) => {
                                                draft.round1_hook = { ...(draft.round1_hook || {}), audio_hook: e.target.value };
                                            })
                                        }
                                        readOnly={!canEdit}
                                        className="w-full bg-[var(--color-bg-secondary)]/40 border border-[var(--glass-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/20"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="text-xs font-medium text-[var(--color-text-tertiary)] ml-1">留存策略</div>
                                    <textarea
                                        value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.retention_strategy || '' : ''}
                                        onChange={(e) =>
                                            mutateRound1((draft) => {
                                                draft.round1_hook = { ...(draft.round1_hook || {}), retention_strategy: e.target.value };
                                            })
                                        }
                                        readOnly={!canEdit}
                                        className="w-full bg-[var(--color-bg-secondary)]/40 border border-[var(--glass-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-pink-500/40 focus:ring-1 focus:ring-pink-500/20 min-h-[60px] resize-y"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Viral Elements */}
                        <div className="glass-card p-5 border-t-4 border-t-amber-500/50">
                            <div className="flex items-center gap-2 text-amber-400 mb-4">
                                <Zap size={16} />
                                <span className="font-bold text-sm">爆款元素</span>
                                {renderAnnotationControl('viral', '爆款元素')}
                            </div>
                            <div className="space-y-3">
                                {typeof round1Data !== 'string' && (round1Data?.round1_skeleton?.viral_elements_found || []).map((v, idx) => (
                                    <div key={idx} className="bg-[var(--glass-bg-light)] p-3 rounded-lg border border-amber-500/10 space-y-2 hover:border-amber-500/30 transition-colors">
                                        <div className="flex gap-2">
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
                                                className="w-1/3 text-xs font-bold text-amber-400 bg-transparent border-b border-amber-500/20 focus:border-amber-400 focus:outline-none px-1 py-0.5"
                                                placeholder="类别"
                                            />
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
                                                className="w-2/3 text-sm font-bold text-[var(--color-text-primary)] bg-transparent border-b border-[var(--glass-border)] focus:border-amber-400 focus:outline-none px-1 py-0.5"
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
                                            className="w-full text-xs text-[var(--color-text-secondary)] bg-[var(--color-bg-secondary)]/40 rounded p-2 border border-transparent focus:border-amber-500/20 focus:outline-none resize-none min-h-[50px]"
                                            placeholder="详细描述..."
                                        />
                                    </div>
                                ))}
                                {(typeof round1Data === 'string' || !round1Data?.round1_skeleton?.viral_elements_found?.length) && (
                                    <span className="text-xs text-[var(--color-text-tertiary)]">暂无数据</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Round 2 Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
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
                {typeof round2Data !== 'string' && round2Data?.characters && Object.keys(round2Data.characters).length > 0 && (
                    <div className="glass-card p-4 bg-[var(--color-bg-secondary)]/30">
                        <div className="flex items-center gap-2 text-[var(--color-text-primary)] mb-3">
                            <Users size={16} className="text-blue-400" />
                            <span className="text-sm font-semibold">角色库</span>
                            {renderAnnotationControl('characters', '角色库')}
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {Object.entries(round2Data.characters).map(([name, desc]) => (
                                <div key={name} className="flex gap-5 p-5 rounded-xl bg-[var(--glass-bg-light)] border border-[var(--glass-border)] hover:border-blue-500/30 transition-colors group">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20 shrink-0 group-hover:scale-105 transition-transform">
                                        {name[0]}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="text-base font-bold text-[var(--color-text-primary)]">{name}</div>
                                        </div>
                                        <textarea
                                            value={typeof desc === 'string' ? desc : JSON.stringify(desc)}
                                            onChange={(e) =>
                                                mutateRound2((draft) => {
                                                    if (!draft.characters) draft.characters = {};
                                                    draft.characters[name] = e.target.value;
                                                })
                                            }
                                            readOnly={!canEdit}
                                            className="w-full bg-[var(--color-bg-secondary)]/40 border border-[var(--glass-border)] rounded-lg p-3 text-sm text-[var(--color-text-secondary)] min-h-[80px] focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 focus:bg-[var(--color-bg-secondary)]/80 transition-all leading-relaxed placeholder:text-[var(--color-text-tertiary)]"
                                            placeholder="输入角色描述..."
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Shots Grid - Single Column for better visibility */}
                <div className="space-y-6">
                    {typeof round2Data !== 'string' && round2Data?.shots?.map((shot, idx) => {
                        const frameUrl = workspaceSlug && shot.keyframe
                            ? `${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/frames/${shot.keyframe}`
                            : null;
                        const clipFromAssets =
                            workspaceSlug && (shot.keyframe ? clipMap.get(shot.keyframe) : clipMap.get(`ordinal-${shot.id ?? idx + 1}`));
                        const clipUrl =
                            workspaceSlug && clipFromAssets
                                ? `${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/videos/${clipFromAssets}`
                                : null;
                        const mission = shot.mission || '';
                        const shotId = shot.id ?? idx + 1;
                        const modShot = mode === 'revision' ? modifiedShotMap.get(shotId) : undefined;
                        const changeBadges =
                            mode === 'revision'
                                ? (modificationLog?.modified_shots?.filter((c) => c.id === shotId) || modificationLog?.changes?.filter((c) => c.shot_id === shotId) || [])
                                : [];
                        const replacementBadges =
                            mode === 'revision'
                                ? modificationLog?.modified_assets_list?.filter((item) => item.affected_shots?.includes(shotId)) || []
                                : [];
                        const isDeleted = mode === 'revision' && (modShot?.action || '').toUpperCase() === 'DELETE';
                        const getChange = (key: string) =>
                            (modShot?.changes as Record<string, { before?: string; after?: string }> | undefined)?.[key];

                        return (
                            <div key={shot.id || idx} className="glass-card p-0 overflow-visible group hover:border-purple-500/30 transition-all duration-300 relative">
                                <div className="p-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg-light)] flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-bold text-purple-400 bg-purple-500/10 px-3 py-1 rounded-md">Shot #{shotId}</span>
                                        <span className="text-sm text-[var(--color-text-tertiary)] font-mono">{shot.timestamp} - {shot.end_time}</span>
                                    </div>
                                    <div className="flex gap-2 flex-wrap justify-end">
                                        {isDeleted && (
                                            <span className="text-[10px] px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 uppercase">
                                                已删除
                                            </span>
                                        )}
                                        {replacementBadges.map((rep, repIdx) => (
                                            <span key={`rep-${repIdx}`} className="text-[10px] px-2 py-1 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                                替换: {rep.replacement}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {isDeleted && modShot?.backup && (
                                    <div className="px-6 pt-4">
                                        <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/5 text-xs text-[var(--color-text-secondary)]">
                                            <div className="text-red-300 font-semibold mb-1">修订说明</div>
                                            <div className="text-[var(--color-text-secondary)]">该镜头在修订中被删除，原始备份：</div>
                                            <pre className="mt-1 text-[11px] whitespace-pre-wrap bg-[var(--glass-bg-light)]/50 p-2 rounded border border-[var(--glass-border)]">
                                                {JSON.stringify(modShot.backup, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                )}

                                {/* In-Card Optimization Details */}
                                {mode === 'revision' && changeBadges.length > 0 && (
                                    <div className="px-6 pt-4 pb-0">
                                        {changeBadges.map((change, cIdx) => (
                                            <div key={`detail-${cIdx}`} className="p-4 rounded-lg bg-purple-500/5 border border-purple-500/20 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Zap size={14} className="text-purple-400" />
                                                        <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">优化详情</span>
                                                    </div>
                                                    {'knowledge_reference' in change && change.knowledge_reference && (
                                                        <span className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-1 bg-[var(--glass-bg-light)] px-2 py-1 rounded border border-[var(--glass-border)]">
                                                            <BookOpen size={10} />
                                                            {change.knowledge_reference}
                                                        </span>
                                                    )}
                                                </div>

                                                {'reason' in change && change.reason && (
                                                    <div className="text-sm text-[var(--color-text-primary)] leading-relaxed pl-2 border-l-2 border-purple-500/30">
                                                        {change.reason}
                                                    </div>
                                                )}

                                                {'changes' in change && change.changes && Object.keys(change.changes).length > 0 && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                                                        {Object.entries(change.changes).map(([field, diff]) => (
                                                            <div key={field} className="text-xs bg-[var(--glass-bg-light)]/50 p-2 rounded border border-[var(--glass-border)]">
                                                                <div className="font-semibold text-[var(--color-text-secondary)] mb-1 capitalize">{field.replace('_', ' ')}</div>
                                                                <div className="space-y-1">
                                                                    {diff.before && (
                                                                        <div className="flex gap-2 opacity-60">
                                                                            <span className="text-red-400 shrink-0">-</span>
                                                                            <span className="line-through truncate" title={diff.before}>{diff.before}</span>
                                                                        </div>
                                                                    )}
                                                                    {diff.after && (
                                                                        <div className="flex gap-2">
                                                                            <span className="text-emerald-400 shrink-0">+</span>
                                                                            <span className="text-[var(--color-text-primary)]" title={diff.after}>{diff.after}</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="p-6 flex flex-col 2xl:flex-row gap-8">
                                    {/* Media Section - Larger Side by Side */}
                                    <div className="flex shrink-0 gap-6 overflow-x-auto pb-4 2xl:w-[700px]">
                                        <div className="w-[320px] shrink-0 space-y-3">
                                            <div className="text-sm text-[var(--color-text-tertiary)] font-medium text-center">首帧</div>
                                            <div className="aspect-[9/16] bg-transparent rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-lg">
                                                {frameUrl ? (
                                                    <img src={frameUrl} alt={`shot-${shot.id}`} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">无图片</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="w-[320px] shrink-0 space-y-3">
                                            <div className="text-sm text-[var(--color-text-tertiary)] font-medium text-center">片段</div>
                                            {clipUrl ? (
                                                <VideoPlayer src={clipUrl} volume={globalVolume} muted={isGlobalMuted} />
                                            ) : (
                                                <div className="aspect-[9/16] bg-black/60 rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-lg w-full flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">
                                                    无视频
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-5 min-w-0 relative">
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-bold">
                                                <span>使命</span>
                                                {renderAnnotationControl(`shot-${shot.id ?? idx}-mission`, `Shot #${shot.id ?? idx + 1} 使命`)}
                                            </div>
                                            {renderFieldWithRevision(
                                                <input
                                                    value={mission}
                                                    onChange={(e) =>
                                                        mutateRound2((draft) => {
                                                            const list = draft.shots ? [...draft.shots] : [];
                                                            list[idx] = { ...(list[idx] || {}), mission: e.target.value };
                                                            draft.shots = list;
                                                        })
                                                    }
                                                    readOnly={!canEdit}
                                                    className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20"
                                                    placeholder="如：吸睛 - 提示强烈反差或异常"
                                                />,
                                                getChange('mission')
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-bold">
                                                <span>首帧描述</span>
                                                {renderAnnotationControl(`shot-${shot.id ?? idx}-initial_frame`, `Shot #${shot.id ?? idx + 1} 首帧描述`)}
                                            </div>
                                            {typeof shot.initial_frame === 'string' || shot.initial_frame === undefined ? (
                                                renderFieldWithRevision(
                                                    <textarea
                                                        value={typeof shot.initial_frame === 'string' ? shot.initial_frame : ''}
                                                        onChange={(e) =>
                                                            mutateRound2((draft) => {
                                                                const list = draft.shots ? [...draft.shots] : [];
                                                                list[idx] = { ...(list[idx] || {}), initial_frame: e.target.value };
                                                                draft.shots = list;
                                                            })
                                                        }
                                                        readOnly={!canEdit}
                                                        className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-xl p-4 text-base text-[var(--color-text-primary)] min-h-[120px] focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 leading-relaxed"
                                                    />,
                                                    getChange('initial_frame')
                                                )
                                            ) : (
                                                <div className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-xl p-4 text-sm text-[var(--color-text-primary)] space-y-2">
                                                    {shot.initial_frame.foreground && (
                                                        <div>
                                                            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">前景</div>
                                                            <pre className="text-xs whitespace-pre-wrap text-[var(--color-text-primary)] bg-[var(--glass-bg-light)]/60 p-2 rounded border border-[var(--glass-border)]">
                                                                {JSON.stringify(shot.initial_frame.foreground, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {shot.initial_frame.midground && (
                                                        <div>
                                                            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">中景</div>
                                                            <pre className="text-xs whitespace-pre-wrap text-[var(--color-text-primary)] bg-[var(--glass-bg-light)]/60 p-2 rounded border border-[var(--glass-border)]">
                                                                {JSON.stringify(shot.initial_frame.midground, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {shot.initial_frame.background && (
                                                        <div>
                                                            <div className="text-xs text-[var(--color-text-tertiary)] mb-1">背景</div>
                                                            <pre className="text-xs whitespace-pre-wrap text-[var(--color-text-primary)] bg-[var(--glass-bg-light)]/60 p-2 rounded border border-[var(--glass-border)]">
                                                                {JSON.stringify(shot.initial_frame.background, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                    {shot.initial_frame.lighting && (
                                                        <div className="text-xs text-[var(--color-text-secondary)]">
                                                            <span className="font-semibold text-[var(--color-text-tertiary)] mr-1">光线:</span>
                                                            {String(shot.initial_frame.lighting)}
                                                        </div>
                                                    )}
                                                    {shot.initial_frame.color_palette && (
                                                        <div className="text-xs text-[var(--color-text-secondary)]">
                                                            <span className="font-semibold text-[var(--color-text-tertiary)] mr-1">色板:</span>
                                                            {String(shot.initial_frame.color_palette)}
                                                        </div>
                                                    )}
                                                    {!shot.initial_frame.foreground &&
                                                        !shot.initial_frame.midground &&
                                                        !shot.initial_frame.background &&
                                                        !shot.initial_frame.lighting &&
                                                        !shot.initial_frame.color_palette && (
                                                            <div className="text-xs text-[var(--color-text-tertiary)]">无结构化首帧描述</div>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)] uppercase tracking-wider font-bold">
                                                <span>画面变化</span>
                                                {renderAnnotationControl(`shot-${shot.id ?? idx}-visual_changes`, `Shot #${shot.id ?? idx + 1} 画面变化`)}
                                            </div>
                                            {renderFieldWithRevision(
                                                <textarea
                                                    value={shot.visual_changes || ''}
                                                    onChange={(e) =>
                                                        mutateRound2((draft) => {
                                                            const list = draft.shots ? [...draft.shots] : [];
                                                            list[idx] = { ...(list[idx] || {}), visual_changes: e.target.value };
                                                            draft.shots = list;
                                                        })
                                                    }
                                                    readOnly={!canEdit}
                                                    className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-xl p-4 text-base text-[var(--color-text-primary)] min-h-[120px] focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 leading-relaxed"
                                                />,
                                                getChange('visual_changes')
                                            )}
                                        </div>
                                        <div className="pt-5 border-t border-[var(--glass-border)] grid grid-cols-1 sm:grid-cols-2 gap-5">
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] font-medium">
                                                    <span className="flex items-center gap-1.5"><Film size={14} /> 镜头</span>
                                                    {renderAnnotationControl(`shot-${shot.id ?? idx}-camera`, `Shot #${shot.id ?? idx + 1} 镜头`)}
                                                </div>
                                                {renderFieldWithRevision(
                                                    <textarea
                                                        value={shot.camera || ''}
                                                        onChange={(e) =>
                                                            mutateRound2((draft) => {
                                                                const list = draft.shots ? [...draft.shots] : [];
                                                                list[idx] = { ...(list[idx] || {}), camera: e.target.value };
                                                                draft.shots = list;
                                                            })
                                                        }
                                                        readOnly={!canEdit}
                                                        className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 min-h-[60px] resize-y"
                                                        title={shot.camera}
                                                    />,
                                                    getChange('camera')
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] font-medium">
                                                    <span className="flex items-center gap-1.5"><Music size={14} /> 音频</span>
                                                    {renderAnnotationControl(`shot-${shot.id ?? idx}-audio`, `Shot #${shot.id ?? idx + 1} 音频`)}
                                                </div>
                                                {renderFieldWithRevision(
                                                    <textarea
                                                        value={shot.audio || ''}
                                                        onChange={(e) =>
                                                            mutateRound2((draft) => {
                                                                const list = draft.shots ? [...draft.shots] : [];
                                                                list[idx] = { ...(list[idx] || {}), audio: e.target.value };
                                                                draft.shots = list;
                                                            })
                                                        }
                                                        readOnly={!canEdit}
                                                        className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 min-h-[60px] resize-y"
                                                        title={shot.audio}
                                                    />,
                                                    getChange('audio')
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] font-medium">
                                                    <span>节奏/情绪</span>
                                                    {renderAnnotationControl(`shot-${shot.id ?? idx}-emotion`, `Shot #${shot.id ?? idx + 1} 节奏/情绪`)}
                                                </div>
                                                {renderFieldWithRevision(
                                                    <input
                                                        value={shot.emotion || ''}
                                                        onChange={(e) =>
                                                            mutateRound2((draft) => {
                                                                const list = draft.shots ? [...draft.shots] : [];
                                                                list[idx] = { ...(list[idx] || {}), emotion: e.target.value };
                                                                draft.shots = list;
                                                            })
                                                        }
                                                        readOnly={!canEdit}
                                                        className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20"
                                                        title={shot.emotion}
                                                    />,
                                                    getChange('emotion')
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-[10px] text-[var(--color-text-tertiary)] font-medium">
                                                    <span>Beat</span>
                                                    {renderAnnotationControl(`shot-${shot.id ?? idx}-beat`, `Shot #${shot.id ?? idx + 1} Beat`)}
                                                </div>
                                                {renderFieldWithRevision(
                                                    <input
                                                        value={shot.beat || ''}
                                                        onChange={(e) =>
                                                            mutateRound2((draft) => {
                                                                const list = draft.shots ? [...draft.shots] : [];
                                                                list[idx] = { ...(list[idx] || {}), beat: e.target.value };
                                                                draft.shots = list;
                                                            })
                                                        }
                                                        readOnly={!canEdit}
                                                        className="w-full bg-[var(--color-bg-secondary)]/60 border border-[var(--glass-border)] rounded-lg px-3 py-2.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20"
                                                        title={shot.beat}
                                                    />,
                                                    getChange('beat')
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
                                            <span className="text-[10px] px-2 py-1 rounded-full border border-purple-500/30 text-purple-300 bg-purple-500/10 uppercase">
                                                {m.action || 'CHANGE'}
                                            </span>
                                        </div>
                                        {m.reason && <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{m.reason}</div>}
                                        {m.changes && Object.keys(m.changes).length > 0 && (
                                            <div className="text-[10px] text-[var(--color-text-tertiary)]">变更字段: {Object.keys(m.changes).join(', ')}</div>
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
    );
}
