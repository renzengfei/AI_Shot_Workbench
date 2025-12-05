import '@/styles/liquid-glass.css';
import { Clock, Zap, Image as ImageIcon, Layers, Sparkles, Users, Sun, Palette, CheckCircle2, RefreshCw, Box, Layout, Trash2, ChevronDown, Check, AlertCircle, Video, Wand2, Loader2, FileText, X, ChevronLeft, ChevronRight, Undo2, Square, Pencil, Film } from 'lucide-react';
import { type ReactNode, useState, useEffect, useMemo } from 'react';
import { AutoTextArea } from '@/components/ui/AutoTextArea';
import { PreviewVideoPlayer } from '@/components/ui/PreviewVideoPlayer';
import { Round2Shot, ReviewMode, StructuredInitialFrame, ShotAlternative } from '@/types/deconstruction';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

// Diff info for a single field
interface DiffInfo {
    oldVal: string;
    newVal: string;
}

// 等待时间计时器组件
const WaitTimer = ({ startTime }: { startTime: number }) => {
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return (
        <span className="text-xs text-slate-400 font-mono">
            已等待 {minutes > 0 ? `${minutes}分` : ''}{seconds}秒
        </span>
    );
};

// 生成失败提示组件
const ErrorTooltip = ({ error }: { error: string }) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="mt-2 w-full">
            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm hover:bg-red-100 transition-colors"
            >
                <AlertCircle size={16} className="flex-shrink-0" />
                <span className="font-medium">生成失败</span>
                <ChevronDown size={14} className={`ml-auto transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            {expanded && (
                <div className="mt-1 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 max-h-32 overflow-y-auto whitespace-pre-wrap break-words">
                    {error}
                </div>
            )}
        </div>
    );
};

// 定稿按钮组件 - Apple Style (SF Symbols checkmark.circle)
const FinalizeButton = ({
    isFinalized,
    onClick,
}: {
    isFinalized: boolean;
    onClick: () => void;
}) => {
    return (
        <button
            onClick={onClick}
            className={`relative w-6 h-6 rounded-full transition-colors duration-100
                ${isFinalized
                    ? 'bg-[#71717a]'
                    : 'bg-transparent border-[1.5px] border-slate-300 hover:border-slate-400'
                }
                active:scale-95 transition-transform duration-75
            `}
            title={isFinalized ? '取消定稿' : '设为定稿'}
        >
            {/* 对勾 - 仅在定稿时显示 */}
            {isFinalized && (
                <svg
                    viewBox="0 0 24 24"
                    className="absolute inset-0 m-auto w-3.5 h-3.5 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            )}
        </button>
    );
};

// 图片放大查看组件
const ImageLightbox = ({
    images,
    currentIndex,
    onClose,
    onPrev,
    onNext,
    getImageIndex,
}: {
    images: string[];
    currentIndex: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    getImageIndex: (url: string) => number;
}) => {
    const currentUrl = images[currentIndex];
    const imageNum = getImageIndex(currentUrl);

    // 键盘导航
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'ArrowLeft') onPrev();
            if (e.key === 'ArrowRight') onNext();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose, onPrev, onNext]);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md"
            onClick={onClose}
        >
            {/* 关闭按钮 */}
            <button
                onClick={onClose}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            >
                <X size={24} />
            </button>

            {/* 图片序号 */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium">
                #{imageNum} · {currentIndex + 1} / {images.length}
            </div>

            {/* 上一张 */}
            {currentIndex > 0 && (
                <button
                    onClick={(e) => { e.stopPropagation(); onPrev(); }}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                    <ChevronLeft size={28} />
                </button>
            )}

            {/* 图片 */}
            <div
                className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                    src={currentUrl}
                    alt={`图片 #${imageNum}`}
                    className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                />
            </div>

            {/* 下一张 */}
            {currentIndex < images.length - 1 && (
                <button
                    onClick={(e) => { e.stopPropagation(); onNext(); }}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                    <ChevronRight size={28} />
                </button>
            )}
        </div>
    );
};

