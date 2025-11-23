import { useCallback, useEffect, useRef } from 'react';
import { useTimelineStore } from '@/lib/stores/timelineStore';

const CACHE_LIMIT = 30;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export function useFramePreview(): {
    previewFrameUrl: string | null;
    previewFramePrevUrl: string | null;
    previewFrameNextUrl: string | null;
    previewFrameTime: number | null;
    previewFramePrevTime: number | null;
    previewFrameNextTime: number | null;
    isFrameLoading: boolean;
    frameError: string | null;
    requestFrame: (time: number) => void;
    requestFrameTriplet: (time: number, delta?: number) => void;
    clearFrame: (time?: number) => void;
} {
    const cacheRef = useRef<Map<string, string>>(new Map());
    const inflightRef = useRef<Set<string>>(new Set());
    const latestRequestRef = useRef<number | null>(null);

    const sessionId = useTimelineStore((state) => state.sessionId);
    const setFramePreview = useTimelineStore((state) => state.setFramePreview);
    const previewFrameUrl = useTimelineStore((state) => state.previewFrameUrl);
    const previewFramePrevUrl = useTimelineStore((state) => state.previewFramePrevUrl);
    const previewFrameNextUrl = useTimelineStore((state) => state.previewFrameNextUrl);
    const isFrameLoading = useTimelineStore((state) => state.isFrameLoading);
    const frameError = useTimelineStore((state) => state.frameError);
    const previewFrameTime = useTimelineStore((state) => state.previewFrameTime);
    const previewFramePrevTime = useTimelineStore((state) => state.previewFramePrevTime);
    const previewFrameNextTime = useTimelineStore((state) => state.previewFrameNextTime);
    const durationSeconds = useTimelineStore((state) => state.durationSeconds);

    useEffect(() => {
        cacheRef.current.forEach((url) => URL.revokeObjectURL(url));
        cacheRef.current.clear();
        inflightRef.current.clear();
        setFramePreview({ url: null, isLoading: false, error: null, time: null });
    }, [sessionId, setFramePreview]);

    const fetchFrameBlob = useCallback(
        async (t: number) => {
            const resp = await fetch(`${API_BASE}/api/frame/${sessionId}?time=${t}`);
            if (!resp.ok) throw new Error(await resp.text());
            return await resp.blob();
        },
        [sessionId]
    );

    const requestFrame = useCallback(
        async (time: number) => {
            if (!sessionId) return;

            const clampedTime = (() => {
                if (durationSeconds && durationSeconds > 0) {
                    const margin = Math.max(1 / 30, 0.02);
                    return Math.max(0, Math.min(time, durationSeconds - margin));
                }
                return Math.max(0, time);
            })();

            const key = clampedTime.toFixed(3);
            latestRequestRef.current = clampedTime;

            if (cacheRef.current.has(key)) {
                const cached = cacheRef.current.get(key) ?? null;
                if (latestRequestRef.current === clampedTime) {
                    setFramePreview({ url: cached, isLoading: false, error: null, time: clampedTime });
                }
                return;
            }
            if (inflightRef.current.has(key)) {
                return;
            }

            inflightRef.current.add(key);
            setFramePreview({ url: previewFrameUrl, isLoading: true, error: null, time: clampedTime });
            try {
                const resp = await fetch(`${API_BASE}/api/frame/${sessionId}?time=${clampedTime}`);
                if (!resp.ok) {
                    throw new Error(await resp.text());
                }
                const blob = await resp.blob();
                const objectUrl = URL.createObjectURL(blob);
                cacheRef.current.set(key, objectUrl);

                if (cacheRef.current.size > CACHE_LIMIT) {
                    const oldestKey = cacheRef.current.keys().next().value as string | undefined;
                    if (oldestKey) {
                        const url = cacheRef.current.get(oldestKey);
                        if (url) URL.revokeObjectURL(url);
                        cacheRef.current.delete(oldestKey);
                    }
                }

                if (latestRequestRef.current === clampedTime) {
                    setFramePreview({ url: objectUrl, isLoading: false, error: null, time: clampedTime });
                } else {
                    URL.revokeObjectURL(objectUrl);
                }
            } catch (error) {
                console.error('fetch frame failed', error);
                if (latestRequestRef.current === clampedTime) {
                    setFramePreview({ url: previewFrameUrl, isLoading: false, error: '帧图获取失败', time: clampedTime });
                }
            } finally {
                inflightRef.current.delete(key);
            }
        },
        [sessionId, previewFrameUrl, setFramePreview, durationSeconds]
    );

    const requestFrameTriplet = useCallback(
        async (time: number, delta: number = 1 / 30) => {
            if (!sessionId) return;

            const clampWithMargin = (t: number) => {
                if (durationSeconds && durationSeconds > 0) {
                    const margin = Math.max(delta, 0.02);
                    return Math.max(0, Math.min(t, durationSeconds - margin));
                }
                return Math.max(0, t);
            };

            const center = clampWithMargin(time);
            const prev = clampWithMargin(center - delta);
            const next = clampWithMargin(center + delta);

            const keys = [center, prev, next].map((t) => t.toFixed(3));
            latestRequestRef.current = center;

            const getUrl = async (t: number, key: string) => {
                if (cacheRef.current.has(key)) {
                    return cacheRef.current.get(key) ?? null;
                }
                if (inflightRef.current.has(key)) return null;
                inflightRef.current.add(key);
                try {
                    const blob = await fetchFrameBlob(t);
                    const objectUrl = URL.createObjectURL(blob);
                    cacheRef.current.set(key, objectUrl);
                    if (cacheRef.current.size > CACHE_LIMIT) {
                        const oldestKey = cacheRef.current.keys().next().value as string | undefined;
                        if (oldestKey) {
                            const url = cacheRef.current.get(oldestKey);
                            if (url) URL.revokeObjectURL(url);
                            cacheRef.current.delete(oldestKey);
                        }
                    }
                    return objectUrl;
                } finally {
                    inflightRef.current.delete(key);
                }
            };

            setFramePreview({
                url: previewFrameUrl,
                prevUrl: previewFramePrevUrl,
                nextUrl: previewFrameNextUrl,
                isLoading: true,
                error: null,
                time: center,
                prevTime: prev,
                nextTime: next,
            });

            try {
                const [centerUrl, prevUrl, nextUrl] = await Promise.all([
                    getUrl(center, keys[0]),
                    getUrl(prev, keys[1]),
                    getUrl(next, keys[2]),
                ]);

                if (latestRequestRef.current === center) {
                    setFramePreview({
                        url: centerUrl ?? previewFrameUrl,
                        prevUrl: prevUrl ?? previewFramePrevUrl,
                        nextUrl: nextUrl ?? previewFrameNextUrl,
                        isLoading: false,
                        error: null,
                        time: center,
                        prevTime: prev,
                        nextTime: next,
                    });
                } else {
                    [centerUrl, prevUrl, nextUrl].forEach((u) => {
                        if (u && !cacheRef.current.has(u)) URL.revokeObjectURL(u);
                    });
                }
            } catch (error) {
                console.error('fetch frame triplet failed', error);
                if (latestRequestRef.current === center) {
                    setFramePreview({
                        url: previewFrameUrl,
                        prevUrl: previewFramePrevUrl,
                        nextUrl: previewFrameNextUrl,
                        isLoading: false,
                        error: '帧图获取失败',
                        time: center,
                        prevTime: prev,
                        nextTime: next,
                    });
                }
            }
        },
        [cacheRef, inflightRef, previewFrameUrl, previewFramePrevUrl, previewFrameNextUrl, setFramePreview, durationSeconds, sessionId, fetchFrameBlob, previewFrameTime]
    );

    const clearFrame = useCallback(
        (time?: number) => {
            const current = previewFrameTime;
            if (time != null && current != null && Math.abs(current - time) > 1e-3) {
                return;
            }
            setFramePreview({
                url: null,
                prevUrl: null,
                nextUrl: null,
                isLoading: false,
                error: null,
                time: null,
                prevTime: null,
                nextTime: null,
            });
        },
        [setFramePreview, previewFrameTime]
    );

    return {
        previewFrameUrl,
        previewFramePrevUrl,
        previewFrameNextUrl,
        previewFrameTime,
        previewFramePrevTime,
        previewFrameNextTime,
        isFrameLoading,
        frameError,
        requestFrame,
        requestFrameTriplet,
        clearFrame,
    };
}
