const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export interface ImagePreset {
    id: string;
    name: string;
    content: string;
    /** 角色参考模板，如 "角色【{name}】的形象、服装、发型严格参考图{image}。" */
    character_ref_template?: string | null;
    /** 场景参考模板，如 "画面的景别、人物姿势和动作严格参考图{image}。" */
    scene_ref_template?: string | null;
    /** 每次生成图片数量，默认 2 */
    images_per_generation?: number | null;
    created_at?: string;
    updated_at?: string;
}

export async function fetchImagePresets(): Promise<ImagePreset[]> {
    const resp = await fetch(`${API_BASE}/api/image-presets`);
    if (!resp.ok) throw new Error(`加载生图设定失败: ${resp.status}`);
    const data = await resp.json();
    return (data?.presets as ImagePreset[]) || [];
}

export interface PresetFormData {
    content: string;
    name?: string;
    character_ref_template?: string | null;
    scene_ref_template?: string | null;
    images_per_generation?: number | null;
}

export async function createImagePreset(data: PresetFormData): Promise<ImagePreset> {
    const resp = await fetch(`${API_BASE}/api/image-presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`创建生图设定失败: ${resp.status}`);
    const result = await resp.json();
    return result?.preset as ImagePreset;
}

export async function updateImagePreset(id: string, data: PresetFormData): Promise<ImagePreset> {
    const resp = await fetch(`${API_BASE}/api/image-presets/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error(`更新生图设定失败: ${resp.status}`);
    const result = await resp.json();
    return result?.preset as ImagePreset;
}

export async function deleteImagePreset(id: string) {
    const resp = await fetch(`${API_BASE}/api/image-presets/${encodeURIComponent(id)}`, {
        method: 'DELETE',
    });
    if (!resp.ok) throw new Error(`删除生图设定失败: ${resp.status}`);
}

export async function getWorkspaceImagePreset(workspacePath: string): Promise<{ preset_id?: string | null; preset?: ImagePreset | null }> {
    const resp = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/image-preset`);
    if (!resp.ok) throw new Error(`加载工作空间生图设定失败: ${resp.status}`);
    return (await resp.json()) as { preset_id?: string | null; preset?: ImagePreset | null };
}

export async function setWorkspaceImagePreset(workspacePath: string, presetId: string | null) {
    const resp = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/image-preset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset_id: presetId }),
    });
    if (!resp.ok) throw new Error(`保存工作空间生图设定失败: ${resp.status}`);
    return (await resp.json()) as { preset_id?: string | null };
}
