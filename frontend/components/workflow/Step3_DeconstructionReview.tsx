'use client';

import '@/styles/liquid-glass.css';
import { RefreshCw, Volume2, VolumeX, AlertCircle, Trash2, X, Zap, Users, Box, Layout, Film, ArrowRight, Check, Copy, MessageSquare, ClipboardPaste, GitBranch, Anchor, Pencil, ChevronLeft, ChevronRight, ArrowLeftRight, AlertTriangle, Ruler, Palette, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import { useWorkspace } from '@/components/WorkspaceContext';
import { parseRound1, parseRound2, parseStoredDeconstruction } from '@/lib/services/deconstruction';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';
import { AutoTextArea } from '@/components/ui/AutoTextArea';
import { ShotCard } from '@/components/workflow/ShotCard';
import { ProviderConfigModal } from '@/components/workflow/ProviderConfigModal';
import { VideoConfigModal, VideoGenConfig } from '@/components/workflow/VideoConfigModal';
import { Video, FolderOutput, Loader2, Image as ImageIcon } from 'lucide-react';
import { Settings } from 'lucide-react';
import {
    fetchCharacterReferences,
    fetchReferenceGallery,
    fetchCategories,
    fetchCategoryPrompts,
    saveCharacterReferences,
    uploadReferenceImage,
    deleteReferenceImage,
    renameReferenceImage,
    createCategory,
    renameCategory,
    deleteCategory,
    saveCategoryPrompt,
    type ReferenceImage,
    type CharacterReferenceMap,
    type CategoryPromptMap,
} from '@/lib/services/referenceGallery';
import {
    fetchImagePresets,
    createImagePreset,
    updateImagePreset,
    deleteImagePreset,
    getWorkspaceImagePreset,
    setWorkspaceImagePreset,
    type ImagePreset,
} from '@/lib/services/imagePresets';
import {
    ReviewMode,
    AssetItem,
    Round1Data,
    Round2Data,
    Round2Shot,
    DeletedShot,
    OptimizedStoryboardPayload,
    StructuredInitialFrame
} from '@/types/deconstruction';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

type AnnotationMap = Record<string, string>;
type PendingGeneration = { taskId: string; startedAt: number };

interface Step3Props {
    /** 隐藏批注功能 */
    hideAnnotations?: boolean;
    /** 隐藏 JSON 对比功能 */
    hideCompare?: boolean;
    /** 隐藏模式切换（只保持 review 模式） */
    hideModeSwitcher?: boolean;
}

export default function Step3_DeconstructionReview({
    hideAnnotations = false,
    hideCompare = false,
    hideModeSwitcher = false,
}: Step3Props = {}) {
    const { project, updateDeconstruction } = useWorkflowStore();
    const {
        saveDeconstruction,
        currentWorkspace,
        deconstructionFiles,
        selectedDeconstructionFile,
        switchDeconstructionFile,
    } = useWorkspace();
    const { nextStep } = useStepNavigator();
    const [mode, setMode] = useState<ReviewMode>('review');


    const [assets, setAssets] = useState<AssetItem[]>([]);
    const [round1Data, setRound1Data] = useState<Round1Data | string | null>(null);
    const [round2Data, setRound2Data] = useState<Round2Data | string | null>(null);
    const [round1Error, setRound1Error] = useState<string | null>(null);
    const [round2Error, setRound2Error] = useState<string | null>(null);
    const [round1Text, setRound1Text] = useState('');
    const [round2Text, setRound2Text] = useState('');
    const [, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
    const [optimizedAnalysis, setOptimizedAnalysis] = useState<NonNullable<OptimizedStoryboardPayload['optimization_analysis']> | null>(null);
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
    // Reference gallery
    const [referenceGallery, setReferenceGallery] = useState<ReferenceImage[]>([]);
    const [galleryLoading, setGalleryLoading] = useState(false);
    const [galleryError, setGalleryError] = useState<string | null>(null);
    const [categories, setCategories] = useState<string[]>([]);
    const [characterRefs, setCharacterRefs] = useState<CharacterReferenceMap>({});
    const [refsSaving, setRefsSaving] = useState(false);
    const [showGalleryModal, setShowGalleryModal] = useState(false);
    const [activeCharacterForPick, setActiveCharacterForPick] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [renameCategoryInput, setRenameCategoryInput] = useState('');
    const [renamingCharacter, setRenamingCharacter] = useState<string | null>(null);
    const [renamingCharacterValue, setRenamingCharacterValue] = useState('');
    const [activeCategoryTab, setActiveCategoryTab] = useState<string>('all');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [renamingCategoryName, setRenamingCategoryName] = useState('');
    const [categorySaving, setCategorySaving] = useState(false);
    const [showDeleteCategoryConfirm, setShowDeleteCategoryConfirm] = useState(false);
    const [deleteCategoryMode, setDeleteCategoryMode] = useState<'move' | 'clear'>('move');
    const [categoryPrompts, setCategoryPrompts] = useState<CategoryPromptMap>({});
    const [categoryPromptInput, setCategoryPromptInput] = useState('');
    const [categoryPromptSaving, setCategoryPromptSaving] = useState(false);
    const [newCharacterName, setNewCharacterName] = useState('');
    const [newCharacterDesc, setNewCharacterDesc] = useState('');
    const [showAddCharacterModal, setShowAddCharacterModal] = useState(false);
    // Image preset library
    const [imagePresets, setImagePresets] = useState<ImagePreset[]>([]);
    const [imagePresetLoading, setImagePresetLoading] = useState(false);
    const [imagePresetError, setImagePresetError] = useState<string | null>(null);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [showProviderModal, setShowProviderModal] = useState(false);
    const [showVideoConfigModal, setShowVideoConfigModal] = useState(false);
    const [videoGenConfig, setVideoGenConfig] = useState<VideoGenConfig | null>(null);
    const [selectedImagePresetId, setSelectedImagePresetId] = useState<string | null>(null);
    // Shot pagination
    const [shotPage, setShotPage] = useState(0);
    const shotsPerPage = 5;
    const [workspacePresetSnapshot, setWorkspacePresetSnapshot] = useState<ImagePreset | null>(null);
    const [presetForm, setPresetForm] = useState<{ content: string }>({ content: '' });
    const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
    const [presetSaving, setPresetSaving] = useState(false);
    // Generated images per shot
    const [generatedImages, setGeneratedImages] = useState<Record<number, string[]>>({});
    const generatedImagesRef = useRef<Record<number, string[]>>({});
    const [generatedIndexes, setGeneratedIndexes] = useState<Record<number, number>>({});
    const [savedIndexes, setSavedIndexes] = useState<Record<number, number>>({});
    const [savedImageFilenames, setSavedImageFilenames] = useState<Record<string, string | number>>({}); // 保存的文件名映射（关键状态）
    const [savedIndexesLoaded, setSavedIndexesLoaded] = useState(false); // 区分"加载中"vs"加载完成但为空"
    const savedIndexesRef = useRef<Record<number, number>>({});
    const [generatingShots, setGeneratingShots] = useState<Record<number, boolean>>({});
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [generateErrors, setGenerateErrors] = useState<Record<number, string | undefined>>({});
    const [newlyGenerated, setNewlyGenerated] = useState<Record<number, string[]>>({});
    // Video generation state
    const [generatingVideoShots, setGeneratingVideoShots] = useState<Record<number, boolean>>({});
    const [videoTaskStatuses, setVideoTaskStatuses] = useState<Record<number, 'pending' | 'processing' | 'completed' | 'failed' | null>>({});
    const [videoProgress, setVideoProgress] = useState<Record<number, number>>({}); // 视频生成进度 0-100
    const [videoTaskProgresses, setVideoTaskProgresses] = useState<Record<number, Array<{ taskId: string; progress: number; status: string; startTime: number }>>>({}); // 每个任务的进度
    const [newlyGeneratedVideos, setNewlyGeneratedVideos] = useState<Record<number, string[]>>({});  // 新生成的视频 URL
    const [generatedVideos, setGeneratedVideos] = useState<Record<number, string[]>>({});  // 视频列表
    const [selectedVideoIndexes, setSelectedVideoIndexes] = useState<Record<number, number[]>>({});  // 选中的视频索引（多选）
    const [savedVideoIndexes, setSavedVideoIndexes] = useState<Record<number, number[]>>({});  // 已保存的视频索引（多选）
    const [savedVideoIndexesLoaded, setSavedVideoIndexesLoaded] = useState(false);  // 是否已加载保存的视频索引
    const [defaultStream, setDefaultStream] = useState<'image' | 'video' | 'outline'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('defaultStream');
            if (saved === 'video') return 'video';
            if (saved === 'image') return 'image';
            return 'outline';  // 默认线稿
        }
        return 'outline';  // 默认线稿
    });  // 所有镜头卡片的默认素材流
    // Outline generation state
    const [outlineModes, setOutlineModes] = useState<Record<number, boolean>>({});  // 每个镜头的线稿模式状态
    const [outlinePrompts, setOutlinePrompts] = useState<Record<number, string>>({});  // 每个镜头的线稿提示词
    const [generatedOutlines, setGeneratedOutlines] = useState<Record<number, string[]>>({});  // 每个镜头的线稿图列表
    const [activeOutlineUrls, setActiveOutlineUrls] = useState<Record<number, string>>({});  // 每个镜头选中的线稿图
    const [generatingOutlines, setGeneratingOutlines] = useState<Record<number, boolean>>({});  // 正在生成线稿的镜头
    const [batchGeneratingOutlines, setBatchGeneratingOutlines] = useState(false);  // 批量生成线稿中
    const isMountedRef = useRef(true);  // 组件是否挂载（用于防止卸载后清除 pending 状态）
    const [outlineProgress, setOutlineProgress] = useState({ completed: 0, total: 0 });  // 线稿生成进度
    // 全局线稿模式配置（从 workspace 加载）
    const [globalOutlineMode, setGlobalOutlineMode] = useState<boolean>(false);
    const [globalOutlinePrompt, setGlobalOutlinePrompt] = useState<string>('');
    const [globalCharRefTemplate, setGlobalCharRefTemplate] = useState<string>('');
    const [globalSceneRefTemplate, setGlobalSceneRefTemplate] = useState<string>('');
    // Provider selection per shot
    const [providers, setProviders] = useState<Array<{ id: string; name: string; is_default?: boolean }>>([]);
    const [shotProviders, setShotProviders] = useState<Record<number, string>>({});
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [previewImage, setPreviewImage] = useState<{ url: string; name?: string } | null>(null);
    const canEdit = mode === 'review';
    const showToast = (message: string, type: 'success' | 'error') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };
    const allowAnnotations = mode === 'review' && !hideAnnotations;
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

    // 组件卸载时标记
    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // 持久化 defaultStream
    useEffect(() => {
        localStorage.setItem('defaultStream', defaultStream);
    }, [defaultStream]);

    // 加载全局线稿配置（所有工作空间共用）
    useEffect(() => {
        fetch(`${API_BASE}/api/outline-config`)
            .then(res => res.ok ? res.json() : null)
            .then(config => {
                if (config) {
                    setGlobalOutlineMode(config.globalOutlineMode ?? false);
                    setGlobalOutlinePrompt(config.globalOutlinePrompt ?? '');
                    setGlobalCharRefTemplate(config.charRefTemplate ?? '');
                    setGlobalSceneRefTemplate(config.sceneRefTemplate ?? '');
                }
            })
            .catch(err => console.error('Failed to load outline config:', err));
    }, []);

    // 保存全局线稿配置
    const saveOutlineConfig = async (config?: {
        mode?: boolean;
        prompt?: string;
        charRefTemplate?: string;
        sceneRefTemplate?: string;
    }) => {
        try {
            await fetch(`${API_BASE}/api/outline-config`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    globalOutlineMode: config?.mode ?? globalOutlineMode,
                    globalOutlinePrompt: config?.prompt ?? globalOutlinePrompt,
                    charRefTemplate: config?.charRefTemplate ?? globalCharRefTemplate,
                    sceneRefTemplate: config?.sceneRefTemplate ?? globalSceneRefTemplate,
                }),
            });
        } catch (err) {
            console.error('Failed to save outline config:', err);
        }
    };

    // 更新全局线稿模式时同步保存
    const handleSetGlobalOutlineMode = (mode: boolean) => {
        setGlobalOutlineMode(mode);
        saveOutlineConfig({ mode });
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
    const deconstructionPath = currentWorkspace?.path && selectedDeconstructionFile
        ? `${currentWorkspace.path}/${selectedDeconstructionFile}`
        : currentWorkspace?.path
            ? `${currentWorkspace.path}/deconstruction.json`
            : '';
    const generatedDir = useMemo(() => {
        const base = (selectedDeconstructionFile || '').split('/').pop()?.trim() || '';
        const match = base.match(/^deconstruction_(.+)\.json$/);
        if (match && match[1]) {
            return `generated_${match[1]}`;
        }
        return 'generated';
    }, [selectedDeconstructionFile]);
    const generatedStorageKey = workspaceSlug
        ? `generatedImages:${workspaceSlug}:${generatedDir}`
        : null;
    const pendingGenKey = workspaceSlug ? `pendingGenerations:${workspaceSlug}:${generatedDir}` : null;
    const pendingOutlineKey = workspaceSlug ? `pendingOutlineGenerations:${workspaceSlug}` : null;

    // 线稿生成持久化类型
    type PendingOutline = { startedAt: number; lastOutlineCount: number };

    // 读取 pending outline generations
    const readPendingOutlines = useCallback((): Record<number, PendingOutline> => {
        if (!pendingOutlineKey) return {};
        try {
            const raw = localStorage.getItem(pendingOutlineKey);
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    }, [pendingOutlineKey]);

    // 写入 pending outline generations
    const writePendingOutlines = useCallback((pending: Record<number, PendingOutline>) => {
        if (!pendingOutlineKey) return;
        try {
            localStorage.setItem(pendingOutlineKey, JSON.stringify(pending));
        } catch { /* ignore */ }
    }, [pendingOutlineKey]);

    // 清除单个 pending outline
    const clearPendingOutline = useCallback((shotId: number) => {
        const pending = readPendingOutlines();
        delete pending[shotId];
        writePendingOutlines(pending);
    }, [readPendingOutlines, writePendingOutlines]);

    // newlyGeneratedVideos 的 localStorage key
    const newVideosStorageKey = workspaceSlug
        ? `newlyGeneratedVideos:${workspaceSlug}:${generatedDir}`
        : null;

    // 加载 newlyGeneratedVideos
    useEffect(() => {
        if (!newVideosStorageKey) return;
        try {
            const saved = localStorage.getItem(newVideosStorageKey);
            if (saved) {
                const parsed = JSON.parse(saved) as Record<number, string[]>;
                setNewlyGeneratedVideos(parsed);
            }
        } catch { /* ignore */ }
    }, [newVideosStorageKey]);

    // 保存 newlyGeneratedVideos
    useEffect(() => {
        if (!newVideosStorageKey) return;
        localStorage.setItem(newVideosStorageKey, JSON.stringify(newlyGeneratedVideos));
    }, [newlyGeneratedVideos, newVideosStorageKey]);

    // 加载已有线稿 + 恢复 pending 状态
    // 【关键修复】必须等待 savedIndexesLoaded 完成后再加载，避免占用请求队列导致 selected-images API 被延迟
    useEffect(() => {
        if (!currentWorkspace?.path) return;
        if (!savedIndexesLoaded) return; // 等待选中图片数据加载完成
        const loadOutlines = async () => {
            try {
                // 获取 round2 数据中的 shots
                if (typeof round2Data === 'string' || !round2Data?.shots) return;
                const shots = round2Data.shots;
                const outlinesMap: Record<number, string[]> = {};

                for (const shot of shots) {
                    const shotId = shot.id ?? (shots.indexOf(shot) + 1);
                    const resp = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/outlines?shot_id=${shotId}`);
                    if (resp.ok) {
                        const data = await resp.json() as { outlines: string[] };
                        if (data.outlines && data.outlines.length > 0) {
                            outlinesMap[shotId] = data.outlines;
                            // 不自动选中，保持未选中状态
                        }
                    }
                }
                setGeneratedOutlines(outlinesMap);

                // 从后端加载保存的线稿选择（只有保存过的才会选中）
                try {
                    const savedResp = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-outlines?generated_dir=${generatedDir}`);
                    if (savedResp.ok) {
                        const savedData = await savedResp.json() as { urls: Record<string, string> };
                        if (savedData.urls && Object.keys(savedData.urls).length > 0) {
                            const savedMap: Record<number, string> = {};
                            for (const [shotIdStr, url] of Object.entries(savedData.urls)) {
                                const shotId = Number(shotIdStr);
                                // 只有当 URL 仍然存在于线稿列表中时才使用
                                if (outlinesMap[shotId]?.includes(url)) {
                                    savedMap[shotId] = url;
                                }
                            }
                            setActiveOutlineUrls(savedMap);
                        }
                        // 没有保存数据时不设置，保持未选中状态
                    }
                } catch {
                    // 请求失败时不设置，保持未选中状态
                }

                // 恢复 pending outline 状态
                const pending = readPendingOutlines();
                const TIMEOUT_MS = 2 * 60 * 1000; // 2分钟超时
                const now = Date.now();
                const toRestore: Record<number, boolean> = {};
                const toCleanup: number[] = [];

                for (const [shotIdStr, info] of Object.entries(pending)) {
                    const shotId = Number(shotIdStr);
                    const elapsed = now - info.startedAt;
                    const currentCount = outlinesMap[shotId]?.length || 0;

                    if (elapsed > TIMEOUT_MS) {
                        // 超时，清除
                        toCleanup.push(shotId);
                    } else if (currentCount > info.lastOutlineCount) {
                        // 已有新线稿，生成完成
                        toCleanup.push(shotId);
                    } else {
                        // 仍在生成中（可能后端还在处理）
                        toRestore[shotId] = true;
                    }
                }

                // 清除已完成或超时的 pending
                if (toCleanup.length > 0) {
                    const newPending = { ...pending };
                    toCleanup.forEach(id => delete newPending[id]);
                    writePendingOutlines(newPending);
                }

                // 恢复生成中状态
                if (Object.keys(toRestore).length > 0) {
                    setGeneratingOutlines(prev => ({ ...prev, ...toRestore }));
                    // 启动轮询检查是否已完成
                    const pollInterval = setInterval(async () => {
                        const stillPending = readPendingOutlines();
                        let allDone = true;

                        for (const shotIdStr of Object.keys(stillPending)) {
                            const shotId = Number(shotIdStr);
                            const info = stillPending[shotId];
                            const elapsed = Date.now() - info.startedAt;

                            if (elapsed > TIMEOUT_MS) {
                                clearPendingOutline(shotId);
                                setGeneratingOutlines(prev => ({ ...prev, [shotId]: false }));
                                continue;
                            }

                            // 检查是否有新线稿
                            try {
                                const resp = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/outlines?shot_id=${shotId}`);
                                if (resp.ok) {
                                    const data = await resp.json() as { outlines: string[] };
                                    if ((data.outlines?.length || 0) > info.lastOutlineCount) {
                                        // 生成完成
                                        setGeneratedOutlines(prev => ({
                                            ...prev,
                                            [shotId]: data.outlines,
                                        }));
                                        // 不自动选中，保持未选中状态，用户需手动选择
                                        clearPendingOutline(shotId);
                                        setGeneratingOutlines(prev => ({ ...prev, [shotId]: false }));
                                    } else {
                                        allDone = false;
                                    }
                                }
                            } catch { /* ignore */ }
                        }

                        if (allDone || Object.keys(readPendingOutlines()).length === 0) {
                            clearInterval(pollInterval);
                        }
                    }, 3000); // 每3秒检查一次

                    // 组件卸载时清除轮询
                    return () => clearInterval(pollInterval);
                }
            } catch (err) {
                console.error('加载线稿失败:', err);
            }
        };
        loadOutlines();
    }, [currentWorkspace?.path, round2Data, savedIndexesLoaded, readPendingOutlines, writePendingOutlines, clearPendingOutline]);

    const activeImagePreset = useMemo(() => {
        return imagePresets.find((p) => p.id === selectedImagePresetId) || workspacePresetSnapshot;
    }, [imagePresets, selectedImagePresetId, workspacePresetSnapshot]);
    const presetLabel = useCallback((p: ImagePreset) => {
        const text = (p.content || '').trim();
        if (!text) return '生图设定';
        const single = text.replace(/\s+/g, ' ');
        return single.slice(0, 24) || '生图设定';
    }, []);
    const probedShotsRef = useRef<Set<number>>(new Set());
    const taskPollersRef = useRef<Record<string, NodeJS.Timeout>>({});
    const readPendingGenerations = useCallback((): Record<number, PendingGeneration> => {
        if (!pendingGenKey) return {};
        try {
            const raw = localStorage.getItem(pendingGenKey);
            if (!raw) return {};
            const parsed = JSON.parse(raw) as Record<number, number | PendingGeneration>;
            const now = Date.now();
            const fresh: Record<number, PendingGeneration> = {};
            Object.entries(parsed).forEach(([k, v]) => {
                if (typeof v === 'number') {
                    if (now - v < 6 * 60 * 1000) {
                        fresh[Number(k)] = { taskId: '', startedAt: v };
                    }
                    return;
                }
                const ts = v?.startedAt ?? 0;
                if (ts && now - ts < 6 * 60 * 1000) {
                    fresh[Number(k)] = { taskId: v.taskId || '', startedAt: ts };
                }
            });
            if (Object.keys(fresh).length !== Object.keys(parsed).length) {
                localStorage.setItem(pendingGenKey, JSON.stringify(fresh));
            }
            return fresh;
        } catch {
            return {};
        }
    }, [pendingGenKey]);

    const writePendingGenerations = useCallback((pending: Record<number, PendingGeneration>) => {
        if (!pendingGenKey) return;
        try {
            localStorage.setItem(pendingGenKey, JSON.stringify(pending));
        } catch {
            // ignore
        }
    }, [pendingGenKey]);

    const appendNewImages = useCallback((shotId: number, urls: string[]) => {
        const normalized = urls
            .map((u) => {
                if (!u) return '';
                if (u.startsWith('http')) return u;
                return `${API_BASE}${u.startsWith('/') ? '' : '/'}${u}`;
            })
            .filter(Boolean);
        if (!normalized.length) return;

        // 关键修复：先计算合并后的图片列表，然后传递给索引匹配逻辑
        // 不能依赖 generatedImagesRef，因为 ref 是通过 useEffect 异步更新的
        let mergedImages: string[] = [];
        setGeneratedImages((prev) => {
            mergedImages = Array.from(new Set([...(prev[shotId] || []), ...normalized]));
            return { ...prev, [shotId]: mergedImages };
        });

        // 设置默认浏览索引（如果还没有的话）
        // 注意：选中图片的匹配由专门的 useEffect 处理（依赖 savedIndexes + generatedImages）
        setGeneratedIndexes((prev) => {
            if (typeof prev[shotId] === 'number') return prev;
            // 先尝试从 window 临时变量中获取文件名匹配（尝试多种 key 格式）
            const savedFilenames = (window as unknown as Record<string, unknown>).__savedImageFilenames as Record<string, string | number> || {};
            const possibleKeys = [String(shotId), shotId.toFixed(1), String(Math.floor(shotId))];
            let filename: string | undefined;
            for (const key of possibleKeys) {
                const val = savedFilenames[key];
                if (typeof val === 'string') {
                    filename = val;
                    break;
                }
            }
            if (filename) {
                // 关键修复：使用刚才计算的 mergedImages，而不是可能陈旧的 ref
                const imgs = mergedImages.length ? mergedImages : (generatedImagesRef.current[shotId] || []);
                const foundIdx = imgs.findIndex(url => url.endsWith(filename!) || url.includes(`/${filename}`));
                if (foundIdx >= 0) {
                    return { ...prev, [shotId]: foundIdx };
                }
                // 有保存记录但匹配失败，不自动选择其他图片
                return prev;
            }
            // 没有保存记录，不自动选择，保持未选中状态
            return prev;
        });
        setNewlyGenerated((prev) => {
            const existing = prev[shotId] || [];
            const merged = Array.from(new Set([...existing, ...normalized]));
            return { ...prev, [shotId]: merged };
        });
    }, []);

    useEffect(() => {
        generatedImagesRef.current = generatedImages;
    }, [generatedImages]);

    // Try to auto-detect existing generated images on disk (fallback: image_url_1.png)
    const loadExistingImagesForShot = useCallback(async (shotId: number) => {
        if (!workspaceSlug || !currentWorkspace?.path) return;
        if (probedShotsRef.current.has(shotId) && !(generatedImagesRef.current[shotId]?.length)) return;
        const labels = new Set<string>();
        labels.add(String(shotId));
        if (Number.isInteger(shotId)) {
            labels.add(shotId.toFixed(1));
        }
        const found: string[] = [];
        for (const label of labels) {
            try {
                const url = `${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/generated?shot_id=${encodeURIComponent(label)}&generated_dir=${encodeURIComponent(generatedDir)}`;
                const resp = await fetch(url);
                if (resp.ok) {
                    const data = await resp.json() as { files?: string[] };
                    if (Array.isArray(data.files) && data.files.length) {
                        // 只加载图片，过滤掉视频文件
                        data.files
                            .filter((f: string) => !f.endsWith('.mp4') && !f.endsWith('.webm'))
                            .forEach((f: string) => found.push(f.startsWith('http') ? f : `${API_BASE}${f.startsWith('/') ? '' : '/'}${f}`));
                    }
                }
            } catch {
                // ignore
            }
        }
        if (found.length) {
            let merged: string[] = [];
            setGeneratedImages((prev) => {
                merged = Array.from(new Set([...(prev[shotId] || []), ...found]));
                return { ...prev, [shotId]: merged };
            });
            // 注意：不在这里设置默认索引！
            // 索引的设置由下方的 useEffect（依赖 savedIndexes, generatedImages, savedIndexesLoaded）统一处理
            // 这样可以确保在 selected-images API 返回后再设置正确的索引
            probedShotsRef.current.add(shotId);
        } else {
            probedShotsRef.current.add(shotId);
        }
    }, [workspaceSlug, currentWorkspace?.path, generatedDir]);

    const clearTaskPoller = useCallback((taskId: string) => {
        const timer = taskPollersRef.current[taskId];
        if (timer) {
            clearTimeout(timer);
            delete taskPollersRef.current[taskId];
        }
    }, []);

    // 加载镜头的所有视频
    const loadVideosForShot = useCallback(async (shotId: number, markAsNew = false) => {
        if (!currentWorkspace?.path) return;
        // 同时查询整数和小数格式的目录（如 1 和 1.0）
        const labels = [String(shotId), shotId.toFixed(1)];
        const allVideos: string[] = [];
        for (const label of labels) {
            try {
                const url = `${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/generated?shot_id=${encodeURIComponent(label)}&generated_dir=${encodeURIComponent(generatedDir)}`;
                const resp = await fetch(url);
                if (!resp.ok) continue;
                const data = await resp.json() as { files?: string[] };
                const files = data.files || [];
                // 过滤出视频文件
                files.filter(f => f.endsWith('.mp4') || f.endsWith('.webm'))
                    .forEach(f => allVideos.push(f));
            } catch {
                // ignore
            }
        }
        if (allVideos.length > 0) {
            const unique = Array.from(new Set(allVideos));
            // 标记新增的视频
            if (markAsNew) {
                setGeneratedVideos(prev => {
                    const oldList = prev[shotId] || [];
                    const newItems = unique.filter(v => !oldList.includes(v));
                    if (newItems.length > 0) {
                        setNewlyGeneratedVideos(prevNew => ({
                            ...prevNew,
                            [shotId]: [...(prevNew[shotId] || []), ...newItems]
                        }));
                    }
                    return { ...prev, [shotId]: unique };
                });
            } else {
                setGeneratedVideos(prev => ({ ...prev, [shotId]: unique }));
            }
            // 不在这里设置默认索引，等 selected-videos API 返回后再统一设置
        }
    }, [currentWorkspace?.path, generatedDir]);

    const pollTaskStatus = useCallback(
        async (shotId: number, taskId: string, attempt = 0) => {
            if (!currentWorkspace?.path) return;
            const url = `${API_BASE}/api/image-tasks/${taskId}?workspace_path=${encodeURIComponent(currentWorkspace.path)}&generated_dir=${encodeURIComponent(generatedDir)}`;
            try {
                const resp = await fetch(url, { cache: 'no-store' });
                if (!resp.ok) throw new Error(`状态 ${resp.status}`);
                const data = (await resp.json()) as { task?: { status?: string; files?: string[]; error?: string } };
                const task = data?.task;
                if (!task) throw new Error('任务不存在');
                if (task.status === 'succeeded') {
                    appendNewImages(shotId, task.files || []);
                    setGeneratingShots((prev) => {
                        const next = { ...prev };
                        delete next[shotId];
                        return next;
                    });
                    setGenerateErrors((prev) => ({ ...prev, [shotId]: undefined }));
                    const pending = readPendingGenerations();
                    delete pending[shotId];
                    writePendingGenerations(pending);
                    clearTaskPoller(taskId);
                    setToast({ message: `生成图片成功（${(task.files || []).length} 张）`, type: 'success' });
                    setTimeout(() => setToast(null), 3000);
                    return;
                }
                if (task.status === 'failed') {
                    const detail = task.error || '生成失败，请重试';
                    setGenerateErrors((prev) => ({ ...prev, [shotId]: detail }));
                    setGeneratingShots((prev) => {
                        const next = { ...prev };
                        delete next[shotId];
                        return next;
                    });
                    const pending = readPendingGenerations();
                    delete pending[shotId];
                    writePendingGenerations(pending);
                    clearTaskPoller(taskId);
                    setToast({ message: detail, type: 'error' });
                    setTimeout(() => setToast(null), 3000);
                    return;
                }
                const delay = Math.min(5000, 1000 + attempt * 500);
                clearTaskPoller(taskId);
                taskPollersRef.current[taskId] = setTimeout(() => {
                    void pollTaskStatus(shotId, taskId, attempt + 1);
                }, delay);
            } catch {
                const delay = Math.min(6000, 1200 + attempt * 600);
                clearTaskPoller(taskId);
                taskPollersRef.current[taskId] = setTimeout(() => {
                    void pollTaskStatus(shotId, taskId, attempt + 1);
                }, delay);
            }
        },
        [appendNewImages, clearTaskPoller, currentWorkspace?.path, generatedDir, readPendingGenerations, writePendingGenerations],
    );

    const startPollingTask = useCallback(
        (shotId: number, taskId: string, delay = 600) => {
            if (!taskId) return;
            clearTaskPoller(taskId);
            taskPollersRef.current[taskId] = setTimeout(() => {
                void pollTaskStatus(shotId, taskId, 0);
            }, delay);
        },
        [clearTaskPoller, pollTaskStatus],
    );

    const loadReferenceGallery = useCallback(async () => {
        setGalleryLoading(true);
        setGalleryError(null);
        try {
            const [items, fetchedCategories, prompts] = await Promise.all([
                fetchReferenceGallery(),
                fetchCategories().catch(() => null),
                fetchCategoryPrompts().catch(() => ({} as CategoryPromptMap)),
            ]);
            setReferenceGallery(items);
            const derived = Array.from(
                new Set([
                    ...(Array.isArray(fetchedCategories) ? fetchedCategories : []),
                    ...items
                        .map((i) => (i.category ?? '').trim())
                        .filter((c) => c !== ''),
                ]),
            );
            // ensure uncategorized tab exists when needed
            const hasUncategorized = items.some((i) => !i.category || i.category.trim() === '');
            const categoriesList = hasUncategorized && !derived.includes('') ? [...derived, ''] : derived;
            setCategories(categoriesList);
            setCategoryPrompts(prompts || {});
            // keep active tab valid
            const validTabs = new Set(['all', ...categoriesList, '']);
            setActiveCategoryTab((prev) => (validTabs.has(prev) ? prev : 'all'));
        } catch (err) {
            console.error(err);
            setGalleryError('加载参考图库失败');
        } finally {
            setGalleryLoading(false);
        }
    }, []);

    const loadCharacterRefs = useCallback(async () => {
        if (!currentWorkspace?.path) return;
        try {
            const data = await fetchCharacterReferences(currentWorkspace.path);
            setCharacterRefs(data || {});
        } catch (err) {
            console.error(err);
        }
    }, [currentWorkspace?.path]);

    const refreshImagePresets = useCallback(async () => {
        setImagePresetLoading(true);
        setImagePresetError(null);
        try {
            const presets = await fetchImagePresets();
            setImagePresets(Array.isArray(presets) ? presets : []);
        } catch (err) {
            console.error(err);
            setImagePresetError('加载生图设定失败');
        } finally {
            setImagePresetLoading(false);
        }
    }, []);

    const loadWorkspaceImagePreset = useCallback(async () => {
        if (!currentWorkspace?.path) {
            setSelectedImagePresetId(null);
            setWorkspacePresetSnapshot(null);
            return;
        }
        try {
            const data = await getWorkspaceImagePreset(currentWorkspace.path);
            const pid = data?.preset_id ?? null;
            setSelectedImagePresetId(pid || null);
            setWorkspacePresetSnapshot((data?.preset as ImagePreset | undefined) ?? null);
            if (data?.preset) {
                setImagePresets((prev) => {
                    if (prev.some((p) => p.id === data.preset?.id)) return prev;
                    return [data.preset as ImagePreset, ...prev];
                });
            }
        } catch (err) {
            console.error('加载工作空间生图设定失败', err);
        }
    }, [currentWorkspace?.path]);

    const persistCharacterRefs = useCallback(
        async (next: CharacterReferenceMap) => {
            if (!currentWorkspace?.path) return;
            setRefsSaving(true);
            try {
                await saveCharacterReferences(currentWorkspace.path, next);
                setCharacterRefs(next);
            } catch (err) {
                console.error('保存参考图引用失败', err);
            } finally {
                setRefsSaving(false);
            }
        },
        [currentWorkspace?.path],
    );

    const handleBindPreset = async (presetId: string | null) => {
        if (!currentWorkspace?.path) {
            showToast('请先选择工作空间', 'error');
            return;
        }
        try {
            await setWorkspaceImagePreset(currentWorkspace.path, presetId);
            setSelectedImagePresetId(presetId);
            if (!presetId) {
                setWorkspacePresetSnapshot(null);
            } else {
                const found = imagePresets.find((p) => p.id === presetId) || workspacePresetSnapshot;
                setWorkspacePresetSnapshot(found || null);
            }
            showToast(presetId ? '已应用生图设定' : '已清除生图设定', 'success');
        } catch (err) {
            console.error('保存生图设定失败', err);
            showToast('保存生图设定失败', 'error');
        }
    };

    const handleEditPreset = (preset: ImagePreset) => {
        setEditingPresetId(preset.id);
        setPresetForm({ content: preset.content });
    };

    const handleResetPresetForm = () => {
        setEditingPresetId(null);
        setPresetForm({ content: '' });
    };

    const handleSavePreset = async () => {
        if (!presetForm.content.trim()) {
            showToast('请填写设定内容', 'error');
            return;
        }
        setPresetSaving(true);
        try {
            const autoName = presetForm.content.trim().split(/\s+/).join(' ').slice(0, 24) || '生图设定';
            const formData = {
                content: presetForm.content,
                name: autoName,
            };
            if (editingPresetId) {
                const updated = await updateImagePreset(editingPresetId, formData);
                setImagePresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                if (selectedImagePresetId === updated.id) {
                    setWorkspacePresetSnapshot(updated);
                }
                showToast('设定已更新', 'success');
            } else {
                const created = await createImagePreset(formData);
                setImagePresets((prev) => [created, ...prev]);
                showToast('设定已创建', 'success');
            }
            handleResetPresetForm();
        } catch (err) {
            console.error('保存生图设定失败', err);
            showToast('保存生图设定失败', 'error');
        } finally {
            setPresetSaving(false);
        }
    };

    const handleDeletePresetById = async (presetId: string) => {
        try {
            await deleteImagePreset(presetId);
            setImagePresets((prev) => prev.filter((p) => p.id !== presetId));
            if (selectedImagePresetId === presetId) {
                setSelectedImagePresetId(null);
                setWorkspacePresetSnapshot(null);
                if (currentWorkspace?.path) {
                    await setWorkspaceImagePreset(currentWorkspace.path, null);
                }
            }
            showToast('已删除生图设定', 'success');
        } catch (err) {
            console.error('删除生图设定失败', err);
            showToast('删除生图设定失败', 'error');
        }
    };

    const handleSelectReference = async (charName: string, imageId: string) => {
        const next = { ...characterRefs, [charName]: imageId };
        await persistCharacterRefs(next);
        setShowGalleryModal(false);
        setActiveCharacterForPick(null);
    };

    const handleDetachReference = async (charName: string) => {
        const next = { ...characterRefs };
        delete next[charName];
        await persistCharacterRefs(next);
    };

    const handlePrevImage = (shot: Round2Shot, idx: number) => {
        const shotId = shot.id ?? idx + 1;
        let list = generatedImages[shotId] || [];
        if (!list.length) {
            void loadExistingImagesForShot(shotId);
            list = generatedImages[shotId] || [];
        }
        if (list.length === 0) return;
        setGeneratedIndexes((prev) => {
            const current = prev[shotId] ?? Math.max(0, list.length - 1);
            if (current <= 0) return prev;
            const nextIdx = current - 1;
            return { ...prev, [shotId]: nextIdx };
        });
    };

    const handleNextImage = (shot: Round2Shot, idx: number) => {
        const shotId = shot.id ?? idx + 1;
        let list = generatedImages[shotId] || [];
        if (!list.length) {
            void loadExistingImagesForShot(shotId);
            list = generatedImages[shotId] || [];
        }
        if (list.length === 0) return;
        setGeneratedIndexes((prev) => {
            const current = prev[shotId] ?? Math.max(0, list.length - 1);
            if (current >= list.length - 1) return prev;
            const nextIdx = current + 1;
            return { ...prev, [shotId]: nextIdx };
        });
    };

    const handleImageSeen = (shot: Round2Shot, idx: number, url: string) => {
        const shotId = shot.id ?? idx + 1;
        setNewlyGenerated((prev) => ({ ...prev, [shotId]: (prev[shotId] || []).filter((u) => u !== url) }));
    };

    const handleClearNewImages = (shot: Round2Shot, idx: number) => {
        const shotId = shot.id ?? idx + 1;
        setNewlyGenerated((prev) => ({ ...prev, [shotId]: [] }));
    };

    // 视频播放后清除 NEW 标识
    const handleVideoSeen = (shotId: number, url: string) => {
        setNewlyGeneratedVideos((prev) => ({ ...prev, [shotId]: (prev[shotId] || []).filter((u) => u !== url) }));
    };

    // 停止单个镜头的视频生成（实际会停止所有任务）
    const handleStopSingleVideoGeneration = async (_shot: Round2Shot, _idx: number) => {
        try {
            await fetch(`${API_BASE}/api/yunwu/tasks/stop-all`, { method: 'POST' });
            // 清除所有生成中状态（因为后端会停止所有任务）
            setGeneratingVideoShots({});
            setVideoTaskStatuses({});
            showToast('已停止所有视频生成', 'success');
        } catch {
            showToast('停止失败', 'error');
        }
    };

    const handleProviderChange = (shot: Round2Shot, idx: number, providerId: string) => {
        const shotId = shot.id ?? idx + 1;
        setShotProviders((prev) => ({ ...prev, [shotId]: providerId }));
    };

    // 保存视频选择到后端（传入最新的索引数组，避免闭包问题）
    const saveVideoSelectionsToBackend = (shotId: number, latestIndexes: number[]) => {
        if (!currentWorkspace?.path || !generatedDir) return;
        if (!savedVideoIndexesLoaded) {
            console.warn('视频选择数据尚未加载完成，跳过保存以避免数据丢失');
            return;
        }

        const videos = generatedVideos[shotId] || [];

        // 转换索引为文件名数组
        const filenames = latestIndexes
            .filter(i => i >= 0 && i < videos.length)
            .map(i => videos[i].split('/').pop() || '');

        // 获取已保存的文件名映射
        const savedFilenames = (window as unknown as Record<string, unknown>).__savedVideoFilenames as Record<string, string[]> || {};

        // 合并：保留原有选择 + 添加/更新当前选择
        const allSelections: Record<string, string[]> = { ...savedFilenames };
        const shotKey = Number.isInteger(shotId) ? shotId.toFixed(1) : String(shotId);
        allSelections[shotKey] = filenames;

        // 同步更新 window 临时变量
        (window as unknown as Record<string, unknown>).__savedVideoFilenames = allSelections;

        fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ generated_dir: generatedDir, indexes: allSelections }),
        }).catch(() => { /* ignore */ });
    };

    // 选择/取消选择视频（点击视频缩略图时调用，toggle 逻辑），保存文件名数组到后端
    const handleSelectVideoIndex = (shotId: number, idx: number) => {
        setSelectedVideoIndexes(prev => {
            const current = prev[shotId] || [];
            const isSelected = current.includes(idx);
            const next = isSelected
                ? current.filter(i => i !== idx)  // 移除
                : [...current, idx];               // 添加

            // 在回调中直接获取最新值并保存
            saveVideoSelectionsToBackend(shotId, next);

            return { ...prev, [shotId]: next };
        });
    };

    // 移除指定视频（从选中列表中移除）
    const handleRemoveVideoIndex = (shotId: number, idx: number) => {
        setSelectedVideoIndexes(prev => {
            const current = prev[shotId] || [];
            const next = current.filter(i => i !== idx);

            // 在回调中直接获取最新值并保存
            saveVideoSelectionsToBackend(shotId, next);

            return { ...prev, [shotId]: next };
        });
    };

    // 选择图片（点击「选择此图」按钮时调用），保存文件名到后端
    const handleSelectImageIndex = (shot: Round2Shot, idx: number, targetIndex: number) => {
        const shotId = shot.id ?? idx + 1;
        let list = generatedImages[shotId] || [];
        if (!list.length) {
            void loadExistingImagesForShot(shotId);
            list = generatedImages[shotId] || [];
        }
        if (!list.length) return;
        const bounded = Math.min(Math.max(0, targetIndex), list.length - 1);
        setGeneratedIndexes((prev) => ({ ...prev, [shotId]: bounded }));

        // 提取文件名并保存到后端（使用文件名更稳定）
        const imageUrl = list[bounded];
        const filename = imageUrl?.split('/').pop() || '';
        if (filename && currentWorkspace?.path && generatedDir) {
            // 安全检查：确保已保存的图片数据已加载完成，避免覆盖
            if (!savedIndexesLoaded) {
                console.warn('图片选择数据尚未加载完成，跳过保存以避免数据丢失');
                return;
            }

            setSavedIndexes((prev) => ({ ...prev, [shotId]: bounded })); // 同时更新本地状态

            // 【关键修复】直接从 window 临时变量获取已保存的文件名，避免数据丢失
            // 不再从 savedIndexesRef 重新构建，因为那样在数据未加载完时会导致覆盖
            const savedFilenames = (window as unknown as Record<string, unknown>).__savedImageFilenames as Record<string, string> || {};

            // 合并：保留原有选择 + 添加/更新当前选择
            // 统一使用 x.0 格式的 key（如 "1.0", "2.0"）
            const allSelections: Record<string, string> = { ...savedFilenames };
            const shotKey = Number.isInteger(shotId) ? shotId.toFixed(1) : String(shotId);
            allSelections[shotKey] = filename;

            // 同步更新 window 临时变量
            (window as unknown as Record<string, unknown>).__savedImageFilenames = allSelections;

            fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generated_dir: generatedDir, indexes: allSelections }),
            }).catch(() => { /* ignore */ });
        }
    };

    const handleUploadReference = async (file?: File) => {
        if (!file) return;
        setUploading(true);
        setGalleryError(null);
        try {
            const categoryToUse = activeCategoryTab !== 'all' ? activeCategoryTab : undefined;
            const item = await uploadReferenceImage(file, undefined, categoryToUse);
            setReferenceGallery((prev) => [...prev, item]);
        } catch (err) {
            console.error(err);
            setGalleryError('上传失败，请重试');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteReference = async (id: string) => {
        try {
            await deleteReferenceImage(id);
            setReferenceGallery((prev) => prev.filter((item) => item.id !== id));
            // Remove from character mappings
            const next = { ...characterRefs };
            Object.entries(next).forEach(([k, v]) => {
                if (v === id) delete next[k];
            });
            await persistCharacterRefs(next);
        } catch (err) {
            console.error(err);
            setGalleryError('删除失败，请重试');
        }
    };

    const handleSaveCategoryPrompt = async () => {
        if (activeCategoryTab === 'all') return;
        setCategoryPromptSaving(true);
        try {
            const prompts = await saveCategoryPrompt(activeCategoryTab, categoryPromptInput);
            setCategoryPrompts(prompts);
            setToast({ message: '分类提示词已保存', type: 'success' });
        } catch (err) {
            console.error(err);
            setGalleryError('保存分类提示词失败');
            setToast({ message: '保存分类提示词失败', type: 'error' });
        } finally {
            setCategoryPromptSaving(false);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const handleAddCharacter = () => {
        if (typeof round2Data === 'string') return;
        const name = newCharacterName.trim();
        if (!name) {
            setToast({ message: '请输入角色名称', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }
        if (round2Data?.characters && round2Data.characters[name]) {
            setToast({ message: '角色已存在', type: 'error' });
            setTimeout(() => setToast(null), 3000);
            return;
        }
        mutateRound2((draft) => {
            if (!draft.characters) draft.characters = {};
            draft.characters[name] = newCharacterDesc.trim();
        });
        setNewCharacterName('');
        setNewCharacterDesc('');
        setToast({ message: '角色已添加', type: 'success' });
        setTimeout(() => setToast(null), 3000);
    };

    const handleCreateCategory = async () => {
        const name = newCategoryName.trim();
        if (!name) return;
        setCategorySaving(true);
        try {
            const cats = await createCategory(name);
            setCategories(cats);
            setActiveCategoryTab(name);
            setNewCategoryName('');
            setToast({ message: '分类已创建', type: 'success' });
        } catch (err) {
            console.error(err);
            setGalleryError('创建分类失败');
            setToast({ message: '创建分类失败', type: 'error' });
        } finally {
            setCategorySaving(false);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const handleRenameCategoryAction = async () => {
        if (activeCategoryTab === 'all' || activeCategoryTab === '') return;
        const nextName = renamingCategoryName.trim();
        if (!nextName || nextName === activeCategoryTab) {
            setRenamingCategoryName('');
            return;
        }
        setCategorySaving(true);
        try {
            const cats = await renameCategory(activeCategoryTab, nextName);
            // update images locally
            setReferenceGallery((prev) =>
                prev.map((item) => (item.category === activeCategoryTab ? { ...item, category: nextName } : item)),
            );
            // update prompts
            const nextPrompts = (() => {
                const next = { ...categoryPrompts };
                if (categoryPrompts[activeCategoryTab]) {
                    next[nextName] = categoryPrompts[activeCategoryTab];
                    delete next[activeCategoryTab];
                }
                return next;
            })();
            setCategoryPrompts(nextPrompts);
            setCategories(cats);
            setActiveCategoryTab(nextName);
            setRenamingCategoryName('');
            setCategoryPromptInput(nextPrompts[nextName] || '');
            setToast({ message: '分类已重命名', type: 'success' });
        } catch (err) {
            console.error(err);
            setGalleryError('重命名分类失败');
            setToast({ message: '重命名分类失败', type: 'error' });
        } finally {
            setCategorySaving(false);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const handleDeleteCategoryAction = async () => {
        if (activeCategoryTab === 'all' || activeCategoryTab === '') return;
        setCategorySaving(true);
        try {
            const cats = await deleteCategory(activeCategoryTab, deleteCategoryMode);
            setCategories(cats);
            // clear category on images
            setReferenceGallery((prev) =>
                prev.map((item) =>
                    item.category === activeCategoryTab
                        ? deleteCategoryMode === 'clear'
                            ? (() => {
                                const clone = { ...item };
                                delete clone.category;
                                return clone;
                            })()
                            : { ...item, category: '' }
                        : item,
                ),
            );
            // remove prompt
            setCategoryPrompts((prev) => {
                const next = { ...prev };
                delete next[activeCategoryTab];
                return next;
            });
            setActiveCategoryTab('all');
            setShowDeleteCategoryConfirm(false);
            setToast({ message: '分类已删除', type: 'success' });
        } catch (err) {
            console.error(err);
            setGalleryError('删除分类失败');
            setToast({ message: '删除分类失败', type: 'error' });
        } finally {
            setCategorySaving(false);
            setTimeout(() => setToast(null), 3000);
        }
    };

    const handleRenameReference = async (id: string, name: string, category?: string) => {
        try {
            const updated = await renameReferenceImage(id, name, category);
            setReferenceGallery((prev) =>
                prev.map((item) =>
                    item.id === id
                        ? { ...item, name, category: category ?? item.category, ...(updated || {}) }
                        : item,
                ),
            );
            setRenamingId(null);
            setRenameValue('');
            setRenameCategoryInput('');
        } catch (err) {
            console.error(err);
            setGalleryError('重命名失败，请重试');
        }
    };

    const handleUpdateImageCategory = async (id: string, category: string) => {
        const item = referenceGallery.find((it) => it.id === id);
        if (!item) return;
        try {
            const updated = await renameReferenceImage(id, item.name, category || undefined);
            setReferenceGallery((prev) =>
                prev.map((it) =>
                    it.id === id
                        ? { ...it, category, ...(updated || {}) }
                        : it,
                ),
            );
            if (category && !categories.includes(category)) {
                setCategories((prev) => [...prev, category]);
            }
            // force refresh of gallery data to reflect possible backend changes
            await loadReferenceGallery();
            setToast({ message: '图片分类已更新', type: 'success' });
        } catch (err) {
            console.error(err);
            setGalleryError('更新图片分类失败');
            setToast({ message: '更新图片分类失败', type: 'error' });
        } finally {
            setTimeout(() => setToast(null), 3000);
        }
    };

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const renameCharacterInFrame = (frame: unknown, oldName: string, newName: string) => {
        if (!frame || typeof frame !== 'object') return;
        const obj = frame as Record<string, unknown>;
        const layers = [obj.foreground, obj.midground];
        layers.forEach((layer) => {
            if (!layer || typeof layer !== 'object') return;
            const layerObj = layer as Record<string, unknown>;
            (['characters'] as const).forEach((key) => {
                const arr = layerObj[key];
                if (Array.isArray(arr)) {
                    layerObj[key] = arr.map((item) => {
                        if (typeof item === 'object' && item && 'tag' in (item as Record<string, unknown>)) {
                            const mapped = { ...(item as Record<string, unknown>) };
                            if ((mapped.tag as string) === oldName) {
                                mapped.tag = newName;
                            }
                            return mapped;
                        }
                        if (item === oldName) return newName;
                        return item;
                    });
                }
            });
        });
    };

    const handleRenameCharacter = (oldName: string, newNameRaw: string) => {
        const newName = newNameRaw.trim();
        if (!newName) {
            showToast('角色名不能为空', 'error');
            return;
        }
        if (newName === oldName) {
            setRenamingCharacter(null);
            return;
        }
        if (round2Data && typeof round2Data !== 'string' && round2Data.characters && round2Data.characters[newName]) {
            showToast('已存在同名角色', 'error');
            return;
        }
        const pattern = new RegExp(`【${escapeRegExp(oldName)}】`, 'g');
        mutateRound2((draft) => {
            if (!draft.characters) draft.characters = {};
            const desc = draft.characters[oldName];
            delete draft.characters[oldName];
            draft.characters[newName] = desc;
            (draft.shots || []).forEach((shot) => {
                if (typeof shot.initial_frame === 'string') {
                    shot.initial_frame = shot.initial_frame.replace(pattern, `【${newName}】`);
                } else if (shot.initial_frame && typeof shot.initial_frame === 'object') {
                    renameCharacterInFrame(shot.initial_frame, oldName, newName);
                }
                if (typeof shot.visual_changes === 'string') {
                    shot.visual_changes = shot.visual_changes.replace(pattern, `【${newName}】`);
                }
            });
        });
        setCharacterRefs((prev) => {
            const next = { ...prev };
            if (next[oldName]) {
                next[newName] = next[oldName];
                delete next[oldName];
                void persistCharacterRefs(next);
                return next;
            }
            return prev;
        });
        setRenamingCharacter(null);
        setRenamingCharacterValue('');
        showToast('角色名称已更新', 'success');
    };

    const categoryOptions = useMemo(() => {
        const ordered = [...categories];
        const hasUncategorized = referenceGallery.some((item) => !item.category || item.category.trim() === '');
        const extras = new Set<string>();
        referenceGallery.forEach((item) => {
            const cat = (item.category || '').trim();
            if (!cat) return;
            if (!ordered.includes(cat)) extras.add(cat);
        });
        const merged = [...ordered, ...Array.from(extras)];
        if (hasUncategorized && !merged.includes('')) merged.push('');
        return merged;
    }, [categories, referenceGallery]);

    useEffect(() => {
        setCategoryPromptInput(categoryPrompts[activeCategoryTab] || '');
    }, [activeCategoryTab, categoryPrompts]);

    useEffect(() => {
        if (activeCategoryTab === '' || activeCategoryTab === 'all') {
            setRenamingCategoryName('');
        }
    }, [activeCategoryTab]);

    useEffect(() => {
        if (showGalleryModal) {
            void (async () => {
                try {
                    const prompts = await fetchCategoryPrompts();
                    setCategoryPrompts(prompts);
                    setCategoryPromptInput(prompts[activeCategoryTab] || '');
                } catch (err) {
                    console.error(err);
                }
            })();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showGalleryModal]);

    const extractReferenceIds = (shot: Round2Shot): string[] => {
        const ids = new Set<string>();
        const regexMatches = (text?: string) => {
            if (!text) return;
            const regex = /【([^】]+)】/g;
            let m: RegExpExecArray | null;
            while ((m = regex.exec(text))) {
                const name = m[1];
                const id = characterRefs[name];
                if (id) ids.add(id);
            }
        };
        if (typeof shot.initial_frame === 'string') {
            regexMatches(shot.initial_frame);
        } else if (shot.initial_frame && typeof shot.initial_frame === 'object') {
            const frame = shot.initial_frame as StructuredInitialFrame;
            const layers = [frame.foreground?.characters, frame.midground?.characters];
            layers.forEach((layer) => {
                if (Array.isArray(layer)) {
                    layer.forEach((c) => {
                        if (typeof c === 'object' && c && 'tag' in c) {
                            const tag = (c as Record<string, unknown>).tag as string;
                            const id = characterRefs[tag];
                            if (id) ids.add(id);
                        }
                    });
                }
            });
        }
        regexMatches(typeof shot.visual_changes === 'string' ? shot.visual_changes : '');
        return Array.from(ids);
    };

    const handleGenerateImage = async (shot: Round2Shot, index: number, providerId?: string) => {
        if (!currentWorkspace?.path || !workspaceSlug) {
            setGenerateError('请先选择工作空间');
            return;
        }
        const shotId = shot.id ?? index + 1;

        // 判断是否开启线稿模式（优先使用单镜头覆盖，否则使用全局配置）
        const isOutlineMode = outlineModes[shotId] !== undefined ? outlineModes[shotId] : globalOutlineMode;
        const activeOutline = activeOutlineUrls[shotId];

        // 线稿模式检查
        if (isOutlineMode && !activeOutline) {
            showToast('线稿模式下请先生成线稿图', 'error');
            return;
        }

        // 获取首帧描述
        const initialFrameDesc = typeof shot.initial_frame === 'string'
            ? shot.initial_frame
            : JSON.stringify(shot.initial_frame || {});

        // 构建提示词
        let basePrompt = `首帧描述: ${initialFrameDesc}`;

        // 线稿模式下添加参考图指引
        if (isOutlineMode && activeOutline) {
            // 从首帧描述中提取角色名（【xxx】格式），去重
            const characterMatches = initialFrameDesc.match(/【([^】]+)】/g) || [];
            const characters = [...new Set(characterMatches.map((m: string) => m.replace(/[【】]/g, '')))];

            // 使用全局配置的模板，如果没有则使用默认值
            const charTemplate = globalCharRefTemplate.trim()
                || '角色【{name}】的形象、服装、发型严格参考图{image}。';
            const sceneTemplate = globalSceneRefTemplate.trim()
                || '画面的景别、人物姿势和动作严格参考图{image}。';

            let referenceGuide = '\n\n';
            characters.forEach((char: string, idx: number) => {
                referenceGuide += charTemplate
                    .replace('{name}', char)
                    .replace('{image}', `image${idx + 1}`) + '\n';
            });
            referenceGuide += sceneTemplate.replace('{image}', `image${characters.length + 1}`);

            basePrompt += referenceGuide;
        }

        const presetText = activeImagePreset?.content?.trim();
        const prompt = presetText ? `${basePrompt}\n\n生图设定：${presetText}` : basePrompt;

        // 构建参考图列表
        let refs: string[];

        if (isOutlineMode && activeOutline) {
            // 线稿模式下，按提示词中角色出现顺序构建 refs（确保 image1 对应第一个角色）
            const characterMatches = initialFrameDesc.match(/【([^】]+)】/g) || [];
            const orderedCharacters = [...new Set(characterMatches.map((m: string) => m.replace(/[【】]/g, '')))];
            const orderedRefs = orderedCharacters
                .map(char => characterRefs[char])
                .filter((id): id is string => !!id);
            refs = [...orderedRefs, activeOutline];
        } else {
            refs = extractReferenceIds(shot);
        }
        setGeneratingShots((prev) => ({ ...prev, [shotId]: true }));
        let taskStarted = false;
        const pendingBefore = readPendingGenerations();
        pendingBefore[shotId] = { taskId: pendingBefore[shotId]?.taskId || '', startedAt: Date.now() };
        writePendingGenerations(pendingBefore);
        setGenerateError(null);
        setGenerateErrors((prev) => ({ ...prev, [shotId]: undefined }));
        try {
            const resp = await fetch(`${API_BASE}/api/image-tasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_path: currentWorkspace.path,
                    shot_id: shotId,
                    prompt,
                    reference_image_ids: refs,
                    generated_dir: generatedDir,
                    count: 2,
                    ...(providerId && { provider_id: providerId }),
                }),
            });
            if (!resp.ok) {
                let detail = resp.statusText;
                try {
                    const data = await resp.json();
                    detail = (data as { detail?: string })?.detail || detail;
                } catch {
                    try {
                        detail = await resp.text();
                    } catch {
                        // ignore
                    }
                }
                throw new Error(detail || `生成失败（${resp.status}）`);
            }
            const data = (await resp.json()) as { task_id?: string };
            const taskId = data?.task_id || '';
            if (!taskId) {
                throw new Error('创建生成任务失败，请重试');
            }
            const pending = readPendingGenerations();
            pending[shotId] = { taskId, startedAt: Date.now() };
            writePendingGenerations(pending);
            startPollingTask(shotId, taskId, 200);
            taskStarted = true;
        } catch (err) {
            console.error(err);
            const msg = err instanceof Error ? (err.message || '生成失败，请重试') : '生成失败，请重试';
            setGenerateError(msg);
            setGenerateErrors((prev) => ({ ...prev, [shotId]: msg }));
            setToast({ message: msg, type: 'error' });
            setTimeout(() => setToast(null), 3000);
            setGeneratingShots((prev) => {
                const next = { ...prev };
                delete next[shotId];
                return next;
            });
            const pending = readPendingGenerations();
            delete pending[shotId];
            writePendingGenerations(pending);
        } finally {
            if (!taskStarted) {
                setGeneratingShots((prev) => {
                    const next = { ...prev };
                    delete next[shotId];
                    return next;
                });
                const pending = readPendingGenerations();
                delete pending[shotId];
                writePendingGenerations(pending);
            }
        }
    };

    // 线稿模式切换回调
    const handleToggleOutlineMode = (shot: Round2Shot, index: number) => {
        const shotId = shot.id ?? index + 1;
        setOutlineModes((prev) => ({ ...prev, [shotId]: !prev[shotId] }));
    };

    // 线稿提示词更新回调
    const handleOutlinePromptChange = (shot: Round2Shot, index: number, prompt: string) => {
        const shotId = shot.id ?? index + 1;
        setOutlinePrompts((prev) => ({ ...prev, [shotId]: prompt }));
    };

    // 保存选中线稿到后端
    const saveSelectedOutlines = useCallback(async (urls: Record<number, string>) => {
        if (!currentWorkspace?.path) return;
        try {
            await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-outlines`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    generated_dir: generatedDir,
                    urls,
                }),
            });
        } catch (err) {
            console.error('保存选中线稿失败:', err);
        }
    }, [currentWorkspace?.path, generatedDir]);

    // 选择线稿回调
    const handleSelectOutline = (shot: Round2Shot, index: number, url: string) => {
        const shotId = shot.id ?? index + 1;
        setActiveOutlineUrls((prev) => {
            const newUrls = { ...prev, [shotId]: url };
            // 保存到后端
            saveSelectedOutlines(newUrls);
            return newUrls;
        });
    };

    // 生成线稿回调（使用原片首帧）
    const handleGenerateOutline = async (shot: Round2Shot, index: number) => {
        if (!currentWorkspace?.path || !workspaceSlug) {
            showToast('请先选择工作空间', 'error');
            return;
        }
        const shotId = shot.id ?? index + 1;

        // 获取原片首帧 URL
        const preferredKeyframe = shot.keyframe && frameNameSet.has(shot.keyframe) ? shot.keyframe : null;
        const frameName = preferredKeyframe ||
            (shot.original_id ? frameMap.get(shot.original_id) : undefined) ||
            frameMap.get(shotId) || null;

        if (!frameName) {
            showToast('未找到原片首帧', 'error');
            return;
        }

        const frameUrl = `${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug)}/assets/frames/${frameName}`;

        setGeneratingOutlines((prev) => ({ ...prev, [shotId]: true }));
        // 记录 pending 状态（刷新后可恢复）
        const pending = readPendingOutlines();
        pending[shotId] = { startedAt: Date.now(), lastOutlineCount: generatedOutlines[shotId]?.length || 0 };
        writePendingOutlines(pending);

        try {
            const resp = await fetch(`${API_BASE}/api/generate-outline`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_path: currentWorkspace.path,
                    shot_id: String(shotId),
                    frame_url: frameUrl,
                    outline_prompt: outlinePrompts[shotId] || globalOutlinePrompt,
                }),
            });
            if (!resp.ok) {
                const detail = await resp.text();
                throw new Error(detail || '线稿生成失败');
            }
            const data = await resp.json() as { outline_url?: string };
            if (data.outline_url) {
                setGeneratedOutlines((prev) => ({
                    ...prev,
                    [shotId]: [data.outline_url!, ...(prev[shotId] || [])],  // 新生成的在前
                }));
                // 不自动选中，用户需手动选择
                showToast('线稿生成成功', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast(err instanceof Error ? err.message : '线稿生成失败', 'error');
        } finally {
            // 只在组件挂载时更新状态和清除 pending（防止切换步骤后丢失恢复能力）
            if (isMountedRef.current) {
                setGeneratingOutlines((prev) => ({ ...prev, [shotId]: false }));
                clearPendingOutline(shotId);
            }
        }
    };

    // 删除线稿回调
    const handleDeleteOutline = async (shot: Round2Shot, index: number, url: string) => {
        if (!currentWorkspace?.path) return;
        const shotId = shot.id ?? index + 1;
        const filename = url.split('/').pop();
        if (!filename) return;

        try {
            const resp = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/outlines/${shotId}/${filename}`, {
                method: 'DELETE',
            });
            if (resp.ok) {
                setGeneratedOutlines((prev) => ({
                    ...prev,
                    [shotId]: (prev[shotId] || []).filter((u) => u !== url),
                }));
                if (activeOutlineUrls[shotId] === url) {
                    const remaining = (generatedOutlines[shotId] || []).filter((u) => u !== url);
                    setActiveOutlineUrls((prev) => ({ ...prev, [shotId]: remaining[0] || '' }));
                }
                showToast('线稿已删除', 'success');
            }
        } catch (err) {
            console.error(err);
            showToast('删除失败', 'error');
        }
    };

    // 批量生成线稿（使用原片首帧）
    const handleBatchGenerateOutlines = async () => {
        if (!currentWorkspace?.path || !workspaceSlug) {
            showToast('请先选择工作空间', 'error');
            return;
        }
        if (typeof round2Data === 'string' || !round2Data?.shots) return;

        // 筛选有原片首帧的镜头
        const shotsWithFrames = round2Data.shots.filter((shot, idx) => {
            const shotId = shot.id ?? idx + 1;
            if (shot.discarded) return false;
            // 检查是否有原片首帧
            const preferredKeyframe = shot.keyframe && frameNameSet.has(shot.keyframe) ? shot.keyframe : null;
            const frameName = preferredKeyframe ||
                (shot.original_id ? frameMap.get(shot.original_id) : undefined) ||
                frameMap.get(shotId) || null;
            return !!frameName;
        });

        if (shotsWithFrames.length === 0) {
            showToast('没有可生成线稿的镜头（无原片首帧）', 'error');
            return;
        }

        setBatchGeneratingOutlines(true);
        setOutlineProgress({ completed: 0, total: shotsWithFrames.length });

        // 并发控制：最多 20 个并发
        const CONCURRENCY = 20;
        let completedCount = 0;
        let successCount = 0;
        let failedCount = 0;

        const generateOne = async (shot: Round2Shot, idx: number) => {
            const shotId = shot.id ?? idx + 1;

            // 获取原片首帧 URL
            const preferredKeyframe = shot.keyframe && frameNameSet.has(shot.keyframe) ? shot.keyframe : null;
            const frameName = preferredKeyframe ||
                (shot.original_id ? frameMap.get(shot.original_id) : undefined) ||
                frameMap.get(shotId) || null;

            if (!frameName) {
                failedCount++;
                return;
            }

            const frameUrl = `${API_BASE}/workspaces/${encodeURIComponent(workspaceSlug!)}/assets/frames/${frameName}`;

            setGeneratingOutlines((prev) => ({ ...prev, [shotId]: true }));
            // 记录 pending 状态
            const pending = readPendingOutlines();
            pending[shotId] = { startedAt: Date.now(), lastOutlineCount: generatedOutlines[shotId]?.length || 0 };
            writePendingOutlines(pending);

            try {
                const resp = await fetch(`${API_BASE}/api/generate-outline`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        workspace_path: currentWorkspace.path,
                        shot_id: String(shotId),
                        frame_url: frameUrl,
                        outline_prompt: outlinePrompts[shotId] || globalOutlinePrompt,
                    }),
                });
                if (resp.ok) {
                    const data = await resp.json() as { outline_url?: string };
                    if (data.outline_url) {
                        setGeneratedOutlines((prev) => ({
                            ...prev,
                            [shotId]: [data.outline_url!, ...(prev[shotId] || [])],  // 新生成的在前
                        }));
                        // 不自动选中，用户需手动选择
                        successCount++;
                    } else {
                        failedCount++;
                    }
                } else {
                    failedCount++;
                }
            } catch (err) {
                console.error(`Shot ${shotId} outline generation failed:`, err);
                failedCount++;
            } finally {
                // 只在组件挂载时更新状态和清除 pending
                if (isMountedRef.current) {
                    setGeneratingOutlines((prev) => ({ ...prev, [shotId]: false }));
                    clearPendingOutline(shotId);
                    completedCount++;
                    setOutlineProgress((prev) => ({ ...prev, completed: completedCount }));
                }
            }
        };

        // 分批执行
        for (let i = 0; i < shotsWithFrames.length; i += CONCURRENCY) {
            const batch = shotsWithFrames.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map((shot: Round2Shot) => {
                const idx = round2Data.shots?.indexOf(shot) ?? 0;
                return generateOne(shot, idx);
            }));
        }

        setBatchGeneratingOutlines(false);
        if (failedCount > 0) {
            showToast(`线稿生成完成：成功 ${successCount} 个，失败 ${failedCount} 个`, failedCount === shotsWithFrames.length ? 'error' : 'success');
        } else {
            showToast(`线稿生成完成 ${successCount}/${shotsWithFrames.length}`, 'success');
        }
    };

    // 生视频回调（支持同时生成多个视频变体）
    const handleGenerateVideo = async (shot: Round2Shot, index: number) => {
        // 从配置读取视频数量，默认 3
        const videoCount = videoGenConfig?.videosPerShot || 3;
        if (!currentWorkspace?.path) {
            showToast('请先选择工作空间', 'error');
            return;
        }
        const shotId = shot.id ?? index + 1;
        const imageUrls = generatedImages[shotId] || [];
        if (imageUrls.length === 0) {
            showToast('请先生成图片', 'error');
            return;
        }

        // 获取当前选中的图片
        const currentIndex = generatedIndexes[shotId] ?? imageUrls.length - 1;
        const imagePath = imageUrls[Math.min(currentIndex, imageUrls.length - 1)];
        if (!imagePath) {
            showToast('未找到图片', 'error');
            return;
        }

        // 获取视频描述
        const prompt = shot.visual_changes || '让人物动起来';

        setGeneratingVideoShots(prev => ({ ...prev, [shotId]: true }));
        setVideoTaskStatuses(prev => ({ ...prev, [shotId]: 'pending' }));

        try {
            const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
            const shotDirName = Number.isInteger(shotId) ? `${shotId}.0` : String(shotId);

            // 使用云雾 API
            const apiBase = '/api/yunwu';

            // 创建多个任务
            const taskIds: string[] = [];
            for (let v = 0; v < videoCount; v++) {
                const outputPath = `${currentWorkspace.path}/${generatedDir}/shots/${shotDirName}/video_${timestamp}_v${v + 1}.mp4`;

                // 构建请求体（云雾 API）
                const requestBody: Record<string, unknown> = {
                    image_path: imagePath,
                    prompt: prompt,
                    output_path: outputPath,
                };

                // 添加云雾 API 参数
                if (videoGenConfig) {
                    requestBody.model = videoGenConfig.model;
                    requestBody.size = videoGenConfig.size;
                    requestBody.aspect_ratio = videoGenConfig.aspectRatio;
                }

                const resp = await fetch(`${API_BASE}${apiBase}/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody),
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data?.task?.task_id) {
                        taskIds.push(data.task.task_id);
                    }
                }
            }

            if (taskIds.length === 0) {
                throw new Error('创建任务失败');
            }

            showToast(`已提交 ${taskIds.length} 个视频生成任务 (云雾 API)`, 'success');
            setVideoTaskStatuses(prev => ({ ...prev, [shotId]: 'processing' }));

            // 初始化占位卡片状态（包含开始时间用于计时显示）
            const startTime = Date.now();
            setVideoTaskProgresses(prev => ({
                ...prev,
                [shotId]: taskIds.map(id => ({ taskId: id, progress: 0, status: 'processing', startTime }))
            }));

            // 批量执行任务（并行）
            await fetch(`${API_BASE}${apiBase}/tasks/run-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_ids: taskIds,
                    parallel: true,
                    max_workers: videoCount,
                }),
            });

            // 使用 SSE 订阅进度
            {
                // SSE 进度订阅
                const taskProgress: Record<string, number> = {};
                const taskStatus: Record<string, string> = {};
                taskIds.forEach(id => { taskStatus[id] = 'processing'; taskProgress[id] = 0; });

                // 更新占位卡片进度的函数
                const updateTaskProgress = (taskId: string, progress: number, status: string) => {
                    setVideoTaskProgresses(prev => {
                        const tasks = prev[shotId] || [];
                        return {
                            ...prev,
                            [shotId]: tasks.map(t => t.taskId === taskId ? { ...t, progress, status } : t)
                        };
                    });
                };

                const subscribeSSE = (taskId: string) => {
                    const eventSource = new EventSource(`${API_BASE}/api/yunwu/tasks/${taskId}/progress`);

                    eventSource.onmessage = (event) => {
                        try {
                            const data = JSON.parse(event.data);
                            if (data.progress !== undefined) {
                                taskProgress[taskId] = data.progress;
                                // 更新占位卡片进度
                                updateTaskProgress(taskId, data.progress, taskStatus[taskId] || 'processing');
                                // 计算总进度
                                const avgProgress = Object.values(taskProgress).reduce((a, b) => a + b, 0) / taskIds.length;
                                setVideoProgress(prev => ({ ...prev, [shotId]: Math.round(avgProgress) }));
                            }
                            if (data.status === 'completed') {
                                taskStatus[taskId] = 'completed';
                                taskProgress[taskId] = 100;
                                // 任务完成后从占位卡片中移除（而不是只更新状态）
                                setVideoTaskProgresses(prev => {
                                    const tasks = (prev[shotId] || []).filter(t => t.taskId !== taskId);
                                    if (tasks.length === 0) {
                                        const next = { ...prev };
                                        delete next[shotId];
                                        return next;
                                    }
                                    return { ...prev, [shotId]: tasks };
                                });
                                eventSource.close();
                                void loadVideosForShot(shotId, true);
                                checkAllDone();
                            } else if (data.status === 'failed') {
                                taskStatus[taskId] = 'failed';
                                updateTaskProgress(taskId, taskProgress[taskId] || 0, 'failed');
                                eventSource.close();
                                checkAllDone();
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    };

                    eventSource.onerror = () => {
                        eventSource.close();
                        // 出错后回退到轮询检查一次
                        fetch(`${API_BASE}${apiBase}/tasks/${taskId}`)
                            .then(r => r.json())
                            .then(d => {
                                if (d?.task?.status === 'completed') {
                                    taskStatus[taskId] = 'completed';
                                    void loadVideosForShot(shotId, true);
                                } else if (d?.task?.status === 'failed') {
                                    taskStatus[taskId] = 'failed';
                                }
                                checkAllDone();
                            })
                            .catch(() => checkAllDone());
                    };
                };

                const checkAllDone = () => {
                    const completed = Object.values(taskStatus).filter(s => s === 'completed').length;
                    const failed = Object.values(taskStatus).filter(s => s === 'failed').length;
                    if (completed + failed === taskIds.length) {
                        setVideoProgress(prev => ({ ...prev, [shotId]: 100 }));
                        setVideoTaskStatuses(prev => ({ ...prev, [shotId]: failed < taskIds.length ? 'completed' : 'failed' }));
                        setGeneratingVideoShots(prev => { const next = { ...prev }; delete next[shotId]; return next; });
                        // 清理占位卡片状态
                        setVideoTaskProgresses(prev => { const next = { ...prev }; delete next[shotId]; return next; });
                        // 最终刷新视频列表
                        void loadVideosForShot(shotId, true);
                        showToast(`镜头 ${shotId}：${completed}/${taskIds.length} 个视频生成完成！`, completed > 0 ? 'success' : 'error');
                    }
                };

                // 为每个任务订阅 SSE
                taskIds.forEach(subscribeSSE);
            }

        } catch (err) {
            const msg = err instanceof Error ? err.message : '视频生成失败';
            showToast(msg, 'error');
            setVideoTaskStatuses(prev => ({ ...prev, [shotId]: 'failed' }));
            setGeneratingVideoShots(prev => {
                const next = { ...prev };
                delete next[shotId];
                return next;
            });
        }
    };

    // 停止所有视频生成
    const handleStopAllVideos = async () => {
        try {
            const resp = await fetch(`${API_BASE}/api/yunwu/tasks/stop-all`, {
                method: 'POST',
            });

            if (resp.ok) {
                // 清除所有生成中状态
                setGeneratingVideoShots({});
                setVideoTaskStatuses({});
                showToast('已停止所有视频生成', 'success');
            } else {
                showToast('停止失败', 'error');
            }
        } catch (err) {
            console.error('停止任务失败:', err);
            showToast('停止失败', 'error');
        }
    };

    // 批量生成视频（多镜头并行）
    const handleBatchGenerateVideos = async () => {
        if (!currentWorkspace?.path || !round2Data || typeof round2Data === 'string') {
            showToast('请先选择工作空间', 'error');
            return;
        }

        const shots = round2Data.shots || [];
        const tasksToCreate: Array<{ shotId: number; imagePath: string; prompt: string; outputPath: string }> = [];

        // 收集所有有图片的镜头
        for (let i = 0; i < shots.length; i++) {
            const shot = shots[i];
            const shotId = shot.id ?? i + 1;
            const imageUrls = generatedImages[shotId] || [];

            if (imageUrls.length === 0) continue;
            if (generatingVideoShots[shotId]) continue; // 跳过正在生成的

            const currentIndex = generatedIndexes[shotId] ?? 0;
            const imagePath = imageUrls[Math.min(currentIndex, imageUrls.length - 1)];
            if (!imagePath) continue;

            const prompt = shot.visual_changes || '让人物动起来';
            const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
            const shotDirName = Number.isInteger(shotId) ? `${shotId}.0` : String(shotId);
            const outputPath = `${currentWorkspace.path}/${generatedDir}/shots/${shotDirName}/video_${timestamp}_${i}.mp4`;

            tasksToCreate.push({ shotId, imagePath, prompt, outputPath });
        }

        if (tasksToCreate.length === 0) {
            showToast('没有可生成的镜头（请先生成图片）', 'error');
            return;
        }

        showToast(`正在提交 ${tasksToCreate.length} 个视频生成任务...`, 'success');

        // 批量创建任务
        const taskIds: string[] = [];
        for (const task of tasksToCreate) {
            try {
                setGeneratingVideoShots(prev => ({ ...prev, [task.shotId]: true }));
                setVideoTaskStatuses(prev => ({ ...prev, [task.shotId]: 'pending' }));

                const resp = await fetch(`${API_BASE}/api/yunwu/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        image_path: task.imagePath,
                        prompt: task.prompt,
                        output_path: task.outputPath,
                    }),
                });

                if (resp.ok) {
                    const data = await resp.json();
                    if (data?.task?.task_id) {
                        taskIds.push(data.task.task_id);
                        setVideoTaskStatuses(prev => ({ ...prev, [task.shotId]: 'processing' }));
                    }
                }
            } catch (err) {
                console.error(`创建任务失败: shot ${task.shotId}`, err);
            }
        }

        if (taskIds.length === 0) {
            showToast('任务创建失败', 'error');
            return;
        }

        // 批量执行（并行）
        try {
            await fetch(`${API_BASE}/api/yunwu/tasks/run-batch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_ids: taskIds,
                    parallel: true,
                    max_workers: 3,
                }),
            });
            showToast(`已提交 ${taskIds.length} 个任务并行生成`, 'success');
        } catch (err) {
            showToast('批量执行失败', 'error');
        }

        // 启动轮询检查所有任务状态
        const pollAllTasks = async () => {
            const maxAttempts = 120; // 10分钟
            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                await new Promise(resolve => setTimeout(resolve, 5000));

                let allDone = true;
                for (const taskId of taskIds) {
                    try {
                        const resp = await fetch(`${API_BASE}/api/yunwu/tasks/${taskId}`);
                        const data = await resp.json();
                        const status = data?.task?.status;

                        // 找到对应的 shotId
                        const taskIdx = taskIds.indexOf(taskId);
                        if (taskIdx >= 0 && taskIdx < tasksToCreate.length) {
                            const shotId = tasksToCreate[taskIdx].shotId;

                            if (status === 'completed') {
                                setVideoTaskStatuses(prev => ({ ...prev, [shotId]: 'completed' }));
                                setGeneratingVideoShots(prev => {
                                    const next = { ...prev };
                                    delete next[shotId];
                                    return next;
                                });
                                void loadVideosForShot(shotId, true);
                            } else if (status === 'failed') {
                                setVideoTaskStatuses(prev => ({ ...prev, [shotId]: 'failed' }));
                                setGeneratingVideoShots(prev => {
                                    const next = { ...prev };
                                    delete next[shotId];
                                    return next;
                                });
                            } else if (status === 'processing' || status === 'pending') {
                                allDone = false;
                            }
                        }
                    } catch {
                        // 忽略错误
                    }
                }

                if (allDone) {
                    showToast('所有视频生成完成！', 'success');
                    break;
                }
            }
        };

        pollAllTasks();
    };

    // 导出选中视频状态
    const [exporting, setExporting] = useState(false);

    // 导出选中视频到 export 文件夹
    const handleExportVideos = async () => {
        if (!currentWorkspace?.path) {
            showToast('请先选择工作空间', 'error');
            return;
        }

        setExporting(true);
        try {
            const resp = await fetch(`${API_BASE}/api/export-selected-videos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    workspace_path: currentWorkspace.path,
                    generated_dir: generatedDir,
                }),
            });

            if (!resp.ok) {
                const err = await resp.json().catch(() => ({ detail: '导出失败' }));
                throw new Error(err.detail || '导出失败');
            }

            const result = await resp.json();
            showToast(`已导出 ${result.total} 个视频到 export 文件夹`, 'success');
        } catch (err) {
            const msg = err instanceof Error ? err.message : '导出失败';
            showToast(msg, 'error');
        } finally {
            setExporting(false);
        }
    };

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
                if (resp.status !== 404) {
                    setOptimizedError(`未找到 optimized_storyboard.json（${resp.status}）`);
                } else {
                    setOptimizedError(null);
                }
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

    useEffect(() => {
        loadReferenceGallery();
    }, [loadReferenceGallery]);

    useEffect(() => {
        loadCharacterRefs();
    }, [loadCharacterRefs]);

    useEffect(() => {
        void refreshImagePresets();
    }, [refreshImagePresets]);

    useEffect(() => {
        void loadWorkspaceImagePreset();
    }, [loadWorkspaceImagePreset]);

    // Load providers list
    useEffect(() => {
        fetch(`${API_BASE}/api/providers`)
            .then(resp => resp.ok ? resp.json() : { providers: [] })
            .then((data: { providers?: Array<{ id: string; name: string; is_default?: boolean }> }) => {
                setProviders(data.providers || []);
            })
            .catch(() => setProviders([]));
    }, []);

    // Load video generation config
    useEffect(() => {
        fetch(`${API_BASE}/api/video-gen/config`)
            .then(resp => resp.ok ? resp.json() : null)
            .then(data => setVideoGenConfig(data))
            .catch(() => setVideoGenConfig(null));
    }, []);

    // Reset image caches when switching workspace or generatedDir
    useEffect(() => {
        setGeneratedImages({});
        setGeneratedIndexes({});
        setSavedIndexesLoaded(false); // 重置加载状态
        setSavedImageFilenames({}); // 重置保存的文件名映射
        // 同时清空 window 临时变量（向后兼容）
        (window as unknown as Record<string, unknown>).__savedImageFilenames = {};
        setNewlyGenerated({});
        setGeneratingShots({});
    }, [generatedDir, currentWorkspace?.path]);

    useEffect(() => {
        return () => {
            Object.values(taskPollersRef.current).forEach((timer) => clearTimeout(timer));
            taskPollersRef.current = {};
        };
    }, [generatedStorageKey]);

    // Load persisted generated images per workspace & pending generation flags
    useEffect(() => {
        if (!generatedStorageKey) return;
        // pending generations
        if (pendingGenKey) {
            const pending = readPendingGenerations();
            if (Object.keys(pending).length > 0) {
                const active: Record<number, boolean> = {};
                const cleanup: number[] = [];
                Object.entries(pending).forEach(([k, v]) => {
                    const id = Number(k);
                    active[id] = true;
                    void loadExistingImagesForShot(id);
                    if (v?.taskId) {
                        startPollingTask(id, v.taskId, 200);
                    } else {
                        cleanup.push(id);
                    }
                });
                setGeneratingShots((prev) => ({ ...prev, ...active }));
                if (cleanup.length) {
                    const next = { ...pending };
                    cleanup.forEach((id) => delete next[id]);
                    writePendingGenerations(next);
                    setGeneratingShots((prev) => {
                        const nextGen = { ...prev };
                        cleanup.forEach((id) => delete nextGen[id]);
                        return nextGen;
                    });
                }
            }
        }
        try {
            const raw = localStorage.getItem(generatedStorageKey);
            if (raw) {
                const parsed = JSON.parse(raw) as Record<number, string | string[]>;
                const normalized: Record<number, string[]> = {};
                Object.entries(parsed).forEach(([k, v]) => {
                    const id = Number(k);
                    if (Array.isArray(v)) {
                        normalized[id] = v;
                    } else if (typeof v === 'string') {
                        normalized[id] = [v];
                    }
                });
                setGeneratedImages(normalized);
                // 不设置默认索引，等 selected-images API 返回后再统一设置
                // 这样可以避免先显示默认图片再切换到正确图片的"闪烁"问题
            } else {
                setGeneratedImages({});
                setGeneratedIndexes({});
            }
        } catch {
            setGeneratedImages({});
            setGeneratedIndexes({});
        }
    }, [generatedStorageKey, pendingGenKey, readPendingGenerations, loadExistingImagesForShot, startPollingTask, writePendingGenerations, currentWorkspace?.path, generatedDir]);

    useEffect(() => {
        if (!generatedStorageKey) return;
        try {
            localStorage.setItem(generatedStorageKey, JSON.stringify(generatedImages));
        } catch {
            // ignore
        }
    }, [generatedImages, generatedStorageKey]);

    // 注：自动保存已移除，改为在 handleSelectImageIndex 中点击「选择此图」时保存

    // 加载每个 shot 的图片/视频列表
    // 必须等 savedIndexesLoaded 和 savedVideoIndexesLoaded 完成后再开始，
    // 否则浏览器并发请求限制会导致 selected-images/selected-videos 被排队
    useEffect(() => {
        if (!workspaceSlug) return;
        if (!round2Data || typeof round2Data === 'string') return;
        if (!savedIndexesLoaded || !savedVideoIndexesLoaded) return; // 等选择数据先加载完
        const shotIds = (round2Data.shots || []).map((s, idx) => s.id ?? idx + 1);
        shotIds.forEach((id) => {
            void loadExistingImagesForShot(id);
            void loadVideosForShot(id);  // 同时加载视频列表
        });
    }, [workspaceSlug, round2Data, loadExistingImagesForShot, loadVideosForShot, savedIndexesLoaded, savedVideoIndexesLoaded]);

    // 拉取已保存的选中图片（支持新格式文件名和旧格式索引）
    useEffect(() => {
        if (!currentWorkspace?.path || !generatedDir) {
            setSavedIndexes({});
            setSavedIndexesLoaded(true); // 无需加载，直接标记完成
            return;
        }
        fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-images?generated_dir=${encodeURIComponent(generatedDir)}`)
            .then(resp => resp.ok ? resp.json() : { indexes: {} })
            .then((data: { indexes?: Record<string, string | number> }) => {
                const mapped: Record<number, number> = {};
                if (data.indexes) {
                    Object.entries(data.indexes).forEach(([k, v]) => {
                        const shotId = Number(k);
                        if (typeof v === 'number') {
                            // 旧格式：直接是索引
                            mapped[shotId] = v;
                        } else if (typeof v === 'string') {
                            // 新格式：文件名，需要等 generatedImages 加载后再匹配
                            // 这里先存 -1 表示需要通过文件名匹配
                            // 实际匹配在下面的 useEffect 中进行
                            mapped[shotId] = -1;
                        }
                    });
                }
                setSavedIndexes(mapped);
                // 【关键】将文件名映射存储到 React 状态（可靠）
                const filenames = data.indexes || {};
                setSavedImageFilenames(filenames);
                // 同时更新 window 变量（向后兼容 appendNewImages 等）
                (window as unknown as Record<string, unknown>).__savedImageFilenames = filenames;
                setSavedIndexesLoaded(true); // 标记加载完成
            })
            .catch(() => {
                setSavedIndexes({});
                setSavedIndexesLoaded(true); // 即使失败也标记完成
            });
    }, [currentWorkspace?.path, generatedDir]);

    // 保持 ref 最新
    useEffect(() => {
        savedIndexesRef.current = savedIndexes;
    }, [savedIndexes]);

    // 拉取已保存的选中视频文件名（支持多选：文件名数组）
    const [savedVideoFilenames, setSavedVideoFilenames] = useState<Record<number, string[]>>({});
    useEffect(() => {
        if (!currentWorkspace?.path || !generatedDir) {
            setSavedVideoFilenames({});
            setSavedVideoIndexes({});
            setSavedVideoIndexesLoaded(true);
            return;
        }
        fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-videos?generated_dir=${encodeURIComponent(generatedDir)}`)
            .then(resp => resp.ok ? resp.json() : { indexes: {} })
            .then((data: { indexes?: Record<string, string | string[] | number> }) => {
                const mapped: Record<number, string[]> = {};
                if (data.indexes) {
                    Object.entries(data.indexes).forEach(([k, v]) => {
                        // 兼容多种格式：数组、单个字符串、数字索引
                        if (Array.isArray(v)) {
                            mapped[Number(k)] = v.map(String);
                        } else if (typeof v === 'string') {
                            mapped[Number(k)] = [v];
                        } else if (typeof v === 'number') {
                            mapped[Number(k)] = [String(v)];
                        }
                    });
                }
                setSavedVideoFilenames(mapped);
                // 同步到 window 临时变量
                (window as unknown as Record<string, unknown>).__savedVideoFilenames = data.indexes || {};
                setSavedVideoIndexesLoaded(true);
            })
            .catch(() => {
                setSavedVideoFilenames({});
                setSavedVideoIndexes({});
                setSavedVideoIndexesLoaded(true);
            });
    }, [currentWorkspace?.path, generatedDir]);

    // 当保存的视频文件名加载完成后，通过文件名匹配到索引并应用到对应镜头（多选）
    useEffect(() => {
        if (!savedVideoIndexesLoaded || !Object.keys(generatedVideos).length) return;

        // 从 window 获取原始的文件名映射（保留字符串 key 格式如 "1.0"）
        const rawSavedFilenames = (window as unknown as Record<string, unknown>).__savedVideoFilenames as Record<string, string | string[] | number> || {};

        setSelectedVideoIndexes((prev) => {
            let changed = false;
            const next = { ...prev };

            Object.entries(generatedVideos).forEach(([k, videos]) => {
                const id = Number(k);
                if (!videos || !videos.length) return;

                // 尝试多种 key 格式匹配（"1", "1.0", 整数形式）
                const possibleKeys = [String(id), id.toFixed(1), String(Math.floor(id))];
                let savedFilenames: string[] = [];
                for (const key of possibleKeys) {
                    const val = rawSavedFilenames[key];
                    if (Array.isArray(val)) {
                        savedFilenames = val.map(String);
                        break;
                    } else if (typeof val === 'string' && val.trim()) {
                        savedFilenames = [val];
                        break;
                    } else if (typeof val === 'number') {
                        // 兼容旧格式：数字索引
                        savedFilenames = [String(val)];
                        break;
                    }
                }
                // 也尝试从 savedVideoFilenames（数字 key）获取
                if (!savedFilenames.length) {
                    const fromState = savedVideoFilenames[id];
                    if (fromState && fromState.length) savedFilenames = fromState;
                }

                if (savedFilenames.length) {
                    // 将每个文件名匹配到索引
                    const matchedIndexes: number[] = [];
                    for (const savedFilename of savedFilenames) {
                        const pureFilename = savedFilename.split('/').pop() || savedFilename;
                        const matchedIdx = videos.findIndex((url: string) => {
                            const urlFilename = url.split('/').pop() || url;
                            return urlFilename === pureFilename || url.endsWith(pureFilename) || url.includes(`/${pureFilename}`);
                        });

                        if (matchedIdx >= 0 && !matchedIndexes.includes(matchedIdx)) {
                            matchedIndexes.push(matchedIdx);
                        } else {
                            // 兼容旧格式：savedFilename 可能是数字字符串（如 "0"）
                            const numIdx = parseInt(savedFilename, 10);
                            if (!isNaN(numIdx) && numIdx >= 0 && numIdx < videos.length && !matchedIndexes.includes(numIdx)) {
                                matchedIndexes.push(numIdx);
                            }
                        }
                    }

                    if (matchedIndexes.length) {
                        const prevIndexes = next[id] || [];
                        if (JSON.stringify(prevIndexes.sort()) !== JSON.stringify(matchedIndexes.sort())) {
                            next[id] = matchedIndexes;
                            changed = true;
                            console.log(`[Video Selection] Shot ${id}: restored to indexes [${matchedIndexes.join(', ')}]`);
                        }
                    }
                }
                // 没有保存记录时不设置默认值，避免 API 还没返回时显示错误的选择
            });

            return changed ? next : prev;
        });
    }, [savedVideoIndexesLoaded, savedVideoFilenames, generatedVideos]);

    // 当远端已保存的索引到达后，应用到对应镜头（支持文件名匹配）
    // 【修复】和视频保持一致，使用 window 变量（同步），避免 React 状态批处理导致的时序问题
    useEffect(() => {
        // 必须等 savedIndexes 加载完成且有图片列表才设置索引，避免闪烁
        if (!savedIndexesLoaded || !Object.keys(generatedImages).length) return;

        // 【关键】从 window 读取原始的文件名映射（和视频一致，保留字符串 key 格式如 "1.0"）
        const rawSavedFilenames = (window as unknown as Record<string, unknown>).__savedImageFilenames as Record<string, string | number> || {};

        // [调试] 记录每次尝试匹配的结果
        const debugLog: string[] = [];
        debugLog.push(`[开始匹配] rawSavedFilenames keys: ${Object.keys(rawSavedFilenames).join(', ')}`);

        setGeneratedIndexes((prev) => {
            let changed = false;
            const next = { ...prev };

            // 遍历所有有图片的 shot
            Object.entries(generatedImages).forEach(([k, imgs]) => {
                const id = Number(k);
                if (!imgs || !imgs.length) return;

                // 【关键】从 window 读取文件名（尝试多种 key 格式）
                const possibleKeys = [String(id), id.toFixed(1), String(Math.floor(id))];
                let filename: string | undefined;
                for (const key of possibleKeys) {
                    const val = rawSavedFilenames[key];
                    if (typeof val === 'string') {
                        filename = val;
                        break;
                    } else if (typeof val === 'number') {
                        // 旧格式：数字索引，直接使用
                        if (val >= 0 && val < imgs.length && prev[id] !== val) {
                            next[id] = val;
                            changed = true;
                            debugLog.push(`[Shot ${id}] 旧格式索引: ${val}`);
                        }
                        return;
                    }
                }

                let targetIdx: number;
                if (filename) {
                    const foundIdx = imgs.findIndex(url => url.endsWith(filename!) || url.includes(`/${filename}`));
                    if (foundIdx >= 0) {
                        targetIdx = foundIdx;
                        debugLog.push(`[Shot ${id}] 匹配成功: ${filename} → index ${foundIdx}`);
                    } else {
                        // 有保存记录但匹配失败，不设置索引
                        debugLog.push(`[Shot ${id}] 匹配失败: 找不到 ${filename}，图片列表: ${imgs.map(u => u.split('/').pop()).join(', ')}`);
                        return;
                    }
                } else {
                    // 没有保存记录，不设置索引
                    return;
                }

                if (prev[id] !== targetIdx) {
                    next[id] = targetIdx;
                    changed = true;
                    debugLog.push(`[Shot ${id}] 设置索引: ${prev[id]} → ${targetIdx}`);
                }
            });

            // 如果有调试信息，输出到控制台
            if (debugLog.length) {
                console.log('[图片索引匹配]', debugLog.join('\n'));
            }

            return changed ? next : prev;
        });
    }, [savedImageFilenames, generatedImages, savedIndexesLoaded]);

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
        if (!currentWorkspace?.path) {
            setPromptCopyStatus('error');
            setTimeout(() => setPromptCopyStatus('idle'), 1500);
            return;
        }
        // 提取相对路径：从 AI_Shot_Workbench 开始
        const workspacePath = currentWorkspace.path;
        const workbenchMatch = workspacePath.match(/AI_Shot_Workbench\/workspaces\/\d+/);
        const relativeWorkspace = workbenchMatch ? workbenchMatch[0] : `AI_Shot_Workbench/workspaces/${currentWorkspace.path.split('/').pop()}`;

        // 生成简短指令
        const instruction = `请仔细阅读AI_Shot_Workbench/frontend/data/productionStoryboardPrompt.ts，该文件是最高命令，以后回答时都要先参考文件中的内容。当前工作空间为${relativeWorkspace}，阅读完后请等待用户的提问`;

        try {
            await navigator.clipboard.writeText(instruction);
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
            if (obj.pose) parts.push(`姿势: ${obj.pose}`);
            if (obj.expression) parts.push(`表情: ${obj.expression}`);
            if (obj.name) parts.push(String(obj.name));
            if (obj.description) parts.push(String(obj.description));
            return parts.length > 0 ? parts.join(' · ') : JSON.stringify(item);
        }
        return String(item);
    };

    // Render structured Initial Frame content for diff popover
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
                <div className="text-[var(--lg-text-secondary)] whitespace-pre-wrap text-xs">
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
                    className={`annotation-btn text-xs px-3 py-1 rounded-lg border transition shadow-sm ${value ? 'border-blue-500/50 text-blue-400 bg-blue-500/15' : 'border-[var(--glass-border)] text-[var(--lg-text-tertiary)] bg-[var(--glass-bg-light)]/60 hover:text-[var(--lg-text-primary)]'}`}
                    onClick={() => openAnnotation(id, label)}
                >
                    批注
                </button>
                {isOpen && (
                    <div className="annotation-popover absolute z-[9999] -top-2 right-0 translate-y-[-100%] w-72 lg-card border border-[var(--glass-border)] shadow-2xl p-3 rounded-xl">
                        <div className="flex items-center justify-between mb-2 text-xs text-[var(--lg-text-primary)]">
                            <span className="font-semibold">{label}</span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => clearAnnotation(id)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--glass-border)] hover:border-red-400 hover:text-red-400 text-[var(--lg-text-tertiary)] transition"
                                >
                                    <Trash2 size={12} /> 清空
                                </button>
                                <button
                                    onClick={() => setEditingKey(null)}
                                    className="px-2 py-0.5 rounded border border-[var(--glass-border)] text-[var(--lg-text-tertiary)] hover:text-[var(--lg-text-primary)]"
                                >
                                    关闭
                                </button>
                            </div>
                        </div>
                        <textarea
                            ref={textareaRef}
                            value={value}
                            onChange={(e) => updateAnnotation(id, e.target.value)}
                            className="w-full bg-[var(--lg-bg-secondary)]/60 border border-[var(--glass-border)] rounded-lg p-2 text-xs text-[var(--lg-text-primary)] min-h-[100px] focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20"
                            placeholder={`填写对「${label}」的批注...`}
                        />
                    </div>
                )}
            </div>
        );
    };

    const copyAllAnnotations = async () => {
        const labelMap: Record<string, string> = {
            logic_chain: '底层逻辑链',
            hooks: '前3秒钩子分析',
            viral: '爆款元素',
            characters: '角色库',
        };
        const shotFieldMap: Record<string, string> = {
            initial_frame: '首帧描述',
            visual_changes: '画面变化',
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
                visual_changes: 'visual_changes',
                audio: 'audio',
                emotion: 'emotion',
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
            const parsed = parseRound2(compareRound2Text);
            if (parsed.error) {
                setCompareRound2Error(parsed.error);
                hasError = true;
            } else {
                r2 = parsed.data as Round2Data;
                setCompareRound2Error(null);
            }
        } else {
            setCompareRound2Error(null);
        }

        if (!compareRound1Text.trim() && !compareRound2Text.trim()) {
            setCompareRound1Error('请至少粘贴 Round 1 JSON 或 Round 2 Markdown');
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
        if (key === 'logic_chain') {
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
        const round1TextHydrated = result.rawRound1Text ?? (result.round1 ? (typeof result.round1 === 'string' ? result.round1 : JSON.stringify(result.round1, null, 2)) : '');
        const round2TextHydrated = result.rawRound2Text ?? (result.round2 ? (typeof result.round2 === 'string' ? result.round2 : JSON.stringify(result.round2, null, 2)) : '');
        setRound1Data(result.round1 as Round1Data);
        setRound2Data(result.round2 as Round2Data);
        setRound1Error(result.errorsRound1.length ? result.errorsRound1.join('；') : null);
        setRound2Error(result.errorsRound2.length ? result.errorsRound2.join('；') : null);
        setRound1Text(round1TextHydrated);
        setRound2Text(round2TextHydrated);
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
            setRound1Error(parsed1.data ? null : parsed1.error);
            setRound2Error(parsed2.data ? null : parsed2.error);

            const fallbackRound2 = typeof round2Data === 'string' ? undefined : round2Data || undefined;
            const payload = JSON.stringify(
                {
                    round1: parsed1.data ?? (typeof round1Data === 'string' ? undefined : round1Data || undefined),
                    round2: parsed2.data ?? fallbackRound2,
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
        <div className="lg-page">
            {/* Liquid Glass Background - 精致多层背景 */}
            <div className="lg-background" />
            {/* 柔和光晕层 - 使用新的预定义类 */}
            <div className="lg-orb-1" />
            <div className="lg-orb-2" />
            <div className="lg-orb-3" />

            <div className="space-y-8 pb-32 relative z-10">
                {/* Header */}
                <div className="lg-card-static p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-[var(--lg-text-primary)] flex items-center gap-2">
                            <Film size={24} className="text-[var(--lg-blue)]" />
                            人工改写
                        </h2>
                        <button
                            onClick={nextStep}
                            className="lg-btn lg-btn-primary shadow-lg shadow-blue-500/20"
                        >
                            下一步: 生产剧本 <ArrowRight size={16} />
                        </button>
                    </div>
                    <div className="text-sm text-[var(--lg-text-secondary)]">
                        {modeSubtitleMap[mode]}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {!hideModeSwitcher && modeOptions.map(({ key, label, helper }) => (
                            <button
                                key={key}
                                onClick={() => setMode(key)}
                                className={`
                                px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                                ${mode === key
                                        ? 'bg-[var(--lg-blue)] text-white shadow-lg shadow-[var(--lg-blue)]/20 ring-2 ring-[var(--lg-blue)]/50'
                                        : 'lg-card-inset text-[var(--lg-text-secondary)] hover:text-[var(--lg-text-primary)]'}
                            `}
                            >
                                <div className="flex flex-col items-start gap-0.5">
                                    <span>{label}</span>
                                    <span className="text-xs opacity-70">{helper}</span>
                                </div>
                            </button>
                        ))}

                        {/* 左侧：剧本文件选择 + 复制按钮 */}
                        <div className="flex items-center gap-2">
                            <select
                                value={selectedDeconstructionFile || 'deconstruction.json'}
                                onChange={(e) => void switchDeconstructionFile(e.target.value)}
                                className="lg-input text-sm h-9 px-3 py-0"
                                style={{ minWidth: '200px' }}
                            >
                                {deconstructionFiles.length === 0 && (
                                    <option value="deconstruction.json">deconstruction.json</option>
                                )}
                                {deconstructionFiles.map((f) => (
                                    <option key={f} value={f}>{f}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleCopyPrompt}
                                disabled={promptCopyStatus === 'loading'}
                                className={`lg-btn lg-btn-sm ${promptCopyStatus === 'copied'
                                    ? 'lg-badge-green'
                                    : promptCopyStatus === 'error'
                                        ? 'lg-badge-red'
                                        : 'lg-btn-glass'}`}
                            >
                                {promptCopyStatus === 'copied' ? <Check size={14} /> : <Copy size={14} />}
                                <span>{promptCopyStatus === 'loading' ? '...' : promptCopyStatus === 'copied' ? '已复制' : '复制改写提示词'}</span>
                            </button>
                            {!hideAnnotations && (
                                <button
                                    onClick={copyAllAnnotations}
                                    className={`lg-btn lg-btn-sm ${copyStatus === 'copied'
                                        ? 'lg-badge-green'
                                        : copyStatus === 'empty'
                                            ? 'lg-badge-orange'
                                            : copyStatus === 'error'
                                                ? 'lg-badge-red'
                                                : 'lg-btn-glass'}`}
                                >
                                    <MessageSquare size={14} />
                                    <span>{copyStatus === 'copied' ? '已复制' : '批注'}</span>
                                </button>
                            )}
                            {/* Compare JSON Button - Only in review mode */}
                            {mode === 'review' && !hideCompare && (
                                <button
                                    onClick={() => setShowComparePanel(!showComparePanel)}
                                    className={`lg-btn lg-btn-sm ${compareData ? 'lg-badge-orange' : 'lg-btn-glass'}`}
                                >
                                    <ClipboardPaste size={14} />
                                    <span>{compareData ? `对比(${diffMap.size})` : '对比'}</span>
                                </button>
                            )}
                        </div>

                        {/* 弹性空间 - 推动右侧配置组到右边 */}
                        <div className="flex-1" />

                        {/* 右侧配置组 - 统一样式 */}
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowPresetModal(true)}
                                className="lg-btn lg-btn-sm lg-btn-glass"
                                type="button"
                            >
                                <Settings size={14} />
                                生图设定
                            </button>
                            <button
                                onClick={() => setShowProviderModal(true)}
                                className="lg-btn lg-btn-sm lg-btn-glass"
                                type="button"
                            >
                                <Settings size={14} />
                                生图供应商
                            </button>
                            <button
                                onClick={() => setShowVideoConfigModal(true)}
                                className="lg-btn lg-btn-sm lg-btn-glass"
                                type="button"
                            >
                                <Video size={14} />
                                视频供应商
                            </button>
                        </div>
                    </div>

                    {/* Compare Panel - Only visible when showComparePanel is true */}
                    {mode === 'review' && !hideCompare && showComparePanel && (
                        <div className="lg-card-compact p-4 space-y-3 border-amber-500/30">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                                    <ClipboardPaste size={16} />
                                    粘贴 Round 1 JSON / Round 2 Markdown 进行对比
                                </h4>
                                <div className="flex items-center gap-2">
                                    {compareData && (
                                        <span className="text-xs px-2 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                            {diffMap.size} 处差异
                                        </span>
                                    )}
                                    <button
                                        onClick={() => setShowComparePanel(false)}
                                        className="p-1 hover:bg-[var(--lg-bg-tertiary)] rounded text-[var(--lg-text-tertiary)]"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            {/* Two separate inputs for Round 1 (JSON) and Round 2 (Markdown) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Round 1 Input */}
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-blue-400">Round 1: 宏观骨架 + 钩子</label>
                                    <textarea
                                        value={compareRound1Text}
                                        onChange={(e) => setCompareRound1Text(e.target.value)}
                                        placeholder="粘贴 Round 1 JSON（含 round1_skeleton 和 round1_hook）..."
                                        className={`w-full h-28 bg-[var(--lg-bg-primary)] border rounded-lg p-3 text-xs font-mono text-[var(--lg-text-primary)] focus:outline-none focus:ring-1 resize-none ${compareRound1Error
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
                                    <label className="text-xs font-semibold text-purple-400">Round 2: 分镜头分析（Markdown）</label>
                                    <textarea
                                        value={compareRound2Text}
                                        onChange={(e) => setCompareRound2Text(e.target.value)}
                                        placeholder="粘贴 Round 2 Markdown（含角色说明 + 分镜表格）..."
                                        className={`w-full h-28 bg-[var(--lg-bg-primary)] border rounded-lg p-3 text-xs font-mono text-[var(--lg-text-primary)] focus:outline-none focus:ring-1 resize-none ${compareRound2Error
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
                                    className="lg-btn lg-btn-sm lg-btn-primary"
                                    style={{ background: 'var(--lg-orange)' }}
                                >
                                    <RefreshCw size={14} />
                                    解析并对比
                                </button>
                                {compareData && (
                                    <button
                                        onClick={clearCompareData}
                                        className="lg-btn lg-btn-sm lg-btn-secondary"
                                    >
                                        <X size={14} />
                                        清除
                                    </button>
                                )}
                            </div>
                            {compareData && diffMap.size > 0 && (
                                <div className="text-xs text-[var(--lg-text-secondary)] leading-relaxed">
                                    <span className="text-amber-400 font-medium">提示:</span> 在下方字段旁边点击
                                    <span className="mx-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px]">核验</span>
                                    按钮查看差异并选择是否采纳。
                                </div>
                            )}
                        </div>
                    )}

                    {/* Global Volume Control */}
                    <div className="flex items-center gap-4 p-3 lg-card-inset">
                        <button
                            onClick={toggleGlobalMute}
                            className="p-1.5 hover:bg-[var(--lg-bg-tertiary)] rounded text-[var(--lg-text-primary)]"
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
                            className="flex-1 h-1 bg-[var(--lg-bg-secondary)] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500"
                        />
                        <span className="text-xs text-[var(--lg-text-tertiary)] w-8 text-right">
                            {Math.round((isGlobalMuted ? 0 : globalVolume) * 100)}%
                        </span>
                    </div>

                </div>

                <div className="mx-auto px-8 py-6 space-y-8 relative">
                    {generateError && (
                        <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-amber-300">
                            {generateError}
                        </div>
                    )}
                    {/* Final Mode Metadata & Analysis */}
                    {(mode === 'final' || mode === 'revision') && (
                        <div className="lg-card-compact p-5 border-l-4 border-l-purple-500 space-y-3">
                            <div className="flex items-center gap-2 text-purple-300">
                                <Zap size={16} />
                                <span className="text-sm font-semibold">{mode === 'final' ? '优化摘要' : '修订摘要（对比终版）'}</span>
                            </div>
                            {optimizedMetadata && (
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[var(--lg-text-secondary)]">
                                    {Object.entries(optimizedMetadata).map(([k, v]) => (
                                        <div key={k} className="p-3 rounded-lg bg-[var(--lg-bg-secondary)]/50 border border-[var(--glass-border)]">
                                            <div className="text-xs uppercase text-[var(--lg-text-tertiary)]">{k}</div>
                                            <div className="text-[var(--lg-text-primary)] break-words">{String(v)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {optimizedAnalysis?.summary && (
                                <div className="text-sm text-[var(--lg-text-primary)] leading-relaxed bg-[var(--glass-bg-light)]/70 p-3 rounded-lg border border-[var(--glass-border)]">
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
                                    <div className="text-xs font-semibold text-[var(--lg-text-primary)]">Checkpoints</div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        {Object.entries(optimizedAnalysis.checkpoints as Record<string, unknown>).map(([k, v]) => (
                                            <div key={k} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-light)]/70 text-xs space-y-1">
                                                <div className="uppercase text-[var(--lg-text-tertiary)]">{k}</div>
                                                <div className="text-[var(--lg-text-primary)] whitespace-pre-wrap leading-relaxed">{String(v)}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {!optimizedMetadata && !optimizedAnalysis?.summary && (
                                <div className="text-xs text-[var(--lg-text-tertiary)]">未提供优化元数据。</div>
                            )}

                            {deletedShots && deletedShots.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-red-300 flex items-center gap-2">
                                        <Trash2 size={12} /> 已删除镜头
                                    </div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        {deletedShots.map((d, idx) => (
                                            <div key={`${d.original_id ?? idx}`} className="p-3 rounded-lg border border-red-500/20 bg-red-500/5 text-xs space-y-1">
                                                <div className="font-semibold text-[var(--lg-text-primary)]">Shot #{d.original_id ?? idx + 1}</div>
                                                {d.reason && <div className="text-[var(--lg-text-secondary)] leading-relaxed">{d.reason}</div>}
                                                {d.type && <div className="text-xs uppercase text-red-300">类型: {d.type}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {Array.isArray(modifiedAssets) && modifiedAssets.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-[var(--lg-text-primary)]">元素替换</div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        {modifiedAssets.map((m, idx) => (
                                            <div key={`${m.original ?? idx}-${idx}`} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-light)]/70 text-xs space-y-1">
                                                <div className="flex items-center gap-2 text-[var(--lg-text-primary)]">
                                                    <span className="line-through text-[var(--lg-text-tertiary)]">{m.original}</span>
                                                    <ArrowRight size={10} className="text-[var(--lg-text-secondary)]" />
                                                    <span className="text-emerald-400 font-semibold">{m.replacement}</span>
                                                </div>
                                                {m.type && <div className={`text-xs uppercase ${modTypeClass(m.type)}`}>{m.type}</div>}
                                                {m.element_type && <div className="text-xs text-amber-300 uppercase">{m.element_type}</div>}
                                                {m.reason && <div className="text-[var(--lg-text-secondary)] leading-relaxed">{m.reason}</div>}
                                                {m.affected_shots && m.affected_shots.length > 0 && (
                                                    <div className="text-xs text-[var(--lg-text-tertiary)]">影响镜头: {m.affected_shots.join(', ')}</div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {optimizedAnalysis?.modified_assets_overview && Array.isArray(optimizedAnalysis.modified_assets_overview) && (
                                <div className="space-y-2">
                                    <div className="text-xs font-semibold text-[var(--lg-text-primary)]">Modified Assets 概览</div>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        {(optimizedAnalysis.modified_assets_overview as Array<Record<string, unknown>>).map((item, idx) => (
                                            <div key={idx} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg-light)]/70 text-xs space-y-1">
                                                {!!item.shot_id && <div className="font-semibold text-[var(--lg-text-primary)]">Shot {String(item.shot_id)}</div>}
                                                {!!item.field && <div className="text-[var(--lg-text-secondary)]">字段: {String(item.field)}</div>}
                                                {!!item.element_type && <div className="text-[var(--lg-text-secondary)]">元素: {String(item.element_type)}</div>}
                                                {!!item.reason && <div className="text-[var(--lg-text-primary)] whitespace-pre-wrap leading-relaxed">{String(item.reason)}</div>}
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
                            <div className="lg-card-compact p-5 border-l-4 border-l-emerald-500 space-y-4">
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
                                {/* Logic Chain */}
                                <div className="lg-card-compact p-5 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                                            <GitBranch size={18} />
                                        </div>
                                        <h3 className="text-base font-semibold text-slate-800">底层逻辑链</h3>
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
                                        minRows={2}
                                        maxRows={20}
                                        className="w-full bg-slate-50/50 border border-slate-200/50 rounded-xl p-4 text-sm text-slate-700 focus:outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all resize-none shadow-sm placeholder:text-slate-400"
                                        placeholder="输入逻辑链..."
                                    />
                                </div>

                                <div className="lg-card-compact p-5 space-y-5">
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500">
                                            <Layout size={18} />
                                        </div>
                                        <h3 className="text-base font-semibold text-slate-800">骨架节点 (Timeline)</h3>
                                    </div>
                                    <div className="space-y-0 relative pl-4">
                                        {/* Timeline Line */}
                                        <div className="absolute left-[29px] top-4 bottom-8 w-px bg-slate-200" />

                                        {typeof round1Data !== 'string' && (round1Data?.round1_skeleton?.skeleton_nodes || []).map((node, idx) => (
                                            <div key={idx} className="relative flex items-stretch gap-4 pb-8 last:pb-0 group">
                                                {/* Timeline Dot */}
                                                <div className="w-14 flex items-center justify-center z-10 pt-2">
                                                    <div className="w-8 h-8 rounded-full bg-white border border-purple-200 text-purple-600 flex items-center justify-center text-sm font-semibold shadow-sm group-hover:scale-110 group-hover:border-purple-400 group-hover:shadow-md transition-all duration-300">
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
                                                    className="w-full bg-slate-50/50 border border-slate-200/50 rounded-xl p-4 text-sm text-slate-700 focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 transition-all resize-none shadow-sm hover:bg-white"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Mechanics & Analysis (5/12) */}
                            <div className="xl:col-span-5 space-y-8">
                                {/* Hooks Analysis */}
                                <div className="lg-card-compact p-5 space-y-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 rounded-lg bg-pink-500/10 text-pink-500">
                                            <Anchor size={18} />
                                        </div>
                                        <h3 className="text-base font-semibold text-slate-800">前3秒钩子分析</h3>
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
                                                className="w-full bg-slate-50/50 border border-slate-200/50 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-pink-500/50 focus:ring-4 focus:ring-pink-500/10 transition-all resize-none shadow-sm"
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
                                                className="w-full bg-slate-50/50 border border-slate-200/50 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-pink-500/50 focus:ring-4 focus:ring-pink-500/10 transition-all resize-none shadow-sm"
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
                                                className="w-full bg-slate-50/50 border border-slate-200/50 rounded-xl px-4 py-3 text-sm text-slate-700 leading-relaxed focus:outline-none focus:border-pink-500/50 focus:ring-4 focus:ring-pink-500/10 transition-all resize-none shadow-sm"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Viral Elements */}
                                <div className="lg-card-compact p-5 space-y-4">
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                                            <Zap size={18} />
                                        </div>
                                        <h3 className="text-base font-semibold text-slate-800">爆款元素</h3>
                                        {renderAnnotationControl('viral', '爆款元素')}
                                    </div>
                                    <div className="space-y-4">
                                        {typeof round1Data !== 'string' && (round1Data?.round1_skeleton?.viral_elements_found || []).map((v, idx) => (
                                            <div key={idx} className="bg-slate-50/50 p-4 rounded-xl border border-slate-200/50 space-y-3 hover:border-amber-400/50 hover:shadow-md transition-all duration-300 group">
                                                <div className="flex gap-3 border-b border-slate-200/50 pb-2">
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
                    <div className="space-y-6">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="apple-headline flex items-center gap-2 text-slate-800">
                                <Film className="w-5 h-5 text-purple-600" />
                                Round 2: 分镜头分析
                            </h3>
                            {round2Error && (
                                <span className="text-xs text-amber-500 flex items-center gap-1 bg-amber-500/10 px-2 py-1 rounded-full border border-amber-500/20">
                                    <AlertCircle size={12} /> 解析错误
                                </span>
                            )}
                        </div>

                        {/* Characters */}
                        {typeof round2Data !== 'string' && (
                            <div className="space-y-6">
                                {/* Enhanced Title Section */}
                                <div className="flex items-center gap-4 px-2 mb-2">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                        <Users size={24} className="text-white" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-2xl font-bold tracking-tight text-slate-900">
                                            角色库
                                        </h3>
                                        <p className="text-sm text-slate-500 mt-0.5 font-medium">
                                            Character Library · {round2Data?.characters ? Object.keys(round2Data.characters).length : 0} 位角色
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setActiveCharacterForPick(null);
                                                setShowGalleryModal(true);
                                            }}
                                            className="apple-button apple-button-secondary py-1.5 px-3 text-sm"
                                        >
                                            参考图库
                                        </button>
                                        {renderAnnotationControl('characters', '角色库')}
                                    </div>
                                </div>
                                <div className="h-px bg-slate-200 mx-2" />

                                {/* Enhanced Character Grid */}
                                {round2Data?.characters && Object.keys(round2Data.characters).length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                        {Object.entries(round2Data.characters).map(([name, desc], index) => {
                                            const refId = characterRefs[name];
                                            const refImage = referenceGallery.find((item) => item.id === refId);
                                            return (
                                                <div
                                                    key={index}
                                                    className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/50 backdrop-blur-xl transition-all duration-300 hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1 hover:border-slate-300"
                                                >

                                                    <div className="relative z-10 p-5">
                                                        <div className="flex gap-4">
                                                            {/* Left: Reference image (9:16) or Avatar placeholder */}
                                                            <div className="flex-shrink-0 w-24">
                                                                {refImage ? (
                                                                    <div
                                                                        className="relative aspect-[9/16] rounded-xl overflow-hidden border border-blue-200/60 bg-slate-900 shadow-lg cursor-zoom-in"
                                                                        onClick={() => setPreviewImage({ url: refImage.url, name: refImage.name })}
                                                                    >
                                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                        <img src={refImage.url} alt={refImage.name} className="w-full h-full object-cover" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="relative aspect-[9/16] rounded-xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-slate-200/60 flex items-center justify-center">
                                                                        <span className="text-4xl font-bold text-slate-400">{name[0]}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Right: Character info */}
                                                            <div className="flex-1 flex flex-col min-w-0">
                                                                {/* Header: Name & Actions */}
                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        {renamingCharacter === name ? (
                                                                            <div className="flex items-center gap-2">
                                                                                <input
                                                                                    value={renamingCharacterValue}
                                                                                    onChange={(e) => setRenamingCharacterValue(e.target.value)}
                                                                                    onKeyDown={(e) => {
                                                                                        if (e.key === 'Enter') handleRenameCharacter(name, renamingCharacterValue);
                                                                                        if (e.key === 'Escape') {
                                                                                            setRenamingCharacter(null);
                                                                                            setRenamingCharacterValue('');
                                                                                        }
                                                                                    }}
                                                                                    autoFocus
                                                                                    className="flex-1 px-2 py-1 rounded-md border border-slate-200 text-sm focus:ring-1 focus:ring-blue-500/40 focus:border-blue-400"
                                                                                    placeholder="新的角色名"
                                                                                />
                                                                                <button
                                                                                    className="px-2 py-1 rounded-md bg-blue-500 text-white text-xs"
                                                                                    onClick={() => handleRenameCharacter(name, renamingCharacterValue)}
                                                                                >
                                                                                    确认
                                                                                </button>
                                                                                <button
                                                                                    className="px-2 py-1 rounded-md bg-slate-200 text-xs"
                                                                                    onClick={() => {
                                                                                        setRenamingCharacter(null);
                                                                                        setRenamingCharacterValue('');
                                                                                    }}
                                                                                >
                                                                                    取消
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <div className="flex items-center gap-2">
                                                                                <div>
                                                                                    <h4 className="text-lg font-bold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors duration-300 truncate">
                                                                                        {name}
                                                                                    </h4>
                                                                                    <div className="h-0.5 w-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mt-1 group-hover:w-16 transition-all duration-500" />
                                                                                </div>
                                                                                <button
                                                                                    onClick={() => {
                                                                                        setRenamingCharacter(name);
                                                                                        setRenamingCharacterValue(name);
                                                                                    }}
                                                                                    className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                                                                                    title="修改角色名"
                                                                                >
                                                                                    <Pencil size={14} />
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                                                        <button
                                                                            onClick={() => {
                                                                                setActiveCharacterForPick(name);
                                                                                setShowGalleryModal(true);
                                                                            }}
                                                                            className="px-2 py-1 rounded-md text-[11px] bg-blue-500/10 text-blue-600 border border-blue-500/30 hover:bg-blue-500/20 transition whitespace-nowrap"
                                                                        >
                                                                            {refImage ? '更换' : '选图'}
                                                                        </button>
                                                                        {refImage && (
                                                                            <button
                                                                                onClick={() => handleDetachReference(name)}
                                                                                className="px-2 py-0.5 rounded-md text-[10px] text-slate-400 hover:text-red-500 transition"
                                                                            >
                                                                                取消
                                                                            </button>
                                                                        )}
                                                                    </div>
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
                                                                    className="flex-1 w-full bg-slate-50/50 border border-slate-200/60 rounded-lg p-2 text-xs text-slate-600 leading-relaxed group-hover:text-slate-800 transition-colors focus:ring-1 focus:ring-blue-500/30 focus:outline-none focus:border-blue-300 resize-none"
                                                                    placeholder="输入角色描述..."
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Bottom Accent Bar */}
                                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
                                                </div>
                                            );
                                        })}

                                        {/* 添加角色卡片 */}
                                        {canEdit && (
                                            <button
                                                onClick={() => setShowAddCharacterModal(true)}
                                                className="group relative overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-white/30 backdrop-blur-sm transition-all duration-300 hover:border-[var(--lg-blue)] hover:bg-white/50 hover:shadow-lg min-h-[200px] flex items-center justify-center"
                                            >
                                                <div className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-[var(--lg-blue)] transition-colors">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-[var(--lg-blue)]/10 flex items-center justify-center transition-colors">
                                                        <Plus size={24} />
                                                    </div>
                                                    <span className="text-sm font-medium">添加角色</span>
                                                </div>
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="lg-card-inset p-5 border border-dashed border-slate-200/50 text-sm text-slate-500 flex flex-col items-center gap-4">
                                        <span>暂无角色，请添加角色信息。</span>
                                        {canEdit && (
                                            <button
                                                onClick={() => setShowAddCharacterModal(true)}
                                                className="lg-btn lg-btn-sm lg-btn-primary"
                                            >
                                                <Plus size={14} />
                                                添加角色
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Shot List - Apple Glass Style */}
                        {/* 全局素材流切换按钮 + 导出按钮 */}
                        {typeof round2Data !== 'string' && round2Data?.shots && round2Data.shots.length > 0 && (
                            <div className="flex items-center justify-between gap-4 mb-4">
                                {/* 左侧：定稿统计 */}
                                <div className="flex items-center gap-3 text-sm">
                                    {(() => {
                                        const activeShots = round2Data.shots.filter(s => !s.discarded);
                                        const total = activeShots.length;
                                        const outlineCount = activeShots.filter(s => s.finalizedOutline).length;
                                        const imageCount = activeShots.filter(s => s.finalizedImage).length;
                                        const videoCount = activeShots.filter(s => s.finalizedVideo).length;
                                        return (
                                            <>
                                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100 text-slate-600">
                                                    <Pencil size={12} />
                                                    <span className="font-medium">{outlineCount}/{total}</span>
                                                </span>
                                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-50 text-blue-600">
                                                    <ImageIcon size={12} />
                                                    <span className="font-medium">{imageCount}/{total}</span>
                                                </span>
                                                <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-50 text-green-600">
                                                    <Film size={12} />
                                                    <span className="font-medium">{videoCount}/{total}</span>
                                                </span>
                                            </>
                                        );
                                    })()}
                                </div>

                                {/* 右侧：操作按钮组 */}
                                <div className="flex items-center gap-4">
                                    {/* 素材流切换 - 使用统一的玻璃容器 + 蓝色选中态 */}
                                    <div className="flex items-center gap-1 p-1 lg-card-inset">
                                        <button
                                            onClick={() => setDefaultStream('outline')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${defaultStream === 'outline'
                                                ? 'bg-[var(--lg-blue)] text-white shadow-sm'
                                                : 'text-[var(--lg-text-secondary)] hover:text-[var(--lg-text-primary)] hover:bg-white/50'
                                                }`}
                                        >
                                            <Pencil size={14} />
                                            线稿
                                        </button>
                                        <button
                                            onClick={() => setDefaultStream('image')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${defaultStream === 'image'
                                                ? 'bg-[var(--lg-blue)] text-white shadow-sm'
                                                : 'text-[var(--lg-text-secondary)] hover:text-[var(--lg-text-primary)] hover:bg-white/50'
                                                }`}
                                        >
                                            <ImageIcon size={14} />
                                            图片
                                        </button>
                                        <button
                                            onClick={() => setDefaultStream('video')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${defaultStream === 'video'
                                                ? 'bg-[var(--lg-blue)] text-white shadow-sm'
                                                : 'text-[var(--lg-text-secondary)] hover:text-[var(--lg-text-primary)] hover:bg-white/50'
                                                }`}
                                        >
                                            <Video size={14} />
                                            视频
                                        </button>
                                    </div>

                                    {/* 分隔线 */}
                                    <div className="w-px h-6 bg-[var(--lg-glass-border)]" />

                                    {/* 批量操作组 - 使用玻璃样式 */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleBatchGenerateOutlines}
                                            disabled={batchGeneratingOutlines}
                                            className="lg-btn lg-btn-sm lg-btn-glass disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {batchGeneratingOutlines ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
                                            {batchGeneratingOutlines ? '生成中...' : '批量生成线稿'}
                                        </button>
                                        {(batchGeneratingOutlines || outlineProgress.total > 0) && (
                                            <span className="lg-caption text-[var(--lg-text-tertiary)]">
                                                {outlineProgress.completed}/{outlineProgress.total}
                                                {outlineProgress.completed === outlineProgress.total && outlineProgress.total > 0 && ' ✓'}
                                            </span>
                                        )}
                                    </div>

                                    {/* 导出按钮 - 主操作用蓝色 */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleExportVideos}
                                            disabled={exporting || Object.keys(savedVideoFilenames).length === 0}
                                            className="lg-btn lg-btn-sm lg-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FolderOutput size={14} />}
                                            {exporting ? '导出中...' : '导出选中视频'}
                                        </button>
                                        <span className="lg-caption text-[var(--lg-text-tertiary)]">
                                            已选中 <span className="font-semibold text-[var(--lg-blue)]">{Object.keys(savedVideoFilenames).length}</span>
                                            /{round2Data.shots.filter(s => !s.discarded).length}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* Top Pagination Controls */}
                        {typeof round2Data !== 'string' && round2Data?.shots && round2Data.shots.length > shotsPerPage && (
                            <div className="flex items-center justify-center gap-4 py-4 mb-6">
                                <button
                                    onClick={() => setShotPage((p) => Math.max(0, p - 1))}
                                    disabled={shotPage === 0}
                                    className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={16} /> 上一页
                                </button>
                                <span className="text-sm text-slate-500">
                                    第 {shotPage + 1} / {Math.ceil(round2Data.shots.length / shotsPerPage)} 页
                                    <span className="ml-2 text-slate-400">（共 {round2Data.shots.length} 个镜头）</span>
                                </span>
                                <button
                                    onClick={() => setShotPage((p) => Math.min(Math.ceil((round2Data.shots?.length || 0) / shotsPerPage) - 1, p + 1))}
                                    disabled={shotPage >= Math.ceil((round2Data.shots?.length || 0) / shotsPerPage) - 1}
                                    className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    下一页 <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                        <div className="space-y-12">
                            {typeof round2Data !== 'string' && round2Data?.shots && (() => {
                                const allShots = round2Data.shots;
                                const totalPages = Math.ceil(allShots.length / shotsPerPage);
                                const startIdx = shotPage * shotsPerPage;
                                const endIdx = startIdx + shotsPerPage;
                                const currentShots = allShots.slice(startIdx, endIdx);
                                return currentShots.map((shot: Round2Shot, localIdx: number) => {
                                    const index = startIdx + localIdx;
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
                                            characterLibrary={typeof round2Data !== 'string' ? round2Data?.characters : undefined}
                                            generatedImageUrls={generatedImages[shot.id ?? index + 1] || []}
                                            generatedImageIndex={generatedIndexes[shot.id ?? index + 1]}
                                            onPrevGenerated={handlePrevImage}
                                            onNextGenerated={handleNextImage}
                                            isGenerating={!!generatingShots[shot.id ?? index + 1]}
                                            providers={providers}
                                            selectedProviderId={shotProviders[shot.id ?? index + 1]}
                                            onProviderChange={handleProviderChange}
                                            onGenerateImage={handleGenerateImage}
                                            highlightGenerated={!!(newlyGenerated[shot.id ?? index + 1]?.length)}
                                            newImages={newlyGenerated[shot.id ?? index + 1] || []}
                                            onImageSeen={handleImageSeen}
                                            onClearNewImages={handleClearNewImages}
                                            generateError={generateErrors[shot.id ?? index + 1]}
                                            canPrevGenerated={(generatedIndexes[shot.id ?? index + 1] ?? 0) > 0}
                                            canNextGenerated={
                                                (() => {
                                                    const list = generatedImages[shot.id ?? index + 1] || [];
                                                    const current = generatedIndexes[shot.id ?? index + 1] ?? Math.max(0, list.length - 1);
                                                    return current < list.length - 1;
                                                })()
                                            }
                                            onSelectGeneratedIndex={handleSelectImageIndex}
                                            workspacePath={currentWorkspace?.path}
                                            generatedDir={generatedDir}
                                            onGenerateVideo={handleGenerateVideo}
                                            isGeneratingVideo={!!generatingVideoShots[shot.id ?? index + 1]}
                                            videoTaskStatus={videoTaskStatuses[shot.id ?? index + 1]}
                                            videoProgress={videoProgress[shot.id ?? index + 1] ?? 0}
                                            videoTaskProgresses={videoTaskProgresses[shot.id ?? index + 1] || []}
                                            generatedVideoUrls={generatedVideos[shot.id ?? index + 1] || []}
                                            selectedVideoIndexes={selectedVideoIndexes[shot.id ?? index + 1] || []}
                                            onSelectVideoIndex={(idx: number) => handleSelectVideoIndex(shot.id ?? index + 1, idx)}
                                            onRemoveVideoIndex={(idx: number) => handleRemoveVideoIndex(shot.id ?? index + 1, idx)}
                                            newVideos={newlyGeneratedVideos[shot.id ?? index + 1] || []}
                                            onVideoSeen={(url: string) => handleVideoSeen(shot.id ?? index + 1, url)}
                                            onStopVideoGeneration={handleStopSingleVideoGeneration}
                                            defaultStream={defaultStream}
                                            // 线稿模式相关
                                            globalOutlineMode={globalOutlineMode}
                                            globalOutlinePrompt={globalOutlinePrompt}
                                            outlineMode={outlineModes[shot.id ?? index + 1]}
                                            onToggleOutlineMode={handleToggleOutlineMode}
                                            outlinePrompt={outlinePrompts[shot.id ?? index + 1]}
                                            onOutlinePromptChange={handleOutlinePromptChange}
                                            outlineUrls={generatedOutlines[shot.id ?? index + 1] || []}
                                            activeOutlineUrl={activeOutlineUrls[shot.id ?? index + 1] || ''}
                                            onSelectOutline={handleSelectOutline}
                                            onGenerateOutline={handleGenerateOutline}
                                            isGeneratingOutline={generatingOutlines[shot.id ?? index + 1] || false}
                                            onDeleteOutline={handleDeleteOutline}
                                            // 定稿相关
                                            onFinalizeOutline={(s, idx, filename) => {
                                                mutateRound2((draft) => {
                                                    if (draft.shots?.[idx]) {
                                                        draft.shots[idx].finalizedOutline = filename || undefined;
                                                    }
                                                });
                                            }}
                                            onFinalizeImage={(s, idx, filename) => {
                                                mutateRound2((draft) => {
                                                    if (draft.shots?.[idx]) {
                                                        draft.shots[idx].finalizedImage = filename || undefined;
                                                    }
                                                });
                                            }}
                                            onFinalizeVideo={(s, idx, filename) => {
                                                mutateRound2((draft) => {
                                                    if (draft.shots?.[idx]) {
                                                        draft.shots[idx].finalizedVideo = filename || undefined;
                                                    }
                                                });
                                            }}
                                        />
                                    );
                                });
                            })()}

                            {/* Pagination Controls */}
                            {typeof round2Data !== 'string' && round2Data?.shots && round2Data.shots.length > shotsPerPage && (
                                <div className="flex items-center justify-center gap-4 py-6">
                                    <button
                                        onClick={() => setShotPage((p) => Math.max(0, p - 1))}
                                        disabled={shotPage === 0}
                                        className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <ChevronLeft size={16} /> 上一页
                                    </button>
                                    <span className="text-sm text-slate-500">
                                        第 {shotPage + 1} / {Math.ceil(round2Data.shots.length / shotsPerPage)} 页
                                        <span className="ml-2 text-slate-400">（共 {round2Data.shots.length} 个镜头）</span>
                                    </span>
                                    <button
                                        onClick={() => setShotPage((p) => Math.min(Math.ceil((round2Data.shots?.length || 0) / shotsPerPage) - 1, p + 1))}
                                        disabled={shotPage >= Math.ceil((round2Data.shots?.length || 0) / shotsPerPage) - 1}
                                        className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition border border-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        下一页 <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}

                            {typeof round2Data === 'string' && (
                                <div className="lg-card-compact p-5 border-l-4 border-l-amber-500">
                                    <div className="text-amber-400 text-base font-medium mb-3 flex items-center gap-2">
                                        <AlertCircle size={20} /> Markdown 解析失败
                                    </div>
                                    <pre className="text-sm text-amber-200/70 whitespace-pre-wrap font-mono overflow-x-auto">
                                        {round2Data}
                                    </pre>
                                </div>
                            )}
                            {mode === 'revision' && missingModifiedShots.length > 0 && (
                                <div className="lg-card-compact p-4 border-l-4 border-l-purple-500 space-y-3">
                                    <div className="text-sm font-semibold text-[var(--lg-text-primary)]">修订日志中的其他镜头</div>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {missingModifiedShots.map((m, idx) => (
                                            <div key={`missing-${m.id}-${idx}`} className="p-3 rounded-lg border border-[var(--glass-border)] bg-[var(--lg-bg-secondary)]/50 space-y-2">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-sm font-semibold text-[var(--lg-text-primary)]">Shot #{String(m.id)}</div>
                                                    <span className="text-xs px-2 py-1 rounded-full border border-purple-500/30 text-purple-300 bg-purple-500/10 uppercase">
                                                        {String(m.action || 'CHANGE')}
                                                    </span>
                                                </div>
                                                {m.reason && <div className="text-xs text-[var(--lg-text-secondary)] leading-relaxed">{String(m.reason)}</div>}
                                                {!!m.changes && Object.keys(m.changes).length > 0 && (
                                                    <div className="text-xs text-[var(--lg-text-tertiary)]">变更字段: {Object.keys(m.changes).join(', ')}</div>
                                                )}
                                                {!!m.backup && (
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
            {toast && (
                <div
                    className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-5 py-3 rounded-xl shadow-lg text-sm font-medium border backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-300"
                    style={{
                        background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(248,113,113,0.95)',
                        borderColor: toast.type === 'success' ? 'rgba(16,185,129,0.6)' : 'rgba(248,113,113,0.6)',
                        color: '#fff',
                    }}
                >
                    {toast.message}
                </div>
            )}
            {previewImage && (
                <div
                    className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
                    onClick={() => setPreviewImage(null)}
                >
                    <div
                        className="relative w-full max-w-6xl max-h-[90vh] flex flex-col gap-4 rounded-3xl border border-white/10 bg-black/80 shadow-2xl p-4 md:p-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between text-white text-sm">
                            <span className="truncate">{previewImage.name || '参考图预览'}</span>
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 transition text-xs"
                            >
                                关闭
                            </button>
                        </div>
                        <div className="relative w-full flex-1 overflow-hidden rounded-2xl bg-black/70 border border-white/10 flex items-center justify-center p-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={previewImage.url}
                                alt={previewImage.name || ''}
                                className="max-h-[80vh] max-w-full object-contain rounded-xl"
                            />
                        </div>
                    </div>
                </div>
            )}
            {showGalleryModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
                    <div className="lg-card lg-card-strong w-full max-w-5xl max-h-[85vh] overflow-hidden shadow-2xl rounded-3xl lg-animate-scale-in">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--glass-border)] bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                    <Layout size={24} className="text-white" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-[var(--lg-text-primary)]">参考图库</h2>
                                    <p className="text-sm text-[var(--lg-text-secondary)]">
                                        {activeCharacterForPick ? `为「${activeCharacterForPick}」选择参考图` : '管理全局参考图库 · 所有工作空间可见'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {refsSaving && <span className="text-xs text-blue-400 animate-pulse">保存中...</span>}
                                <button
                                    onClick={() => {
                                        setShowGalleryModal(false);
                                        setActiveCharacterForPick(null);
                                    }}
                                    className="p-2.5 rounded-xl hover:bg-slate-200/60 transition-all duration-200"
                                >
                                    <X size={20} className="text-slate-500" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                            {/* Category Tabs */}
                            <div className="flex flex-wrap items-center gap-2 px-1">
                                {(['all', ...categoryOptions] as string[]).map((cat) => {
                                    const label = cat === 'all' ? '全部' : cat === '' ? '未分类' : cat;
                                    const active = activeCategoryTab === cat;
                                    return (
                                        <button
                                            key={cat || 'uncategorized'}
                                            onClick={() => {
                                                setActiveCategoryTab(cat);
                                                setRenamingCategoryName('');
                                            }}
                                            className={`px-3 py-1.5 rounded-xl text-sm border transition ${active
                                                ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-blue-200 hover:text-blue-600'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                                {/* New category */}
                                <div className="flex items-center gap-2 ml-auto">
                                    <input
                                        type="text"
                                        value={newCategoryName}
                                        onChange={(e) => setNewCategoryName(e.target.value)}
                                        placeholder="新建分类"
                                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-sm w-36 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                                    />
                                    <button
                                        onClick={() => void handleCreateCategory()}
                                        className="px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-sm hover:bg-emerald-600 transition disabled:opacity-60"
                                        disabled={categorySaving || !newCategoryName.trim()}
                                    >
                                        新建
                                    </button>
                                </div>
                            </div>

                            {/* Category management + prompt */}
                            {activeCategoryTab !== 'all' && (
                                <div className="mt-3 px-1 flex flex-col gap-3">
                                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                                        <div className="flex items-center gap-2">
                                            <span>当前分类：{activeCategoryTab === '' ? '未分类' : activeCategoryTab}</span>
                                            <button
                                                onClick={() => {
                                                    if (activeCategoryTab === '') return;
                                                    setRenamingCategoryName(activeCategoryTab);
                                                }}
                                                className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600 transition text-[11px]"
                                                disabled={categorySaving || activeCategoryTab === ''}
                                            >
                                                重命名
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (activeCategoryTab === '') return;
                                                    setShowDeleteCategoryConfirm(true);
                                                }}
                                                className="px-2 py-1 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 transition text-[11px]"
                                                disabled={categorySaving || activeCategoryTab === ''}
                                            >
                                                删除
                                            </button>
                                        </div>
                                        {categoryPromptSaving && <span className="text-blue-500 animate-pulse">保存中...</span>}
                                    </div>
                                    {renamingCategoryName && (
                                        <div className="flex items-center gap-2">
                                            <input
                                                value={renamingCategoryName}
                                                onChange={(e) => setRenamingCategoryName(e.target.value)}
                                                className="flex-1 text-sm px-3 py-2 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                                placeholder="新的分类名称"
                                                autoFocus
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') void handleRenameCategoryAction();
                                                    if (e.key === 'Escape') setRenamingCategoryName('');
                                                }}
                                            />
                                            <button
                                                onClick={() => void handleRenameCategoryAction()}
                                                className="px-3 py-2 rounded-xl bg-blue-500 text-white text-sm hover:bg-blue-600 transition disabled:opacity-60"
                                                disabled={categorySaving || !renamingCategoryName.trim()}
                                            >
                                                保存
                                            </button>
                                            <button
                                                onClick={() => setRenamingCategoryName('')}
                                                className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-slate-300 transition"
                                            >
                                                取消
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-xs text-slate-500">
                                        <span>分类提示词（仅记录，不参与生成）</span>
                                        {categoryPromptSaving && <span className="text-blue-500 animate-pulse">保存中...</span>}
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <AutoTextArea
                                            value={categoryPromptInput}
                                            onChange={(e) => setCategoryPromptInput(e.target.value)}
                                            minRows={2}
                                            maxRows={4}
                                            className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none max-h-48 overflow-y-auto"
                                            placeholder="为该分类记录一段提示词..."
                                        />
                                        <button
                                            onClick={() => void handleSaveCategoryPrompt()}
                                            className="px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition disabled:opacity-60"
                                            disabled={categoryPromptSaving}
                                        >
                                            保存
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Upload Section (simplified) */}
                            <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/60">
                                <label className="relative cursor-pointer group">
                                    <div className={`px-5 py-2.5 rounded-xl text-sm font-medium shadow-md transition-all duration-200 ${uploading ? 'bg-slate-400 text-white' : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:shadow-lg hover:shadow-blue-500/40'}`}>
                                        {uploading ? '上传中...' : '上传图片'}
                                    </div>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) void handleUploadReference(file);
                                            e.target.value = '';
                                        }}
                                        disabled={uploading}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                    />
                                </label>
                                <span className="text-xs text-slate-400">支持 PNG / JPG / WebP，默认归入当前标签</span>
                                {galleryError && <span className="text-xs text-amber-500 font-medium">{galleryError}</span>}
                            </div>

                            {/* Gallery Grid */}
                            {galleryLoading ? (
                                <div className="flex items-center justify-center py-12 text-slate-400">
                                    <RefreshCw size={20} className="animate-spin mr-2" />
                                    加载中...
                                </div>
                            ) : referenceGallery.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                                    <Layout size={48} className="mb-4 opacity-30" />
                                    <p className="text-sm">暂无参考图片</p>
                                    <p className="text-xs mt-1">点击上方按钮上传图片</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {referenceGallery
                                        .filter((item) => activeCategoryTab === 'all' || (item.category || '') === activeCategoryTab)
                                        .map((item) => (
                                            <div key={item.id} className="group relative rounded-2xl overflow-hidden border border-slate-200/60 bg-white shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300">
                                                {/* 9:16 Image */}
                                                <div
                                                    className="relative aspect-[9/16] bg-slate-900 cursor-zoom-in"
                                                    onClick={(e) => {
                                                        // avoid opening preview when editing name or clicking action buttons
                                                        if (renamingId === item.id) return;
                                                        if ((e.target as HTMLElement)?.closest('[data-stop-preview]')) return;
                                                        setPreviewImage({ url: item.url, name: item.name });
                                                    }}
                                                >
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                                                    {/* Hover Overlay */}
                                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                                    {/* Select Button (when picking for character) */}
                                                    {activeCharacterForPick && (
                                                        <button
                                                            data-stop-preview
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void handleSelectReference(activeCharacterForPick, item.id);
                                                            }}
                                                            className="absolute top-2 right-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white shadow-lg opacity-0 group-hover:opacity-100 hover:bg-blue-600 transition-all duration-200"
                                                        >
                                                            选择此图
                                                        </button>
                                                    )}
                                                    {/* Action Buttons */}
                                                    <div
                                                        className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                                                        data-stop-preview
                                                    >
                                                        {renamingId === item.id ? (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    void handleRenameReference(item.id, renameValue || item.name, renameCategoryInput);
                                                                }}
                                                                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition"
                                                            >
                                                                确认
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setRenamingId(item.id);
                                                                    setRenameValue(item.name);
                                                                    setRenameCategoryInput(item.category || '');
                                                                }}
                                                                className="flex-1 px-2 py-1.5 rounded-lg text-xs font-medium bg-white/90 text-slate-700 hover:bg-white transition"
                                                            >
                                                                重命名
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                void handleDeleteReference(item.id);
                                                            }}
                                                            className="px-2 py-1.5 rounded-lg text-xs font-medium bg-red-500/90 text-white hover:bg-red-600 transition"
                                                        >
                                                            删除
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* Name & Category */}
                                                <div className="p-2.5 space-y-2">
                                                    {renamingId === item.id ? (
                                                        <div className="space-y-2">
                                                            <input
                                                                value={renameValue}
                                                                onChange={(e) => setRenameValue(e.target.value)}
                                                                className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                                                                autoFocus
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') void handleRenameReference(item.id, renameValue || item.name, renameCategoryInput);
                                                                    if (e.key === 'Escape') {
                                                                        setRenamingId(null);
                                                                        setRenameCategoryInput('');
                                                                    }
                                                                }}
                                                                placeholder="名称"
                                                            />
                                                            <input
                                                                value={renameCategoryInput}
                                                                onChange={(e) => setRenameCategoryInput(e.target.value)}
                                                                className="w-full text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') void handleRenameReference(item.id, renameValue || item.name, renameCategoryInput);
                                                                    if (e.key === 'Escape') {
                                                                        setRenamingId(null);
                                                                        setRenameCategoryInput('');
                                                                    }
                                                                }}
                                                                placeholder="分类（可选）"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs font-medium text-slate-700 truncate" title={item.name}>
                                                            {item.name}
                                                        </p>
                                                    )}
                                                    {/* Quick category change */}
                                                    {!renamingId && (
                                                        <div className="flex items-center gap-2">
                                                            <select
                                                                value={item.category || ''}
                                                                onChange={(e) => void handleUpdateImageCategory(item.id, e.target.value)}
                                                                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                                            >
                                                                <option value="">未分类</option>
                                                                {categoryOptions
                                                                    .filter((c) => c !== 'all' && c !== '')
                                                                    .map((c) => (
                                                                        <option key={c} value={c}>
                                                                            {c}
                                                                        </option>
                                                                    ))}
                                                            </select>
                                                            <span className="text-[11px] text-slate-400 whitespace-nowrap">切换分类</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 添加角色弹窗 */}
            {showAddCharacterModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
                    <div className="w-full max-w-lg lg-card lg-card-strong rounded-3xl shadow-2xl overflow-hidden lg-animate-scale-in">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--lg-glass-border)]">
                            <div>
                                <h3 className="lg-title-3 text-[var(--lg-text-primary)]">添加新角色</h3>
                                <p className="lg-footnote text-[var(--lg-text-secondary)]">创建一个新的角色描述</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAddCharacterModal(false);
                                    setNewCharacterName('');
                                    setNewCharacterDesc('');
                                }}
                                className="lg-btn lg-btn-glass p-2 rounded-full"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[var(--lg-text-primary)]">角色名称</label>
                                <input
                                    value={newCharacterName}
                                    onChange={(e) => setNewCharacterName(e.target.value)}
                                    placeholder="如：格子衬衫男主"
                                    className="lg-input"
                                    autoFocus
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-[var(--lg-text-primary)]">角色描述</label>
                                <AutoTextArea
                                    value={newCharacterDesc}
                                    onChange={(e) => setNewCharacterDesc(e.target.value)}
                                    minRows={3}
                                    maxRows={8}
                                    placeholder="外观、妆造、性格、标志物..."
                                    className="lg-input resize-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--lg-glass-border)]">
                            <button
                                onClick={() => {
                                    setShowAddCharacterModal(false);
                                    setNewCharacterName('');
                                    setNewCharacterDesc('');
                                }}
                                className="lg-btn lg-btn-sm lg-btn-glass"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    handleAddCharacter();
                                    setShowAddCharacterModal(false);
                                }}
                                disabled={!newCharacterName.trim()}
                                className="lg-btn lg-btn-sm lg-btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus size={14} />
                                添加角色
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showPresetModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
                    <div className="w-full max-w-5xl lg-card lg-card-strong rounded-3xl shadow-2xl overflow-hidden lg-animate-scale-in flex flex-col" style={{ maxHeight: 'calc(100vh - 48px)' }}>
                        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--lg-glass-border)] flex-shrink-0">
                            <div>
                                <h3 className="lg-title-3 text-[var(--lg-text-primary)]">生图设定库（全局复用）</h3>
                                <p className="lg-footnote text-[var(--lg-text-secondary)]">选择一条设定即可应用，或新增设定</p>
                            </div>
                            <div className="flex items-center gap-3">
                                {imagePresetLoading && <span className="lg-caption text-[var(--lg-blue)] animate-pulse">加载中...</span>}
                                <button
                                    onClick={() => setShowPresetModal(false)}
                                    className="p-2 rounded-full hover:bg-[var(--lg-glass-bg)] transition text-[var(--lg-text-secondary)]"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {imagePresetError && (
                                <div className="text-xs text-amber-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    {imagePresetError}
                                </div>
                            )}

                            {/* 生图模式切换 */}
                            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                                <div className="flex items-center gap-2 mb-3">
                                    <ArrowLeftRight size={16} className="text-slate-500" />
                                    <span className="text-sm font-semibold text-slate-700">Generation Mode</span>
                                </div>
                                <div className="flex gap-3 mb-3">
                                    <button
                                        onClick={() => handleSetGlobalOutlineMode(false)}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${!globalOutlineMode
                                            ? 'bg-blue-500 text-white shadow-md'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:border-blue-300'
                                            }`}
                                    >
                                        标准模式
                                    </button>
                                    <button
                                        onClick={() => handleSetGlobalOutlineMode(true)}
                                        className={`flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all ${globalOutlineMode
                                            ? 'bg-[#6B7280] text-white shadow-md'
                                            : 'bg-white border border-slate-200 text-slate-600 hover:border-[#6B7280]'
                                            }`}
                                    >
                                        Outline Mode
                                    </button>
                                </div>
                                <div className="text-xs text-slate-500 space-y-1">
                                    <div><strong>标准模式：</strong>首帧描述 + 角色参考图 + 生图设定</div>
                                    <div><strong>线稿模式：</strong>线稿图 + 首帧描述 + 角色参考图 + 生图设定</div>
                                </div>
                            </div>

                            {/* 线稿提取设定（线稿模式专用） */}
                            {globalOutlineMode && (
                                <div className="p-4 rounded-xl border border-[#6B7280]/30 bg-[#6B7280]/5 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <Pencil size={16} className="text-[#6B7280]" />
                                        <span className="text-sm font-semibold text-[#6B7280]">线稿提取设定（线稿模式专用）</span>
                                    </div>

                                    {/* 线稿提示词 */}
                                    <div>
                                        <label className="text-xs text-slate-600">线稿提示词：</label>
                                        <textarea
                                            value={globalOutlinePrompt}
                                            onChange={(e) => setGlobalOutlinePrompt(e.target.value)}
                                            onBlur={(e) => saveOutlineConfig({ prompt: e.target.value })}
                                            className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-[#6B7280]/20 bg-white/80 focus:outline-none focus:ring-2 focus:ring-[#6B7280]/30 resize-none"
                                            rows={2}
                                            placeholder="描述线稿提取风格..."
                                        />
                                    </div>

                                    {/* 📐 参考图指引模板 */}
                                    <div className="space-y-2 p-3 rounded-lg border border-[#6B7280]/20 bg-white/50">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-[#6B7280]"><Ruler size={12} /> Reference Template (leave empty for default)</div>
                                        <div>
                                            <label className="text-xs text-slate-500">角色参考：</label>
                                            <input
                                                type="text"
                                                value={globalCharRefTemplate}
                                                onChange={(e) => setGlobalCharRefTemplate(e.target.value)}
                                                onBlur={(e) => saveOutlineConfig({ charRefTemplate: e.target.value })}
                                                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-[#6B7280]/20 bg-white text-sm focus:ring-2 focus:ring-[#6B7280]/20"
                                                placeholder="角色【{name}】的形象、服装、发型严格参考图{image}。"
                                            />
                                            <div className="mt-0.5 text-[10px] text-slate-400">占位符：{'{name}'} = 角色名，{'{image}'} = 参考图编号</div>
                                        </div>
                                        <div>
                                            <label className="text-xs text-slate-500">场景参考：</label>
                                            <input
                                                type="text"
                                                value={globalSceneRefTemplate}
                                                onChange={(e) => setGlobalSceneRefTemplate(e.target.value)}
                                                onBlur={(e) => saveOutlineConfig({ sceneRefTemplate: e.target.value })}
                                                className="w-full mt-1 px-3 py-1.5 rounded-lg border border-[#6B7280]/20 bg-white text-sm focus:ring-2 focus:ring-[#6B7280]/20"
                                                placeholder="画面的景别、人物姿势和动作严格参考图{image}。"
                                            />
                                            <div className="mt-0.5 text-[10px] text-slate-400">占位符：{'{image}'} = 线稿图编号</div>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-500">
                                        <AlertTriangle size={12} className="inline mr-1" />In outline mode, if no outline exists, one will be auto-generated when clicking generate
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-slate-200 pt-4">
                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-3"><Palette size={16} className="text-slate-500" />Image Presets</div>
                            </div>
                            <div className="space-y-3 max-h-[35vh] overflow-y-auto pr-1">
                                <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 cursor-pointer transition">
                                    <input
                                        type="radio"
                                        checked={!selectedImagePresetId}
                                        onChange={() => void handleBindPreset(null)}
                                        className="mt-1"
                                    />
                                    <div className="space-y-1">
                                        <div className="text-sm font-semibold text-slate-800">不使用生图设定</div>
                                        <div className="text-xs text-slate-500">直接使用首帧描述生成</div>
                                    </div>
                                </label>
                                {imagePresets.map((p) => (
                                    <label
                                        key={p.id}
                                        className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:border-blue-300 cursor-pointer transition"
                                    >
                                        <input
                                            type="radio"
                                            checked={selectedImagePresetId === p.id}
                                            onChange={() => void handleBindPreset(p.id)}
                                            className="mt-1"
                                        />
                                        <div className="space-y-1 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="text-sm font-semibold text-slate-800 truncate">{presetLabel(p)}</div>
                                                <div className="flex gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditPreset(p);
                                                        }}
                                                        className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-600 transition"
                                                    >
                                                        编辑
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            void handleDeletePresetById(p.id);
                                                        }}
                                                        className="text-[11px] px-2 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition"
                                                    >
                                                        删除
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                                                {p.content}
                                            </div>
                                        </div>
                                    </label>
                                ))}
                                {!imagePresets.length && (
                                    <div className="text-xs text-slate-400">暂无设定，请在下方新增。</div>
                                )}
                            </div>
                            <div className="p-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 space-y-3">
                                <div className="text-sm font-semibold text-slate-800">{editingPresetId ? '编辑设定' : '新增设定'}</div>
                                <AutoTextArea
                                    value={presetForm.content}
                                    onChange={(e) => setPresetForm((prev) => ({ ...prev, content: e.target.value }))}
                                    minRows={3}
                                    maxRows={8}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                                    placeholder="描述画风、用词模板、比例等，将在生成时拼接到首帧描述后"
                                />
                                <div className="flex gap-2 justify-end">
                                    <button
                                        onClick={() => void handleSavePreset()}
                                        className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-60"
                                        disabled={presetSaving}
                                    >
                                        {editingPresetId ? '保存修改' : '新增设定'}
                                    </button>
                                    {editingPresetId && (
                                        <button
                                            onClick={handleResetPresetForm}
                                            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-600 hover:border-slate-300 transition"
                                        >
                                            取消编辑
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {showGalleryModal && showDeleteCategoryConfirm && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-slate-200 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-red-50 border border-red-100">
                                <Trash2 size={18} className="text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-slate-800">删除分类</h3>
                                <p className="text-sm text-slate-500 mt-0.5">当前分类：{activeCategoryTab === '' ? '未分类' : activeCategoryTab}</p>
                            </div>
                        </div>
                        <div className="space-y-2 text-sm text-slate-600">
                            <label className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition cursor-pointer">
                                <input
                                    type="radio"
                                    name="delete-category-mode"
                                    value="move"
                                    checked={deleteCategoryMode === 'move'}
                                    onChange={() => setDeleteCategoryMode('move')}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="font-medium text-slate-800">同时移动到未分类</div>
                                    <div className="text-xs text-slate-500">该分类下的图片将归入“未分类”，分类提示词一并删除。</div>
                                </div>
                            </label>
                            <label className="flex items-start gap-2 p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition cursor-pointer">
                                <input
                                    type="radio"
                                    name="delete-category-mode"
                                    value="clear"
                                    checked={deleteCategoryMode === 'clear'}
                                    onChange={() => setDeleteCategoryMode('clear')}
                                    className="mt-1"
                                />
                                <div>
                                    <div className="font-medium text-slate-800">删除分类及提示词，但保留图片分类为空</div>
                                    <div className="text-xs text-slate-500">分类字段将被清空（无分类），不移动到“未分类”标签。</div>
                                </div>
                            </label>
                        </div>
                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowDeleteCategoryConfirm(false)}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:border-slate-300 transition"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => void handleDeleteCategoryAction()}
                                className="px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition disabled:opacity-60"
                                disabled={categorySaving}
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <ProviderConfigModal
                isOpen={showProviderModal}
                onClose={() => setShowProviderModal(false)}
            />
            <VideoConfigModal
                isOpen={showVideoConfigModal}
                onClose={() => setShowVideoConfigModal(false)}
                onSave={(config) => setVideoGenConfig(config)}
            />
        </div>
    );
}
