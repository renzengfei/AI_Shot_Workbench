'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useWorkflowStore, Shot } from '@/lib/stores/workflowStore';
import { useTimelineStore } from '@/lib/stores/timelineStore';
import { http, API_BASE } from '@/lib/services/http';

interface WorkspaceContextType {
    currentWorkspace: Workspace | null;
    workspaces: Workspace[];
    createWorkspace: (name: string) => Promise<void>;
    openWorkspace: (path: string) => Promise<void>;
    closeWorkspace: () => void;
    refreshWorkspaces: () => Promise<void>;
    saveSegmentation: (payload: SaveSegmentationPayload) => Promise<void>;
    saveDeconstruction: (content: string) => Promise<void>;
    saveShots: (shots: Shot[]) => Promise<void>;
    generateAssets: (payload: GenerateAssetsPayload) => Promise<unknown>;
}

interface Workspace {
    name: string;
    path: string;
    updated_at?: string;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export interface SaveSegmentationPayload {
    cuts: number[];
    video_url?: string | null;
    file_name?: string | null;
    duration?: number | null;
    session_id?: string | null;
    edit_video_url?: string | null;
    source_url?: string | null;
    hidden_segments?: number[];
}

export interface GenerateAssetsPayload {
    cuts: number[];
    duration: number;
    session_id?: string | null;
    file_name?: string | null;
    include_video?: boolean;
    hidden_segments?: number[];
}

const LAST_WORKSPACE_KEY = 'ai-shot-last-workspace';
const RECENT_WORKSPACES_KEY = 'ai-shot-recent-workspaces';

interface WorkspaceApiResponse {
    data: {
        name: string;
        current_step?: number;
        updated_at?: string;
    };
    path: string;
}

interface SegmentationResponse {
    cuts?: number[];
    video_url?: string | null;
    edit_video_url?: string | null;
    file_name?: string | null;
    duration?: number | null;
    session_id?: string | null;
    source_url?: string | null;
    hidden_segments?: number[];
}

interface DeconstructionResponse {
    content?: string;
}

interface ShotsResponse {
    shots?: Shot[];
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
    const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const { setProject } = useWorkflowStore();
    const { loadVideo, resetVideo } = useTimelineStore();

    const mergeWorkspaces = (primary: Workspace[], secondary: Workspace[]) => {
        const map = new Map<string, Workspace>();
        [...primary, ...secondary].forEach((ws) => {
            if (!ws?.path) return;
            const existing = map.get(ws.path);
            if (!existing) {
                map.set(ws.path, ws);
            } else if (!existing.updated_at && ws.updated_at) {
                map.set(ws.path, ws);
            }
        });
        return Array.from(map.values()).sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
    };

    const loadStoredRecents = () => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem(RECENT_WORKSPACES_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw) as Workspace[];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    };

    const persistRecents = (list: Workspace[]) => {
        if (typeof window === 'undefined') return;
        try {
            localStorage.setItem(RECENT_WORKSPACES_KEY, JSON.stringify(list.slice(0, 20)));
        } catch {
            // ignore
        }
    };

    const updateRecents = (ws: Workspace) => {
        const nowIso = new Date().toISOString();
        const next: Workspace = { ...ws, updated_at: ws.updated_at || nowIso };
        setWorkspaces((prev) => {
            const merged = mergeWorkspaces([next], prev);
            persistRecents(merged);
            return merged;
        });
    };

