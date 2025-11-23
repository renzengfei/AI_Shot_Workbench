'use client';

import { useEffect } from 'react';
import Step4_ScriptRewrite from '@/components/workflow/Step4_ScriptRewrite';
import { useWorkflowStore, type WorkflowStep } from '@/lib/stores/workflowStore';

export default function ScriptRewritePage() {
    const { project, goToStep } = useWorkflowStore();

    useEffect(() => {
        if (project && project.currentStep !== 4) {
            goToStep(4 as WorkflowStep);
        }
    }, [project, goToStep]);

    return <Step4_ScriptRewrite />;
}
