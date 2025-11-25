'use client';
/* eslint-disable @next/next/no-img-element */

import { ChevronLeft, ChevronRight, Edit, Eye, RefreshCw, Plus, Minus, Volume2, VolumeX, Download, AlertCircle, Trash2, X, FileText, Zap, Users, Box, Layout, Film, ArrowRight, Check, Copy, MessageSquare, ClipboardPaste, BookOpen, GitBranch, Anchor } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import { useWorkspace } from '@/components/WorkspaceContext';
import { parseRound1, parseRound2, parseStoredDeconstruction } from '@/lib/services/deconstruction';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';
import { AutoTextArea } from '@/components/ui/AutoTextArea';
import { ShotCard } from '@/components/workflow/ShotCard';
import {
    ReviewMode,
    AssetItem,
    Round1Data,
    Round2Data,
    Round2Shot,
    DeletedShot,
    OptimizedStoryboardPayload
} from '@/types/deconstruction';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

type AnnotationMap = Record<string, string>;

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

    // Compare JSON Feature States
    const [showComparePanel, setShowComparePanel] = useState(false);
    const [compareRound1Text, setCompareRound1Text] = useState('');
    const [compareRound2Text, setCompareRound2Text] = useState('');
    const [compareRound1Error, setCompareRound1Error] = useState<string | null>(null);
    const [compareRound2Error, setCompareRound2Error] = useState<string | null>(null);
    const [compareData, setCompareData] = useState<{ round1: Round1Data | null; round2: Round2Data | null } | null>(null);
    const [diffMap, setDiffMap] = useState<Map<string, { oldVal: string; newVal: string }>>(new Map());
    const [, setActiveDiffPopover] = useState<string | null>(null);

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

    // Helper to render character or object item (handles both string and object types)
    const renderFrameItem = (item: unknown): string => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
            // Handle structured character object with tag, pose, expression, clothing
            const obj = item as Record<string, unknown>;
            const parts: string[] = [];
            if (obj.tag) parts.push(String(obj.tag));
            if (obj.pose) parts.push(`姿态: ${obj.pose}`);
            if (obj.expression) parts.push(`表情: ${obj.expression}`);
            if (obj.clothing) parts.push(`服装: ${obj.clothing}`);
            if (obj.name) parts.push(String(obj.name));
            if (obj.description) parts.push(String(obj.description));
            return parts.length > 0 ? parts.join(' · ') : JSON.stringify(item);
        }
        return String(item);
    };

    // Render structured Initial Frame content for diff popover
    const renderInitialFrameDiff = (jsonStr: string) => {
        try {
            const frame = JSON.parse(jsonStr);
            return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Foreground */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-orange-500">
                            <Users size={14} />
                            <span>前景 / FOREGROUND</span>
                        </div>
                        <div className="space-y-2 pl-1">
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">角色:</div>
                                <div className="space-y-1">
                                    {(frame.foreground?.characters || []).map((c: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">{renderFrameItem(c) || '添加角色...'}</div>
                                    ))}
                                    {(!frame.foreground?.characters?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无角色</div>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">道具:</div>
                                <div className="space-y-1">
                                    {(frame.foreground?.objects || []).map((o: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">{renderFrameItem(o) || '添加道具...'}</div>
                                    ))}
                                    {(!frame.foreground?.objects?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无道具</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Midground */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-orange-500">
                            <Box size={14} />
                            <span>中景 / MIDGROUND</span>
                        </div>
                        <div className="space-y-2 pl-1">
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">角色:</div>
                                <div className="space-y-1">
                                    {(frame.midground?.characters || []).map((c: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">{renderFrameItem(c) || '添加角色...'}</div>
                                    ))}
                                    {(!frame.midground?.characters?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无角色</div>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">道具:</div>
                                <div className="space-y-1">
                                    {(frame.midground?.objects || []).map((o: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">{renderFrameItem(o) || '添加道具...'}</div>
                                    ))}
                                    {(!frame.midground?.objects?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无道具</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Background */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-orange-500">
                            <Layout size={14} />
                            <span>背景 / BACKGROUND</span>
                        </div>
                        <div className="space-y-2 pl-1">
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">环境:</div>
                                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                                    {frame.background?.environment || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">景深:</div>
                                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                                    {frame.background?.depth || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Lighting & Palette */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-orange-500">
                            <Zap size={14} />
                            <span>光影与色调 / LIGHTING & PALETTE</span>
                        </div>
                        <div className="space-y-2 pl-1">
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">光照:</div>
                                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                                    {frame.lighting || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">色调:</div>
                                <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700">
                                    {frame.color_palette || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        } catch {
            // Not valid JSON, render as plain text
            return (
                <div className="text-[var(--color-text-secondary)] whitespace-pre-wrap text-xs">
                    {jsonStr || <span className="italic text-slate-400">(空)</span>}
                </div>
            );
        }
    };

    const renderAnnotationControl = (id: string, label: string) => {
        if (!allowAnnotations) return null;
        const value = annotations[id] || '';
        const isOpen = editingKey === id;

        return (
            <div className="relative inline-flex items-center gap-1 annotation-wrapper">
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

    const modTypeClass = (modType?: string) => {
        const upper = (modType || '').toUpperCase();
        if (upper === 'DELETE') return 'text-red-300';
        if (upper === 'REPLACE') return 'text-amber-300';
        if (upper === 'ADD' || upper === 'INSERT') return 'text-emerald-300';
        return 'text-blue-300';
    };

    // Compare JSON Functions
    const normalizeValue = (val: unknown): string => {
        if (val === null || val === undefined) return '';
        if (typeof val === 'string') return val.trim();
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
    };

    const computeDiffMap = useCallback((newR1: Round1Data | null, newR2: Round2Data | null): Map<string, { oldVal: string; newVal: string }> => {
        const map = new Map<string, { oldVal: string; newVal: string }>();
        if (!round1Data || typeof round1Data === 'string') return map;
        if (!round2Data || typeof round2Data === 'string') return map;

        // Round 1 fields
        if (newR1) {
            const skeleton = newR1.round1_skeleton;
            const oldSkeleton = round1Data.round1_skeleton;
            // story_summary
            if (normalizeValue(skeleton?.story_summary) !== normalizeValue(oldSkeleton?.story_summary)) {
                map.set('story_summary', { oldVal: normalizeValue(oldSkeleton?.story_summary), newVal: normalizeValue(skeleton?.story_summary) });
            }
            // logic_chain
            if (normalizeValue(skeleton?.logic_chain) !== normalizeValue(oldSkeleton?.logic_chain)) {
                map.set('logic_chain', { oldVal: normalizeValue(oldSkeleton?.logic_chain), newVal: normalizeValue(skeleton?.logic_chain) });
            }
            // hooks (combined)
            const hook = newR1.round1_hook;
            const oldHook = round1Data.round1_hook;
            const hookFields = ['visual_hook', 'audio_hook', 'retention_strategy', 'beat1_reference'] as const;
            for (const field of hookFields) {
                if (normalizeValue(hook?.[field]) !== normalizeValue(oldHook?.[field])) {
                    map.set(`hooks_${field}`, { oldVal: normalizeValue(oldHook?.[field]), newVal: normalizeValue(hook?.[field]) });
                }
            }
            // viral elements (compare by index)
            const oldViral = oldSkeleton?.viral_elements_found || [];
            const newViral = skeleton?.viral_elements_found || [];
            for (let i = 0; i < Math.max(oldViral.length, newViral.length); i++) {
                const ov = oldViral[i];
                const nv = newViral[i];
                if (normalizeValue(ov) !== normalizeValue(nv)) {
                    map.set(`viral_${i}`, { oldVal: normalizeValue(ov), newVal: normalizeValue(nv) });
                }
            }
        }

        // Round 2 fields
        if (newR2) {
            // Characters
            const oldChars = round2Data.characters || {};
            const newChars = newR2.characters || {};
            const allCharKeys = new Set([...Object.keys(oldChars), ...Object.keys(newChars)]);
            for (const key of allCharKeys) {
                if (normalizeValue(oldChars[key]) !== normalizeValue(newChars[key])) {
                    map.set(`characters_${key}`, { oldVal: normalizeValue(oldChars[key]), newVal: normalizeValue(newChars[key]) });
                }
            }
            // Shots
            const oldShots = round2Data.shots || [];
            const newShots = newR2.shots || [];
            // Map of internal field names to diffMap key names (some keys differ from field names for ShotCard compatibility)
            const shotFieldKeyMap: Record<string, string> = {
                mission: 'mission',
                visual_changes: 'visual_changes',
                audio: 'audio',
                camera: 'camera',
                beat: 'beat',
                viral_element: 'viral_element',
                emotion: 'emotion',
                logic_mapping: 'logic_mapping',
            };
            const shotFields = Object.keys(shotFieldKeyMap) as (keyof typeof shotFieldKeyMap)[];
            for (let i = 0; i < Math.max(oldShots.length, newShots.length); i++) {
                const os = oldShots[i];
                const ns = newShots[i];
                // Use shot.id if available, otherwise use index (0-based) to match ShotCard's key format
                const shotId = os?.id ?? ns?.id ?? i;
                for (const field of shotFields) {
                    const oldFieldVal = os ? normalizeValue(os[field as keyof Round2Shot]) : '';
                    const newFieldVal = ns ? normalizeValue(ns[field as keyof Round2Shot]) : '';
                    if (oldFieldVal !== newFieldVal) {
                        const keyName = shotFieldKeyMap[field];
                        map.set(`shot-${shotId}-${keyName}`, { oldVal: oldFieldVal, newVal: newFieldVal });
                    }
                }
                
                // Handle initial_frame sub-fields separately
                const oldFrame = os?.initial_frame;
                const newFrame = ns?.initial_frame;
                const parseFrame = (frame: unknown) => {
                    if (!frame) return null;
                    if (typeof frame === 'string') {
                        try { return JSON.parse(frame); } catch { return null; }
                    }
                    return frame as Record<string, unknown>;
                };
                const oldParsed = parseFrame(oldFrame);
                const newParsed = parseFrame(newFrame);
                
                // Helper to get nested array as string
                const getArrayStr = (obj: Record<string, unknown> | null, path: string[]): string => {
                    if (!obj) return '';
                    let val: unknown = obj;
                    for (const key of path) {
                        val = (val as Record<string, unknown>)?.[key];
                    }
                    if (Array.isArray(val)) return JSON.stringify(val);
                    return '';
                };
                // Helper to get nested string value
                const getStrVal = (obj: Record<string, unknown> | null, path: string[]): string => {
                    if (!obj) return '';
                    let val: unknown = obj;
                    for (const key of path) {
                        val = (val as Record<string, unknown>)?.[key];
                    }
                    return typeof val === 'string' ? val : '';
                };
                
                // Compare each sub-field of initial_frame
                const initialSubFields = [
                    { key: 'initial_fg_chars', path: ['foreground', 'characters'], isArray: true },
                    { key: 'initial_fg_objects', path: ['foreground', 'objects'], isArray: true },
                    { key: 'initial_mg_chars', path: ['midground', 'characters'], isArray: true },
                    { key: 'initial_mg_objects', path: ['midground', 'objects'], isArray: true },
                    { key: 'initial_bg_env', path: ['background', 'environment'], isArray: false },
                    { key: 'initial_bg_depth', path: ['background', 'depth'], isArray: false },
                    { key: 'initial_lighting', path: ['lighting'], isArray: false },
                    { key: 'initial_palette', path: ['color_palette'], isArray: false },
                ];
                for (const { key, path, isArray } of initialSubFields) {
                    const oldVal = isArray ? getArrayStr(oldParsed, path) : getStrVal(oldParsed, path);
                    const newVal = isArray ? getArrayStr(newParsed, path) : getStrVal(newParsed, path);
                    if (oldVal !== newVal) {
                        map.set(`shot-${shotId}-${key}`, { oldVal, newVal });
                    }
                }
            }
        }

        return map;
    }, [round1Data, round2Data]);

    const handleParseCompareJson = () => {
        let r1: Round1Data | null = null;
        let r2: Round2Data | null = null;
        let hasError = false;

        // Parse Round 1
        if (compareRound1Text.trim()) {
            try {
                JSON.parse(compareRound1Text);
                const parsed = parseRound1(compareRound1Text);
                if (parsed.error) {
                    setCompareRound1Error(parsed.error);
                    hasError = true;
                } else {
                    r1 = parsed.data as Round1Data;
                    setCompareRound1Error(null);
                }
            } catch (err) {
                setCompareRound1Error(`JSON 解析失败: ${err instanceof Error ? err.message : '未知错误'}`);
                hasError = true;
            }
        } else {
            setCompareRound1Error(null);
        }

        // Parse Round 2
        if (compareRound2Text.trim()) {
            try {
                JSON.parse(compareRound2Text);
                const parsed = parseRound2(compareRound2Text);
                if (parsed.error) {
                    setCompareRound2Error(parsed.error);
                    hasError = true;
                } else {
                    r2 = parsed.data as Round2Data;
                    setCompareRound2Error(null);
                }
            } catch (err) {
                setCompareRound2Error(`JSON 解析失败: ${err instanceof Error ? err.message : '未知错误'}`);
                hasError = true;
            }
        } else {
            setCompareRound2Error(null);
        }

        if (!compareRound1Text.trim() && !compareRound2Text.trim()) {
            setCompareRound1Error('请至少粘贴 Round 1 或 Round 2 的 JSON');
            return;
        }

        if (!hasError) {
            setCompareData({ round1: r1, round2: r2 });
            const diffResult = computeDiffMap(r1, r2);
            setDiffMap(diffResult);
        }
    };

    const handleAcceptDiff = (key: string) => {
        const diff = diffMap.get(key);
        if (!diff) return;

        // Apply the new value based on key pattern
        if (key === 'story_summary') {
            mutateRound1((draft) => {
                draft.round1_skeleton = { ...(draft.round1_skeleton || {}), story_summary: diff.newVal };
            });
        } else if (key === 'logic_chain') {
            mutateRound1((draft) => {
                draft.round1_skeleton = { ...(draft.round1_skeleton || {}), logic_chain: diff.newVal };
            });
        } else if (key.startsWith('hooks_')) {
            const field = key.replace('hooks_', '') as 'visual_hook' | 'audio_hook' | 'retention_strategy' | 'beat1_reference';
            mutateRound1((draft) => {
                draft.round1_hook = { ...(draft.round1_hook || {}), [field]: diff.newVal };
            });
        } else if (key.startsWith('viral_')) {
            const idx = parseInt(key.replace('viral_', ''));
            if (!isNaN(idx) && compareData?.round1?.round1_skeleton?.viral_elements_found?.[idx]) {
                mutateRound1((draft) => {
                    const list = [...(draft.round1_skeleton?.viral_elements_found || [])];
                    list[idx] = compareData.round1!.round1_skeleton!.viral_elements_found![idx];
                    draft.round1_skeleton = { ...(draft.round1_skeleton || {}), viral_elements_found: list };
                });
            }
        } else if (key.startsWith('characters_')) {
            const charName = key.replace('characters_', '');
            mutateRound2((draft) => {
                if (!draft.characters) draft.characters = {};
                draft.characters[charName] = diff.newVal;
            });
        } else if (key.startsWith('shot-')) {
            const match = key.match(/^shot-(\d+)-(.+)$/);
            if (match) {
                const shotId = parseInt(match[1]);
                const keyName = match[2];
                
                // Check if this is an initial_frame sub-field
                const initialSubFieldMap: Record<string, { path: string[]; isArray: boolean }> = {
                    initial_fg_chars: { path: ['foreground', 'characters'], isArray: true },
                    initial_fg_objects: { path: ['foreground', 'objects'], isArray: true },
                    initial_mg_chars: { path: ['midground', 'characters'], isArray: true },
                    initial_mg_objects: { path: ['midground', 'objects'], isArray: true },
                    initial_bg_env: { path: ['background', 'environment'], isArray: false },
                    initial_bg_depth: { path: ['background', 'depth'], isArray: false },
                    initial_lighting: { path: ['lighting'], isArray: false },
                    initial_palette: { path: ['color_palette'], isArray: false },
                };
                
                if (keyName in initialSubFieldMap) {
                    // Handle initial_frame sub-field
                    const { path, isArray } = initialSubFieldMap[keyName];
                    mutateRound2((draft) => {
                        if (!draft.shots) return;
                        const shotIdx = draft.shots.findIndex((s) => (s.id ?? 0) === shotId);
                        if (shotIdx < 0) return;
                        
                        // Get or create initial_frame object
                        let frame = draft.shots[shotIdx].initial_frame;
                        if (typeof frame === 'string') {
                            try { frame = JSON.parse(frame); } catch { frame = {}; }
                        }
                        if (!frame || typeof frame !== 'object') frame = {};
                        
                        // Parse new value
                        const newVal = isArray ? JSON.parse(diff.newVal || '[]') : diff.newVal;
                        
                        // Set nested value
                        let target = frame as Record<string, unknown>;
                        for (let i = 0; i < path.length - 1; i++) {
                            if (!target[path[i]] || typeof target[path[i]] !== 'object') {
                                target[path[i]] = {};
                            }
                            target = target[path[i]] as Record<string, unknown>;
                        }
                        target[path[path.length - 1]] = newVal;
                        
                        draft.shots[shotIdx].initial_frame = frame as Round2Shot['initial_frame'];
                    });
                } else {
                    // Handle regular shot fields
                    const field = keyName as keyof Round2Shot;
                    mutateRound2((draft) => {
                        if (!draft.shots) return;
                        const shotIdx = draft.shots.findIndex((s) => (s.id ?? 0) === shotId);
                        if (shotIdx >= 0) {
                            const newShot = compareData?.round2?.shots?.find((s) => (s.id ?? 0) === shotId);
                            if (newShot && field in newShot) {
                                // @ts-expect-error - dynamic field assignment
                                draft.shots[shotIdx][field] = newShot[field];
                            }
                        }
                    });
                }
            }
        }

        // Remove from diff map after accepting
        setDiffMap((prev) => {
            const next = new Map(prev);
            next.delete(key);
            return next;
        });
        setActiveDiffPopover(null);
    };

    const clearCompareData = () => {
        setCompareData(null);
        setDiffMap(new Map());
        setCompareRound1Text('');
        setCompareRound2Text('');
        setCompareRound1Error(null);
        setCompareRound2Error(null);
        setShowComparePanel(false);
        setActiveDiffPopover(null);
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
                    {/* Compare JSON Button - Only in review mode */}
                    {mode === 'review' && (
                        <button
                            onClick={() => setShowComparePanel(!showComparePanel)}
                            className={`
                                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                                ${compareData
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20'}
                            `}
                        >
                            <ClipboardPaste size={14} />
                            <span>{compareData ? `对比中 (${diffMap.size}处差异)` : '粘贴JSON对比'}</span>
                        </button>
                    )}
                </div>

                {/* Compare JSON Panel - Only visible when showComparePanel is true */}
                {mode === 'review' && showComparePanel && (
                    <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-amber-500/30 space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                                <ClipboardPaste size={16} />
                                粘贴新 JSON 进行对比
                            </h4>
                            <div className="flex items-center gap-2">
                                {compareData && (
                                    <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                        {diffMap.size} 处差异
                                    </span>
                                )}
                                <button
                                    onClick={() => setShowComparePanel(false)}
                                    className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-tertiary)]"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                        {/* Two separate JSON inputs for Round 1 and Round 2 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Round 1 Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-blue-400">Round 1: 宏观骨架 + 钩子</label>
                                <textarea
                                    value={compareRound1Text}
                                    onChange={(e) => setCompareRound1Text(e.target.value)}
                                    placeholder="粘贴 Round 1 JSON（含 round1_skeleton 和 round1_hook）..."
                                    className={`w-full h-28 bg-[var(--color-bg-primary)] border rounded-lg p-3 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:ring-1 resize-none ${
                                        compareRound1Error 
                                            ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20' 
                                            : 'border-[var(--glass-border)] focus:border-blue-500/50 focus:ring-blue-500/20'
                                    }`}
                                />
                                {compareRound1Error && (
                                    <div className="text-xs text-red-400 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        {compareRound1Error}
                                    </div>
                                )}
                            </div>
                            {/* Round 2 Input */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-purple-400">Round 2: 分镜头分析</label>
                                <textarea
                                    value={compareRound2Text}
                                    onChange={(e) => setCompareRound2Text(e.target.value)}
                                    placeholder="粘贴 Round 2 JSON（含 characters 和 shots）..."
                                    className={`w-full h-28 bg-[var(--color-bg-primary)] border rounded-lg p-3 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:ring-1 resize-none ${
                                        compareRound2Error 
                                            ? 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20' 
                                            : 'border-[var(--glass-border)] focus:border-purple-500/50 focus:ring-purple-500/20'
                                    }`}
                                />
                                {compareRound2Error && (
                                    <div className="text-xs text-red-400 flex items-center gap-1">
                                        <AlertCircle size={12} />
                                        {compareRound2Error}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleParseCompareJson}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition font-medium text-sm"
                            >
                                <RefreshCw size={14} />
                                解析并对比
                            </button>
                            {compareData && (
                                <button
                                    onClick={clearCompareData}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--glass-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-red-500/50 transition font-medium text-sm"
                                >
                                    <X size={14} />
                                    清除对比
                                </button>
                            )}
                        </div>
                        {compareData && diffMap.size > 0 && (
                            <div className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                                <span className="text-amber-400 font-medium">提示:</span> 在下方字段旁边点击
                                <span className="mx-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px]">核验</span>
                                按钮查看差异并选择是否采纳。
                            </div>
                        )}
                    </div>
                )}

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
                        {optimizedAnalysis?.checkpoints && typeof optimizedAnalysis.checkpoints === 'object' && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-[var(--color-text-primary)]">Checkpoints</div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {Object.entries(optimizedAnalysis.checkpoints as Record<string, unknown>).map(([k, v]) => (
                                        <div key={k} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-light)]/70 text-xs space-y-1">
                                            <div className="uppercase text-[var(--color-text-tertiary)]">{k}</div>
                                            <div className="text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">{String(v)}</div>
                                        </div>
                                    ))}
                                </div>
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
                        {optimizedAnalysis?.modified_assets_overview && Array.isArray(optimizedAnalysis.modified_assets_overview) && (
                            <div className="space-y-2">
                                <div className="text-xs font-semibold text-[var(--color-text-primary)]">Modified Assets 概览</div>
                                <div className="grid gap-2 md:grid-cols-2">
                                    {(optimizedAnalysis.modified_assets_overview as Array<Record<string, unknown>>).map((item, idx) => (
                                        <div key={idx} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-light)]/70 text-xs space-y-1">
                                            {item.shot_id && <div className="font-semibold text-[var(--color-text-primary)]">Shot {item.shot_id}</div>}
                                            {item.field && <div className="text-[var(--color-text-secondary)]">字段: {String(item.field)}</div>}
                                            {item.element_type && <div className="text-[var(--color-text-secondary)]">元素: {String(item.element_type)}</div>}
                                            {item.reason && <div className="text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">{String(item.reason)}</div>}
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
                                    <AutoTextArea
                                        value={round1Data?.round1_skeleton?.story_summary || ''}
                                        onChange={(e) =>
                                            mutateRound1((draft) => {
                                                draft.round1_skeleton = { ...(draft.round1_skeleton || {}), story_summary: e.target.value };
                                            })
                                        }
                                        readOnly={!canEdit}
                                        minRows={1}
                                        maxRows={24}
                                        className="w-full bg-black/5 border border-black/10 rounded-2xl p-6 text-base text-slate-700 focus:outline-none focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/10 transition-all duration-300 leading-relaxed resize-none placeholder:text-slate-400 shadow-inner"
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
                                <AutoTextArea
                                    value={typeof round1Data !== 'string' ? round1Data?.round1_skeleton?.logic_chain || '' : ''}
                                    onChange={(e) =>
                                        mutateRound1((draft) => {
                                            draft.round1_skeleton = { ...(draft.round1_skeleton || {}), logic_chain: e.target.value };
                                        })
                                    }
                                    readOnly={!canEdit}
                                    minRows={1}
                                    maxRows={20}
                                    className="w-full bg-black/5 border border-black/10 rounded-xl p-4 text-sm text-indigo-700 focus:outline-none focus:border-indigo-500/30 focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none italic font-medium shadow-inner placeholder:text-indigo-400"
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
                                        <div key={idx} className="relative flex items-stretch gap-4 pb-8 last:pb-0 group">
                                            {/* Timeline Dot */}
                                            <div className="w-14 flex items-center justify-center z-10 pt-2">
                                                <div className="w-10 h-10 rounded-full bg-[#1a1a2e] border-2 border-purple-500/40 text-purple-300 flex items-center justify-center text-sm font-bold shadow-[0_0_15px_rgba(168,85,247,0.2)] group-hover:scale-110 group-hover:border-purple-400 group-hover:text-white group-hover:shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all duration-300">
                                                    {idx + 1}
                                                </div>
                                            </div>

                                            <AutoTextArea
                                                value={node || ''}
                                                onChange={(e) =>
                                                    mutateRound1((draft) => {
                                                        const list = [...(draft.round1_skeleton?.skeleton_nodes || [])];
                                                        list[idx] = e.target.value;
                                                        draft.round1_skeleton = { ...(draft.round1_skeleton || {}), skeleton_nodes: list };
                                                    })
                                                }
                                                readOnly={!canEdit}
                                                minRows={1}
                                                maxRows={12}
                                                className="w-full bg-black/5 border border-black/10 rounded-xl p-4 text-sm text-slate-700 focus:outline-none focus:border-purple-500/30 focus:ring-2 focus:ring-purple-500/10 transition-all resize-none shadow-sm hover:bg-black/10 leading-relaxed"
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
                                        <AutoTextArea
                                            value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.visual_hook || '' : ''}
                                            onChange={(e) =>
                                                mutateRound1((draft) => {
                                                    draft.round1_hook = { ...(draft.round1_hook || {}), visual_hook: e.target.value };
                                                })
                                            }
                                            readOnly={!canEdit}
                                            minRows={2}
                                            maxRows={12}
                                            className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/10 transition-all resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-pink-500/60 uppercase tracking-wider ml-1">音频钩子</div>
                                        <AutoTextArea
                                            value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.audio_hook || '' : ''}
                                            onChange={(e) =>
                                                mutateRound1((draft) => {
                                                    draft.round1_hook = { ...(draft.round1_hook || {}), audio_hook: e.target.value };
                                                })
                                            }
                                            readOnly={!canEdit}
                                            minRows={1}
                                            maxRows={12}
                                            className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/10 transition-all resize-none"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <div className="text-xs font-bold text-pink-500/60 uppercase tracking-wider ml-1">留存策略</div>
                                        <AutoTextArea
                                            value={typeof round1Data !== 'string' ? round1Data?.round1_hook?.retention_strategy || '' : ''}
                                            onChange={(e) =>
                                                mutateRound1((draft) => {
                                                    draft.round1_hook = { ...(draft.round1_hook || {}), retention_strategy: e.target.value };
                                                })
                                            }
                                            readOnly={!canEdit}
                                            minRows={2}
                                            maxRows={12}
                                            className="w-full bg-black/5 border border-black/10 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-pink-500/30 focus:ring-2 focus:ring-pink-500/10 transition-all resize-none"
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
                                                <AutoTextArea
                                                    value={v.category || ''}
                                                    onChange={(e) =>
                                                        mutateRound1((draft) => {
                                                            const list = [...(draft.round1_skeleton?.viral_elements_found || [])];
                                                            list[idx] = { ...(list[idx] || {}), category: e.target.value };
                                                            draft.round1_skeleton = { ...(draft.round1_skeleton || {}), viral_elements_found: list };
                                                        })
                                                    }
                                                    readOnly={!canEdit}
                                                    minRows={1}
                                                    maxRows={4}
                                                    className="w-1/3 text-xs font-bold text-amber-400 bg-transparent border-none focus:ring-0 px-0 resize-none leading-relaxed placeholder:text-amber-400/30"
                                                    placeholder="类别"
                                                />
                                                <div className="w-px bg-black/10" />
                                                <AutoTextArea
                                                    value={v.element || ''}
                                                    onChange={(e) =>
                                                        mutateRound1((draft) => {
                                                            const list = [...(draft.round1_skeleton?.viral_elements_found || [])];
                                                            list[idx] = { ...(list[idx] || {}), element: e.target.value };
                                                            draft.round1_skeleton = { ...(draft.round1_skeleton || {}), viral_elements_found: list };
                                                        })
                                                    }
                                                    readOnly={!canEdit}
                                                    minRows={1}
                                                    maxRows={6}
                                                    className="flex-1 text-sm font-bold text-slate-700 bg-transparent border-none focus:ring-0 px-0 resize-none leading-relaxed placeholder:text-slate-400"
                                                    placeholder="元素"
                                                />
                                            </div>
                                            <AutoTextArea
                                                value={v.description || ''}
                                                onChange={(e) =>
                                                    mutateRound1((draft) => {
                                                        const list = [...(draft.round1_skeleton?.viral_elements_found || [])];
                                                        list[idx] = { ...(list[idx] || {}), description: e.target.value };
                                                        draft.round1_skeleton = { ...(draft.round1_skeleton || {}), viral_elements_found: list };
                                                    })
                                                }
                                                readOnly={!canEdit}
                                                minRows={1}
                                                maxRows={10}
                                                className="w-full text-sm text-slate-600 bg-transparent border-none focus:ring-0 p-0 resize-none leading-relaxed placeholder:text-slate-400"
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
                            const optimizedShot = getOptimizedShot(shot, index);

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
                                <ShotCard
                                    key={index}
                                    shot={shot}
                                    index={index}
                                    mode={mode}
                                    optimizedShot={optimizedShot}
                                    onUpdate={(updatedShot) => {
                                        mutateRound2((draft) => {
                                            if (draft.shots) {
                                                draft.shots[index] = updatedShot;
                                            }
                                        });
                                    }}
                                    renderAnnotationControl={renderAnnotationControl}
                                    globalVolume={globalVolume}
                                    isGlobalMuted={isGlobalMuted}
                                    clipUrl={clipUrl}
                                    frameUrl={frameUrl}
                                    diffMap={diffMap}
                                    onAcceptDiff={handleAcceptDiff}
                                />
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
