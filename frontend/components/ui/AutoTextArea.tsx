import { useCallback, useLayoutEffect, useRef, type ChangeEvent } from 'react';

interface AutoTextAreaProps {
    value: string;
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
    className?: string;
    placeholder?: string;
    minRows?: number;
    maxRows?: number;
    readOnly?: boolean;
    /** 是否尽量保留光标位置，默认开启 */
    preserveSelection?: boolean;
}

export const AutoTextArea = ({
    value,
    onChange,
    className,
    placeholder,
    minRows = 1,
    maxRows = 12,
    readOnly,
    preserveSelection = true,
}: AutoTextAreaProps) => {
    const ref = useRef<HTMLTextAreaElement | null>(null);
    const selectionRef = useRef<{ start: number; end: number } | null>(null);
    const resize = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = 'auto';
        const lineHeight = parseInt(getComputedStyle(el).lineHeight || '20', 10);
        const minHeight = (minRows || 1) * lineHeight;
        const maxHeight = (maxRows || minRows) * lineHeight;
        const next = Math.min(maxHeight, Math.max(minHeight, el.scrollHeight));
        el.style.height = `${next}px`;
        // 只有内容超出最大高度时才显示滚动条
        el.style.overflowY = el.scrollHeight > next + 1 ? 'auto' : 'hidden';
    }, [maxRows, minRows]);

    useLayoutEffect(() => {
        resize();
        if (preserveSelection && selectionRef.current && ref.current && document.activeElement === ref.current) {
            const { start, end } = selectionRef.current;
            const len = ref.current.value.length;
            const nextStart = Math.min(start, len);
            const nextEnd = Math.min(end, len);
            ref.current.setSelectionRange(nextStart, nextEnd);
        }
    }, [value, minRows, maxRows, resize, preserveSelection]);

    return (
        <textarea
            ref={ref}
            value={value}
            onChange={(e) => {
                if (preserveSelection) {
                    selectionRef.current = {
                        start: e.target.selectionStart ?? e.target.value.length,
                        end: e.target.selectionEnd ?? e.target.value.length,
                    };
                }
                onChange(e);
            }}
            readOnly={readOnly}
            rows={minRows}
            style={{ overflowY: 'auto', overflowX: 'hidden' }}
            className={className}
            placeholder={placeholder}
        />
    );
};
