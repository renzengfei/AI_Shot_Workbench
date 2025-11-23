'use client';

import { useEffect } from 'react';
import Step1_Segmentation from '@/components/workflow/Step1_Segmentation';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

export default function SegmentationPage() {
    const { project, goToStep } = useWorkflowStore();
    useEffect(() => {
        if (project && project.currentStep !== 1) {
            goToStep(1 as WorkflowStep);
        }
    }, [project, goToStep]);
    return <Step1_Segmentation />;
}
