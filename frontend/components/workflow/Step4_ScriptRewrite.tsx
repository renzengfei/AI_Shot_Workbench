'use client';

import { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, FileText, ShieldCheck, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import { PRODUCTION_STORYBOARD_PROMPT } from '@/data/productionStoryboardPrompt';
import { useWorkflowStore } from '@/lib/stores/workflowStore';

type Mode = 'initial' | 'revision' | 'final';

interface ModificationLog {
    title?: string;
    summary?: string;
    items?: { id?: number | string; change?: string; reason?: string }[];
    [key: string]: unknown;
}

interface OptimizedStoryboard {
    title?: string;
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
            const [decon, mod, opt] = await Promise.allSettled([
                fetchText(`/workspaces/${encodeURIComponent(workspaceSlug)}/deconstruction.md`),
                fetchText(`/workspaces/${encodeURIComponent(workspaceSlug)}/modification_log.json`),
                fetchText(`/workspaces/${encodeURIComponent(workspaceSlug)}/optimized_storyboard.json`),
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

    const ModeToggle = ({ value, label }: { value: Mode; label: string }) => (
        <button
            onClick={() => setMode(value)}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
                mode === value
                    ? 'bg-blue-500 text-white border-blue-500 shadow-lg shadow-blue-500/20'
                    : 'bg-[var(--glass-bg-light)] border-[var(--glass-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
            }`}
        >
            {label}
        </button>
    );

    const renderInitial = () => (
        <div className="glass-card p-6 space-y-4 border border-[var(--glass-border)]">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                    <Sparkles size={18} className="text-blue-400" />
                    <span className="font-semibold">初始模式：复制提示词并发给任意AI编程工具</span>
                </div>
                <button
                    onClick={copyPrompt}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 text-white text-sm shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition"
                >
                    <Copy size={14} />
                    {copyState === 'copied' ? '已复制' : '复制提示词'}
                </button>
            </div>
            <div className="bg-[var(--color-bg-secondary)]/50 rounded-lg border border-[var(--glass-border)] p-4 text-xs text-[var(--color-text-primary)] font-mono whitespace-pre-wrap leading-relaxed">
                {promptText}
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)]">
                已自动填入当前工作空间文件路径：<span className="text-[var(--color-text-primary)]">{deconstructionPath}</span>
            </div>
        </div>
    );

    const renderRevision = () => (
        <div className="space-y-6">
            <div className="glass-card p-5 border border-[var(--glass-border)]">
                <div className="flex items-center gap-2 text-[var(--color-text-primary)] mb-2">
                    <FileText size={16} className="text-blue-400" />
                    <span className="font-semibold">原始剧本 (deconstruction.md)</span>
                </div>
                <div className="bg-[var(--color-bg-secondary)]/40 border border-[var(--glass-border)] rounded-lg p-3 text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-auto">
                    {deconstructionText || '未加载到 deconstruction.md'}
                </div>
            </div>

            <div className="glass-card p-5 border border-[var(--glass-border)]">
                <div className="flex items-center gap-2 text-[var(--color-text-primary)] mb-2">
                    <ShieldCheck size={16} className="text-green-400" />
                    <span className="font-semibold">修改日志 (modification_log.json)</span>
                </div>
                {modLog ? (
                    <div className="space-y-3">
                        {modLog.title && <div className="text-base font-semibold">{modLog.title}</div>}
                        {modLog.summary && <p className="text-sm text-[var(--color-text-secondary)]">{modLog.summary}</p>}
                        {Array.isArray(modLog.items) && modLog.items.length > 0 && (
                            <div className="space-y-2">
                                {modLog.items.map((item, i) => (
                                    <div key={i} className="p-3 rounded-lg bg-[var(--glass-bg-light)] border border-[var(--glass-border)]">
                                        <div className="text-xs font-bold text-[var(--color-text-primary)] mb-1">#{item.id ?? i + 1}</div>
                                        <div className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{item.change || ''}</div>
                                        {item.reason && <div className="text-xs text-[var(--color-text-tertiary)] mt-1">原因：{item.reason}</div>}
                                    </div>
                                ))}
                            </div>
                        )}
                        {!modLog.items?.length && (
                            <pre className="text-xs text-[var(--color-text-secondary)] whitespace-pre-wrap">{JSON.stringify(modLog, null, 2)}</pre>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-[var(--color-text-tertiary)]">未找到 modification_log.json</div>
                )}
            </div>
        </div>
    );

    const renderFinal = () => (
        <div className="space-y-6">
            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                <CheckCircle2 size={18} className="text-green-400" />
                <span className="font-semibold">终版剧本 (optimized_storyboard.json)</span>
            </div>
            {optimized ? (
                <div className="space-y-4">
                    {optimized.title && <div className="text-xl font-bold">{optimized.title}</div>}
                    {Array.isArray(optimized.shots) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {optimized.shots.map((shot, idx) => (
                                <div key={idx} className="glass-card p-4 border border-[var(--glass-border)] space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-bold text-purple-400">Shot #{shot.id ?? idx + 1}</div>
                                        {shot.mission && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300">
                                                {shot.mission}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
                                        {shot.initial_frame && <p><strong>首帧：</strong>{shot.initial_frame}</p>}
                                        {shot.visual_changes && <p><strong>变化：</strong>{shot.visual_changes}</p>}
                                        {shot.camera && <p><strong>镜头：</strong>{shot.camera}</p>}
                                        {shot.audio && <p><strong>音频：</strong>{shot.audio}</p>}
                                        {shot.emotion && <p><strong>情绪：</strong>{shot.emotion}</p>}
                                        {shot.beat && <p><strong>Beat：</strong>{shot.beat}</p>}
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
        <div className="space-y-8 pb-16">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="space-y-1">
                    <h2 className="apple-title text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">剧本重构</h2>
                    <p className="apple-body text-[var(--color-text-secondary)]">
                        合并分镜优化与爆款密度：初始复制提示词，修订查看修改日志，终版查看最终剧本。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <ModeToggle value="initial" label="初始模式" />
                    <ModeToggle value="revision" label="修订模式" />
                    <ModeToggle value="final" label="终版模式" />
                </div>
            </div>

            {loading && (
                <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                    <Loader2 className="animate-spin" size={16} /> 正在加载工作空间文件...
                </div>
            )}
            {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    <AlertTriangle size={16} /> {error}
                </div>
            )}

            {mode === 'initial' && renderInitial()}
            {mode === 'revision' && renderRevision()}
            {mode === 'final' && renderFinal()}

            <div className="text-xs text-[var(--color-text-tertiary)]">
                当前工作空间：{currentWorkspace?.name || '未选择'} {project?.name ? `· 项目：${project.name}` : ''}
            </div>
        </div>
    );
}
