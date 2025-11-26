'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function DeconstructionReviewPage() {
    const { project, goToStep } = useWorkflowStore();
    const router = useRouter();
    useEffect(() => {
        if (project && project.currentStep !== 3) {
            goToStep(3 as WorkflowStep);
        }
        router.replace('/deconstruction/manual');
    }, [project, goToStep, router]);
    return null;
}
