'use client';

import { useEffect, useRef } from 'react';
import Step3_DeconstructionReview from '@/components/workflow/Step3_DeconstructionReview';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';

/**
 * 人工改写页面
 * 
 * 功能：与"剧本重构"的原片审验模式几乎一样，但没有批注和 JSON 对比功能。
 * 通过传入 hideAnnotations、hideCompare、hideModeSwitcher props 实现。
 */
export default function ManualRewritePage() {
    const { project, goToStep } = useWorkflowStore();
    const hasSetStep = useRef(false);
    
    useEffect(() => {
        // 只在挂载时设置一次 step，避免无限循环
        if (project && !hasSetStep.current) {
            hasSetStep.current = true;
            goToStep(3 as WorkflowStep);
        }
    }, [project, goToStep]);
    
    return (
        <Step3_DeconstructionReview
            hideAnnotations={true}
            hideCompare={true}
            hideModeSwitcher={true}
        />
    );
}
