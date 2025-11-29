'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import { FileText, ArrowRight, Copy, Check, Sparkles, Youtube, MessageSquare, Type, Eye, X, Clipboard, AlertCircle } from 'lucide-react';
import { useWorkspace } from '@/components/WorkspaceContext';
import { DECONSTRUCTION_PROMPT } from '@/data/deconstructionPrompt';
import { parseRound1, parseRound2, parseStoredDeconstruction } from '@/lib/services/deconstruction';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export default function Step2_Deconstruction() {
    const { project, updateDeconstruction } = useWorkflowStore();
    const { saveDeconstruction, currentWorkspace } = useWorkspace();
    const { nextStep } = useStepNavigator();
    const [round1Text, setRound1Text] = useState('');
    const [round2Text, setRound2Text] = useState('');
    const [assetsReady, setAssetsReady] = useState(false);
    const [assetsChecking, setAssetsChecking] = useState(false);
    const [assetsError, setAssetsError] = useState<string | null>(null);
    const [isCopyingPrompt, setIsCopyingPrompt] = useState(false);
    const [isCopyingUrl, setIsCopyingUrl] = useState(false);
    const [isCopyingContent, setIsCopyingContent] = useState(false);
    const [isCopyingSegmentation, setIsCopyingSegmentation] = useState(false);
    const [showPromptPreview, setShowPromptPreview] = useState(false);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [round1Error, setRound1Error] = useState<string | null>(null);
    const [round2Error, setRound2Error] = useState<string | null>(null);
    const [lastGoodRound2, setLastGoodRound2] = useState<Round2Parsed>(null);

    const scheduleSave = (nextRound1: string, nextRound2: string) => {
        const round1Parsed = parseRound1(nextRound1);
        const round2Parsed = parseRound2(nextRound2);
        setRound1Error(round1Parsed.data ? null : round1Parsed.error);
        setRound2Error(round2Parsed.data ? null : round2Parsed.error);
        if (round2Parsed.data) setLastGoodRound2(round2Parsed.data);

        const payload = JSON.stringify(
            {
                round1: round1Parsed.data ?? undefined,
                round2: round2Parsed.data ?? (typeof lastGoodRound2 === 'string' ? undefined : lastGoodRound2 ?? undefined),
            },
            null,
            2,
        );

        updateDeconstruction(payload);
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            saveDeconstruction(payload);
        }, 500);
    };

    const handleRound1Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        setRound1Text(value);
        try {
            if (value.trim()) JSON.parse(value);
            setRound1Error(null);
        } catch {
            setRound1Error('JSON 格式无效，请检查逗号/引号/括号');
        }
        scheduleSave(value, round2Text);
    };

    const handleRound2Change = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const parsed = parseRound2(value);
        setRound2Error(parsed.error);
        if (parsed.data && parsed.source === 'markdown') {
            const normalized = JSON.stringify(parsed.data, null, 2);
            setRound2Text(normalized);
            scheduleSave(round1Text, normalized);
        } else {
            setRound2Text(value);
            scheduleSave(round1Text, value);
        }
    };

    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    const copyToClipboard = async (text: string, type: 'prompt' | 'url' | 'content') => {
        try {
            await navigator.clipboard.writeText(text);
            if (type === 'prompt') {
                setIsCopyingPrompt(true);
                setTimeout(() => setIsCopyingPrompt(false), 2000);
            } else if (type === 'url') {
                setIsCopyingUrl(true);
                setTimeout(() => setIsCopyingUrl(false), 2000);
            } else if (type === 'content') {
                setIsCopyingContent(true);
                setTimeout(() => setIsCopyingContent(false), 2000);
            }
        } catch (err) {
            console.error('复制失败', err);
            alert('复制失败，请手动复制');
        }
    };

    useEffect(() => {
        // hydrate from existing stored text
        const stored = project?.deconstructionText;
        if (!stored) return;
        const { round1, round2, rawRound1Text, rawRound2Text, errorsRound1, errorsRound2, errorsGeneral } = parseStoredDeconstruction(stored);
        setRound1Error(errorsRound1[0] || errorsGeneral[0] || null);
        setRound2Error(errorsRound2[0] || errorsGeneral[0] || null);
        if (rawRound1Text || round1) {
            setRound1Text(rawRound1Text ?? (typeof round1 === 'string' ? round1 : JSON.stringify(round1, null, 2)));
        }
        if (rawRound2Text || round2) {
            setRound2Text(rawRound2Text ?? (typeof round2 === 'string' ? round2 : JSON.stringify(round2, null, 2)));
            setLastGoodRound2(typeof round2 === 'string' ? null : round2);
        }
    }, [project?.deconstructionText]);

    const workspaceSlug = useMemo(() => {
        if (!currentWorkspace?.path) return null;
        const marker = '/workspaces/';
        const idx = currentWorkspace.path.lastIndexOf(marker);
        if (idx >= 0) return currentWorkspace.path.substring(idx + marker.length);
        return currentWorkspace.path.split('/').pop() || currentWorkspace.path;
    }, [currentWorkspace?.path]);

    useEffect(() => {
        if (!workspaceSlug) return;
        const checkAssets = async () => {
            setAssetsChecking(true);
            setAssetsError(null);
            try {
                const res = await fetch(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/report.json`);
                if (res.ok) {
                    setAssetsReady(true);
                } else {
                    setAssetsReady(false);
                    setAssetsError('分镜资产未生成，请在原片切分确认切分后再试');
                }
            } catch (err) {
                console.error(err);
                setAssetsReady(false);
                setAssetsError('检查分镜资产时出现错误');
            } finally {
                setAssetsChecking(false);
            }
        };
        checkAssets();
    }, [workspaceSlug]);

    const copySegmentationJson = async () => {
        if (!workspaceSlug) {
            alert('请先打开或创建工作空间');
            return;
        }
        if (!assetsReady) {
            alert('分镜资产尚未生成，请在原片切分点击确认切分后再试');
            return;
        }
        try {
            setIsCopyingSegmentation(true);
            const res = await fetch(`${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/report.json`);
            if (!res.ok) throw new Error(`获取分镜 JSON 失败: ${res.status}`);
            const data = await res.json();

            type ReportItem = { start?: number; end?: number; duration?: number;[key: string]: unknown };
            const round3 = (v: unknown) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
            const normalized = Array.isArray((data as { report?: ReportItem[] }).report)
                ? {
                    ...data,
                    report: (data as { report?: ReportItem[] }).report!.map((item) => ({
                        ...item,
                        start: round3(item?.start),
                        end: round3(item?.end),
                        duration: round3(item?.duration),
                    })),
                }
                : data;

            await navigator.clipboard.writeText(JSON.stringify(normalized, null, 2));
            setTimeout(() => setIsCopyingSegmentation(false), 2000);
        } catch (err) {
            console.error(err);
            alert('复制分镜 JSON 失败，请确认已生成资产后重试');
            setIsCopyingSegmentation(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="glass-card p-4 flex items-center justify-between border-b-4 border-b-blue-500/20">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        AI 原片拆解
                    </h2>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                        使用 Gemini 获取 AI 拆解结果，粘贴 Round 1 JSON 与 Round 2 Markdown 到下方自动保存。
                        {!assetsReady && (
                            <span className="ml-2 text-amber-400">分镜资产生成中，请稍候…</span>
                        )}
                    </p>
                    {assetsError && (
                        <div className="text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1 inline-flex items-center gap-1">
                            <AlertCircle size={12} /> {assetsError}
                        </div>
                    )}
                </div>
                <button
                    onClick={nextStep}
                    className="px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-2"
                >
                下一步：剧本重构
                    <ArrowRight size={16} />
                </button>
            </div>

            {/* Guide - always visible */}
            <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-500" />
                        AI Studio 操作指引
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                    {/* Step 1 */}
                    <div className="glass-card p-6 space-y-4 relative overflow-hidden group hover:border-blue-500/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-1" style={{ animationDelay: '0ms' }}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
                            <span className="text-8xl font-bold bg-gradient-to-br from-blue-500 to-transparent bg-clip-text text-transparent">1</span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 mb-2 ring-1 ring-blue-500/20 group-hover:bg-blue-500/20 transition-colors">
                            <span className="font-bold text-lg">1</span>
                        </div>
                        <h4 className="font-semibold text-[var(--color-text-primary)]">模型配置</h4>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                            选择最新的 <span className="font-medium text-[var(--color-text-primary)]">Gemini</span> 模型，并确认右侧边栏配置：
                        </p>
                        <div className="bg-[var(--color-bg-secondary)]/50 rounded-lg p-3 text-xs font-mono text-[var(--color-text-secondary)] border border-[var(--glass-border)] backdrop-blur-sm">
                            <div className="flex justify-between py-0.5"><span>Temperature:</span> <span className="text-blue-500 font-semibold">0.3</span></div>
                            <div className="flex justify-between py-0.5"><span>Media resolution:</span> <span className="text-blue-500 font-semibold">High</span></div>
                            <div className="flex justify-between py-0.5"><span>Thinking level:</span> <span className="text-blue-500 font-semibold">High</span></div>
                        </div>
                    </div>

                    {/* Step 2 */}
                    <div className="glass-card p-6 space-y-4 relative overflow-hidden group hover:border-purple-500/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-1" style={{ animationDelay: '100ms' }}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
                            <span className="text-8xl font-bold bg-gradient-to-br from-purple-500 to-transparent bg-clip-text text-transparent">2</span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600 mb-2 ring-1 ring-purple-500/20 group-hover:bg-purple-500/20 transition-colors">
                            <span className="font-bold text-lg">2</span>
                        </div>
                        <h4 className="font-semibold text-[var(--color-text-primary)]">输入提示词与视频</h4>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                            复制拆解提示词，并提供视频链接或文件。
                        </p>
                        <div className="space-y-2.5 pt-2">
                            <div className="flex gap-2">
                                <button
                                    onClick={() => copyToClipboard(DECONSTRUCTION_PROMPT, 'prompt')}
                                    disabled={isCopyingPrompt}
                                    className={`flex-1 text-xs py-2.5 flex items-center justify-center gap-2 rounded-lg border transition-all duration-200 ${isCopyingPrompt
                                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-transparent hover:bg-purple-500/10 hover:text-purple-600 hover:border-purple-500/20'
                                        }`}
                                >
                                    {isCopyingPrompt ? <Check size={14} /> : <Copy size={14} />}
                                    {isCopyingPrompt ? '已复制' : '复制提示词'}
                                </button>
                                <button
                                    onClick={() => setShowPromptPreview(true)}
                                    className="px-3 py-2.5 rounded-lg border border-transparent bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
                                    title="预览提示词"
                                >
                                    <Eye size={14} />
                                </button>
                            </div>
                            <button
                                onClick={() => copyToClipboard(project?.sourceUrl || '', 'url')}
                                disabled={!project?.sourceUrl}
                                className={`w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-lg border transition-all duration-200 disabled:opacity-50 ${isCopyingUrl
                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                    : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-transparent hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/20'
                                    }`}
                            >
                                {isCopyingUrl ? <Check size={14} /> : <Youtube size={14} />}
                                {isCopyingUrl ? '已复制链接' : '复制 YouTube 链接'}
                            </button>
                        </div>
                    </div>

                    {/* Step 3 */}
                    <div className="glass-card p-6 space-y-4 relative overflow-hidden group hover:border-amber-500/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-1" style={{ animationDelay: '200ms' }}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
                            <span className="text-8xl font-bold bg-gradient-to-br from-amber-500 to-transparent bg-clip-text text-transparent">3</span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 mb-2 ring-1 ring-amber-500/20 group-hover:bg-amber-500/20 transition-colors">
                            <span className="font-bold text-lg">3</span>
                        </div>
                        <h4 className="font-semibold text-[var(--color-text-primary)]">上传辅助文件</h4>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                            上传分镜 JSON 和首帧图，辅助 AI 对齐分镜。
                        </p>
                        <div className="bg-[var(--color-bg-secondary)]/50 rounded-lg p-4 text-xs text-[var(--color-text-secondary)] border border-[var(--glass-border)] backdrop-blur-sm space-y-3">
                            <button
                                onClick={copySegmentationJson}
                                disabled={isCopyingSegmentation || assetsChecking || !assetsReady}
                                className={`w-full text-xs py-2.5 flex items-center justify-center gap-2 rounded-lg border transition-all duration-200 disabled:opacity-60 ${isCopyingSegmentation
                                    ? 'bg-green-500/10 text-green-600 border-green-500/20'
                                    : assetsReady
                                        ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-transparent hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/20'
                                        : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] border-transparent cursor-not-allowed'
                                    }`}
                            >
                                {isCopyingSegmentation ? <Check size={14} /> : <Copy size={14} />}
                                {assetsChecking
                                    ? '检查中...'
                                    : assetsReady
                                        ? isCopyingSegmentation ? '已复制分镜 JSON' : '复制分镜 JSON'
                                        : '等待分镜资产生成'}
                            </button>
                            <div className="text-[11px] leading-relaxed opacity-80">
                                首帧图：请在工作空间的首帧图文件夹中选择对应图片一起上传（无需显示路径）。
                            </div>
                        </div>
                    </div>

                    {/* Step 4 */}
                    <div className="glass-card p-6 space-y-4 relative overflow-hidden group hover:border-green-500/40 hover:shadow-lg transition-all duration-300 hover:-translate-y-1" style={{ animationDelay: '300ms' }}>
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-15 transition-opacity duration-500">
                            <span className="text-8xl font-bold bg-gradient-to-br from-green-500 to-transparent bg-clip-text text-transparent">4</span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center text-green-600 mb-2 ring-1 ring-green-500/20 group-hover:bg-green-500/20 transition-colors">
                            <span className="font-bold text-lg">4</span>
                        </div>
                        <h4 className="font-semibold text-[var(--color-text-primary)]">获取结果</h4>
                        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                            等待 AI 完成，粘贴 Round 1 的 JSON 与 Round 2 的 Markdown（角色说明 + 分镜表格），自动保存到工作空间。
                        </p>
                        <div className="glass-card bg-gradient-to-r from-green-500/5 to-emerald-500/5 border border-green-500/10 p-3 text-xs text-green-600/90 dark:text-green-400/90">
                            <p className="flex items-center gap-1.5 font-medium mb-1">
                                <MessageSquare size={13} />
                                提示
                            </p>
                            <p className="opacity-90 leading-relaxed">粘贴后自动写入 deconstruction.json，可刷新或切换步骤，内容保留。</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Editors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="glass-card p-1 flex flex-col h-[480px] group focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg-light)] rounded-t-xl backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                                <FileText size={16} className="text-blue-500" />
                                <span className="text-sm font-medium">Round 1（宏观骨架 + 钩子）</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]">
                            {round1Error && <span className="text-amber-400 text-xs">{round1Error}</span>}
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-bg-secondary)]/50 border border-[var(--glass-border)]" title="字数统计">
                                <Type size={14} />
                                <span className="text-xs font-mono">{round1Text.length}</span>
                            </div>
                        </div>
                    </div>
                    <textarea
                        value={round1Text}
                        onChange={handleRound1Change}
                        placeholder={`{\n  \"round1_skeleton\": {\n    \"logic_chain\": \"...\",\n    \"skeleton_nodes\": [\"...\"],\n    \"viral_elements_found\": [{\"category\": \"暴力\", \"element\": \"...\", \"timestamp\": \"5.267s\", \"description\": \"...\"}]\n  },\n  \"round1_hook\": {\n    \"visual_hook\": \"...\",\n    \"audio_hook\": \"...\",\n    \"retention_strategy\": \"...\",\n    \"beat1_reference\": \"...\"\n  }\n}`}
                        className={`flex-1 w-full bg-[var(--color-bg-secondary)]/30 rounded-b-xl p-4 font-mono text-sm resize-none outline-none transition-all text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] leading-relaxed selection:bg-blue-500/20 ${round1Error ? 'border border-amber-500/50' : ''}`}
                        spellCheck={false}
                    />
                </div>

                <div className="glass-card p-1 flex flex-col h-[480px] group focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/30 transition-all duration-300">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg-light)] rounded-t-xl backdrop-blur-md">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-[var(--color-text-primary)]">
                                <FileText size={16} className="text-purple-500" />
                                <span className="text-sm font-medium">Round 2（全维填空）</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-[var(--color-text-tertiary)]">
                            {round2Error && <span className="text-amber-400 text-xs">{round2Error}</span>}
                            <button
                                onClick={() => copyToClipboard(`${round1Text}\n\n${round2Text}`, 'content')}
                                className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-text-primary)] transition-colors text-xs"
                                title="复制两段输入"
                            >
                                {isCopyingContent ? <Check size={14} className="text-green-500" /> : <Clipboard size={14} />}
                                <span>{isCopyingContent ? '已复制' : '复制'}</span>
                            </button>
                            <div className="h-3 w-[1px] bg-[var(--glass-border)]" />
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-bg-secondary)]/50 border border-[var(--glass-border)]" title="字数统计">
                                <Type size={14} />
                                <span className="text-xs font-mono">{round2Text.length}</span>
                            </div>
                        </div>
                    </div>
                    <textarea
                        value={round2Text}
                        onChange={handleRound2Change}
                        placeholder={`\u3010\u89d2\u8272\u8bf4\u660e\u3011(\u7528\u4e8e\u89d2\u8272\u5e93)\n\`\`\`text\n\u3010\u9ed1\u53d1\u683c\u7eb9\u7537\u3011 = ...\n\u3010\u7c89\u53d1\u7537\u3011 = ...\n\`\`\`\n\n|\u5e8f\u53f7|\u5f00\u59cb\u65f6\u95f4|\u7ed3\u675f\u65f6\u95f4|\u65f6\u957f|\u9996\u5e27\u6587\u4ef6\u540d|\u753b\u9762\u63d0\u793a\u8bcd (Image Prompt)|\u89c6\u9891\u63d0\u793a\u8bcd (Video Prompt)|\n|:---|:---|:---|:---|:---|:---|:---|\n|1|0.000s|1.900s|1.900s|frame_001_0.000s.jpg|\u753b\u9762...|\u89c6\u9891...|`}
                        className={`flex-1 w-full bg-[var(--color-bg-secondary)]/30 rounded-b-xl p-4 font-mono text-sm resize-none outline-none transition-all text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] leading-relaxed selection:bg-blue-500/20 ${round2Error ? 'border border-amber-500/50' : ''}`}
                        spellCheck={false}
                    />
                </div>
            </div>

            {/* Prompt Preview Modal */}
            {showPromptPreview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="glass-card w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 border-[var(--glass-border-strong)]">
                        <div className="flex items-center justify-between p-4 border-b border-[var(--glass-border)]">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-purple-500" />
                                提示词预览
                            </h3>
                            <button
                                onClick={() => setShowPromptPreview(false)}
                                className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 bg-[var(--color-bg-secondary)]/30">
                            <pre className="whitespace-pre-wrap font-mono text-sm text-[var(--color-text-primary)] leading-relaxed">
                                {DECONSTRUCTION_PROMPT}
                            </pre>
                        </div>
                        <div className="p-4 border-t border-[var(--glass-border)] flex justify-end gap-3 bg-[var(--glass-bg-light)]">
                            <button
                                onClick={() => setShowPromptPreview(false)}
                                className="apple-button-secondary text-sm px-4 py-2"
                            >
                                关闭
                            </button>
                            <button
                                onClick={() => copyToClipboard(DECONSTRUCTION_PROMPT, 'prompt')}
                                className="apple-button-primary text-sm px-4 py-2 flex items-center gap-2"
                            >
                                {isCopyingPrompt ? <Check size={16} /> : <Copy size={16} />}
                                {isCopyingPrompt ? '已复制' : '复制提示词'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
