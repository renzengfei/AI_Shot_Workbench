'use client';

import '@/styles/liquid-glass.css';
import { useState } from 'react';
import { Upload, Link, ArrowRight } from 'lucide-react';
import { useTimelineStore } from '@/lib/stores/timelineStore';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
import Timeline from '@/components/Timeline';
import VideoPlayer from '@/components/VideoPlayer';
import PlaybackControls from '@/components/PlaybackControls';
import StatusBar from '@/components/StatusBar';
import { useWorkspace, type GenerateAssetsPayload } from '@/components/WorkspaceContext';
import FramePreview from '@/components/FramePreview';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';
const USE_EDIT_VIDEO = false; // 如果希望强制使用带音频的原始文件，则保持 false

export default function Step1_Segmentation() {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [isConfirming, setIsConfirming] = useState(false);

    const { videoUrl, cutPoints, hiddenSegments, loadVideo, setPlayhead, setPlaying } = useTimelineStore();
    const { project, createProject, updateCuts, setProject } = useWorkflowStore();
    const { nextStep } = useStepNavigator();
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE}/api/analyze`, {
                method: 'POST',
                body: formData,
            });
            const data: { video_path: string; edit_video_url?: string; cuts: { time: number }[]; duration: number; session_id?: string } = await response.json();

            const serverFileName = data.video_path.split('/').pop() || file.name;
            const encodedFileName = encodeURIComponent(serverFileName);
            const originalUrl = `${API_BASE}/uploads/${encodedFileName}`;
            const editVideoUrl = data.edit_video_url ? `${API_BASE}${data.edit_video_url}` : originalUrl;
            const playbackUrl = USE_EDIT_VIDEO ? editVideoUrl : originalUrl;

            if (!project) {
                createProject(serverFileName, playbackUrl);
            } else {
                setProject({ ...project, sourceUrl: project.sourceUrl ?? null });
            }

            loadVideo({
                videoUrl: playbackUrl,
                fileName: serverFileName,
                cutPoints: data.cuts.map((c) => c.time),
                durationSeconds: data.duration,
                sessionId: data.session_id ?? null,
            });

            updateCuts(data.cuts.map((c) => c.time));
            await saveSegmentation({
                cuts: data.cuts.map((c) => c.time),
                video_url: playbackUrl,
                file_name: serverFileName,
                duration: data.duration,
                session_id: data.session_id ?? null,
                edit_video_url: editVideoUrl,
            });
        } catch (error) {
            console.error('Analysis failed:', error);
            alert('分析失败,请检查后端服务');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleYouTubeDownload = async () => {
        if (!youtubeUrl.trim()) {
            alert('❌ 请输入 YouTube 链接');
            return;
        }

        setIsAnalyzing(true);
        try {
            const response = await fetch(`${API_BASE}/api/download-youtube`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: youtubeUrl }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Download failed');
            }

            const data: {
                video_path: string;
                edit_video_url?: string;
                cuts: { time: number }[];
                duration: number;
                session_id?: string;
            } = await response.json();
            const videoPath = data.video_path;
            const fileName = videoPath.split('/').pop() || 'video.mp4';
            const encodedFileName = encodeURIComponent(fileName);
            const originalUrl = `${API_BASE}/uploads/${encodedFileName}`;
            const editVideoUrl = data.edit_video_url ? `${API_BASE}${data.edit_video_url}` : originalUrl;
            const playbackUrl = USE_EDIT_VIDEO ? editVideoUrl : originalUrl;

            if (!project) {
                createProject(fileName, playbackUrl, youtubeUrl);
            } else {
                setProject({ ...project, sourceUrl: youtubeUrl });
            }
            if (typeof window !== 'undefined') {
                localStorage.setItem('ai-shot-last-source-url', youtubeUrl);
            }

            loadVideo({
                videoUrl: playbackUrl,
                fileName: fileName,
                cutPoints: data.cuts.map((c) => c.time),
                durationSeconds: data.duration,
                sessionId: data.session_id ?? null,
            });

            updateCuts(data.cuts.map((c) => c.time));
            await saveSegmentation({
                cuts: data.cuts.map((c) => c.time),
                video_url: playbackUrl,
                file_name: fileName,
                duration: data.duration,
                session_id: data.session_id ?? null,
                edit_video_url: editVideoUrl,
                source_url: youtubeUrl,
            });
            setYoutubeUrl('');
        } catch (error: unknown) {
            console.error('YouTube download failed:', error);
            const message = error instanceof Error ? error.message : 'Download failed';
            alert(`❌ 下载失败: ${message}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSeek = (seconds: number) => {
        setPlayhead(seconds);
        setPlaying(false);
    };

    const { saveSegmentation, generateAssets, currentWorkspace } = useWorkspace();

    const handleConfirmSegmentation = async () => {
        const { cutPoints, videoUrl, videoFileName, durationSeconds, sessionId } = useTimelineStore.getState();
        if (!cutPoints.length) return;
        setIsConfirming(true);

        try {
            // Persist segmentation with metadata
            await saveSegmentation({
                cuts: cutPoints,
                video_url: videoUrl,
                file_name: videoFileName,
                duration: durationSeconds,
                session_id: sessionId,
                edit_video_url: videoUrl, // videoUrl 已是可播放地址（优先 edit 视频）
                source_url: project?.sourceUrl ?? (project?.videoUrl ?? null),
                hidden_segments: hiddenSegments,
            });

            // Move to next step immediately
            nextStep();

            // Fire-and-forget asset generation
            if (currentWorkspace && durationSeconds && videoFileName) {
                const hiddenSet = new Set(hiddenSegments.map((v) => v.toFixed(3)));
                const visibleCuts = cutPoints.filter((c) => !hiddenSet.has(c.toFixed(3)));
                // Ensure at least start/end kept
                const finalCuts = visibleCuts.length >= 2 ? visibleCuts : cutPoints;
                const payload: GenerateAssetsPayload = {
                    cuts: finalCuts,
                    duration: durationSeconds,
                    session_id: sessionId ?? undefined,
                    file_name: videoFileName ?? undefined,
                    include_video: true,
                    hidden_segments: hiddenSegments,
                };
                generateAssets(payload).catch((err) => {
                    console.error('生成资产失败', err);
                });
            }
        } finally {
            setIsConfirming(false);
        }
    };



    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="lg-card p-4 flex items-center justify-between border-b-4 border-b-blue-500/20">
                <div className="space-y-1">
                    <h2 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
                        原片切分
                    </h2>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                        上传视频，AI 将自动为你完成分镜拆解
                    </p>
                </div>
                {videoUrl && (
                    <button
                        onClick={handleConfirmSegmentation}
                        disabled={cutPoints.length === 0 || isConfirming}
                        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 text-white text-sm font-medium shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {isConfirming ? '处理中...' : '下一步：AI 原片拆解'}
                        <ArrowRight size={16} />
                    </button>
                )}
            </div>

            {/* Upload Section */}
            {!videoUrl && (
                <div className="max-w-4xl mx-auto">
                    {/* Upload Video Card */}
                    <div className="lg-card p-10 border border-[var(--glass-border)] shadow-2xl bg-gradient-to-b from-[var(--glass-bg-light)] to-[var(--glass-bg-dark)]">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-3">
                                开始你的创作
                            </h2>
                            <p className="text-[var(--color-text-secondary)] text-lg">
                                上传视频，AI 将自动为你完成分镜拆解
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Local Upload */}
                            <label className="group relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <div className="relative bg-[var(--glass-bg-light)] border border-[var(--glass-border)] rounded-2xl h-full flex flex-col items-center justify-center gap-6 p-8 transition-colors group-hover:border-blue-500/30">
                                    <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-blue-500/10">
                                        <Upload size={36} />
                                    </div>
                                    <div className="text-center space-y-2">
                                        <span className="block font-bold text-xl text-[var(--color-text-primary)]">本地上传</span>
                                        <span className="text-sm text-[var(--color-text-tertiary)]">支持 MP4, MOV (Max 500MB)</span>
                                    </div>
                                </div>
                                <input
                                    type="file"
                                    accept="video/*"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                />
                            </label>

                            {/* YouTube Upload */}
                            <div className="flex flex-col gap-4">
                                <div className="relative group flex-1">
                                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 rounded-2xl" />
                                    <div className="relative bg-[var(--glass-bg-light)] border border-[var(--glass-border)] rounded-2xl h-full p-6 flex flex-col justify-between group-hover:border-red-500/30 transition-colors">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3 text-[var(--color-text-primary)]">
                                                <div className="p-2 rounded-lg bg-red-500/10 text-red-500">
                                                    <Link size={20} />
                                                </div>
                                                <span className="font-bold text-lg">YouTube 链接</span>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="粘贴视频链接..."
                                                value={youtubeUrl}
                                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleYouTubeDownload()}
                                                className="w-full bg-[var(--color-bg-secondary)]/50 border border-[var(--glass-border)] rounded-xl px-4 py-3 outline-none focus:border-red-500/50 focus:ring-2 focus:ring-red-500/20 transition-all placeholder:text-[var(--color-text-tertiary)] text-[var(--color-text-primary)]"
                                            />
                                        </div>
                                        <button
                                            onClick={handleYouTubeDownload}
                                            disabled={isAnalyzing || !youtubeUrl.trim()}
                                            className={`w-full mt-4 py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2
                                                ${isAnalyzing || !youtubeUrl.trim()
                                                    ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-tertiary)] cursor-not-allowed'
                                                    : 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-lg shadow-red-500/20 hover:shadow-red-500/30 active:scale-[0.98]'
                                                }`}
                                        >
                                            {isAnalyzing ? (
                                                <>
                                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                    <span>解析中...</span>
                                                </>
                                            ) : (
                                                <span>开始下载</span>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Video Editing Section */}
            {videoUrl && (
                <>
                    <StatusBar />

                    <div className="grid lg:grid-cols-12 gap-6 items-start">
                        {/* Left: Video (5/12) */}
                        <div className="lg:col-span-5 w-full sticky top-6">
                            <div className="lg-card p-0 overflow-hidden border border-[var(--glass-border)] shadow-2xl rounded-2xl bg-black">
                                <VideoPlayer videoUrl={videoUrl} />
                            </div>

                            {/* Instructions Alert */}
                            <div className="mt-4 lg-card p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                <div className="flex items-start gap-3">
                                    <div className="p-1.5 bg-blue-500/10 rounded-full text-blue-400 mt-0.5">
                                        <div className="w-1.5 h-1.5 bg-current rounded-full" />
                                    </div>
                                    <div className="space-y-2 text-sm text-[var(--color-text-secondary)]">
                                        <p className="font-medium text-[var(--color-text-primary)]">检查建议：</p>
                                        <ol className="list-decimal list-inside space-y-1 text-[var(--color-text-tertiary)] ml-1">
                                            <li>点击播放，确认每个片段是一个完整的分镜</li>
                                            <li>自动暂停时，对比前后帧确认切点准确</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right: Controls + Timeline (7/12) */}
                        <div className="lg:col-span-7 space-y-6">
                            {/* Frame Preview */}
                            <div className="lg-card p-4 border border-[var(--glass-border)]">
                                <FramePreview />
                            </div>

                            {/* Timeline */}
                            <div className="lg-card p-6 border border-[var(--glass-border)]">
                                <div className="flex items-center justify-between mb-6">
                                    <h2 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                                        <div className="w-1 h-5 bg-blue-500 rounded-full" />
                                        时间轴编辑
                                    </h2>
                                    {isAnalyzing && (
                                        <span className="text-xs text-blue-400 flex items-center gap-1.5 bg-blue-500/10 px-2 py-1 rounded-full">
                                            <div className="w-2 h-2 bg-current rounded-full animate-ping" />
                                            AI 分析中...
                                        </span>
                                    )}
                                </div>

                                {isAnalyzing ? (
                                    <div className="h-32 flex flex-col items-center justify-center gap-3 text-[var(--color-text-tertiary)]">
                                        <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                                        <span className="text-sm">正在分析视频结构...</span>
                                    </div>
                                ) : (
                                    <Timeline onSeek={handleSeek} />
                                )}
                            </div>

                            {/* Controls */}
                            <div className="lg-card p-4 border border-[var(--glass-border)]">
                                <PlaybackControls />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