// Prompt 查看器组件
const PromptViewer = ({
    workspacePath,
    shotId,
    generatedDir,
    imageFilename,
    imageUrl,
    compact = false
}: {
    workspacePath: string;
    shotId: string | number;
    generatedDir?: string;
    imageFilename?: string;
    imageUrl?: string;
    compact?: boolean;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [prompt, setPrompt] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [lastImageFilename, setLastImageFilename] = useState<string | undefined>(undefined);

    const fetchPrompt = async () => {
        // 如果图片文件名变了，需要重新获取 prompt
        if (prompt !== null && lastImageFilename === imageFilename) {
            setIsOpen(true);
            return;
        }
        setLoading(true);
        try {
            const shotFromUrl = imageUrl
                ? (imageUrl.match(/\/shots\/([^/]+)/)?.[1] ?? undefined)
                : undefined;
            const params = new URLSearchParams({
                shot_id: shotFromUrl ?? String(shotId),
                ...(generatedDir && { generated_dir: generatedDir }),
                ...(imageFilename && { image_filename: imageFilename }),
            });
            const res = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/prompt?${params}`);
            const data = await res.json();
            setPrompt(data.prompt || '暂无 Prompt 记录');
            setLastImageFilename(imageFilename);
            setIsOpen(true);
        } catch {
            setPrompt('加载失败');
            setIsOpen(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={fetchPrompt}
                disabled={loading}
                className={compact
                    ? "flex items-center justify-center p-2 rounded-lg bg-slate-100/80 border border-slate-200/30 text-slate-400 hover:bg-slate-200/80 hover:text-slate-600 transition-all duration-200 active:scale-95"
                    : "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/80 border border-slate-200/50 text-slate-500 text-xs font-medium hover:bg-slate-200/80 hover:text-slate-700 transition-all duration-200 active:scale-95"
                }
                title="查看生图 Prompt"
            >
                <FileText size={compact ? 14 : 12} />
                {!compact && (loading ? '...' : 'Prompt')}
            </button>
            {isOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setIsOpen(false)}
                >
                    <div
                        className="relative w-[90%] max-w-2xl max-h-[80vh] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/50 overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/50">
                            <h3 className="text-base font-semibold text-slate-700">生图 Prompt</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto max-h-[60vh]">
                            <pre className="whitespace-pre-wrap text-sm text-slate-600 leading-relaxed font-mono bg-slate-50/80 rounded-xl p-4 border border-slate-100">
                                {prompt}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

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
    onGenerateImage?: (shot: Round2Shot, index: number, providerId?: string) => void;
    isGenerating?: boolean;
    providers?: Array<{ id: string; name: string; is_default?: boolean }>;
    selectedProviderId?: string;
    onProviderChange?: (shot: Round2Shot, index: number, providerId: string) => void;
    highlightGenerated?: boolean;
    newImages?: string[];
    onImageSeen?: (shot: Round2Shot, index: number, url: string) => void;
    onClearNewImages?: (shot: Round2Shot, index: number) => void;
    generateError?: string | null;
    canPrevGenerated?: boolean;
    canNextGenerated?: boolean;
    onSelectGeneratedIndex?: (shot: Round2Shot, shotIndex: number, imageIndex: number) => void;
    workspacePath?: string;
    generatedDir?: string;
    // 生视频相关
    onGenerateVideo?: (shot: Round2Shot, index: number) => void;
    isGeneratingVideo?: boolean;
    videoTaskStatus?: 'pending' | 'processing' | 'completed' | 'failed' | null;
    videoProgress?: number; // 视频生成进度 0-100
    videoTaskProgresses?: Array<{ taskId: string; progress: number; status: string; startTime: number }>; // 每个任务的进度
    generatedVideoUrls?: string[];
    selectedVideoIndex?: number;
    onSelectVideoIndex?: (index: number) => void;
    newVideos?: string[];  // 新生成的视频 URL
    onVideoSeen?: (url: string) => void;  // 播放视频后的回调
    onStopVideoGeneration?: (shot: Round2Shot, index: number) => void;  // 停止视频生成
    defaultStream?: 'image' | 'video' | 'outline';  // 默认素材流类型
    // 线稿模式相关
    globalOutlineMode?: boolean;          // 全局线稿模式
    globalOutlinePrompt?: string;         // 全局线稿提示词
    outlineMode?: boolean;                // 该镜头是否启用线稿模式（覆盖全局）
    onToggleOutlineMode?: (shot: Round2Shot, index: number) => void;  // 切换线稿模式
    outlinePrompt?: string;               // 该镜头的线稿提示词（覆盖全局）
    onOutlinePromptChange?: (shot: Round2Shot, index: number, prompt: string) => void;  // 更新线稿提示词
    outlineUrls?: string[];               // 该镜头的线稿图列表
    activeOutlineUrl?: string;            // 当前激活的线稿图
    onSelectOutline?: (shot: Round2Shot, index: number, url: string) => void;  // 选择线稿图
    onGenerateOutline?: (shot: Round2Shot, index: number) => void;  // 生成线稿
    isGeneratingOutline?: boolean;        // 是否正在生成线稿
    onDeleteOutline?: (shot: Round2Shot, index: number, url: string) => void;  // 删除线稿
    // 定稿相关
    onFinalizeOutline?: (shot: Round2Shot, index: number, url: string | null) => void;  // 定稿线稿
    onFinalizeImage?: (shot: Round2Shot, index: number, url: string | null) => void;    // 定稿生成图
    onFinalizeVideo?: (shot: Round2Shot, index: number, url: string | null) => void;    // 定稿视频
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
    providers = [],
    selectedProviderId,
    onProviderChange,
    highlightGenerated = false,
    newImages = [],
    onImageSeen,
    onClearNewImages,
    generateError = null,
    canPrevGenerated = true,
    canNextGenerated = true,
    onSelectGeneratedIndex,
    workspacePath = '',
    generatedDir,
    onGenerateVideo,
    isGeneratingVideo = false,
    videoTaskStatus = null,
    videoProgress = 0,
    videoTaskProgresses = [],
    generatedVideoUrls = [],
    selectedVideoIndex = 0,
    onSelectVideoIndex,
    newVideos = [],
    onVideoSeen,
    onStopVideoGeneration,
    defaultStream = 'image',
    // 线稿模式相关
    globalOutlineMode = false,
    globalOutlinePrompt = '',  // 不使用默认值，由生图设定配置
    outlineMode,               // undefined 表示使用全局
    onToggleOutlineMode,
    outlinePrompt,             // undefined 表示使用全局
    onOutlinePromptChange,
    outlineUrls = [],
    activeOutlineUrl,
    onSelectOutline,
    onGenerateOutline,
    isGeneratingOutline = false,
    onDeleteOutline,
    // 定稿相关
    onFinalizeOutline,
    onFinalizeImage,
    onFinalizeVideo,
}: ShotCardProps) => {
    const shotId = shot.id ?? index + 1;
    const canEdit = mode === 'review';

    // 计算实际使用的线稿模式和提示词（考虑全局和局部覆盖）
    const effectiveOutlineMode = outlineMode !== undefined ? outlineMode : globalOutlineMode;
    const effectiveOutlinePrompt = outlinePrompt !== undefined ? outlinePrompt : globalOutlinePrompt;

    // 将相对路径转换为完整 URL（使用选中的视频）
    const videoSrc = useMemo(() => {
        if (!generatedVideoUrls.length) return null;
        const url = generatedVideoUrls[Math.min(selectedVideoIndex, generatedVideoUrls.length - 1)];
        if (!url) return null;
        return url.startsWith('/') ? `${API_BASE}${url}` : url;
    }, [generatedVideoUrls, selectedVideoIndex]);

    // Delete confirmation state: { type: 'fg_char' | 'fg_obj' | 'mg_char' | 'mg_obj', index: number } | null
    const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; index: number; label: string } | null>(null);
    const [activeStream, setActiveStream] = useState<'image' | 'video' | 'outline'>(defaultStream || 'image');
    const [selectedVideo] = useState<string | null>(clipUrl || null);

    // 图片放大查看状态
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

    // 线稿提示词折叠状态
    const [outlinePromptExpanded, setOutlinePromptExpanded] = useState(false);

    // 同步父组件的 defaultStream 到本地 activeStream
    useEffect(() => {
        if (defaultStream) {
            setActiveStream(defaultStream);
        }
    }, [defaultStream]);

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
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <Users size={14} />
                            <span>前景 / FOREGROUND</span>
                        </div>
                        <div className="space-y-2 pl-1">
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">角色:</div>
                                <div className="space-y-1">
                                    {(frame.foreground?.characters || []).map((c: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-white/60 border border-slate-200/50 text-slate-700">{renderFrameItem(c) || '添加角色...'}</div>
                                    ))}
                                    {(!frame.foreground?.characters?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无角色</div>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">道具:</div>
                                <div className="space-y-1">
                                    {(frame.foreground?.objects || []).map((o: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-white/60 border border-slate-200/50 text-slate-700">{renderFrameItem(o) || '添加道具...'}</div>
                                    ))}
                                    {(!frame.foreground?.objects?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无道具</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Midground */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <Box size={14} />
                            <span>中景 / MIDGROUND</span>
                        </div>
                        <div className="space-y-2 pl-1">
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">角色:</div>
                                <div className="space-y-1">
                                    {(frame.midground?.characters || []).map((c: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-white/60 border border-slate-200/50 text-slate-700">{renderFrameItem(c) || '添加角色...'}</div>
                                    ))}
                                    {(!frame.midground?.characters?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无角色</div>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">道具:</div>
                                <div className="space-y-1">
                                    {(frame.midground?.objects || []).map((o: unknown, i: number) => (
                                        <div key={i} className="p-2 rounded-lg bg-white/60 border border-slate-200/50 text-slate-700">{renderFrameItem(o) || '添加道具...'}</div>
                                    ))}
                                    {(!frame.midground?.objects?.length) && <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-400 italic">无道具</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Background */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <Layout size={14} />
                            <span>背景 / BACKGROUND</span>
                        </div>
                        <div className="space-y-2 pl-1">
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">环境:</div>
                                <div className="p-2 rounded-lg bg-white/60 border border-slate-200/50 text-slate-700">
                                    {frame.background?.environment || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">景深:</div>
                                <div className="p-2 rounded-lg bg-white/60 border border-slate-200/50 text-slate-700">
                                    {frame.background?.depth || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Lighting & Palette */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                            <Zap size={14} />
                            <span>光影与色调 / LIGHTING & PALETTE</span>
                        </div>
                        <div className="space-y-2 pl-1">
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">光照:</div>
                                <div className="p-2 rounded-lg bg-white/60 border border-slate-200/50 text-slate-700">
                                    {frame.lighting || <span className="italic text-slate-400">无</span>}
                                </div>
                            </div>
                            <div>
                                <div className="text-slate-500 text-[10px] mb-1">色调:</div>
                                <div className="p-2 rounded-lg bg-white/60 border border-slate-200/50 text-slate-700">
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
                        <div key={i} className="p-2 rounded-lg bg-white/50 border border-slate-200/50 text-slate-700 text-sm">
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
            <div className="mt-2 border border-[#34C759]/30 rounded-xl p-3 bg-[#34C759]/5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-[#34C759] font-semibold mb-2">
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
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#34C759] text-white hover:bg-[#2DB84D] transition text-xs font-medium shadow-sm"
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
            : 'border-slate-400/30 bg-slate-500/5 text-slate-700';
        const labelClass = isMissing ? 'text-blue-600' : 'text-slate-600';
        const badgeClass = isMissing
            ? 'bg-blue-500 text-white border-transparent'
            : 'bg-slate-500 text-white border-transparent';

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
        if (upper === 'DELETE') return 'text-[#e11d48]';
        if (upper === 'REPLACE') return 'text-slate-300';
        if (upper === 'ADD' || upper === 'INSERT') return 'text-[#34C759]';
        return 'text-blue-300';
    };

    const modType = shot.modification?.type;
    const originalModificationInfo = shot.modification_info;
    const optimizedModificationInfo = optimizedShot?.modification_info;
    const modificationInfo = originalModificationInfo ?? optimizedModificationInfo;
    const hasOriginalMod = !!originalModificationInfo;
    const hasOptimizedMod = !!optimizedModificationInfo;
    const modIsDiff = hasOriginalMod && hasOptimizedMod && JSON.stringify(originalModificationInfo) !== JSON.stringify(optimizedModificationInfo);
    let modBadgeClass = 'border-slate-400/50 bg-slate-500/10';
    if (!hasOriginalMod && hasOptimizedMod) {
        modBadgeClass = 'border-blue-400/50 bg-blue-500/10';
    } else if (modIsDiff) {
        modBadgeClass = 'border-[#e11d48]/50 bg-[#e11d48]/10';
    }

    // Determine border color based on modification
    let borderColor = "border-white/10";
    let glowColor = "";

    if (mode === 'revision') {
        if (modType === 'delete') {
            borderColor = "border-[#e11d48]/30";
            glowColor = "shadow-[#e11d48]/5";
        } else if (modType === 'add') {
            borderColor = "border-[#34C759]/30";
            glowColor = "shadow-[#34C759]/5";
        } else if (modType === 'modify') {
            borderColor = "border-slate-400/30";
            glowColor = "shadow-slate-500/5";
        }
    }

    // Prepare values
    const baseVisual = shot.visual_changes ?? '';
    const optVisual = optimizedShot?.visual_changes;
    const visualVal = mode === 'revision' ? baseVisual : (shot.visual_changes ?? optVisual ?? '');

    const alternatives = shot.alternatives || [];
    const showGeneration = !!onGenerateImage;
    const hasGeneratedImages = Array.isArray(generatedImageUrls) && generatedImageUrls.length > 0;
    // 【修复】不使用默认索引，只有当明确传入 generatedImageIndex 时才显示选中图片
    // 避免在 savedIndexes 加载完成前显示错误的图片
    const activeIndex = generatedImageIndex;
    const activeImage = hasGeneratedImages && activeIndex !== undefined ? generatedImageUrls[Math.min(activeIndex, generatedImageUrls.length - 1)] : null;
    const isNewShot = !Number.isInteger(shotId) || shot.timestamp === 'N/A' || shot.end_time === 'N/A';

    // 从图片URL提取文件名序号（如 image_url_27.png → 27）
    const getImageIndex = (url: string): number => {
        try {
            const filename = url.split('/').pop() || '';
            const match = filename.match(/_(\d+)\.[^.]+$/);
            return match ? parseInt(match[1], 10) : 0;
        } catch {
            return 0;
        }
    };

    // 排序后的图片列表（按文件名序号倒序，最新在前）
    const sortedImages = useMemo(() =>
        [...generatedImageUrls]
            .filter(Boolean)
            .sort((a, b) => getImageIndex(b) - getImageIndex(a)),
        [generatedImageUrls]
    );

    // Premium Design System - Refined spacing & styling
    const MEDIA_WIDTH = 'w-[400px]';           // Card width
    const DESC_WIDTH = 'w-[600px]';            // Description width (1.5x media)
    const CARD_HEIGHT = 'h-[780px]';           // Card height
    const CARD_PADDING = 'p-5';                // Consistent padding
    const CARD_GAP = 'gap-4';                  // Internal spacing
    const CARD_RADIUS = 'rounded-2xl';         // Refined radius
    const BTN_RADIUS = 'rounded-lg';           // Button radius

    // Media container: 9:16 aspect with premium styling
    const mediaBaseClass = `relative aspect-[9/16] ${CARD_RADIUS} overflow-hidden bg-[var(--theme-bg-page)] border border-[var(--theme-border)]`;
    const mediaCardBase = `flex-shrink-0 ${MEDIA_WIDTH} ${CARD_RADIUS} lg-card ${CARD_PADDING} flex flex-col ${CARD_GAP} transition-all duration-300`;
    // Title styling: fixed height for alignment
    const mediaTitleClass = 'h-5 text-xs font-semibold text-[var(--theme-text-sub)] text-center tracking-wide uppercase';

    // 从 URL 提取生成时间和版本号（格式：MM/DD HH:MM v1）
    // 支持两种格式：_YYYYMMDDHHMMSS_vN 或 _YYYYMMDD_HHMMSS
    const getGenerationInfo = (url: string): string => {
        try {
            const filename = url.split('/').pop() || '';
            // 先尝试匹配连续格式（如 video_20251202173327_v1.mp4）
            let match = filename.match(/_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_(v\d+)/);
            if (match) {
                const [, , month, day, hour, minute, , version] = match;
                return `${month}/${day} ${hour}:${minute} ${version}`;
            }
            // 再尝试匹配分隔格式（如 image_20251202_173327.png）
            match = filename.match(/_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
            if (match) {
                const [, , month, day, hour, minute] = match;
                return `${month}/${day} ${hour}:${minute}`;
            }
            // 尝试匹配无版本号的连续格式
            match = filename.match(/_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})_/);
            if (match) {
                const [, , month, day, hour, minute] = match;
                return `${month}/${day} ${hour}:${minute}`;
            }
            return '';
        } catch {
            return '';
        }
    };

    // 当前选中的视频
    const activeVideo = useMemo(() => selectedVideo || clipUrl || null, [selectedVideo, clipUrl]);

    // 视频流列表
    const videoFlow = useMemo(() => {
        const list: string[] = [];
        if (selectedVideo && selectedVideo !== clipUrl) list.push(selectedVideo);
        if (clipUrl) list.push(clipUrl);
        return list;
    }, [clipUrl, selectedVideo]);

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

    const isDiscarded = !!shot.discarded;

    return (
        <>
            <div
                id={`shot-${index}`}
                className={`relative group p-6 lg-card ${borderColor}`}
            >
                {/* Discarded Overlay */}
                {isDiscarded && (
                    <div className="absolute inset-0 bg-black/50 z-20 pointer-events-none rounded-[24px]" />
                )}

                {/* Header: Shot Number & Duration */}
                <div className="relative z-10 flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[var(--theme-bg-page)] border border-[var(--theme-border-highlight)] shadow-sm">
                            <span className="text-base font-bold tabular-nums text-[var(--theme-text-main)]">
                                {String(index + 1).padStart(2, '0')}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 flex-wrap justify-end">
                        {shot.timestamp && (
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-100 border border-zinc-200/60 text-zinc-600 text-sm">
                                <Clock size={14} className="text-zinc-400" />
                                <span className="font-mono text-xs">{shot.timestamp}</span>
                                {shot.end_time && <span className="font-mono text-xs text-zinc-400">— {shot.end_time}</span>}
                                {shot.duration && <span className="ml-1 text-zinc-400 text-xs">({shot.duration}s)</span>}
                            </div>
                        )}
                        {/* Outline Mode Toggle */}
                        <button
                            onClick={() => onToggleOutlineMode?.(shot, index)}
                            className={`relative z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${effectiveOutlineMode
                                ? 'bg-zinc-700 text-white hover:bg-zinc-600'
                                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 border border-zinc-200/60'
                                }`}
                            title={effectiveOutlineMode ? 'Outline mode enabled' : 'Enable outline mode'}
                        >
                            <Pencil size={12} />
                            <span>Outline</span>
                            {effectiveOutlineMode && <Check size={10} />}
                        </button>
                        <button
                            onClick={() => updateField('discarded', !isDiscarded)}
                            className={`relative z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${isDiscarded
                                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200/60'
                                }`}
                        >
                            {isDiscarded ? (
                                <>
                                    <Undo2 size={12} />
                                    <span>Restore</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 size={12} />
                                    <span>Discard</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* 横向滚动布局：原片视频(sticky) + 选中图 + 生成视频 + 描述 + 流切换器 + 素材列表 */}
                <div className="relative z-10 space-y-6">
                    {/* 横向滚动容器 */}
                    <div className="relative overflow-x-auto" style={{ scrollbarWidth: 'thin' }}>
                        <div className="flex flex-nowrap items-start gap-6 pb-4 pt-2" style={{ minWidth: 'max-content' }}>

                            {/* 1. 原片分镜视频 (Sticky) - 放大宽度 w-[510px] */}
                            <div className={`sticky left-0 top-0 z-20 ${mediaCardBase}`}>
                                <div className={mediaTitleClass}>原片分镜</div>
                                {clipUrl ? (
                                    <PreviewVideoPlayer
                                        src={clipUrl}
                                        volume={globalVolume}
                                        muted={isGlobalMuted}
                                        className="w-full"
                                        aspectRatio="aspect-[9/16]"
                                        poster={frameUrl || undefined}
                                        lazy
                                    />
                                ) : isNewShot ? (
                                    <div className={`${mediaBaseClass} border border-dashed border-slate-700 flex items-center justify-center text-slate-400 text-base p-6 text-center`}>
                                        新增镜头
                                    </div>
                                ) : frameUrl ? (
                                    <div className={`${mediaBaseClass} border border-[var(--glass-border)] shadow-lg`}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={frameUrl} alt={`Shot ${index + 1} frame`} className="w-full h-full object-cover" />
                                    </div>
                                ) : (
                                    <div className={`${mediaBaseClass} border border-dashed border-slate-700 flex items-center justify-center text-slate-500 text-base`}>
                                        无媒体
                                    </div>
                                )}
                            </div>

                            {/* 1.5 选中线稿图 - 仅在线稿模式下显示 */}
                            {showGeneration && effectiveOutlineMode && (
                                <div className={`${mediaCardBase} ${shot.finalizedOutline ? 'ring-2 ring-zinc-400/30 !duration-100' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <div className={mediaTitleClass}>选中线稿图</div>
                                        {activeOutlineUrl && (
                                            <FinalizeButton
                                                isFinalized={!!(shot.finalizedOutline && activeOutlineUrl.includes(shot.finalizedOutline))}
                                                onClick={() => {
                                                    const filename = activeOutlineUrl.split('/').pop() || '';
                                                    const isFinalized = shot.finalizedOutline === filename;
                                                    onFinalizeOutline?.(shot, index, isFinalized ? null : filename);
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div className={`${mediaBaseClass} border border-[#6B7280]/30 shadow-sm flex items-center justify-center`}>
                                        {activeOutlineUrl ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={activeOutlineUrl.startsWith('/') ? `${API_BASE}${activeOutlineUrl}` : activeOutlineUrl} alt="线稿图" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="flex flex-col items-center gap-2 text-slate-400">
                                                <Pencil size={28} className="text-[#6B7280]/50" />
                                                <span className="text-sm">暂无线稿</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* 生成线稿按钮 */}
                                    <div className="mt-2">
                                        <button
                                            onClick={() => onGenerateOutline?.(shot, index)}
                                            disabled={isGeneratingOutline}
                                            className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium shadow-md transition-all duration-200 active:scale-95 ${isGeneratingOutline
                                                ? 'bg-slate-400 text-white cursor-not-allowed'
                                                : 'bg-slate-500 text-white hover:bg-slate-600'
                                                }`}
                                        >
                                            {isGeneratingOutline ? (
                                                <><Loader2 size={16} className="animate-spin" />生成中...</>
                                            ) : (
                                                <><Pencil size={16} />生成线稿</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* 2. 选中的生成图片 - 放大 */}
                            {showGeneration && (
                                <div className={`${mediaCardBase} ${shot.finalizedImage ? 'ring-2 ring-zinc-400/30 !duration-100' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <div className={mediaTitleClass}>
                                            {getGenerationInfo(activeImage || '') || '选中生成图'}
                                        </div>
                                        {activeImage && (
                                            <FinalizeButton
                                                isFinalized={!!(shot.finalizedImage && activeImage.includes(shot.finalizedImage))}
                                                onClick={() => {
                                                    const filename = activeImage.split('/').pop() || '';
                                                    const isFinalized = shot.finalizedImage === filename;
                                                    onFinalizeImage?.(shot, index, isFinalized ? null : filename);
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div className={`${mediaBaseClass} border ${highlightGenerated || (activeImage && newImages.includes(activeImage)) ? 'border-red-400' : 'border-slate-200'} shadow-sm flex items-center justify-center text-lg text-blue-300`}>
                                        {(activeImage && newImages.includes(activeImage)) && (
                                            <span className="absolute top-2 right-2 px-3 py-1.5 rounded-full text-sm font-semibold bg-[#e11d48] text-white">NEW</span>
                                        )}
                                        {activeImage ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={activeImage} alt="生成图片" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-slate-400">点击下方生成</span>
                                        )}
                                    </div>
                                    {/* 供应商选择器 + 生图按钮 */}
                                    <div className="mt-2 flex items-center gap-2">
                                        {providers.length > 0 && (
                                            <select
                                                value={selectedProviderId || providers.find(p => p.is_default)?.id || providers[0]?.id || ''}
                                                onChange={(e) => onProviderChange?.(shot, index, e.target.value)}
                                                disabled={isGenerating}
                                                className="lg-input flex-shrink-0 py-2 text-xs font-medium disabled:opacity-50 w-auto"
                                                title="选择生图供应商"
                                            >
                                                {providers.map(p => (
                                                    <option key={p.id} value={p.id}>
                                                        {p.name}{p.is_default ? ' ✓' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                        <button
                                            onClick={() => {
                                                // 先 blur 当前输入框，强制同步 debounce 中的数据
                                                (document.activeElement as HTMLElement)?.blur();
                                                // 延迟 50ms 确保 React 状态更新完成
                                                setTimeout(() => {
                                                    onGenerateImage?.(shot, index, selectedProviderId);
                                                }, 50);
                                            }}
                                            disabled={isGenerating}
                                            className={`flex-1 lg-btn ${isGenerating
                                                ? 'lg-btn-secondary opacity-50 cursor-not-allowed'
                                                : 'lg-btn-primary'
                                                }`}
                                        >
                                            {isGenerating ? (
                                                <><Loader2 size={16} className="animate-spin" />生成中...</>
                                            ) : (
                                                <><Wand2 size={16} />生成</>
                                            )}
                                        </button>
                                    </div>
                                    {/* 生成失败提示 */}
                                    {generateError && !isGenerating && (
                                        <ErrorTooltip error={generateError} />
                                    )}
                                </div>
                            )}

                            {/* 3. 选中视频 - 展示选中的视频，没有则显示占位（无切换按钮，在素材流中选择） */}
                            {showGeneration && (
                                <div className={`${mediaCardBase} ${shot.finalizedVideo ? 'ring-2 ring-zinc-400/30 !duration-100' : ''}`}>
                                    <div className="flex items-center justify-between">
                                        <div className={mediaTitleClass}>选中视频</div>
                                        {videoSrc && (
                                            <FinalizeButton
                                                isFinalized={!!(shot.finalizedVideo && videoSrc.includes(shot.finalizedVideo))}
                                                onClick={() => {
                                                    const filename = videoSrc.split('/').pop() || '';
                                                    const isFinalized = shot.finalizedVideo === filename;
                                                    onFinalizeVideo?.(shot, index, isFinalized ? null : filename);
                                                }}
                                            />
                                        )}
                                    </div>
                                    {videoSrc ? (
                                        <>
                                            <PreviewVideoPlayer
                                                src={videoSrc}
                                                volume={globalVolume}
                                                muted={isGlobalMuted}
                                                className="w-full"
                                                aspectRatio="aspect-[9/16]"
                                                lazy
                                                defaultRate={2.5}
                                            />
                                        </>
                                    ) : (
                                        <div className={`${mediaBaseClass} border border-dashed border-zinc-300/50 shadow-sm flex flex-col items-center justify-center gap-3`}>
                                            <Video size={32} className="text-zinc-400" />
                                            <span className="text-sm text-zinc-400">暂无选中视频</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* 4. 首帧/视频描述 */}
                            <div className={`flex-shrink-0 ${DESC_WIDTH} ${CARD_HEIGHT} lg-card ${CARD_PADDING} flex flex-col ${CARD_GAP} overflow-y-auto`}>
                                {/* 线稿提示词输入框 - 仅在线稿模式下显示，默认折叠 */}
                                {effectiveOutlineMode && (
                                    <div className="flex flex-col gap-2 flex-shrink-0 mb-2">
                                        <div className="flex items-center justify-between text-sm font-semibold text-[#6B7280] flex-shrink-0">
                                            <button
                                                onClick={() => setOutlinePromptExpanded(!outlinePromptExpanded)}
                                                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                                            >
                                                <Pencil size={14} />
                                                <span>线稿提示词</span>
                                                <ChevronDown size={14} className={`transition-transform duration-200 ${outlinePromptExpanded ? '' : '-rotate-90'}`} />
                                            </button>
                                            <div className="flex items-center gap-2">
                                                {outlinePromptExpanded && effectiveOutlinePrompt && effectiveOutlinePrompt !== globalOutlinePrompt && (
                                                    <button
                                                        onClick={() => onOutlinePromptChange?.(shot, index, globalOutlinePrompt)}
                                                        className="text-xs text-slate-500 hover:text-[#6B7280] transition-colors flex items-center gap-1"
                                                        title="恢复默认提示词"
                                                    >
                                                        <Undo2 size={12} />
                                                        恢复默认
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => onGenerateOutline?.(shot, index)}
                                                    disabled={isGeneratingOutline}
                                                    className={`flex items-center justify-center gap-2 w-[100px] py-1.5 rounded-xl text-xs font-medium shadow-sm transition-all duration-200 active:scale-95 normal-case h-[34px] ${isGeneratingOutline
                                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                                        : 'bg-slate-500 text-white hover:bg-slate-600'
                                                        }`}
                                                >
                                                    {isGeneratingOutline ? (
                                                        <><Loader2 size={14} className="animate-spin" />生成中</>
                                                    ) : (
                                                        <><Pencil size={14} />生成线稿</>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                        {outlinePromptExpanded && (
                                            <AutoTextArea
                                                value={outlinePrompt ?? globalOutlinePrompt}
                                                onChange={(e) => onOutlinePromptChange?.(shot, index, e.target.value)}
                                                placeholder="描述线稿风格..."
                                                minRows={2}
                                                maxRows={8}
                                                className={`w-full p-4 ${BTN_RADIUS} bg-white/40 border border-white/30 text-slate-700 text-base leading-loose hover:bg-white/60 transition-all focus:outline-none focus:ring-2 focus:ring-[#6B7280]/20 resize-none placeholder:text-slate-400`}
                                            />
                                        )}
                                    </div>
                                )}
                                <div className="flex flex-col gap-2 basis-[58%] min-h-0 overflow-hidden">
                                    <div className="flex items-center justify-between text-sm font-medium text-slate-500 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <ImageIcon size={14} />
                                            <span>首帧描述</span>
                                            {renderAnnotationControl?.(`shot-${shot.id ?? index}-initial`, `Shot #${shot.id ?? index + 1} Initial Frame`)}
                                        </div>
                                        {/* 生图按钮 */}
                                        {showGeneration && (
                                            <div className="flex items-center gap-2">
                                                {providers.length > 0 && (
                                                    <select
                                                        value={selectedProviderId || providers.find(p => p.is_default)?.id || providers[0]?.id || ''}
                                                        onChange={(e) => onProviderChange?.(shot, index, e.target.value)}
                                                        disabled={isGenerating}
                                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/80 border border-slate-200/50 text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-400/50 disabled:opacity-50 normal-case h-[34px]"
                                                        title="选择生图供应商"
                                                    >
                                                        {providers.map(p => (
                                                            <option key={p.id} value={p.id}>
                                                                {p.name}{p.is_default ? ' ✓' : ''}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        (document.activeElement as HTMLElement)?.blur();
                                                        setTimeout(() => {
                                                            onGenerateImage?.(shot, index, selectedProviderId);
                                                        }, 50);
                                                    }}
                                                    disabled={isGenerating}
                                                    className={`flex items-center justify-center gap-2 w-[100px] py-1.5 rounded-xl text-xs font-medium shadow-sm transition-all duration-200 active:scale-95 normal-case h-[34px] ${isGenerating
                                                        ? 'bg-slate-400 text-white cursor-not-allowed'
                                                        : 'bg-zinc-800 text-white hover:bg-zinc-700'
                                                        }`}
                                                >
                                                    {isGenerating ? (
                                                        <><Loader2 size={14} className="animate-spin" />生成中</>
                                                    ) : (
                                                        <><Wand2 size={14} />生图</>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-h-0 overflow-y-auto">
                                        {renderFieldWithRevision(
                                            structuredFrameOriginal || structuredFrameOptimized ? (
                                                <div className="p-3 rounded-lg border border-dashed border-slate-200 bg-white/60 text-sm text-slate-500">
                                                    结构化首帧，见下方
                                                </div>
                                            ) : (
                                                <AutoTextArea
                                                    value={initialFrameText}
                                                    onChange={(e) => updateField('initial_frame', e.target.value)}
                                                    readOnly={!canEdit}
                                                    minRows={2}
                                                    maxRows={20}
                                                    className={`w-full h-full p-4 ${BTN_RADIUS} apple-input bg-white/50 text-base leading-relaxed hover:bg-white/80 resize-none placeholder:text-slate-400`}
                                                    placeholder="输入首帧描述..."
                                                />
                                            ),
                                            '首帧描述',
                                            initialFrameText,
                                            initialFrameTextOptimized,
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 basis-[30%] min-h-0">
                                    <div className="flex items-center justify-between text-sm font-medium text-slate-500 flex-shrink-0">
                                        <div className="flex items-center gap-2">
                                            <Film size={14} />
                                            <span>视频描述</span>
                                            {renderAnnotationControl?.(`shot-${shot.id ?? index}-visual`, `Shot #${shot.id ?? index + 1} Visual`)}
                                        </div>
                                        {/* 生视频按钮 */}
                                        {onGenerateVideo && showGeneration && (
                                            <button
                                                onClick={() => isGeneratingVideo ? onStopVideoGeneration?.(shot, index) : onGenerateVideo(shot, index)}
                                                disabled={!isGeneratingVideo && !hasGeneratedImages}
                                                title={isGeneratingVideo ? '停止生成视频' : !hasGeneratedImages ? '请先生成图片' : '使用当前图片生成视频'}
                                                className={`flex items-center justify-center gap-2 w-[100px] py-1.5 rounded-xl text-xs font-medium shadow-sm transition-all duration-200 active:scale-95 normal-case h-[34px] ${isGeneratingVideo
                                                    ? 'bg-[#e11d48] text-white hover:bg-[#be123c]'
                                                    : !hasGeneratedImages
                                                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                                                        : 'bg-zinc-800 text-white hover:bg-zinc-700'
                                                    }`}
                                            >
                                                {isGeneratingVideo ? (
                                                    <><Square size={14} fill="currentColor" />停止生成</>
                                                ) : (
                                                    <><Video size={14} />生视频</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    {renderFieldWithRevision(
                                        <AutoTextArea
                                            value={visualVal}
                                            onChange={(e) => updateField('visual_changes', e.target.value)}
                                            readOnly={!canEdit}
                                            minRows={2}
                                            maxRows={12}
                                            className={`w-full h-full p-4 ${BTN_RADIUS} apple-input bg-slate-50/50 text-base leading-relaxed hover:bg-slate-50/80 resize-none placeholder:text-slate-400`}
                                            placeholder="画面描述..."
                                        />,
                                        '视频描述',
                                        baseVisual,
                                        optVisual
                                    )}
                                    {renderDiffPanel(`shot-${shot.id ?? index}-visual_changes`)}
                                </div>
                            </div>

                            {/* 5. 流切换器 (Apple Glass 竖向Tab) */}
                            {showGeneration && (
                                <div className={`flex-shrink-0 w-[72px] ${CARD_HEIGHT} flex flex-col items-center gap-2 p-2 glass-card`}>
                                    {/* 线稿 Tab */}
                                    <button
                                        onClick={() => setActiveStream('outline')}
                                        className={`group w-14 flex-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95
                                            ${activeStream === 'outline'
                                                ? 'bg-[#71717a] shadow-md shadow-[#71717a]/30'
                                                : 'bg-white/60 hover:bg-white/90 border border-white/50'}`}
                                    >
                                        <Pencil size={18} className={activeStream === 'outline' ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'} />
                                        <span className={`text-[10px] font-medium ${activeStream === 'outline' ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`}>线稿</span>
                                    </button>
                                    {/* 图片 Tab */}
                                    <div className="relative flex-1 flex flex-col w-14">
                                        <button
                                            onClick={() => {
                                                setActiveStream('image');
                                                if (newImages.length > 0) {
                                                    onClearNewImages?.(shot, index);
                                                }
                                            }}
                                            className={`group w-full h-full rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95
                                                ${activeStream === 'image'
                                                    ? 'bg-[#71717a] shadow-md shadow-[#71717a]/30'
                                                    : 'bg-white/60 hover:bg-white/90 border border-white/50'}`}
                                        >
                                            <ImageIcon size={18} className={activeStream === 'image' ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'} />
                                            <span className={`text-[10px] font-medium ${activeStream === 'image' ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`}>图片</span>
                                        </button>
                                        {newImages.length > 0 && (
                                            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#e11d48] shadow-sm animate-pulse" />
                                        )}
                                    </div>
                                    {/* 视频 Tab */}
                                    <button
                                        onClick={() => setActiveStream('video')}
                                        className={`group w-14 flex-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 active:scale-95
                                            ${activeStream === 'video'
                                                ? 'bg-[#71717a] shadow-md shadow-[#71717a]/30'
                                                : 'bg-white/60 hover:bg-white/90 border border-white/50'}`}
                                    >
                                        <Video size={18} className={activeStream === 'video' ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'} />
                                        <span className={`text-[10px] font-medium ${activeStream === 'video' ? 'text-white' : 'text-slate-500 group-hover:text-slate-700'}`}>视频</span>
                                    </button>
                                </div>
                            )}

                            {/* 6. 素材列表 (横向无限滚动) */}
                            <div className="flex flex-nowrap items-start gap-6">
                                {activeStream === 'video' ? (
                                    <>
                                        {/* 生成中：显示占位卡片（在已有视频前面） */}
                                        {isGeneratingVideo && videoTaskProgresses.length > 0 && videoTaskProgresses.map((task, idx) => (
                                            <div
                                                key={`task-${task.taskId}-${idx}`}
                                                className={`${MEDIA_WIDTH} flex-shrink-0 ${CARD_RADIUS} border border-[#71717a]/30 bg-white/50 backdrop-blur-xl ${CARD_PADDING} flex flex-col ${CARD_GAP}`}
                                            >
                                                <div className={mediaTitleClass}>生成中 <WaitTimer startTime={task.startTime} /></div>
                                                <div className={`${mediaBaseClass} border border-white/10 shadow-inner flex flex-col items-center justify-center gap-3`}>
                                                    <Loader2 size={36} className="animate-spin text-[#71717a]" />
                                                    <span className="text-[#71717a] text-sm font-medium">
                                                        {task.status === 'downloading' ? '下载中...' : task.status === 'processing' ? (task.progress > 0 ? `${task.progress}%` : '生成中...') : '排队中...'}
                                                    </span>
                                                    {(task.status === 'processing' || task.status === 'downloading') && (
                                                        <div className="w-32 h-2 bg-zinc-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-[#71717a] rounded-full transition-all duration-300"
                                                                style={{ width: `${task.progress}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center justify-center">
                                                    <span className="text-xs text-slate-400">视频 #{idx + 1}</span>
                                                </div>
                                            </div>
                                        ))}
                                        {/* 已有视频 */}
                                        {generatedVideoUrls.map((url, idx) => {
                                            const isSelected = idx === selectedVideoIndex;
                                            const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : url;
                                            const isNew = newVideos.includes(url);
                                            const genInfo = getGenerationInfo(url);
                                            return (
                                                <div
                                                    key={`video-${url}-${idx}`}
                                                    className={`${MEDIA_WIDTH} flex-shrink-0 ${CARD_RADIUS} border transition-all duration-300 ${isSelected ? 'border-zinc-300/50 shadow-lg ring-1 ring-zinc-300/30' : 'border-white/30 hover:shadow-md'} bg-white/50 backdrop-blur-xl ${CARD_PADDING} flex flex-col ${CARD_GAP}`}
                                                >
                                                    <div className={mediaTitleClass}>{genInfo || ' '}</div>
                                                    <div className={`${mediaBaseClass} border border-white/10 shadow-inner cursor-pointer relative`}>
                                                        {/* 左上角：NEW 标识 */}
                                                        {isNew && (
                                                            <span className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-semibold bg-[#e11d48] text-white z-10">
                                                                NEW
                                                            </span>
                                                        )}
                                                        {/* 不设置 poster，让浏览器自动显示视频第一帧 */}
                                                        <PreviewVideoPlayer
                                                            src={fullUrl}
                                                            volume={globalVolume}
                                                            muted={isGlobalMuted}
                                                            aspectRatio="aspect-[9/16]"
                                                            className="w-full h-full object-cover"
                                                            lazy
                                                            defaultRate={2.5}
                                                            onPlay={() => onVideoSeen?.(url)}
                                                        />
                                                    </div>
                                                    {/* 操作按钮区 */}
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => onSelectVideoIndex?.(idx)}
                                                            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${BTN_RADIUS} px-4 py-2.5 transition-all duration-200 active:scale-[0.98] ${isSelected
                                                                ? 'bg-[#71717a] text-white shadow-md'
                                                                : 'bg-white/70 border border-slate-200/50 text-slate-600 hover:bg-white hover:border-[#71717a]/50 hover:text-[#71717a]'}`}
                                                        >
                                                            {isSelected ? <><Check size={14} /> 已选择</> : '选择此视频'}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* 空状态：没有视频且不在生成中 */}
                                        {generatedVideoUrls.length === 0 && !isGeneratingVideo && (
                                            <div className={`w-full min-w-[360px] flex flex-col items-center justify-center gap-4 text-slate-400 bg-white/30 ${CARD_RADIUS} border border-dashed border-zinc-300/50 p-10 backdrop-blur-sm`}>
                                                <Video size={36} className="text-zinc-400" />
                                                <span>暂无生成视频</span>
                                                <span className="text-xs text-slate-300">点击「生视频」按钮开始生成</span>
                                            </div>
                                        )}
                                        {/* 空状态：没有视频但正在生成（没有占位卡片时的备用显示） */}
                                        {generatedVideoUrls.length === 0 && isGeneratingVideo && videoTaskProgresses.length === 0 && (
                                            <div className={`w-full min-w-[360px] flex flex-col items-center justify-center gap-4 text-slate-400 bg-white/30 ${CARD_RADIUS} border border-dashed border-zinc-300/50 p-10 backdrop-blur-sm`}>
                                                <div className="flex flex-col items-center gap-3 w-full">
                                                    <Loader2 size={36} className="animate-spin text-zinc-400" />
                                                    <span className="text-zinc-400">
                                                        {videoTaskStatus === 'processing' ? `视频生成中 ${videoProgress}%` : '排队等待中...'}
                                                    </span>
                                                    {videoTaskStatus === 'processing' && (
                                                        <div className="w-48 h-2 bg-zinc-200 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-[#71717a] rounded-full transition-all duration-300"
                                                                style={{ width: `${videoProgress}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={() => onStopVideoGeneration?.(shot, index)}
                                                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#e11d48] text-white hover:bg-[#be123c] transition"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="6" width="12" height="12" rx="2"></rect></svg>
                                                        停止生成
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : activeStream === 'outline' ? (
                                    <>
                                        {/* 线稿流：生成中 */}
                                        {isGeneratingOutline && (
                                            <div className={`${MEDIA_WIDTH} flex-shrink-0 ${CARD_RADIUS} border border-[#6B7280]/50 bg-white/50 backdrop-blur-xl ${CARD_PADDING} flex flex-col ${CARD_GAP}`}>
                                                <div className={mediaTitleClass}>生成线稿中...</div>
                                                <div className={`${mediaBaseClass} border border-white/10 shadow-inner flex flex-col items-center justify-center gap-3`}>
                                                    <Loader2 size={36} className="animate-spin text-[#6B7280]" />
                                                    <span className="text-[#6B7280] text-sm font-medium">正在提取线稿...</span>
                                                </div>
                                            </div>
                                        )}
                                        {/* 线稿流：已有线稿 */}
                                        {outlineUrls.map((url, idx) => {
                                            const isActive = url === activeOutlineUrl;
                                            const genInfo = getGenerationInfo(url);
                                            return (
                                                <div
                                                    key={`outline-${url}-${idx}`}
                                                    className={`${MEDIA_WIDTH} flex-shrink-0 ${CARD_RADIUS} border transition-all duration-300 ${isActive ? 'border-[#6B7280]/50 shadow-lg ring-1 ring-[#6B7280]/20' : 'border-white/30 hover:shadow-md'} bg-white/50 backdrop-blur-xl ${CARD_PADDING} flex flex-col ${CARD_GAP}`}
                                                >
                                                    <div className={mediaTitleClass}>{genInfo || '线稿图'}</div>
                                                    <div className={`${mediaBaseClass} border border-white/10 shadow-inner cursor-pointer relative`}>
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={url.startsWith('/') ? `${API_BASE}${url}` : url} alt={`线稿 ${idx + 1}`} className="w-full h-full object-cover" />
                                                    </div>
                                                    {/* 操作按钮区 */}
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => onSelectOutline?.(shot, index, url)}
                                                            className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${BTN_RADIUS} px-4 py-2.5 transition-all duration-200 active:scale-[0.98] ${isActive
                                                                ? 'bg-gradient-to-r from-[#6B7280] to-[#5B6370] text-white shadow-md'
                                                                : 'bg-white/70 border border-slate-200/50 text-slate-600 hover:bg-white hover:border-[#6B7280]/50 hover:text-[#6B7280]'}`}
                                                        >
                                                            {isActive ? <><Check size={14} /> 已选择</> : '选择此线稿'}
                                                        </button>
                                                        <button
                                                            onClick={() => onDeleteOutline?.(shot, index, url)}
                                                            className={`p-2.5 ${BTN_RADIUS} bg-white/70 border border-slate-200/50 text-slate-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-all duration-200`}
                                                            title="删除线稿"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* 线稿流：空状态 */}
                                        {!isGeneratingOutline && outlineUrls.length === 0 && (
                                            <div className={`w-full min-w-[360px] flex flex-col items-center justify-center gap-4 text-slate-400 bg-white/30 ${CARD_RADIUS} border border-dashed border-[#6B7280]/30 p-10 backdrop-blur-sm`}>
                                                <Pencil size={36} className="text-[#6B7280]/60" />
                                                <span>暂无线稿图</span>
                                                <button
                                                    onClick={() => onGenerateOutline?.(shot, index)}
                                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-slate-500 text-white hover:bg-slate-600 transition shadow-md"
                                                >
                                                    <Wand2 size={14} />
                                                    生成线稿
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : sortedImages.length > 0 ? (
                                    sortedImages.map((url, idx) => {
                                        const originalIdx = generatedImageUrls.indexOf(url);
                                        const isActive = activeImage === url;
                                        const isNew = newImages.includes(url);
                                        const genTime = getGenerationInfo(url);
                                        return (
                                            <div
                                                key={`${url}-${idx}`}
                                                className={`${MEDIA_WIDTH} flex-shrink-0 ${CARD_RADIUS} border transition-all duration-300 ${isActive ? 'border-blue-400/50 shadow-lg ring-1 ring-blue-400/20' : 'border-white/30 hover:shadow-md'} bg-white/50 backdrop-blur-xl ${CARD_PADDING} flex flex-col ${CARD_GAP}`}
                                            >
                                                <div className={mediaTitleClass}>{genTime || ' '}</div>
                                                <div
                                                    className={`${mediaBaseClass} border border-white/10 shadow-inner cursor-pointer`}
                                                    onClick={() => setLightboxIndex(idx)}
                                                >
                                                    {/* 右上角：生成时间 */}
                                                    {genTime && (
                                                        <span className="absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-medium bg-black/50 text-white/90 backdrop-blur-sm z-10">
                                                            {genTime}
                                                        </span>
                                                    )}
                                                    {isNew && (
                                                        <span className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-semibold bg-[#e11d48] text-white z-10">
                                                            NEW
                                                        </span>
                                                    )}
                                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                                    <img src={url} alt={`生成图 ${idx + 1}`} className="w-full h-full object-cover" />
                                                </div>
                                                {/* 操作按钮区 */}
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => onSelectGeneratedIndex?.(shot, index, originalIdx)}
                                                        className={`flex-1 flex items-center justify-center gap-2 text-sm font-medium ${BTN_RADIUS} px-4 py-2.5 transition-all duration-200 active:scale-[0.98] ${isActive
                                                            ? 'bg-zinc-800 text-white shadow-sm'
                                                            : 'bg-white/70 border border-slate-200/50 text-slate-600 hover:bg-white hover:border-blue-300 hover:text-blue-600'}`}
                                                    >
                                                        {isActive ? <><Check size={14} /> 已选择</> : '选择此图'}
                                                    </button>
                                                    <span className={`text-xs font-medium text-slate-400 px-2.5 py-2 bg-slate-100/80 ${BTN_RADIUS} border border-slate-200/30`}>
                                                        #{getImageIndex(url)}
                                                    </span>
                                                    {/* 查看 Prompt 按钮 */}
                                                    {workspacePath && (
                                                        <PromptViewer
                                                            workspacePath={workspacePath}
                                                            shotId={shotId}
                                                            generatedDir={generatedDir}
                                                            imageFilename={url.split('/').pop()}
                                                            imageUrl={url}
                                                            compact
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className={`w-full min-w-[360px] flex items-center justify-center text-sm text-slate-400 bg-white/30 ${CARD_RADIUS} border border-dashed border-slate-300/50 p-10 backdrop-blur-sm`}>
                                        暂无生成图片，点击左侧「生成」开始
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* 下方内容区域 */}
                    <div className="space-y-6">

                        {modificationInfo && (
                            <div className={`p-4 rounded-2xl text-sm border ${modBadgeClass} space-y-2 bg-gradient-to-br from-blue-50/50 to-indigo-50/30`}>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <Sparkles size={16} className="text-zinc-600" />
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
                                                <Users size={16} className="text-zinc-600" />
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
                                                                            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors"
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
                                                                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors"
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
                                                <Layers size={16} className="text-[#71717a]" />
                                                中景 / Midground
                                            </div>
                                            <div className="space-y-3 pl-3 border-l-2 border-[#71717a]/30">
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
                                                                                <span className="px-2 py-1 rounded-md bg-zinc-100 text-zinc-600 text-xs font-semibold border border-zinc-200">
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
                                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-xs leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-[#71717a]/30 placeholder:text-slate-400"
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
                                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-xs leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-[#71717a]/30 placeholder:text-slate-400"
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
                                                                            className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-[#71717a]/30 placeholder:text-slate-400"
                                                                            placeholder="角色描述..."
                                                                        />
                                                                    )}
                                                                    {canEdit && (
                                                                        <button
                                                                            onClick={() => setDeleteConfirm({ type: 'mg_char', index: idx, label: `中景角色 #${idx + 1}` })}
                                                                            className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors"
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
                                                            className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-[#71717a]/30 placeholder:text-slate-400"
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
                                                                    className="flex-1 p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-[#71717a]/30 placeholder:text-slate-400"
                                                                    placeholder="道具描述..."
                                                                />
                                                                {canEdit && (
                                                                    <button
                                                                        onClick={() => setDeleteConfirm({ type: 'mg_obj', index: idx, label: `中景道具 #${idx + 1}` })}
                                                                        className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-[#e11d48] hover:bg-[#e11d48]/10 transition-colors"
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
                                                            className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-[#71717a]/30 placeholder:text-slate-400"
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
                                                <ImageIcon size={16} className="text-zinc-500" />
                                                背景 / Background
                                            </div>
                                            <div className="space-y-2 pl-3 border-l-2 border-zinc-300/30">
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
                                                        className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-zinc-300/30 placeholder:text-slate-400"
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
                                                        className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-zinc-300/30 placeholder:text-slate-400"
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
                                            <div className="space-y-2 pl-3 border-l-2 border-slate-400/30">
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
                                                        className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-slate-400/30 placeholder:text-slate-400"
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
                                                        className="w-full p-2 rounded-lg bg-black/5 border border-black/10 text-slate-700 text-sm leading-relaxed hover:bg-black/10 transition-colors resize-none focus:outline-none focus:border-slate-400/30 placeholder:text-slate-400"
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
                                        <div className="relative z-10 border rounded-2xl p-7 text-base shadow-sm backdrop-blur-sm transition-all duration-300 hover:shadow-md border-slate-400/30 bg-amber-500/5 text-slate-800 leading-relaxed">
                                            <div className="flex items-center justify-between mb-4">
                                                <div className="flex items-center gap-2 text-base uppercase font-bold tracking-wider text-slate-600">
                                                    <Sparkles size={16} />
                                                    <span>初始帧设定 (优化后)</span>
                                                </div>
                                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm bg-slate-500 text-white border-transparent">
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
                                                        <Layers size={16} className="text-zinc-500" />
                                                        优化中景
                                                    </div>
                                                    <div className="space-y-2 pl-3 border-l-2 border-zinc-300/30">
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
                                                        <ImageIcon size={16} className="text-zinc-400" />
                                                        优化背景
                                                    </div>
                                                    <div className="space-y-1 pl-3 border-l-2 border-zinc-300/30">
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
                        ) : null}

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
                                className="flex-1 px-4 py-2 rounded-xl bg-[#e11d48] text-white hover:bg-[#be123c] transition font-medium shadow-lg shadow-[#e11d48]/20"
                            >
                                确认删除
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 图片放大查看 Lightbox */}
            {lightboxIndex !== null && sortedImages.length > 0 && (
                <ImageLightbox
                    images={sortedImages}
                    currentIndex={lightboxIndex}
                    onClose={() => setLightboxIndex(null)}
                    onPrev={() => setLightboxIndex(Math.max(0, lightboxIndex - 1))}
                    onNext={() => setLightboxIndex(Math.min(sortedImages.length - 1, lightboxIndex + 1))}
                    getImageIndex={getImageIndex}
                />
            )}
        </>
    );
};
