import { useCallback, useLayoutEffect, useRef, type ChangeEvent } from 'react';

interface AutoTextAreaProps {
    value: string;
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    className?: string;
    placeholder?: string;
    minRows?: number;
    maxRows?: number;
    readOnly?: boolean;
}

export const AutoTextArea = ({
    value,
    onChange,
    className,
    placeholder,
    minRows = 1,
    maxRows = 12,
    readOnly,
}: AutoTextAreaProps) => {
    const ref = useRef<HTMLTextAreaElement | null>(null);
    const resize = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        el.rows = 1;
        const lineHeight = parseInt(getComputedStyle(el).lineHeight || '20', 10);
        const maxHeight = maxRows * lineHeight;
        const next = Math.min(maxHeight, el.scrollHeight);
        el.style.height = `${next}px`;
    }, [maxRows]);

    useLayoutEffect(() => {
        resize();
    }, [value, minRows, maxRows, resize]);

    return (
        <textarea
            ref={ref}
            value={value}
            onChange={onChange}
            readOnly={readOnly}
            rows={1}
            style={{ overflow: 'hidden' }}
            className={className}
            placeholder={placeholder}
        />
    );
};
