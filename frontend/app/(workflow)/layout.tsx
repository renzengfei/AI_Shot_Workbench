'use client';

import '@/styles/liquid-glass.css';
import { useEffect, useMemo, useRef } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/components/WorkspaceContext';
import { useWorkflowStore, WorkflowStep } from '@/lib/stores/workflowStore';
import StepNavigation from '@/components/workflow/StepNavigation';
import WorkspaceSelector from '@/components/WorkspaceSelector';
import { Folder, ExternalLink } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { pathToStep, stepToPath } from '@/lib/constants/steps';

function Shell({ children }: { children: React.ReactNode }) {
    const { project, goToStep } = useWorkflowStore();
    const { currentWorkspace, closeWorkspace } = useWorkspace();
    const pathname = usePathname();
    const router = useRouter();
    const lastSyncedStepRef = useRef<WorkflowStep | null>(null);

    const savedSourceUrl = useMemo(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('ai-shot-last-source-url') || '';
        }
        return '';
    }, []);
    const sourceUrl = project?.sourceUrl || project?.videoUrl || '';
    const isYoutubeSource =
        (sourceUrl.includes('youtube.com') || sourceUrl.includes('youtu.be')) ||
        (savedSourceUrl.includes('youtube.com') || savedSourceUrl.includes('youtu.be'));

    const currentStepFromPath = useMemo(() => pathToStep(pathname), [pathname]);

    useEffect(() => {
        if (!project) return;

        const currentStep = project.currentStep;

        // 如果当前 URL 对应的步骤存在，但与 store 不一致，则只同步 store
        if (currentStepFromPath && currentStep !== currentStepFromPath) {
            // 只在没有同步过或者步骤确实不同时才同步
            if (lastSyncedStepRef.current !== currentStepFromPath) {
                lastSyncedStepRef.current = currentStepFromPath;
                goToStep(currentStepFromPath);
            }
            return;
        }

        // 更新ref以跟踪当前步骤
        lastSyncedStepRef.current = currentStep;

        // 路径未知时，回退到当前步骤对应的路径
        if (!currentStepFromPath) {
            const desiredStep = currentStep ?? 1;
            const desiredPath = stepToPath(desiredStep);
            if (desiredPath && pathname !== desiredPath) {
                router.replace(desiredPath);
            }
        }
    }, [project, project?.currentStep, currentStepFromPath, pathname, goToStep, router]);

    if (!currentWorkspace) return <WorkspaceSelector />;

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans selection:bg-blue-500/30">
            <header className="z-30 lg-card border-b border-[var(--glass-border)] bg-[var(--glass-bg-light)] backdrop-blur-xl">
                <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20">
                            AI
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-lg font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300">
                                AI Shot Workbench
                            </h1>
                            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                                <Folder size={10} />
                                <span className="font-medium">{currentWorkspace.name}</span>
                                <span className="text-[var(--color-text-tertiary)]/50 mx-1">|</span>
                                <button
                                    onClick={closeWorkspace}
                                    className="hover:text-[var(--color-text-primary)] transition-colors"
                                >
                                    Switch
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 max-w-2xl mx-12">
                        <StepNavigation />
                    </div>

                    {isYoutubeSource && (project?.sourceUrl || savedSourceUrl) && (
                        <a
                            href={project?.sourceUrl || savedSourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm text-blue-300 border border-white/15 transition"
                        >
                            <ExternalLink size={16} />
                            查看原片
                        </a>
                    )}
                </div>
            </header>

            <main className="mx-auto px-6 lg:px-8 py-8 space-y-8">
                <div className="min-h-[600px]">{children}</div>
            </main>
        </div>
    );
}

export default function WorkflowLayout({ children }: { children: React.ReactNode }) {
    return (
        <WorkspaceProvider>
            <Shell>{children}</Shell>
        </WorkspaceProvider>
    );
}
