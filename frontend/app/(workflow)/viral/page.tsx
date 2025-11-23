'use client';

import { useEffect } from 'react';
import Step4_Viral from '@/components/workflow/Step4_Viral';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function ViralPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 5) {
            goToStep(5 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step4_Viral />;
}
