const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export interface ReferenceImage {
    id: string;
    name: string;
    filename?: string;
    url: string;
    category?: string;
}
export type CategoryPromptMap = Record<string, string>;
export type CategoryList = string[];

export type CharacterReferenceMap = Record<string, string>;

const buildUrl = (item: ReferenceImage): string => {
    const base = (API_BASE || '').replace(/\/$/, '');
    if (item?.url && item.url.startsWith('http')) return item.url;
    const path = item.url || (item.filename ? `/reference-gallery/images/${item.filename}` : '');
    // encode URI to support spaces / CJK in category folders
    return encodeURI(`${base}${path}`);
};

const normalizeItem = (item: ReferenceImage): ReferenceImage => {
    const withUrl = { ...item };
    withUrl.url = buildUrl(withUrl);
    return withUrl;
};

export async function fetchReferenceGallery(): Promise<ReferenceImage[]> {
    const resp = await fetch(`${API_BASE}/api/reference-gallery`);
    if (!resp.ok) throw new Error(`加载图库失败: ${resp.status}`);
    const data = await resp.json();
    const items = Array.isArray(data.items) ? data.items : [];
    return items.map((item: ReferenceImage) => normalizeItem(item));
}

export async function fetchCategoryPrompts(): Promise<CategoryPromptMap> {
    const resp = await fetch(`${API_BASE}/api/reference-gallery/category-prompts`);
    if (!resp.ok) throw new Error(`加载分类提示词失败: ${resp.status}`);
    const data = await resp.json();
    return (data?.prompts as CategoryPromptMap) || {};
}

export async function fetchCategories(): Promise<CategoryList> {
    const resp = await fetch(`${API_BASE}/api/reference-gallery/categories`);
    if (!resp.ok) throw new Error(`加载分类失败: ${resp.status}`);
    const data = await resp.json();
    return (data?.categories as CategoryList) || [];
}

export async function createCategory(name: string): Promise<CategoryList> {
    const resp = await fetch(`${API_BASE}/api/reference-gallery/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!resp.ok) throw new Error(`创建分类失败: ${resp.status}`);
    const data = await resp.json();
    return (data?.categories as CategoryList) || [];
}

export async function renameCategory(oldName: string, newName: string): Promise<CategoryList> {
    const resp = await fetch(`${API_BASE}/api/reference-gallery/categories/${encodeURIComponent(oldName)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
    });
    if (!resp.ok) throw new Error(`重命名分类失败: ${resp.status}`);
    const data = await resp.json();
    return (data?.categories as CategoryList) || [];
}

export async function deleteCategory(name: string, mode: 'move' | 'clear' = 'move'): Promise<CategoryList> {
    const resp = await fetch(`${API_BASE}/api/reference-gallery/categories/${encodeURIComponent(name)}?mode=${mode}`, {
        method: 'DELETE',
    });
    if (!resp.ok) throw new Error(`删除分类失败: ${resp.status}`);
    const data = await resp.json();
    return (data?.categories as CategoryList) || [];
}

export async function saveCategoryPrompt(category: string, prompt: string): Promise<CategoryPromptMap> {
    const resp = await fetch(`${API_BASE}/api/reference-gallery/category-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, prompt }),
    });
    if (!resp.ok) throw new Error(`保存提示词失败: ${resp.status}`);
    const data = await resp.json();
    return (data?.prompts as CategoryPromptMap) || {};
}

export async function uploadReferenceImage(file: File, name?: string, category?: string): Promise<ReferenceImage> {
    const form = new FormData();
    form.append('file', file);
    if (name) form.append('name', name);
    if (category) form.append('category', category);
    const resp = await fetch(`${API_BASE}/api/reference-gallery`, {
        method: 'POST',
        body: form,
    });
    if (!resp.ok) throw new Error(`上传失败: ${resp.status}`);
    const item = await resp.json();
    return normalizeItem(item);
}

export async function deleteReferenceImage(id: string) {
    const resp = await fetch(`${API_BASE}/api/reference-gallery/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!resp.ok) throw new Error(`删除失败: ${resp.status}`);
}

export async function renameReferenceImage(id: string, name?: string, category?: string) {
    const payload: Record<string, string> = {};
    if (name !== undefined) payload.name = name;
    if (category !== undefined) payload.category = category;
    if (Object.keys(payload).length === 0) return;
    const resp = await fetch(`${API_BASE}/api/reference-gallery/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });
    if (!resp.ok) throw new Error(`重命名失败: ${resp.status}`);
    const data = await resp.json();
    const item = data?.item as ReferenceImage | undefined;
    return item ? normalizeItem(item) : undefined;
}

export async function fetchCharacterReferences(workspacePath: string): Promise<CharacterReferenceMap> {
    const resp = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/character-references`);
    if (!resp.ok) throw new Error(`加载角色引用失败: ${resp.status}`);
    const data = await resp.json();
    return (data as CharacterReferenceMap) || {};
}

export async function saveCharacterReferences(workspacePath: string, links: CharacterReferenceMap) {
    const resp = await fetch(`${API_BASE}/api/workspaces/${encodeURIComponent(workspacePath)}/character-references`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(links),
    });
    if (!resp.ok) throw new Error(`保存角色引用失败: ${resp.status}`);
}
