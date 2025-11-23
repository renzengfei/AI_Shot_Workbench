'use client';

import * as React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

interface TooltipProps {
    children: React.ReactNode;
}

export const TooltipProvider = ({ children }: TooltipProps) => (
    <RadixTooltip.Provider delayDuration={100}>{children}</RadixTooltip.Provider>
);

export const Tooltip = RadixTooltip.Root;
export const TooltipTrigger = RadixTooltip.Trigger;
export const TooltipContent = ({ children, ...props }: RadixTooltip.TooltipContentProps) => (
    <RadixTooltip.Content
        side="top"
        align="center"
        sideOffset={6}
        className="rounded-md border border-[var(--glass-border)] bg-[var(--glass-bg-light)] px-3 py-2 shadow-xl text-[var(--color-text-primary)] backdrop-blur-lg"
        {...props}
    >
        {children}
        <RadixTooltip.Arrow className="fill-[var(--glass-bg-light)]" />
    </RadixTooltip.Content>
);
