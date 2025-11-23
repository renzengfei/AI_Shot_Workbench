'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';
import { stepToPath } from '@/lib/constants/steps';

export function useStepNavigator() {
    const router = useRouter();
    const { project, goToStep } = useWorkflowStore();

    const navigateToStep = useCallback(
        (step: WorkflowStep) => {
            goToStep(step);
            const path = stepToPath(step);
            if (path) {
                router.push(path);
            }
        },
        [goToStep, router],
    );

    const nextStep = useCallback(() => {
        const current = project?.currentStep ?? 1;
        const next = Math.min((current + 1) as WorkflowStep, 9 as WorkflowStep);
        navigateToStep(next);
    }, [navigateToStep, project?.currentStep]);

    const prevStep = useCallback(() => {
        const current = project?.currentStep ?? 1;
        const prev = Math.max((current - 1) as WorkflowStep, 1 as WorkflowStep);
        navigateToStep(prev);
    }, [navigateToStep, project?.currentStep]);

    return { navigateToStep, nextStep, prevStep, stepToPath };
}
