import { create } from 'zustand';

export const PLAYBACK_RATES = [1, 0.5, 0.25] as const;
const CUT_POINT_EPSILON = 1e-3;

const clampTime = (value: number, duration: number | null): number => {
    if (duration && duration > 0) {
        return Math.min(Math.max(value, 0), duration);
    }
    return Math.max(value, 0);
};

const normalizeCutPoints = (values: number[]): number[] => {
    const sorted = values
        .filter((value) => Number.isFinite(value))
        .map((value) => Number(value))
        .sort((a, b) => a - b);

    if (sorted.length === 0) {
        return [];
    }

    const unique: number[] = [sorted[0]];
    for (let index = 1; index < sorted.length; index += 1) {
        const current = sorted[index];
        const last = unique[unique.length - 1];
        if (Math.abs(current - last) >= CUT_POINT_EPSILON) {
            unique.push(current);
        }
    }
    return unique;
};

export interface TimelineState {
    videoUrl: string | null;
    videoFileName: string | null;
    sessionId: string | null;
    transcodeStatus: 'pending' | 'ready' | 'error' | string | null;
    durationSeconds: number | null;
    cutPoints: number[];
    manualCutPoints: number[];
    hiddenSegments: number[];
    selectedCutPoint: number | null;
    playheadSeconds: number;
    playbackRateIndex: number;
    isPlaying: boolean;
    sourceVideoFileHash: string | null;
    previewFrameUrl: string | null;
    previewFramePrevUrl: string | null;
    previewFrameNextUrl: string | null;
    isFrameLoading: boolean;
    frameError: string | null;
    previewFrameTime: number | null;
    previewFramePrevTime: number | null;
    previewFrameNextTime: number | null;

    loadVideo: (payload: {
        videoUrl: string | null;
        fileName: string;
        cutPoints: number[];
        durationSeconds: number | null;
        hiddenSegments?: number[];
        sessionId?: string | null;
        transcodeStatus?: 'pending' | 'ready' | 'error' | string | null;
        sourceVideoFileHash?: string | null;
    }) => void;
    updateTranscodeStatus: (status: 'pending' | 'ready' | 'error' | string | null) => void;
    setFramePreview: (payload: {
        url: string | null;
        isLoading?: boolean;
        error?: string | null;
        time?: number | null;
        prevUrl?: string | null;
        nextUrl?: string | null;
        prevTime?: number | null;
        nextTime?: number | null;
    }) => void;
    resetVideo: () => void;
    setDuration: (seconds: number) => void;
    setPlayhead: (seconds: number) => void;
    setPlaying: (playing: boolean) => void;
    addManualCutPoint: (time: number) => void;
    removeCutPoint: (time: number) => void;
    toggleHideSegmentAtCut: (cutTime: number) => void;
    setSelectedCutPoint: (time: number | null) => void;
    cyclePlaybackRate: () => number;
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
    videoUrl: null,
    videoFileName: null,
    sessionId: null,
    transcodeStatus: null,
    durationSeconds: null,
    cutPoints: [],
    manualCutPoints: [],
    hiddenSegments: [],
    selectedCutPoint: null,
    playheadSeconds: 0,
    playbackRateIndex: 0,
    isPlaying: false,
    sourceVideoFileHash: null,
    previewFrameUrl: null,
    previewFramePrevUrl: null,
    previewFrameNextUrl: null,
    isFrameLoading: false,
    frameError: null,
    previewFrameTime: null,
    previewFramePrevTime: null,
    previewFrameNextTime: null,

    loadVideo: ({
        videoUrl,
        fileName,
        cutPoints,
        durationSeconds,
        hiddenSegments: hidden = [],
        sessionId = null,
        transcodeStatus = null,
        sourceVideoFileHash = null,
    }) => {
        const normalizedCuts = normalizeCutPoints(cutPoints);
        const availableKeys = new Set(normalizedCuts.map((value) => value.toFixed(3)));
        const normalizedHidden = normalizeCutPoints(hidden).filter((value) =>
            availableKeys.has(value.toFixed(3))
        );
        set({
            videoUrl,
            videoFileName: fileName,
            sessionId,
            transcodeStatus,
            cutPoints: normalizedCuts,
            manualCutPoints: [],
            hiddenSegments: normalizedHidden,
            selectedCutPoint: null,
            durationSeconds,
            playheadSeconds: 0,
            playbackRateIndex: 0,
            isPlaying: false,
            sourceVideoFileHash,
            previewFrameUrl: null,
            previewFramePrevUrl: null,
            previewFrameNextUrl: null,
            isFrameLoading: false,
            frameError: null,
            previewFrameTime: null,
            previewFramePrevTime: null,
            previewFrameNextTime: null,
        });
    },

