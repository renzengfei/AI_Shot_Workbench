'use client';

import { useState, useCallback, ImgHTMLAttributes } from 'react';
import { ImageOff, RefreshCw } from 'lucide-react';

interface SafeImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  fallbackSrc?: string;
  maxRetries?: number;
  showRetryButton?: boolean;
}

/**
 * SafeImage - 带错误处理和重试机制的图片组件
 * 
 * 特性:
 * - 加载失败时显示占位图
 * - 自动重试（最多 maxRetries 次）
 * - 可选手动重试按钮
 * - 支持自定义 fallback 图片
 */
export const SafeImage = ({
  src,
  fallbackSrc,
  maxRetries = 2,
  showRetryButton = false,
  className,
  alt,
  ...props
}: SafeImageProps) => {
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = useCallback(() => {
    if (retryCount < maxRetries) {
      // 自动重试，添加时间戳破坏缓存
      setTimeout(() => {
        setRetryCount(c => c + 1);
        setCurrentSrc(`${src}${src.includes('?') ? '&' : '?'}retry=${Date.now()}`);
      }, 500 * (retryCount + 1));
    } else if (fallbackSrc) {
      // 使用 fallback 图片
      setCurrentSrc(fallbackSrc);
      setHasError(false);
    } else {
      setHasError(true);
      setIsLoading(false);
    }
  }, [src, fallbackSrc, retryCount, maxRetries]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleRetry = useCallback(() => {
    setRetryCount(0);
    setHasError(false);
    setIsLoading(true);
    setCurrentSrc(`${src}${src.includes('?') ? '&' : '?'}retry=${Date.now()}`);
  }, [src]);

  // 当 src 变化时重置状态
  if (src !== currentSrc.split('?')[0] && src !== currentSrc) {
    setCurrentSrc(src);
    setRetryCount(0);
    setHasError(false);
    setIsLoading(true);
  }

  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 bg-gray-100 ${className}`}>
        <ImageOff size={24} className="text-gray-400" />
        <span className="text-xs text-gray-400">加载失败</span>
        {showRetryButton && (
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors"
          >
            <RefreshCw size={12} />
            重试
          </button>
        )}
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      onError={handleError}
      onLoad={handleLoad}
      {...props}
    />
  );
};

export default SafeImage;
