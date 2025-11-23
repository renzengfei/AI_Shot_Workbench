'use client';

import { useEffect } from 'react';
import Step3_Optimization from '@/components/workflow/Step3_Optimization';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function OptimizationPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 4) {
            goToStep(4 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step3_Optimization />;
}
