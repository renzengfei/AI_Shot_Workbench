import { create } from 'zustand';
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export type WorkflowStep = 1 | 2 | 3;

export interface Shot {
    id: string;
    timeRange: { start: number; end: number };
    description: string;
    visuals: string;
    audio: string;
    duration: number;
    // Step 5 Data
    viralTags: string[];
    densityScore: number;
    // Step 6 Data
    imagePrompt: string;
    // Step 7 Data
    videoPrompt: string;
    selectedAsset: string | null;
}

export interface Project {
    id: string;
    name: string;
    videoUrl: string | null;
    sourceUrl?: string | null;
    currentStep: WorkflowStep;
    lastModified: Date;

    // Step 1 & 2: Segmentation
    cuts: number[];

    // Step 3: Deconstruction
    deconstructionText: string;

    // Step 4: Production Config
    productionConfig: {
        tailDensityEnabled: boolean;
        tailDensityDuration: number;
        viralTemplate: string;
    };

    // Step 4-8: Shot List
    shots: Shot[];
}

interface WorkflowState {
    project: Project | null;

    // Project management
    createProject: (name: string, videoUrl: string, sourceUrl?: string | null) => void;
    setProject: (project: Project) => void;
    resetProject: () => void;

    // Step navigation
    goToStep: (step: WorkflowStep) => void;
    nextStep: () => void;
    prevStep: () => void;

    // Actions
    updateCuts: (cuts: number[]) => void;
    updateDeconstruction: (text: string) => void;
    setShots: (shots: Shot[]) => void;
    updateShot: (id: string, data: Partial<Shot>) => void;
    updateProductionConfig: (config: Partial<Project['productionConfig']>) => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
    project: null,

    createProject: (name, videoUrl, sourceUrl = null) => {
        const newProject: Project = {
            id: Date.now().toString(),
            name,
            videoUrl,
            sourceUrl,
            currentStep: 1,
            lastModified: new Date(),
            cuts: [],
            deconstructionText: '',
            productionConfig: {
                tailDensityEnabled: false,
                tailDensityDuration: 0,
                viralTemplate: 'default',
            },
            shots: [],
        };
        set({ project: newProject });
    },

    setProject: (project) => set({ project }),
    resetProject: () => set({ project: null }),

    goToStep: (step) => {
        const { project } = get();
        if (project) {
            set({ project: { ...project, currentStep: step } });
            persistStep(project.id, step).catch(() => { });
        }
    },

    nextStep: () => {
        const { project } = get();
        if (project && project.currentStep < 3) {
            const next = (project.currentStep + 1) as WorkflowStep;
            set({ project: { ...project, currentStep: next } });
            persistStep(project.id, next).catch(() => { });
        }
    },

    prevStep: () => {
        const { project } = get();
        if (project && project.currentStep > 1) {
            const prev = (project.currentStep - 1) as WorkflowStep;
            set({ project: { ...project, currentStep: prev } });
            persistStep(project.id, prev).catch(() => { });
        }
    },

    updateCuts: (cuts) => {
        const { project } = get();
        if (project) {
            set({ project: { ...project, cuts } });
        }
    },

    updateDeconstruction: (text) => {
        const { project } = get();
        if (project) {
            set({ project: { ...project, deconstructionText: text } });
        }
    },

    setShots: (shots) => {
        const { project } = get();
        if (project) {
            set({ project: { ...project, shots } });
        }
    },

    updateShot: (id, data) => {
        const { project } = get();
        if (project) {
            const updatedShots = project.shots.map(shot =>
                shot.id === id ? { ...shot, ...data } : shot
            );
            set({ project: { ...project, shots: updatedShots } });
        }
    },

    updateProductionConfig: (config) => {
        const { project } = get();
        if (project) {
            set({
                project: {
                    ...project,
                    productionConfig: { ...project.productionConfig, ...config },
                },
            });
        }
    },
}));

async function persistStep(workspacePath: string, step: WorkflowStep) {
    try {
        const encodedPath = encodeURIComponent(workspacePath);
        await fetch(`${API_BASE}/api/workspaces/${encodedPath}/step`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ step }),
        });
    } catch {
        // Best-effort; ignore errors to avoid blocking UI
    }
}
