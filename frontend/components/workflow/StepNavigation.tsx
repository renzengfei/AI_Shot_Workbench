'use client';

import { usePathname } from 'next/navigation';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';
import { STEP_ROUTES } from '@/lib/constants/steps';

const steps = [
    { id: 1 as WorkflowStep, label: '原片切分' },
    { id: 2 as WorkflowStep, label: 'AI 原片拆解' },
    { id: 3 as WorkflowStep, label: '剧本重构' },
    { id: 6 as WorkflowStep, label: '画面提示词' },
    { id: 7 as WorkflowStep, label: '画面生成' },
    { id: 8 as WorkflowStep, label: '视频生成' },
    { id: 9 as WorkflowStep, label: '导出剪辑' },
];

export default function StepNavigation() {
    const { project } = useWorkflowStore();
    const { navigateToStep } = useStepNavigator();
    const pathname = usePathname();

    if (!project) return null;

    return (
        <div className="flex items-center justify-center w-full">
            <div className="flex items-center p-1 rounded-lg bg-[var(--color-bg-secondary)]/50 border border-[var(--glass-border)] backdrop-blur-md">
                {steps.map((step) => {
                    const path = STEP_ROUTES[step.id];
                    const isActive = pathname.startsWith(path);
                    const isCompleted = project.currentStep > step.id;

                    return (
                        <button
                            key={step.id}
                            onClick={() => navigateToStep(step.id)}
                            className={`
                                relative px-4 py-1.5 rounded-md text-xs font-medium whitespace-nowrap
                                ${isActive
                                    ? 'bg-[var(--glass-bg-light)] text-[var(--color-text-primary)] shadow-sm border border-[var(--glass-border)]'
                                    : isCompleted
                                        ? 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                        : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]'
                                }
                            `}
                        >
                            {step.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
