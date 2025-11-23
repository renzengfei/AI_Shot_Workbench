'use client';

import { useEffect } from 'react';
import Step7_VideoGen from '@/components/workflow/Step7_VideoGen';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function VideoGenPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 8) {
            goToStep(8 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step7_VideoGen />;
}
