'use client';

import { useEffect } from 'react';
import Step6_ImageGen from '@/components/workflow/Step6_ImageGen';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function ImageGenPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 7) {
            goToStep(7 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step6_ImageGen />;
}
