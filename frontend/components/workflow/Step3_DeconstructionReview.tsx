'use client';

import { RefreshCw, Volume2, VolumeX, AlertCircle, Trash2, X, Zap, Users, Box, Layout, Film, ArrowRight, Check, Copy, MessageSquare, ClipboardPaste, GitBranch, Anchor, Pencil, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import { useWorkspace } from '@/components/WorkspaceContext';
import { parseRound1, parseRound2, parseStoredDeconstruction } from '@/lib/services/deconstruction';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';
import { AutoTextArea } from '@/components/ui/AutoTextArea';
import { ShotCard } from '@/components/workflow/ShotCard';
import { ProviderConfigModal } from '@/components/workflow/ProviderConfigModal';
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
    OptimizedStoryboardPayload
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
    // Image preset library
    const [imagePresets, setImagePresets] = useState<ImagePreset[]>([]);
    const [imagePresetLoading, setImagePresetLoading] = useState(false);
    const [imagePresetError, setImagePresetError] = useState<string | null>(null);
    const [showPresetModal, setShowPresetModal] = useState(false);
    const [showProviderModal, setShowProviderModal] = useState(false);
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
    const savedIndexesRef = useRef<Record<number, number>>({});
    const [generatingShots, setGeneratingShots] = useState<Record<number, boolean>>({});
    const [generateError, setGenerateError] = useState<string | null>(null);
    const [generateErrors, setGenerateErrors] = useState<Record<number, string | undefined>>({});
    const [newlyGenerated, setNewlyGenerated] = useState<Record<number, string[]>>({});
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
        let mergedLen = 0;
        setGeneratedImages((prev) => {
            const merged = Array.from(new Set([...(prev[shotId] || []), ...normalized]));
            mergedLen = merged.length;
            return { ...prev, [shotId]: merged };
        });
        // 只有当该 shot 没有已保存的索引时才设置为最后一张
        setGeneratedIndexes((prev) => {
            if (typeof prev[shotId] === 'number') return prev;
            const saved = savedIndexesRef.current[shotId];
            if (typeof saved === 'number' && saved >= 0 && saved < mergedLen) {
                return { ...prev, [shotId]: saved };
            }
            return { ...prev, [shotId]: Math.max(0, mergedLen - 1) };
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
                        data.files.forEach((f) => found.push(f.startsWith('http') ? f : `${API_BASE}${f.startsWith('/') ? '' : '/'}${f}`));
                    }
                }
            } catch {
                // ignore
            }
        }
        if (found.length) {
            let mergedLen = 0;
            setGeneratedImages((prev) => {
                const merged = Array.from(new Set([...(prev[shotId] || []), ...found]));
                mergedLen = merged.length;
                return { ...prev, [shotId]: merged };
            });
            // 只有当该 shot 没有已保存的索引时才设置为最后一张
            setGeneratedIndexes((prev) => {
                if (typeof prev[shotId] === 'number') return prev;
                const saved = savedIndexesRef.current[shotId];
                if (typeof saved === 'number' && saved >= 0 && saved < mergedLen) {
                    return { ...prev, [shotId]: saved };
                }
                return { ...prev, [shotId]: Math.max(0, mergedLen - 1) };
            });
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
            if (editingPresetId) {
                const updated = await updateImagePreset(editingPresetId, presetForm.content);
                setImagePresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                if (selectedImagePresetId === updated.id) {
                    setWorkspacePresetSnapshot(updated);
                }
                showToast('设定已更新', 'success');
            } else {
                // 自动生成名称（前 24 个字符）
                const autoName = presetForm.content.trim().split(/\s+/).join(' ').slice(0, 24) || '生图设定';
                const created = await createImagePreset(presetForm.content, autoName);
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

    const handleProviderChange = (shot: Round2Shot, idx: number, providerId: string) => {
        const shotId = shot.id ?? idx + 1;
        setShotProviders((prev) => ({ ...prev, [shotId]: providerId }));
    };

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
        const basePrompt = `首帧描述: ${typeof shot.initial_frame === 'string' ? shot.initial_frame : JSON.stringify(shot.initial_frame || {})}`;
        const presetText = activeImagePreset?.content?.trim();
        const prompt = presetText ? `${basePrompt}\n\n生图设定：${presetText}` : basePrompt;
        const refs = extractReferenceIds(shot);
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

    // Reset image caches when switching workspace or generatedDir
    useEffect(() => {
        setGeneratedImages({});
        setGeneratedIndexes({});
        setNewlyGenerated({});
        setGeneratingShots({});
    }, [generatedStorageKey, pendingGenKey, readPendingGenerations, loadExistingImagesForShot, startPollingTask]);

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
                // Load saved indexes from server, fallback to last image for each shot
                const applyIndexes = (savedIndexes: Record<number, number>) => {
                    const idxMap: Record<number, number> = {};
                    Object.entries(normalized).forEach(([k, arr]) => {
                        const shotId = Number(k);
                        const saved = savedIndexes[shotId];
                        if (typeof saved === 'number' && saved >= 0 && saved < arr.length) {
                            idxMap[shotId] = saved;
                        } else {
                            idxMap[shotId] = Math.max(0, arr.length - 1);
                        }
                    });
                    setGeneratedIndexes(idxMap);
                };
                if (currentWorkspace?.path && generatedDir) {
                    fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-images?generated_dir=${encodeURIComponent(generatedDir)}`)
                        .then(resp => resp.ok ? resp.json() : { indexes: {} })
                        .then((data: { indexes?: Record<string, number> }) => {
                            const savedIndexes: Record<number, number> = {};
                            if (data.indexes) {
                                Object.entries(data.indexes).forEach(([k, v]) => {
                                    savedIndexes[Number(k)] = v;
                                });
                            }
                            applyIndexes(savedIndexes);
                        })
                        .catch(() => applyIndexes({}));
                } else {
                    applyIndexes({});
                }
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

    // Persist selected image indexes到后端文件（带防抖）
    const saveIndexesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (!currentWorkspace?.path || !generatedDir || Object.keys(generatedIndexes).length === 0) return;
        // Debounce save to avoid too many requests
        if (saveIndexesTimeoutRef.current) {
            clearTimeout(saveIndexesTimeoutRef.current);
        }
        saveIndexesTimeoutRef.current = setTimeout(() => {
            fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-images`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ generated_dir: generatedDir, indexes: generatedIndexes }),
            }).catch(() => { /* ignore */ });
        }, 500);
        return () => {
            if (saveIndexesTimeoutRef.current) {
                clearTimeout(saveIndexesTimeoutRef.current);
            }
        };
    }, [generatedIndexes, currentWorkspace?.path, generatedDir]);

    useEffect(() => {
        if (!workspaceSlug) return;
        if (!round2Data || typeof round2Data === 'string') return;
        const shotIds = (round2Data.shots || []).map((s, idx) => s.id ?? idx + 1);
        shotIds.forEach((id) => {
            void loadExistingImagesForShot(id);
        });
    }, [workspaceSlug, round2Data, loadExistingImagesForShot]);

    // 拉取已保存的选中索引（即使本地没有缓存也要获取）
    useEffect(() => {
        if (!currentWorkspace?.path || !generatedDir) {
            setSavedIndexes({});
            return;
        }
        fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/selected-images?generated_dir=${encodeURIComponent(generatedDir)}`)
            .then(resp => resp.ok ? resp.json() : { indexes: {} })
            .then((data: { indexes?: Record<string, number> }) => {
                const mapped: Record<number, number> = {};
                if (data.indexes) {
                    Object.entries(data.indexes).forEach(([k, v]) => {
                        if (typeof v === 'number') mapped[Number(k)] = v;
                    });
                }
                setSavedIndexes(mapped);
            })
            .catch(() => setSavedIndexes({}));
    }, [currentWorkspace?.path, generatedDir]);

    // 保持 ref 最新
    useEffect(() => {
        savedIndexesRef.current = savedIndexes;
    }, [savedIndexes]);

    // 当远端已保存的索引到达后，为尚未设置的镜头应用它
    useEffect(() => {
        if (!Object.keys(savedIndexes).length) return;
        setGeneratedIndexes((prev) => {
            let changed = false;
            const next = { ...prev };
            Object.entries(savedIndexes).forEach(([k, v]) => {
                const id = Number(k);
                const imgs = generatedImages[id];
                if (!imgs || !imgs.length) return;
                if (v >= 0 && v < imgs.length && prev[id] !== v) {
                    next[id] = v;
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [savedIndexes, generatedImages]);

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
        <>
        <div className="space-y-12 pb-32">
            {/* Header */}
            <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                        <Film size={24} className="text-blue-400" />
                        人工改写
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
                    {!hideModeSwitcher && modeOptions.map(({ key, label, helper }) => (
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
                    <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
                        <span className="hidden md:inline">剧本文件</span>
                        <select
                            value={selectedDeconstructionFile || 'deconstruction.json'}
                            onChange={(e) => void switchDeconstructionFile(e.target.value)}
                            className="px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--color-bg-secondary)]/70 text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30"
                        >
                            {deconstructionFiles.length === 0 && (
                                <option value="deconstruction.json">deconstruction.json</option>
                            )}
                            {deconstructionFiles.map((f) => (
                                <option key={f} value={f}>{f}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={() => setShowPresetModal(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition shadow-sm"
                        type="button"
                    >
                        生图设定
                    </button>
                    <button
                        onClick={() => setShowProviderModal(true)}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition border border-slate-200"
                        type="button"
                    >
                        <Settings size={14} />
                        供应商
                    </button>
                    {!hideAnnotations && (
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
                    )}
                    {/* Compare JSON Button - Only in review mode */}
                    {mode === 'review' && !hideCompare && (
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
                            <span>{compareData ? `对比中 (${diffMap.size}处差异)` : '粘贴数据对比'}</span>
                        </button>
                    )}
                </div>

                {/* Compare Panel - Only visible when showComparePanel is true */}
                {mode === 'review' && !hideCompare && showComparePanel && (
                    <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)]/50 border border-amber-500/30 space-y-3">
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
                                    className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded text-[var(--color-text-tertiary)]"
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
                                    className={`w-full h-28 bg-[var(--color-bg-primary)] border rounded-lg p-3 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:ring-1 resize-none ${compareRound1Error
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
                                    className={`w-full h-28 bg-[var(--color-bg-primary)] border rounded-lg p-3 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:ring-1 resize-none ${compareRound2Error
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
                {generateError && (
                    <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm text-amber-300">
                        {generateError}
                    </div>
                )}
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
                    {typeof round2Data !== 'string' && (
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
                                        <p className="text-sm text-slate-500 mt-0.5">
                                            Character Library · {round2Data?.characters ? Object.keys(round2Data.characters).length : 0} 位角色
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setActiveCharacterForPick(null);
                                                setShowGalleryModal(true);
                                            }}
                                            className="px-3 py-1.5 rounded-lg text-sm bg-blue-500/10 text-blue-500 border border-blue-500/30 hover:bg-blue-500/20 transition"
                                        >
                                            参考图库
                                        </button>
                                        {renderAnnotationControl('characters', '角色库')}
                                    </div>
                                </div>
                                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
                            </div>

                            {/* Add Character */}
                            {canEdit && (
                                <div className="glass-card p-4 rounded-2xl border border-slate-200/70 bg-white/70">
                                    <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
                                        <div className="flex-1 flex flex-col gap-2 w-full">
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs text-slate-500">角色名称</label>
                                                <input
                                                    value={newCharacterName}
                                                    onChange={(e) => setNewCharacterName(e.target.value)}
                                                    placeholder="如：格子衬衫男主"
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                                                />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <label className="text-xs text-slate-500">角色描述</label>
                                                <AutoTextArea
                                                    value={newCharacterDesc}
                                                    onChange={(e) => setNewCharacterDesc(e.target.value)}
                                                    minRows={2}
                                                    maxRows={6}
                                                    placeholder="外观、妆造、性格、标志物..."
                                                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                                                />
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleAddCharacter}
                                            className="whitespace-nowrap px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition disabled:opacity-60"
                                            disabled={!newCharacterName.trim()}
                                        >
                                            添加角色
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Enhanced Character Grid */}
                            {round2Data?.characters && Object.keys(round2Data.characters).length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {Object.entries(round2Data.characters).map(([name, desc], index) => {
                                        const refId = characterRefs[name];
                                        const refImage = referenceGallery.find((item) => item.id === refId);
                                        return (
                                            <div
                                                key={index}
                                                className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-gradient-to-br from-white to-slate-50/30 backdrop-blur-sm transition-all duration-500 hover:shadow-xl hover:shadow-blue-500/10 hover:-translate-y-1 hover:border-blue-300/50"
                                            >
                                                {/* Gradient Overlay on Hover */}
                                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                                {/* Shine Effect */}
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />

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

                                                {/* Bottom Gradient Bar */}
                                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="glass-card p-6 rounded-2xl border border-dashed border-slate-200 text-sm text-slate-500">
                                    暂无角色，请添加角色信息。
                                </div>
                            )}
                        </div>
                    )}

                    {/* Shot List - Apple Glass Style */}
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
                            <div className="glass-card p-6 border-amber-500/30 bg-amber-500/5">
                                <div className="text-amber-400 text-base font-medium mb-3 flex items-center gap-2">
                                    <AlertCircle size={20} /> Markdown 解析失败
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
        {toast && (
            <div
                className="fixed bottom-4 right-4 z-[9999] px-4 py-3 rounded-lg shadow-lg text-sm border"
                style={{
                    background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(248,113,113,0.15)',
                    borderColor: toast.type === 'success' ? 'rgba(16,185,129,0.4)' : 'rgba(248,113,113,0.4)',
                    color: toast.type === 'success' ? '#10b981' : '#f87171',
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
                <div className="glass-card w-full max-w-5xl max-h-[85vh] overflow-hidden border border-[var(--glass-border)] shadow-2xl rounded-3xl">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--glass-border)] bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                                <Layout size={24} className="text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">参考图库</h2>
                                <p className="text-sm text-[var(--color-text-secondary)]">
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
                                        className={`px-3 py-1.5 rounded-xl text-sm border transition ${
                                            active
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
                                                            setRenameCategory(item.category || '');
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
                                                                setRenameCategory('');
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
        {showPresetModal && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
                <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900">生图设定库（全局复用）</h3>
                            <p className="text-xs text-slate-500">选择一条设定即可应用，或新增设定</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {imagePresetLoading && <span className="text-xs text-blue-500 animate-pulse">加载中...</span>}
                            <button
                                onClick={() => setShowPresetModal(false)}
                                className="p-2 rounded-full hover:bg-slate-100 transition text-slate-500"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        {imagePresetError && (
                            <div className="text-xs text-amber-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                {imagePresetError}
                            </div>
                        )}
                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
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
                            <div className="text-sm font-semibold text-slate-800">新增设定</div>
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
        </>
    );
}
