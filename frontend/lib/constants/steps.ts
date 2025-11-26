import { WorkflowStep } from '@/lib/stores/workflowStore';

export const STEP_ROUTES: Record<WorkflowStep, string> = {
    1: '/segmentation',
    2: '/deconstruction/ai',
    3: '/deconstruction/manual', // 人工改写
    4: '/deconstruction/manual', // deprecated: 原剧本重构
    5: '/deconstruction/manual', // deprecated
    6: '/image-prompts',
    7: '/image-gen',
    8: '/video-gen',
    9: '/export',
};

export function stepToPath(step: WorkflowStep): string {
    return STEP_ROUTES[step];
}

export function pathToStep(pathname: string): WorkflowStep | null {
    const match = Object.entries(STEP_ROUTES).find(([, path]) => pathname.startsWith(path));
    if (!match) return null;
    return Number(match[0]) as WorkflowStep;
}
