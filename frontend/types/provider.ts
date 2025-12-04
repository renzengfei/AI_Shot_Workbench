/**
 * 生图供应商相关类型定义
 */

export type ProviderType = 'rabbit' | 'candy' | 'gemini';

export interface ImageProvider {
  id: string;
  name: string;
  type: ProviderType;
  api_key_preview: string;  // 脱敏后的 API Key
  endpoint: string;
  model: string;
  is_default: boolean;
}

export interface ProviderCreateRequest {
  name: string;
  type: ProviderType;
  api_key: string;
  endpoint: string;
  model: string;
  is_default?: boolean;
}

export interface ProviderUpdateRequest {
  name?: string;
  api_key?: string;
  endpoint?: string;
  model?: string;
  is_default?: boolean;
}

// Provider type 显示配置
export const PROVIDER_TYPE_CONFIG: Record<ProviderType, { label: string; description: string; defaultEndpoint: string; defaultModel: string }> = {
  rabbit: {
    label: '糖果',
    description: 'OpenAI 兼容格式，支持流式响应',
    defaultEndpoint: 'https://api.tu-zi.com/v1',
    defaultModel: 'gemini-3-pro-image-preview-4',
  },
  candy: {
    label: '兔子',
    description: 'Nano 协议，适合高质量图片生成',
    defaultEndpoint: '',
    defaultModel: 'flux-schnell',
  },
  gemini: {
    label: '云雾',
    description: 'Google Gemini 原生 API，高质量多模态',
    defaultEndpoint: 'https://yunwu.ai',
    defaultModel: 'gemini-3-pro-image-preview',
  },
};