    resetVideo: () =>
        set({
            videoUrl: null,
            videoFileName: null,
            sessionId: null,
            transcodeStatus: null,
            durationSeconds: null,
            cutPoints: [],
            manualCutPoints: [],
            hiddenSegments: [],
            sourceVideoFileHash: null,
            selectedCutPoint: null,
            playheadSeconds: 0,
            playbackRateIndex: 0,
            isPlaying: false,
            previewFrameUrl: null,
            previewFramePrevUrl: null,
            previewFrameNextUrl: null,
            isFrameLoading: false,
            frameError: null,
            previewFrameTime: null,
            previewFramePrevTime: null,
            previewFrameNextTime: null,
        }),

    setDuration: (seconds: number) => set({ durationSeconds: seconds }),
    setPlayhead: (seconds: number) => set({ playheadSeconds: seconds }),
    setPlaying: (playing: boolean) => set({ isPlaying: playing }),

    addManualCutPoint: (time: number) => {
        const { durationSeconds, cutPoints, manualCutPoints } = get();
        const clamped = clampTime(time, durationSeconds);
        const rounded = Number(clamped.toFixed(3));

        if (cutPoints.some((value) => Math.abs(value - rounded) < CUT_POINT_EPSILON)) {
            return;
        }

        const nextManual = normalizeCutPoints([...manualCutPoints, rounded]);
        const nextAll = normalizeCutPoints([...cutPoints, rounded]);

        set({
            manualCutPoints: nextManual,
            cutPoints: nextAll,
            selectedCutPoint: rounded,
        });
    },

    removeCutPoint: (time: number) => {
        const { durationSeconds, cutPoints, manualCutPoints, hiddenSegments } = get();
        const rounded = Number(clampTime(time, durationSeconds).toFixed(3));
        const start = 0.0;
        const end = typeof durationSeconds === 'number' && durationSeconds > 0
            ? Number(durationSeconds.toFixed(3))
            : null;

        // Guard: do not remove boundary
        if (Math.abs(rounded - start) < CUT_POINT_EPSILON || (end != null && Math.abs(rounded - end) < CUT_POINT_EPSILON)) {
            return;
        }

        const nextAll = cutPoints.filter((v) => Math.abs(v - rounded) >= CUT_POINT_EPSILON);
        const nextManual = manualCutPoints.filter((v) => Math.abs(v - rounded) >= CUT_POINT_EPSILON);
        const nextHidden = hiddenSegments.filter((v) => Math.abs(v - rounded) >= CUT_POINT_EPSILON);
        set({ cutPoints: nextAll, manualCutPoints: nextManual, hiddenSegments: nextHidden, selectedCutPoint: null });
    },

    toggleHideSegmentAtCut: (cutTime: number) => {
        const { durationSeconds, cutPoints, hiddenSegments } = get();
        const rounded = Number(clampTime(cutTime, durationSeconds).toFixed(3));

        // Find cut index, last cut has no following segment
        const idx = cutPoints.findIndex((v) => Math.abs(v - rounded) < CUT_POINT_EPSILON);
        if (idx === -1 || idx === cutPoints.length - 1) {
            return;
        }

        const exists = hiddenSegments.some((v) => Math.abs(v - rounded) < CUT_POINT_EPSILON);
        const next = exists
            ? hiddenSegments.filter((v) => Math.abs(v - rounded) >= CUT_POINT_EPSILON)
            : normalizeCutPoints([...hiddenSegments, rounded]);
        set({ hiddenSegments: next });
    },

    setSelectedCutPoint: (time: number | null) => set({ selectedCutPoint: time }),
    updateTranscodeStatus: (status) => set({ transcodeStatus: status }),
    setFramePreview: ({ url, isLoading = false, error = null, time = null, prevUrl = null, nextUrl = null, prevTime = null, nextTime = null }) =>
        set(() => ({
            previewFrameUrl: url,
            previewFramePrevUrl: prevUrl,
            previewFrameNextUrl: nextUrl,
            isFrameLoading: isLoading,
            frameError: error,
            previewFrameTime: time,
            previewFramePrevTime: prevTime,
            previewFrameNextTime: nextTime,
        })),

    cyclePlaybackRate: () => {
        const { playbackRateIndex } = get();
        const nextIndex = (playbackRateIndex + 1) % PLAYBACK_RATES.length;
        set({ playbackRateIndex: nextIndex });
        return PLAYBACK_RATES[nextIndex];
    },
}));

export const selectPlaybackRate = (state: TimelineState) =>
    PLAYBACK_RATES[state.playbackRateIndex];
