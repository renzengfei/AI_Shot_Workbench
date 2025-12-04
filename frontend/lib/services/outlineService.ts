/**
 * 线稿图生成服务
 * 复用现有生图 API，传入原片首帧作为参考图 + 线稿提示词
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export interface GenerateOutlineRequest {
    workspacePath: string;
    shotId: string;
    frameUrl: string;          // 原片首帧 URL
    outlinePrompt: string;     // 线稿提示词
    providerId?: string;       // 供应商 ID
}

export interface GenerateOutlineResponse {
    success: boolean;
    outlineUrl?: string;       // 生成的线稿图 URL
    error?: string;
}

export interface OutlineConfig {
    globalOutlineMode: boolean;           // 全局线稿模式开关
    globalOutlinePrompt: string;          // 全局线稿提示词
}

// 默认线稿提示词（不使用硬编码默认值，由生图设定配置）
export const DEFAULT_OUTLINE_PROMPT = '';

/**
 * 生成单个镜头的线稿图
 * 复用 /api/generate-image 接口
 */
export async function generateOutline(request: GenerateOutlineRequest): Promise<GenerateOutlineResponse> {
    try {
        // 将首帧 URL 转换为参考图 ID（如果需要）
        // 这里直接使用首帧作为参考图，通过 base64 编码传递
        const response = await fetch(`${API_BASE}/api/generate-outline`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                workspace_path: request.workspacePath,
                shot_id: request.shotId,
                frame_url: request.frameUrl,
                outline_prompt: request.outlinePrompt,
                provider_id: request.providerId,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const data = await response.json();
        return {
            success: true,
            outlineUrl: data.outline_url,
        };
    } catch (error) {
        console.error('生成线稿失败:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '生成线稿失败',
        };
    }
}

/**
 * 批量生成线稿图
 * @param requests 请求列表
 * @param concurrency 并发数（默认 20）
 * @param onProgress 进度回调
 */
export async function batchGenerateOutlines(
    requests: GenerateOutlineRequest[],
    concurrency: number = 20,
    onProgress?: (completed: number, total: number, failed: number) => void
): Promise<{ results: GenerateOutlineResponse[]; failedCount: number }> {
    const results: GenerateOutlineResponse[] = [];
    let completed = 0;
    let failed = 0;

    // 分批处理
    for (let i = 0; i < requests.length; i += concurrency) {
        const batch = requests.slice(i, i + concurrency);
        const batchResults = await Promise.all(
            batch.map(async (req) => {
                const result = await generateOutline(req);
                completed++;
                if (!result.success) {
                    failed++;
                }
                onProgress?.(completed, requests.length, failed);
                return result;
            })
        );
        results.push(...batchResults);
    }

    return { results, failedCount: failed };
}

/**
 * 获取镜头的所有线稿图列表
 */
export async function listOutlines(workspacePath: string, shotId: string): Promise<string[]> {
    try {
        const response = await fetch(
            `${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/outlines?shot_id=${encodeURIComponent(shotId)}`
        );
        if (!response.ok) {
            return [];
        }
        const data = await response.json();
        return data.outlines || [];
    } catch (error) {
        console.error('获取线稿列表失败:', error);
        return [];
    }
}

/**
 * 删除线稿图
 */
export async function deleteOutline(workspacePath: string, shotId: string, outlineUrl: string): Promise<boolean> {
    try {
        const filename = outlineUrl.split('/').pop();
        const response = await fetch(
            `${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/outlines/${encodeURIComponent(shotId)}/${encodeURIComponent(filename || '')}`,
            { method: 'DELETE' }
        );
        return response.ok;
    } catch (error) {
        console.error('删除线稿失败:', error);
        return false;
    }
}

/**
 * 保存线稿配置到 workspace
 */
export async function saveOutlineConfig(workspacePath: string, config: OutlineConfig): Promise<boolean> {
    try {
        const response = await fetch(
            `${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/outline-config`,
            {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            }
        );
        return response.ok;
    } catch (error) {
        console.error('保存线稿配置失败:', error);
        return false;
    }
}

/**
 * 加载线稿配置
 */
export async function loadOutlineConfig(workspacePath: string): Promise<OutlineConfig | null> {
    try {
        const response = await fetch(
            `${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/outline-config`
        );
        if (!response.ok) {
            return null;
        }
        return await response.json();
    } catch (error) {
        console.error('加载线稿配置失败:', error);
        return null;
    }
}
