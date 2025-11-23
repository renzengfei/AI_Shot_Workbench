'use client';

import { useEffect } from 'react';
import Step5_ImagePrompts from '@/components/workflow/Step5_ImagePrompts';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function ImagePromptsPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 6) {
            goToStep(6 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step5_ImagePrompts />;
}
