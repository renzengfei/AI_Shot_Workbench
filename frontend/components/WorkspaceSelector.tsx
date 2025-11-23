'use client';

import { useState } from 'react';
import { FolderPlus, FolderOpen, Clock } from 'lucide-react';
import { useWorkspace } from './WorkspaceContext';

export default function WorkspaceSelector() {
    const { workspaces, createWorkspace, openWorkspace } = useWorkspace();
    const [isCreating, setIsCreating] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWorkspaceName.trim()) return;

        setIsLoading(true);
        try {
            await createWorkspace(newWorkspaceName);
        } catch (error) {
            alert('Failed to create workspace');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)] p-6">
            <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Left Column: Create / Open */}
                <div className="space-y-8">
                    <div className="text-center md:text-left">
                        <h1 className="apple-headline text-4xl mb-2">AI Shot Workbench</h1>
                        <p className="apple-body text-[var(--color-text-secondary)]">
                            选择一个工作空间开始您的创作之旅。
                        </p>
                    </div>

                    {/* Create New Card */}
                    <div className="glass-card p-6 transition-all duration-300 hover:shadow-lg">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                                <FolderPlus size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">新建工作空间</h3>
                                <p className="text-sm text-[var(--color-text-tertiary)]">创建一个新的项目文件夹</p>
                            </div>
                        </div>

                        <form onSubmit={handleCreate} className="space-y-4">
                            <input
                                type="text"
                                placeholder="工作空间名称"
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                className="apple-input w-full"
                                autoFocus
                            />
                            <button
                                type="submit"
                                disabled={!newWorkspaceName.trim() || isLoading}
                                className="apple-button-primary w-full justify-center"
                            >
                                {isLoading ? '创建中...' : '创建工作空间'}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Right Column: Recent Workspaces */}
                <div className="glass-card p-6 h-full max-h-[600px] overflow-hidden flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                        <Clock size={20} className="text-[var(--color-text-tertiary)]" />
                        <h3 className="text-lg font-semibold">最近的工作空间</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {workspaces.length === 0 ? (
                            <div className="text-center py-12 text-[var(--color-text-tertiary)]">
                                暂无最近的工作空间。
                            </div>
                        ) : (
                            workspaces.map((ws) => (
                                <button
                                    key={ws.path}
                                    onClick={() => openWorkspace(ws.path)}
                                    className="w-full text-left p-4 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors group border border-transparent hover:border-[var(--glass-border)]"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-[var(--color-text-primary)] group-hover:text-blue-500 transition-colors">
                                            {ws.name}
                                        </span>
                                        <FolderOpen size={16} className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-500" />
                                    </div>
                                    <div className="text-xs text-[var(--color-text-tertiary)] truncate font-mono">
                                        {ws.path}
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
