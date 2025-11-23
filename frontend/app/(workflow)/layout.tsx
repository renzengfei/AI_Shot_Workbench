'use client';

import { useEffect, useMemo } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/components/WorkspaceContext';
import { useWorkflowStore } from '@/lib/stores/workflowStore';
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
        const desiredStep = project.currentStep ?? 1;
        const desiredPath = stepToPath(desiredStep);
        const pathStep = currentStepFromPath;

        // Always trust store as source of truth; if当前路径与步骤不一致，则跳转到当前步骤
        if (pathStep !== desiredStep) {
            if (desiredPath && pathname !== desiredPath) {
                router.replace(desiredPath);
            } else {
                goToStep(desiredStep as WorkflowStep);
            }
            return;
        }

        // If route unknown/null, still fallback to desired step path
        if (!pathStep && desiredPath && pathname !== desiredPath) {
            router.replace(desiredPath);
        }
    }, [project, currentStepFromPath, goToStep, pathname, router]);

    if (!currentWorkspace) return <WorkspaceSelector />;

    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] font-sans selection:bg-blue-500/30">
            <header className="z-30 glass-card border-b border-[var(--glass-border)] bg-[var(--glass-bg-light)] backdrop-blur-xl">
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

            <main className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8 space-y-8">
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
