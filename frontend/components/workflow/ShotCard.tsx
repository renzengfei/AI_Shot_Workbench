import { Clock, Zap, Image as ImageIcon, Layers, Sparkles, Users, Sun, Palette, CheckCircle2, RefreshCw, Box, Layout, Trash2 } from 'lucide-react';
import { type ReactNode, useState, useEffect } from 'react';
import { AutoTextArea } from '@/components/ui/AutoTextArea';
import { PreviewVideoPlayer } from '@/components/ui/PreviewVideoPlayer';
import { Round2Shot, ReviewMode, StructuredInitialFrame, ShotAlternative } from '@/types/deconstruction';

// Diff info for a single field
interface DiffInfo {
    oldVal: string;
    newVal: string;
}

interface ShotCardProps {
    shot: Round2Shot;
    index: number;
    mode: ReviewMode;
    optimizedShot?: Round2Shot | null;
    onUpdate?: (updatedShot: Round2Shot) => void;
    renderAnnotationControl?: (id: string, label: string) => ReactNode;
    globalVolume: number;
    isGlobalMuted: boolean;
    clipUrl: string | null;
    frameUrl: string | null;
    // Diff comparison props
    diffMap?: Map<string, DiffInfo>;
    onAcceptDiff?: (fieldKey: string) => void;
    // Character library for reference detection
    characterLibrary?: Record<string, string>;
    generatedImageUrls?: string[];
    generatedImageIndex?: number;
    onPrevGenerated?: (shot: Round2Shot, index: number) => void;
    onNextGenerated?: (shot: Round2Shot, index: number) => void;
    onGenerateImage?: (shot: Round2Shot, index: number) => void;
    isGenerating?: boolean;
    highlightGenerated?: boolean;
    newImages?: string[];
    onImageSeen?: (shot: Round2Shot, index: number, url: string) => void;
    generateError?: string | null;
    canPrevGenerated?: boolean;
    canNextGenerated?: boolean;
}

