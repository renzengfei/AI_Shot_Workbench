'use client';

import { useEffect } from 'react';
import Step8_Export from '@/components/workflow/Step8_Export';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function ExportPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 9) {
            goToStep(9 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step8_Export />;
}
