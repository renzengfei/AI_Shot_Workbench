'use client';

import { useEffect } from 'react';
import Step3_DeconstructionReview from '@/components/workflow/Step3_DeconstructionReview';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function DeconstructionReviewPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 3) {
            goToStep(3 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step3_DeconstructionReview />;
}