export const ShotCard = ({
    shot,
    index,
    mode,
    optimizedShot,
    onUpdate,
    renderAnnotationControl,
    globalVolume,
    isGlobalMuted,
    clipUrl,
    frameUrl,
    diffMap,
    onAcceptDiff,
    characterLibrary = {},
    generatedImageUrls = [],
    generatedImageIndex = undefined,
    onPrevGenerated,
    onNextGenerated,
    onGenerateImage,
    isGenerating = false,
    highlightGenerated = false,
    newImages = [],
    onImageSeen,
    generateError = null,
    canPrevGenerated = true,
    canNextGenerated = true,
}: ShotCardProps) => {
    const shotId = shot.id ?? index + 1;
    const canEdit = mode === 'review';

    // Delete confirmation state: { type: 'fg_char' | 'fg_obj' | 'mg_char' | 'mg_obj', index: number } | null
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; index: number; label: string } | null>(null);

    // Helper to render character or object item (handles both string and object types)
    const renderFrameItem = (item: unknown): string => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
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

    // Helper to check if a character tag is from the character library
    const isCharacterFromLibrary = (char: unknown): boolean => {
        if (typeof char === 'object' && char !== null) {
            const obj = char as Record<string, unknown>;
            const tag = obj.tag as string;
            return !!tag && tag in characterLibrary;
        }
        return false;
    };

    // Helper to render structured Initial Frame diff content
    const renderInitialFrameDiffContent = (jsonStr: string) => {
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
                                        <div key={i} className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-700">{renderFrameItem(c) || '添加角色...'}</div>
                                    ))}
                                    {(!frame.foreground?.characters?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无角色</div>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">道具:</div>
                                <div className="space-y-1">
                                    {(frame.foreground?.objects || []).map((o: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-700">{renderFrameItem(o) || '添加道具...'}</div>
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
                                        <div key={i} className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-700">{renderFrameItem(c) || '添加角色...'}</div>
                                    ))}
                                    {(!frame.midground?.characters?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无角色</div>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">道具:</div>
                                <div className="space-y-1">
                                    {(frame.midground?.objects || []).map((o: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-700">{renderFrameItem(o) || '添加道具...'}</div>
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
                                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-700">
                                    {frame.background?.environment || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">景深:</div>
                                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-700">
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
                                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-700">
                                    {frame.lighting || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">色调:</div>
                                <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-slate-700">
                                    {frame.color_palette || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        } catch {
            return (
                <div className="text-slate-700 whitespace-pre-wrap text-sm">
                    {jsonStr || <span className="italic text-slate-400">(空)</span>}
                </div>
            );
        }
    };

    // Helper to render array diff content (for characters/objects)
    const renderArrayDiffContent = (jsonStr: string): ReactNode => {
        try {
            const arr = JSON.parse(jsonStr);
            if (!Array.isArray(arr) || arr.length === 0) {
                return <span className="italic text-slate-400">(空)</span>;
            }
            return (
                <div className="space-y-1">
                    {arr.map((item, i) => (
                        <div key={i} className="p-2 rounded-lg bg-emerald-100/50 border border-emerald-200 text-slate-700 text-sm">
                            {renderFrameItem(item)}
                        </div>
                    ))}
                </div>
            );
        } catch {
            return <div className="text-sm text-slate-700">{jsonStr}</div>;
        }
    };

    // Helper to render diff panel below a field
    const renderDiffPanel = (fieldKey: string, displayType: 'text' | 'array' | 'initial_frame' = 'text'): ReactNode => {
        if (!diffMap || !onAcceptDiff) return null;
        const diff = diffMap.get(fieldKey);
        if (!diff) return null;

        return (
            <div className="mt-2 border border-emerald-400/50 rounded-xl p-3 bg-emerald-50/50 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold mb-2">
                            <RefreshCw size={12} />
                            <span>新值</span>
                        </div>
                        {displayType === 'initial_frame' ? (
                            renderInitialFrameDiffContent(diff.newVal)
                        ) : displayType === 'array' ? (
                            renderArrayDiffContent(diff.newVal)
                        ) : (
                            <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                                {diff.newVal || <span className="italic text-slate-400">(空)</span>}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={() => onAcceptDiff(fieldKey)}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition text-xs font-medium shadow-sm"
                    >
                        <CheckCircle2 size={14} />
                        应用
                    </button>
                </div>
            </div>
        );
    };

    // Handler to delete character or object from initial frame
    const handleDeleteItem = (type: string, idx: number) => {
        if (!structuredFrameOriginal) return;

        let newFrame = { ...structuredFrameOriginal };

        switch (type) {
            case 'fg_char':
                if (newFrame.foreground?.characters) {
                    const newChars = [...newFrame.foreground.characters];
                    newChars.splice(idx, 1);
                    newFrame = { ...newFrame, foreground: { ...newFrame.foreground, characters: newChars } };
                }
                break;
            case 'fg_obj':
                if (newFrame.foreground?.objects) {
                    const newObjs = [...newFrame.foreground.objects];
                    newObjs.splice(idx, 1);
                    newFrame = { ...newFrame, foreground: { ...newFrame.foreground, objects: newObjs } };
                }
                break;
            case 'mg_char':
                if (newFrame.midground?.characters) {
                    const newChars = [...newFrame.midground.characters];
                    newChars.splice(idx, 1);
                    newFrame = { ...newFrame, midground: { ...newFrame.midground, characters: newChars } };
                }
                break;
            case 'mg_obj':
                if (newFrame.midground?.objects) {
                    const newObjs = [...newFrame.midground.objects];
                    newObjs.splice(idx, 1);
                    newFrame = { ...newFrame, midground: { ...newFrame.midground, objects: newObjs } };
                }
                break;
        }

        updateField('initial_frame', newFrame);
        setDeleteConfirm(null);
    };

    // Helper to render fields with revision comparison
    const renderFieldWithRevision = (
        originalNode: ReactNode,
        label: string,
        originalVal?: string,
        optimizedVal?: string,
    ): ReactNode => {
        if (mode !== 'revision') return originalNode;
        const nextVal = optimizedVal;
        const origVal = originalVal ?? '';
        if (!nextVal || nextVal === origVal) return originalNode;

        const isMissing = !origVal;
        const panelClass = isMissing
            ? 'border-blue-500/30 bg-blue-500/5 text-slate-700'
            : 'border-amber-500/30 bg-amber-500/5 text-slate-700';
        const labelClass = isMissing ? 'text-blue-600' : 'text-amber-600';
        const badgeClass = isMissing
            ? 'bg-blue-500 text-white border-transparent'
            : 'bg-amber-500 text-white border-transparent';

        return (
            <div className="space-y-3 group/revision">
                <div className="relative">
                    {originalNode}
                    <div className="absolute left-4 -bottom-3 w-0.5 h-3 bg-gradient-to-b from-slate-300 to-transparent z-0" />
                </div>

                <div className={`relative z-10 border rounded-xl p-4 text-sm shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md ${panelClass}`}>
                    <div className="flex items-center justify-between mb-2">
                        <div className={`flex items-center gap-2 text-xs uppercase font-bold tracking-wider ${labelClass}`}>
                            <Sparkles size={12} />
                            <span>{label} (优化后)</span>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm ${badgeClass}`}>
                            NEW
                        </span>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed font-medium">{nextVal}</div>
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

    const modType = shot.modification?.type;
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

    // Prepare values
    const baseVisual = shot.visual_changes ?? '';
    const optVisual = optimizedShot?.visual_changes;
    const visualVal = mode === 'revision' ? baseVisual : (shot.visual_changes ?? optVisual ?? '');

    const alternatives = shot.alternatives || [];
    const showGeneration = !!onGenerateImage;
    const hasGeneratedImages = Array.isArray(generatedImageUrls) && generatedImageUrls.length > 0;
    const activeIndex = generatedImageIndex !== undefined ? generatedImageIndex : (hasGeneratedImages ? generatedImageUrls.length - 1 : 0);
    const activeImage = hasGeneratedImages ? generatedImageUrls[Math.min(activeIndex, generatedImageUrls.length - 1)] : null;
    useEffect(() => {
        if (activeImage && newImages.includes(activeImage)) {
            onImageSeen?.(shot, index, activeImage);
        }
    }, [activeImage, newImages, onImageSeen, shot, index]);

    // Initial Frame Logic
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

    const updateField = (field: keyof Round2Shot, value: Round2Shot[keyof Round2Shot]) => {
        if (onUpdate) {
            onUpdate({ ...shot, [field]: value });
        }
    };

    return (
        <>
            <div
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
                <div className={`relative z-10 grid grid-cols-1 ${showGeneration ? 'md:grid-cols-5' : 'md:grid-cols-4'} gap-6`}>
                    {/* Left Column: Video/Frame Display + Generated Placeholders */}
                    <div className={showGeneration ? 'md:col-span-3' : ''}>
                        <div className={showGeneration ? 'grid grid-cols-3 gap-4' : ''}>
                            {/* Original Video/Frame */}
                            <div className="space-y-3">
                                {clipUrl ? (
                                    <PreviewVideoPlayer
                                        src={clipUrl}
                                        volume={globalVolume}
                                        muted={isGlobalMuted}
                                        className="w-full"
                                        aspectRatio="aspect-[9/16]"
                                    />
                                ) : frameUrl ? (
                                    <div className="relative aspect-[9/16] bg-slate-900 rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-lg">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
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
                            {/* Generated Image Placeholder */}
                            {showGeneration && (
                                <div className="space-y-2">
                                    <div className={`relative aspect-[9/16] rounded-xl overflow-hidden border ${highlightGenerated || (activeImage && newImages.includes(activeImage)) ? 'border-red-400' : 'border-[var(--glass-border)]'} shadow-lg bg-slate-900 flex items-center justify-center text-xs text-blue-300`}>
                                        {(activeImage && newImages.includes(activeImage)) && (
                                            <span className="absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-semibold bg-red-500 text-white shadow">
                                                NEW
                                            </span>
                                        )}
                                        {activeImage ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={activeImage} alt="生成图片" className="w-full h-full object-cover" />
                                        ) : (
                                            '生成图片'
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => onPrevGenerated?.(shot, index)}
                                            disabled={!hasGeneratedImages || isGenerating || !canPrevGenerated}
                                            className="flex-1 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium border border-slate-300 hover:bg-slate-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            上一张
                                        </button>
                                        <button
                                            onClick={() => onGenerateImage?.(shot, index)}
                                            disabled={isGenerating}
                                            className="flex-1 py-2 rounded-lg bg-blue-500 text-white text-xs font-medium shadow hover:bg-blue-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            {isGenerating ? '生成中...' : '生成图片'}
                                        </button>
                                        <button
                                            onClick={() => onNextGenerated?.(shot, index)}
                                            disabled={!hasGeneratedImages || isGenerating || !canNextGenerated}
                                            className="flex-1 py-2 rounded-lg bg-slate-200 text-slate-700 text-xs font-medium border border-slate-300 hover:bg-slate-300 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                        >
                                            下一张
                                        </button>
                                    </div>
                                    {generateError && (
                                        <button
                                            onClick={() => alert(generateError)}
                                            className="w-full text-[11px] text-red-500 underline underline-offset-2 text-left"
                                        >
                                            生成失败，点击查看原因
                                        </button>
                                    )}
                                </div>
                            )}
                            {/* Generated Video Placeholder */}
                            {showGeneration && (
                                <div className="relative aspect-[9/16] bg-slate-900 rounded-xl overflow-hidden border border-[var(--glass-border)] shadow-lg flex items-center justify-center text-xs text-purple-300">
                                    生成视频（占位）
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: All Content Fields */}
                    <div className={`${showGeneration ? 'md:col-span-2' : 'md:col-span-3'} space-y-6`}>

                        {modificationInfo && (
                            <div className={`p-4 rounded-2xl text-sm border ${modBadgeClass} space-y-2 bg-gradient-to-br from-blue-50/50 to-indigo-50/30`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Sparkles size={16} className="text-blue-500" />
                                    <span className="text-blue-700 font-semibold text-xs uppercase">优化概述</span>
                                    {modificationInfo.type && (
                                        <span className={`px-2 py-0.5 rounded-full border ${modTypeClass(modificationInfo.type)}`}>
                                            {modificationInfo.type}
                                        </span>
                                    )}
                                </div>
                                {modificationInfo.reason && (
                                    <div className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                        {modificationInfo.reason}
                                    </div>
                                )}
                            </div>
                        )}
                        {/* Initial Frame Details */}
                        {structuredFrameOriginal || structuredFrameOptimized ? (
                            <div className="space-y-3 pb-4 border-b border-white/5">
                                <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-600 pl-1">
                                    <span>初始帧设定 / Initial Frame</span>
                                    {renderAnnotationControl?.(`shot-${shot.id ?? index}-initial`, `Shot #${shot.id ?? index + 1} Initial Frame`)}
                                </div>
                                {structuredFrameOriginal && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 rounded-2xl bg-black/5 border border-black/10 text-base text-slate-800 leading-relaxed">
                                        {/* Foreground */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-base font-semibold text-slate-700 uppercase">
                                                <Users size={16} className="text-blue-500" />
                                                前景 / Foreground
                                            </div>
                                            <div className="space-y-3 pl-3 border-l-2 border-blue-500/30">
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-500">角色:</span>
                                                    {Array.isArray(structuredFrameOriginal.foreground?.characters) && structuredFrameOriginal.foreground.characters.length > 0 ? (
                                                        structuredFrameOriginal.foreground.characters.map((char, idx) => {
                                                            const isFromLibrary = isCharacterFromLibrary(char);
                                                            const charObj = typeof char === 'object' && char !== null ? char as Record<string, unknown> : null;

                                                            return (
                                                                <div key={idx} className="flex items-start gap-2">
                                                                    {isFromLibrary && charObj ? (
                                                                        // Character from library: tag is read-only badge, other fields editable
                                                                        <div className="flex-1 space-y-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-600 text-xs font-semibold border border-blue-500/20">
                                                                                    {charObj.tag as string}
                                                                                </span>
                                                                                <span className="text-xs text-slate-400">(引用角色库)</span>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                {charObj.pose !== undefined && (
                                                                                    <div className="flex items-start gap-2">
                                                                                        <span className="text-[10px] text-slate-500 pt-2 shrink-0">姿势</span>
                                                                                        <AutoTextArea
                                                                                            value={String(charObj.pose || '')}
                                                                                            onChange={(e) => {
                                                                                                const newChars = [...(structuredFrameOriginal.foreground?.characters || [])];
                                                                                                newChars[idx] = { ...charObj, pose: e.target.value };
                                                                                                const newFrame = {
                                                                                                    ...structuredFrameOriginal,
                                                                                                    foreground: { ...structuredFrameOriginal.foreground, characters: newChars }
                                                                                                };
                                                                                                updateField('initial_frame', newFrame);
                                                                                            }}
                                                                                            readOnly={!canEdit}
                                                                                            minRows={1}
                                                                                            maxRows={3}
                                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-xs leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-blue-500/30 placeholder:text-slate-400"
                                                                                            placeholder="姿势..."
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                                {charObj.expression !== undefined && (
                                                                                    <div className="flex items-start gap-2">
                                                                                        <span className="text-[10px] text-slate-500 pt-2 shrink-0">表情</span>
                                                                                        <AutoTextArea
                                                                                            value={String(charObj.expression || '')}
                                                                                            onChange={(e) => {
                                                                                                const newChars = [...(structuredFrameOriginal.foreground?.characters || [])];
                                                                                                newChars[idx] = { ...charObj, expression: e.target.value };
                                                                                                const newFrame = {
                                                                                                    ...structuredFrameOriginal,
                                                                                                    foreground: { ...structuredFrameOriginal.foreground, characters: newChars }
                                                                                                };
                                                                                                updateField('initial_frame', newFrame);
                                                                                            }}
                                                                                            readOnly={!canEdit}
                                                                                            minRows={1}
                                                                                            maxRows={2}
                                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-xs leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-blue-500/30 placeholder:text-slate-400"
                                                                                            placeholder="表情..."
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        // Not from library: editable as before
                                                                        <AutoTextArea
                                                                            value={typeof char === 'string' ? char : [charObj?.tag, charObj?.pose, charObj?.expression].filter(Boolean).join(' · ')}
                                                                            onChange={(e) => {
                                                                                const newChars = [...(structuredFrameOriginal.foreground?.characters || [])];
                                                                                newChars[idx] = e.target.value;
                                                                                const newFrame = {
                                                                                    ...structuredFrameOriginal,
                                                                                    foreground: { ...structuredFrameOriginal.foreground, characters: newChars }
                                                                                };
                                                                                updateField('initial_frame', newFrame);
                                                                            }}
                                                                            readOnly={!canEdit}
                                                                            minRows={1}
                                                                            maxRows={3}
                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-blue-500/30 placeholder:text-slate-400"
                                                                            placeholder="角色描述..."
                                                                        />
                                                                    )}
                                                                    {canEdit && (
                                                                        <button
                                                                            onClick={() => setDeleteConfirm({ type: 'fg_char', index: idx, label: `前景角色 #${idx + 1}` })}
                                                                            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                            title="删除角色"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <AutoTextArea
                                                            value=""
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    const newFrame = {
                                                                        ...structuredFrameOriginal,
                                                                        foreground: { ...structuredFrameOriginal.foreground, characters: [e.target.value] }
                                                                    };
                                                                    updateField('initial_frame', newFrame);
                                                                }
                                                            }}
                                                            readOnly={!canEdit}
                                                            minRows={1}
                                                            maxRows={3}
                                                            className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-blue-500/30 placeholder:text-slate-400"
                                                            placeholder="添加角色..."
                                                        />
                                                    )}
                                                    {renderDiffPanel(`shot-${shot.id ?? index}-initial_fg_chars`, 'array')}
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-500">道具:</span>
                                                    {Array.isArray(structuredFrameOriginal.foreground?.objects) && structuredFrameOriginal.foreground.objects.length > 0 ? (
                                                        structuredFrameOriginal.foreground.objects.map((obj, idx) => (
                                                            <div key={idx} className="flex items-start gap-2">
                                                                <AutoTextArea
                                                                    value={obj}
                                                                    onChange={(e) => {
                                                                        const newObjs = [...(structuredFrameOriginal.foreground?.objects || [])];
                                                                        newObjs[idx] = e.target.value;
                                                                        const newFrame = {
                                                                            ...structuredFrameOriginal,
                                                                            foreground: { ...structuredFrameOriginal.foreground, objects: newObjs }
                                                                        };
                                                                        updateField('initial_frame', newFrame);
                                                                    }}
                                                                    readOnly={!canEdit}
                                                                    minRows={1}
                                                                    maxRows={3}
                                                                    className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-blue-500/30 placeholder:text-slate-400"
                                                                    placeholder="道具描述..."
                                                                />
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={() => setDeleteConfirm({ type: 'fg_obj', index: idx, label: `前景道具 #${idx + 1}` })}
                                                                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                        title="删除道具"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <AutoTextArea
                                                            value=""
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    const newFrame = {
                                                                        ...structuredFrameOriginal,
                                                                        foreground: { ...structuredFrameOriginal.foreground, objects: [e.target.value] }
                                                                    };
                                                                    updateField('initial_frame', newFrame);
                                                                }
                                                            }}
                                                            readOnly={!canEdit}
                                                            minRows={1}
                                                            maxRows={3}
                                                            className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-blue-500/30 placeholder:text-slate-400"
                                                            placeholder="添加道具..."
                                                        />
                                                    )}
                                                    {renderDiffPanel(`shot-${shot.id ?? index}-initial_fg_objects`, 'array')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Midground */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-base font-semibold text-slate-700 uppercase">
                                                <Layers size={16} className="text-purple-500" />
                                                中景 / Midground
                                            </div>
                                            <div className="space-y-3 pl-3 border-l-2 border-purple-500/30">
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-500">角色:</span>
                                                    {Array.isArray(structuredFrameOriginal.midground?.characters) && structuredFrameOriginal.midground.characters.length > 0 ? (
                                                        structuredFrameOriginal.midground.characters.map((char, idx) => {
                                                            const isFromLibrary = isCharacterFromLibrary(char);
                                                            const charObj = typeof char === 'object' && char !== null ? char as Record<string, unknown> : null;

                                                            return (
                                                                <div key={idx} className="flex items-start gap-2">
                                                                    {isFromLibrary && charObj ? (
                                                                        // Character from library: tag is read-only badge, other fields editable
                                                                        <div className="flex-1 space-y-2">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="px-2 py-1 rounded-md bg-purple-500/10 text-purple-600 text-xs font-semibold border border-purple-500/20">
                                                                                    {charObj.tag as string}
                                                                                </span>
                                                                                <span className="text-xs text-slate-400">(引用角色库)</span>
                                                                            </div>
                                                                            <div className="space-y-1">
                                                                                {charObj.pose !== undefined && (
                                                                                    <div className="flex items-start gap-2">
                                                                                        <span className="text-[10px] text-slate-500 pt-2 shrink-0">姿势</span>
                                                                                        <AutoTextArea
                                                                                            value={String(charObj.pose || '')}
                                                                                            onChange={(e) => {
                                                                                                const newChars = [...(structuredFrameOriginal.midground?.characters || [])];
                                                                                                newChars[idx] = { ...charObj, pose: e.target.value };
                                                                                                const newFrame = {
                                                                                                    ...structuredFrameOriginal,
                                                                                                    midground: { ...structuredFrameOriginal.midground, characters: newChars }
                                                                                                };
                                                                                                updateField('initial_frame', newFrame);
                                                                                            }}
                                                                                            readOnly={!canEdit}
                                                                                            minRows={1}
                                                                                            maxRows={3}
                                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-xs leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-purple-500/30 placeholder:text-slate-400"
                                                                                            placeholder="姿势..."
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                                {charObj.expression !== undefined && (
                                                                                    <div className="flex items-start gap-2">
                                                                                        <span className="text-[10px] text-slate-500 pt-2 shrink-0">表情</span>
                                                                                        <AutoTextArea
                                                                                            value={String(charObj.expression || '')}
                                                                                            onChange={(e) => {
                                                                                                const newChars = [...(structuredFrameOriginal.midground?.characters || [])];
                                                                                                newChars[idx] = { ...charObj, expression: e.target.value };
                                                                                                const newFrame = {
                                                                                                    ...structuredFrameOriginal,
                                                                                                    midground: { ...structuredFrameOriginal.midground, characters: newChars }
                                                                                                };
                                                                                                updateField('initial_frame', newFrame);
                                                                                            }}
                                                                                            readOnly={!canEdit}
                                                                                            minRows={1}
                                                                                            maxRows={2}
                                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-xs leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-purple-500/30 placeholder:text-slate-400"
                                                                                            placeholder="表情..."
                                                                                        />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ) : (
                                                                        // Not from library: editable as before
                                                                        <AutoTextArea
                                                                            value={typeof char === 'string' ? char : [charObj?.tag, charObj?.pose, charObj?.expression].filter(Boolean).join(' · ')}
                                                                            onChange={(e) => {
                                                                                const newChars = [...(structuredFrameOriginal.midground?.characters || [])];
                                                                                newChars[idx] = e.target.value;
                                                                                const newFrame = {
                                                                                    ...structuredFrameOriginal,
                                                                                    midground: { ...structuredFrameOriginal.midground, characters: newChars }
                                                                                };
                                                                                updateField('initial_frame', newFrame);
                                                                            }}
                                                                            readOnly={!canEdit}
                                                                            minRows={1}
                                                                            maxRows={3}
                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-purple-500/30 placeholder:text-slate-400"
                                                                            placeholder="角色描述..."
                                                                        />
                                                                    )}
                                                                    {canEdit && (
                                                                        <button
                                                                            onClick={() => setDeleteConfirm({ type: 'mg_char', index: idx, label: `中景角色 #${idx + 1}` })}
                                                                            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                            title="删除角色"
                                                                        >
                                                                            <Trash2 size={14} />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <AutoTextArea
                                                            value=""
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    const newFrame = {
                                                                        ...structuredFrameOriginal,
                                                                        midground: { ...structuredFrameOriginal.midground, characters: [e.target.value] }
                                                                    };
                                                                    updateField('initial_frame', newFrame);
                                                                }
                                                            }}
                                                            readOnly={!canEdit}
                                                            minRows={1}
                                                            maxRows={3}
                                                            className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-purple-500/30 placeholder:text-slate-400"
                                                            placeholder="添加角色..."
                                                        />
                                                    )}
                                                    {renderDiffPanel(`shot-${shot.id ?? index}-initial_mg_chars`, 'array')}
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-500">道具:</span>
                                                    {Array.isArray(structuredFrameOriginal.midground?.objects) && structuredFrameOriginal.midground.objects.length > 0 ? (
                                                        structuredFrameOriginal.midground.objects.map((obj, idx) => (
                                                            <div key={idx} className="flex items-start gap-2">
                                                                <AutoTextArea
                                                                    value={obj}
                                                                    onChange={(e) => {
                                                                        const newObjs = [...(structuredFrameOriginal.midground?.objects || [])];
                                                                        newObjs[idx] = e.target.value;
                                                                        const newFrame = {
                                                                            ...structuredFrameOriginal,
                                                                            midground: { ...structuredFrameOriginal.midground, objects: newObjs }
                                                                        };
                                                                        updateField('initial_frame', newFrame);
                                                                    }}
                                                                    readOnly={!canEdit}
                                                                    minRows={1}
                                                                    maxRows={3}
                                                                    className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-purple-500/30 placeholder:text-slate-400"
                                                                    placeholder="道具描述..."
                                                                />
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={() => setDeleteConfirm({ type: 'mg_obj', index: idx, label: `中景道具 #${idx + 1}` })}
                                                                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                        title="删除道具"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <AutoTextArea
                                                            value=""
                                                            onChange={(e) => {
                                                                if (e.target.value) {
                                                                    const newFrame = {
                                                                        ...structuredFrameOriginal,
                                                                        midground: { ...structuredFrameOriginal.midground, objects: [e.target.value] }
                                                                    };
                                                                    updateField('initial_frame', newFrame);
                                                                }
                                                            }}
                                                            readOnly={!canEdit}
                                                            minRows={1}
                                                            maxRows={3}
                                                            className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-purple-500/30 placeholder:text-slate-400"
                                                            placeholder="添加道具..."
                                                        />
                                                    )}
                                                    {renderDiffPanel(`shot-${shot.id ?? index}-initial_mg_objects`, 'array')}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Background */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-base font-semibold text-slate-700 uppercase">
                                                <ImageIcon size={16} className="text-pink-500" />
                                                背景 / Background
                                            </div>
                                            <div className="space-y-2 pl-3 border-l-2 border-pink-500/30">
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-500">环境:</span>
                                                    <AutoTextArea
                                                        value={structuredFrameOriginal.background?.environment || ''}
                                                        onChange={(e) => {
                                                            const newFrame = {
                                                                ...structuredFrameOriginal,
                                                                background: { ...structuredFrameOriginal.background, environment: e.target.value }
                                                            };
                                                            updateField('initial_frame', newFrame);
                                                        }}
                                                        readOnly={!canEdit}
                                                        minRows={1}
                                                        maxRows={4}
                                                        className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-pink-500/30 placeholder:text-slate-400"
                                                        placeholder="环境..."
                                                    />
                                                    {renderDiffPanel(`shot-${shot.id ?? index}-initial_bg_env`)}
                                                </div>
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-500">景深:</span>
                                                    <AutoTextArea
                                                        value={structuredFrameOriginal.background?.depth || ''}
                                                        onChange={(e) => {
                                                            const newFrame = {
                                                                ...structuredFrameOriginal,
                                                                background: { ...structuredFrameOriginal.background, depth: e.target.value }
                                                            };
                                                            updateField('initial_frame', newFrame);
                                                        }}
                                                        readOnly={!canEdit}
                                                        minRows={1}
                                                        maxRows={4}
                                                        className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-pink-500/30 placeholder:text-slate-400"
                                                        placeholder="景深..."
                                                    />
                                                    {renderDiffPanel(`shot-${shot.id ?? index}-initial_bg_depth`)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Lighting & Palette */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-base font-semibold text-slate-700 uppercase">
                                                <Sun size={16} className="text-amber-500" />
                                                光影与色调 / Lighting & Palette
                                            </div>
                                            <div className="space-y-2 pl-3 border-l-2 border-amber-500/30">
                                                <div className="space-y-1">
                                                    <span className="text-xs text-slate-500">光照:</span>
                                                    <AutoTextArea
                                                        value={structuredFrameOriginal.lighting || ''}
                                                        onChange={(e) => {
                                                            const newFrame = { ...structuredFrameOriginal, lighting: e.target.value };
                                                            updateField('initial_frame', newFrame);
                                                        }}
                                                        readOnly={!canEdit}
                                                        minRows={1}
                                                        maxRows={4}
                                                        className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-amber-500/30 placeholder:text-slate-400"
                                                        placeholder="光照..."
                                                    />
                                                    {renderDiffPanel(`shot-${shot.id ?? index}-initial_lighting`)}
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-1">
                                                        <Palette size={10} className="text-slate-400" />
                                                        <span className="text-xs text-slate-500">色调:</span>
                                                    </div>
                                                    <AutoTextArea
                                                        value={structuredFrameOriginal.color_palette || ''}
                                                        onChange={(e) => {
                                                            const newFrame = { ...structuredFrameOriginal, color_palette: e.target.value };
                                                            updateField('initial_frame', newFrame);
                                                        }}
                                                        readOnly={!canEdit}
                                                        minRows={1}
                                                        maxRows={4}
                                                        className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-amber-500/30 placeholder:text-slate-400"
                                                        placeholder="色调..."
                                                    />
                                                    {renderDiffPanel(`shot-${shot.id ?? index}-initial_palette`)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {structuredFrameOptimized && (!structuredFrameOriginal || JSON.stringify(structuredFrameOriginal) !== JSON.stringify(structuredFrameOptimized)) && (
                                    <div className="space-y-3 group/revision mt-4">
                                        <div className="relative z-10 border rounded-2xl p-7 text-base shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md border-amber-500/30 bg-amber-500/5 text-slate-800 leading-relaxed">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2 text-base uppercase font-bold tracking-wider text-amber-600">
                                                    <Sparkles size={16} />
                                                    <span>初始帧设定 (优化后)</span>
                                                </div>
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-amber-500 text-white border-transparent">
                                                    NEW
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {/* Foreground */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-base font-semibold text-slate-700 uppercase">
                                                        <Users size={16} className="text-blue-400" />
                                                        优化前景
                                                    </div>
                                                    <div className="space-y-2 pl-3 border-l-2 border-blue-400/30">
                                                        {Array.isArray(structuredFrameOptimized.foreground?.characters) && structuredFrameOptimized.foreground.characters.length > 0 ? (
                                                            structuredFrameOptimized.foreground.characters.map((char, idx) => (
                                                                <div key={idx} className="text-sm text-slate-800 leading-relaxed">
                                                                    {typeof char === 'string' ? char : [char.tag, char.pose, char.expression].filter(Boolean).join(' · ')}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="text-sm text-slate-500 italic">无角色</div>
                                                        )}
                                                        {Array.isArray(structuredFrameOptimized.foreground?.objects) && structuredFrameOptimized.foreground.objects.length > 0 ? (
                                                            structuredFrameOptimized.foreground.objects.map((obj, idx) => (
                                                                <div key={idx} className="text-sm text-slate-700">• {obj}</div>
                                                            ))
                                                        ) : (
                                                            <div className="text-sm text-slate-500 italic">无道具</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Midground */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-base font-semibold text-slate-700 uppercase">
                                                        <Layers size={16} className="text-purple-400" />
                                                        优化中景
                                                    </div>
                                                    <div className="space-y-2 pl-3 border-l-2 border-purple-400/30">
                                                        {Array.isArray(structuredFrameOptimized.midground?.characters) && structuredFrameOptimized.midground.characters.length > 0 ? (
                                                            structuredFrameOptimized.midground.characters.map((char, idx) => (
                                                                <div key={idx} className="text-sm text-slate-800">
                                                                    {typeof char === 'string' ? char : char.tag || '-'}
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="text-sm text-slate-500 italic">无角色</div>
                                                        )}
                                                        {Array.isArray(structuredFrameOptimized.midground?.objects) && structuredFrameOptimized.midground.objects.length > 0 ? (
                                                            structuredFrameOptimized.midground.objects.map((obj, idx) => (
                                                                <div key={idx} className="text-sm text-slate-700">• {obj}</div>
                                                            ))
                                                        ) : (
                                                            <div className="text-sm text-slate-500 italic">无道具</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Background */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-base font-semibold text-slate-700 uppercase">
                                                        <ImageIcon size={16} className="text-pink-400" />
                                                        优化背景
                                                    </div>
                                                    <div className="space-y-1 pl-3 border-l-2 border-pink-400/30">
                                                        <div className="text-sm text-slate-800"><span className="text-slate-500">环境:</span> {structuredFrameOptimized.background?.environment || '-'}</div>
                                                        <div className="text-sm text-slate-800"><span className="text-slate-500">景深:</span> {structuredFrameOptimized.background?.depth || '-'}</div>
                                                    </div>
                                                </div>

                                                {/* Lighting & Palette */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-base font-semibold text-slate-700 uppercase">
                                                        <Sun size={16} className="text-amber-400" />
                                                        优化光影/色调
                                                    </div>
                                                    <div className="space-y-1 pl-3 border-l-2 border-amber-400/30">
                                                        <div className="flex items-center gap-1 text-sm text-slate-800">
                                                            <span className="text-slate-500">光照:</span>
                                                            <span>{structuredFrameOptimized.lighting || '-'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 text-sm text-slate-800">
                                                            <Palette size={10} className="text-slate-400" />
                                                            <span className="text-slate-500">色调:</span>
                                                            <span>{structuredFrameOptimized.color_palette || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : initialFrameText || initialFrameTextOptimized ? (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 pl-1">
                                    <ImageIcon size={12} className="text-blue-500" />
                                    <span>首帧描述</span>
                                    {renderAnnotationControl?.(`shot-${shot.id ?? index}-initial`, `Shot #${shot.id ?? index + 1} Initial Frame`)}
                                </div>
                                {renderFieldWithRevision(
                                    <AutoTextArea
                                        value={initialFrameText}
                                        onChange={(e) => updateField('initial_frame', e.target.value)}
                                        readOnly={!canEdit}
                                        minRows={1}
                                        maxRows={16}
                                        className="w-full p-4 rounded-xl bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors focus:outline-none focus:border-blue-500/30 resize-none placeholder:text-slate-400"
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
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-purple-400/80 pl-1">
                                <span>视频描述</span>
                                {renderAnnotationControl?.(`shot-${shot.id ?? index}-visual`, `Shot #${shot.id ?? index + 1} Visual`)}
                            </div>
                            {renderFieldWithRevision(
                                <AutoTextArea
                                    value={visualVal}
                                    onChange={(e) => updateField('visual_changes', e.target.value)}
                                    readOnly={!canEdit}
                                    minRows={1}
                                    maxRows={16}
                                    className="w-full p-4 rounded-xl bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors focus:outline-none focus:border-purple-500/30 resize-none placeholder:text-slate-400"
                                    placeholder="画面描述..."
                                />,
                                '视频描述',
                                baseVisual,
                                optVisual
                            )}
                            {renderDiffPanel(`shot-${shot.id ?? index}-visual_changes`)}
                        </div>

                        {/* Camera, Beat, Viral, Logic, Mission hidden per requirement */}

                        {/* Alternatives */}
                        {Array.isArray(alternatives) && alternatives.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-500 pl-1">
                                    <Sparkles size={12} className="text-amber-400" />
                                    备选方案
                                </div>
                                <div className="grid gap-3 md:grid-cols-2">
                                    {alternatives.map((alt: ShotAlternative, altIdx: number) => (
                                        <div key={`alt-${altIdx}`} className="p-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-light)]/60 text-sm space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-semibold text-[var(--color-text-primary)]">{alt.type || `方案 ${altIdx + 1}`}</span>
                                                {alt.viral_score !== undefined && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-400/40">Viral {alt.viral_score}</span>
                                                )}
                                            </div>
                                            {alt.description && <div className="text-[var(--color-text-secondary)] leading-relaxed">{alt.description}</div>}
                                            {alt.visual_changes && (
                                                <div className="text-[var(--color-text-primary)] leading-relaxed whitespace-pre-wrap">
                                                    {alt.visual_changes}
                                                </div>
                                            )}
                                            {alt.reason && <div className="text-xs text-[var(--color-text-tertiary)]">理由: {alt.reason}</div>}
                                            {Array.isArray(alt.affected_shots_change) && alt.affected_shots_change.length > 0 && (
                                                <div className="text-xs text-[var(--color-text-tertiary)]">影响镜头: {alt.affected_shots_change.join(', ')}</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-full bg-red-100">
                                <Trash2 size={20} className="text-red-500" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-800">确认删除</h3>
                        </div>
                        <p className="text-slate-600 mb-6">
                            确定要删除 <span className="font-medium text-slate-800">{deleteConfirm.label}</span> 吗？此操作无法撤销。
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 transition font-medium"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => handleDeleteItem(deleteConfirm.type, deleteConfirm.index)}
                                className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white hover:bg-red-600 transition font-medium shadow-lg shadow-red-500/20"
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
