'use client';

import { useEffect } from 'react';
import Step2_Deconstruction from '@/components/workflow/Step2_Deconstruction';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function DeconstructionAIPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 2) {
            goToStep(2 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step2_Deconstruction />;
}
