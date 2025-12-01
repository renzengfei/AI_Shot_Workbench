import { useCallback, useLayoutEffect, useRef, useState, useEffect, type ChangeEvent } from 'react';

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
    /** 防抖延迟（毫秒），默认 500ms，设为 0 则不防抖 */
    debounceMs?: number;
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
    debounceMs = 500,
}: AutoTextAreaProps) => {
    const ref = useRef<HTMLTextAreaElement | null>(null);
    const selectionRef = useRef<{ start: number; end: number } | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingEventRef = useRef<ChangeEvent<HTMLTextAreaElement> | null>(null);

    // 本地状态缓冲，实现即时响应
    const [localValue, setLocalValue] = useState(value);

    // 当外部 value 变化且不是由本地输入触发时，同步到本地状态
    useEffect(() => {
        // 如果外部 value 与本地不同，且当前 textarea 不处于焦点状态，则同步
        // 这样可以避免在用户输入时被外部值覆盖
        if (value !== localValue && document.activeElement !== ref.current) {
            setLocalValue(value);
        }
    }, [value, localValue]);

    // 组件卸载时清理防抖定时器
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

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
    }, [localValue, minRows, maxRows, resize, preserveSelection]);

    const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;

        if (preserveSelection) {
            selectionRef.current = {
                start: e.target.selectionStart ?? newValue.length,
                end: e.target.selectionEnd ?? newValue.length,
            };
        }

        // 立即更新本地状态，保证输入流畅
        setLocalValue(newValue);

        // 防抖通知父组件
        if (debounceMs <= 0) {
            onChange(e);
        } else {
            // 保存事件引用以便防抖后使用
            pendingEventRef.current = e;
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
            debounceRef.current = setTimeout(() => {
                if (pendingEventRef.current) {
                    onChange(pendingEventRef.current);
                    pendingEventRef.current = null;
                }
            }, debounceMs);
        }
    };

    // 失焦时立即同步，确保数据不丢失
    const handleBlur = () => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
            debounceRef.current = null;
        }
        if (pendingEventRef.current) {
            onChange(pendingEventRef.current);
            pendingEventRef.current = null;
        }
    };

    return (
        <textarea
            ref={ref}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            readOnly={readOnly}
            rows={minRows}
            style={{ overflowY: 'auto', overflowX: 'hidden' }}
            className={className}
            placeholder={placeholder}
        />
    );
};