    useEffect(() => {
        refreshWorkspaces();
        // Auto-open last workspace if available
        const lastPath = typeof window !== 'undefined' ? localStorage.getItem(LAST_WORKSPACE_KEY) : null;
        if (lastPath) {
            openWorkspace(lastPath).catch((error) => {
                console.error('Auto-open workspace failed:', error);
                if (typeof window !== 'undefined') {
                    localStorage.removeItem(LAST_WORKSPACE_KEY);
                }
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Connect to WebSocket when workspace is active
    useEffect(() => {
        if (!currentWorkspace) return;

        const ws = new WebSocket(`${API_BASE.replace('http', 'ws')}/ws`);

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'file_change') {
                console.log('File changed:', data.file);
                // TODO: Trigger specific store updates based on file type
                if (data.file === 'project.json') {
                    // Reload project data
                }
            }
        };

        return () => {
            ws.close();
        };
    }, [currentWorkspace]);

    const refreshWorkspaces = async () => {
        try {
            const data = await http.get<Workspace[]>('/api/workspaces');
            const serverList = Array.isArray(data) ? data : [];
            setWorkspaces(serverList);
            persistRecents(serverList);
        } catch (error) {
            console.error('Failed to fetch workspaces:', error);
            // keep previous state on error; optionally use cached list
            const cached = loadStoredRecents();
            if (cached.length > 0) setWorkspaces(cached);
        }
    };

    const createWorkspace = async (name: string) => {
        try {
            const data = await http.post<WorkspaceApiResponse>('/api/workspaces', { name });
            setCurrentWorkspace({ name: data.data.name, path: data.path });
            if (typeof window !== 'undefined') {
                localStorage.setItem(LAST_WORKSPACE_KEY, data.path);
            }
            await refreshWorkspaces();

            // Initialize workflow store
            setProject({
                id: data.path,
                name: data.data.name,
                currentStep: 1,
                lastModified: new Date(),
                videoUrl: '',
                cuts: [],
                deconstructionText: '',
                shots: []
            });
            updateRecents({ name: data.data.name, path: data.path, updated_at: data.data.updated_at });
            resetVideo();
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const openWorkspace = async (path: string) => {
        try {
            const data = await http.post<WorkspaceApiResponse>('/api/workspaces/open', { path });
            setCurrentWorkspace({ name: data.data.name, path: data.path });
            if (typeof window !== 'undefined') {
                localStorage.setItem(LAST_WORKSPACE_KEY, data.path);
            }
            updateRecents({ name: data.data.name, path: data.path, updated_at: data.data.updated_at });

            // Load persisted files
            const [segData, deconData, shotsData] = await Promise.all([
                http.get<SegmentationResponse>(`/api/workspaces/${encodeURIComponent(data.path)}/segmentation`).catch(() => ({})),
                http.get<DeconstructionResponse>(`/api/workspaces/${encodeURIComponent(data.path)}/deconstruction`).catch(() => ({ content: '' })),
                http.get<ShotsResponse>(`/api/workspaces/${encodeURIComponent(data.path)}/shots`).catch(() => ({})),
            ]);

            const cuts = Array.isArray(segData.cuts) ? segData.cuts : [];
            const hiddenSegments = Array.isArray(segData.hidden_segments) ? segData.hidden_segments : [];
            // 优先用原始（带音频）视频，edit_video_url 只用于帧抓取
            const playbackUrl = segData.video_url || segData.edit_video_url || '';
            const fileName = segData.file_name || (playbackUrl ? playbackUrl.split('/').pop() : '') || '';
            const duration = segData.duration ?? null;
            const sessionId = segData.session_id ?? null;
            const sourceUrl = segData.source_url ?? null;

            // Update workflow store
            setProject({
                id: data.path,
                name: data.data.name,
                currentStep: data.data.current_step || 1,
                lastModified: new Date(data.data.updated_at),
                videoUrl: playbackUrl,
                sourceUrl,
                cuts,
                deconstructionText: deconData.content || '',
                shots: Array.isArray(shotsData.shots) ? shotsData.shots : [],
            });

            // Sync timeline store
            if (playbackUrl) {
                loadVideo({
                    videoUrl: playbackUrl,
                    fileName,
                    cutPoints: cuts,
                    hiddenSegments,
                    durationSeconds: duration,
                    sessionId,
                });
            } else {
                resetVideo();
            }
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    const closeWorkspace = () => {
        setCurrentWorkspace(null);
        useWorkflowStore.getState().resetProject();
        resetVideo();
        if (typeof window !== 'undefined') {
            localStorage.removeItem(LAST_WORKSPACE_KEY);
        }
    };

    const saveSegmentation = async (payload: SaveSegmentationPayload) => {
        if (!currentWorkspace) return;
        try {
            await http.post(`/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/segmentation`, payload);
        } catch (error) {
            console.error('Failed to save segmentation:', error);
        }
    };

    const generateAssets = async (payload: GenerateAssetsPayload) => {
        if (!currentWorkspace) return;
        const body = { include_video: true, ...payload };
        return http.post(`/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/generate-assets`, body);
    };

    const saveDeconstruction = async (content: string) => {
        if (!currentWorkspace) return;
        try {
            await http.post(`/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/deconstruction`, { content });
        } catch (error) {
            console.error('Failed to save deconstruction:', error);
        }
    };

    const saveShots = async (shots: Shot[]) => {
        if (!currentWorkspace) return;
        try {
            await http.post(`/api/workspaces/${encodeURIComponent(currentWorkspace.path)}/shots`, { shots });
        } catch (error) {
            console.error('Failed to save shots:', error);
        }
    };

    return (
        <WorkspaceContext.Provider value={{
            currentWorkspace,
            workspaces,
            createWorkspace,
            openWorkspace,
            closeWorkspace,
            refreshWorkspaces,
            saveSegmentation,
            saveDeconstruction,
            saveShots,
            generateAssets
        }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const context = useContext(WorkspaceContext);
    if (context === undefined) {
        throw new Error('useWorkspace must be used within a WorkspaceProvider');
    }
    return context;
}
