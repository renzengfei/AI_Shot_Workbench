'use client';

import { usePathname } from 'next/navigation';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';
import { useStepNavigator } from '@/lib/hooks/useStepNavigator';
import { STEP_ROUTES } from '@/lib/constants/steps';

const steps = [
    { id: 1 as WorkflowStep, label: '原片切分' },
    { id: 2 as WorkflowStep, label: 'AI 原片拆解' },
    { id: 3 as WorkflowStep, label: '人工改写' },
];

export default function StepNavigation() {
    const { project } = useWorkflowStore();
    const { navigateToStep } = useStepNavigator();
    const pathname = usePathname();

    if (!project) return null;

    return (
        <div className="flex items-center justify-center w-full">
            <div className="flex items-center p-1 rounded-xl bg-[rgba(255,255,255,0.4)] border border-[var(--lg-glass-border)] backdrop-blur-lg">
                {steps.map((step) => {
                    const path = STEP_ROUTES[step.id];
                    const isActive = pathname.startsWith(path);
                    const isCompleted = project.currentStep > step.id;

                    return (
                        <button
                            key={step.id}
                            onClick={() => navigateToStep(step.id)}
                            className={`
                                relative px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                                transition-[background-color,color,box-shadow] duration-200
                                ${isActive
                                    ? 'bg-white/90 text-[var(--lg-text-primary)] shadow-sm'
                                    : isCompleted
                                        ? 'text-[var(--lg-text-secondary)] hover:text-[var(--lg-text-primary)] hover:bg-white/40'
                                        : 'text-[var(--lg-text-tertiary)] hover:text-[var(--lg-text-secondary)] hover:bg-white/20'
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
