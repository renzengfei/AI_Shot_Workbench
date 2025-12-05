import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const API_BASE = '/api/yunwu';

// 类型定义
interface SelectionState {
  // ===== 状态 =====
  // 图片选择: workspaceKey -> shotId -> filename
  imageSelections: Record<string, Record<string, string>>;
  // 视频选择: workspaceKey -> shotId -> filename[]
  videoSelections: Record<string, Record<string, string[]>>;
  // 线稿选择: workspaceKey -> shotId -> url
  outlineSelections: Record<string, Record<string, string>>;
  
  // 加载状态
  loadedWorkspaces: Record<string, { images: boolean; videos: boolean; outlines: boolean }>;
  
  // 待同步队列（离线时累积，上线后批量同步）
  pendingSync: {
    images: Record<string, Record<string, string>>;
    videos: Record<string, Record<string, string[]>>;
    outlines: Record<string, Record<string, string>>;
  };
  
  // ===== 操作 =====
  // 获取 workspace key
  getWorkspaceKey: (workspacePath: string, generatedDir: string) => string;
  
  // 图片选择
  setImageSelection: (workspacePath: string, generatedDir: string, shotId: number, filename: string) => void;
  getImageSelection: (workspacePath: string, generatedDir: string, shotId: number) => string | undefined;
  getImageSelections: (workspacePath: string, generatedDir: string) => Record<string, string>;
  
  // 视频选择
  setVideoSelection: (workspacePath: string, generatedDir: string, shotId: number, filenames: string[]) => void;
  getVideoSelection: (workspacePath: string, generatedDir: string, shotId: number) => string[];
  getVideoSelections: (workspacePath: string, generatedDir: string) => Record<string, string[]>;
  
  // 线稿选择
  setOutlineSelection: (workspacePath: string, generatedDir: string, shotId: number, url: string) => void;
  getOutlineSelection: (workspacePath: string, generatedDir: string, shotId: number) => string | undefined;
  getOutlineSelections: (workspacePath: string, generatedDir: string) => Record<string, string>;
  
  // 从后端加载
  loadFromBackend: (workspacePath: string, generatedDir: string, type: 'images' | 'videos' | 'outlines') => Promise<void>;
  
  // 同步到后端
  syncToBackend: (workspacePath: string, generatedDir: string, type: 'images' | 'videos' | 'outlines') => Promise<boolean>;
  
  // 重试所有 pending 同步
  retryPendingSync: () => Promise<void>;
  
  // 检查是否已加载
  isLoaded: (workspacePath: string, generatedDir: string, type: 'images' | 'videos' | 'outlines') => boolean;
  
  // 清除 workspace 数据（切换 workspace 时）
  clearWorkspace: (workspacePath: string, generatedDir: string) => void;
}

export const useSelectionStore = create<SelectionState>()(
  persist(
    (set, get) => ({
      // ===== 初始状态 =====
      imageSelections: {},
      videoSelections: {},
      outlineSelections: {},
      loadedWorkspaces: {},
      pendingSync: {
        images: {},
        videos: {},
        outlines: {},
      },
      
      // ===== 工具函数 =====
      getWorkspaceKey: (workspacePath: string, generatedDir: string) => {
        return `${workspacePath}::${generatedDir}`;
      },
      
      // ===== 图片选择 =====
      setImageSelection: (workspacePath, generatedDir, shotId, filename) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        const shotKey = shotId.toFixed(1);
        
        set((state) => ({
          imageSelections: {
            ...state.imageSelections,
            [key]: {
              ...state.imageSelections[key],
              [shotKey]: filename,
            },
          },
        }));
        
        // 异步同步到后端
        get().syncToBackend(workspacePath, generatedDir, 'images');
      },
      
      getImageSelection: (workspacePath, generatedDir, shotId) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        const shotKey = shotId.toFixed(1);
        return get().imageSelections[key]?.[shotKey];
      },
      
      getImageSelections: (workspacePath, generatedDir) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        return get().imageSelections[key] || {};
      },
      
      // ===== 视频选择 =====
      setVideoSelection: (workspacePath, generatedDir, shotId, filenames) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        const shotKey = shotId.toFixed(1);
        
        set((state) => ({
          videoSelections: {
            ...state.videoSelections,
            [key]: {
              ...state.videoSelections[key],
              [shotKey]: filenames,
            },
          },
        }));
        
        // 异步同步到后端
        get().syncToBackend(workspacePath, generatedDir, 'videos');
      },
      
      getVideoSelection: (workspacePath, generatedDir, shotId) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        const shotKey = shotId.toFixed(1);
        return get().videoSelections[key]?.[shotKey] || [];
      },
      
      getVideoSelections: (workspacePath, generatedDir) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        return get().videoSelections[key] || {};
      },
      
      // ===== 线稿选择 =====
      setOutlineSelection: (workspacePath, generatedDir, shotId, url) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        const shotKey = String(shotId);
        
        set((state) => ({
          outlineSelections: {
            ...state.outlineSelections,
            [key]: {
              ...state.outlineSelections[key],
              [shotKey]: url,
            },
          },
        }));
        
        // 异步同步到后端
        get().syncToBackend(workspacePath, generatedDir, 'outlines');
      },
      
      getOutlineSelection: (workspacePath, generatedDir, shotId) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        const shotKey = String(shotId);
        return get().outlineSelections[key]?.[shotKey];
      },
      
      getOutlineSelections: (workspacePath, generatedDir) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        return get().outlineSelections[key] || {};
      },
      
      // ===== 从后端加载 =====
      loadFromBackend: async (workspacePath, generatedDir, type) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        
        try {
          let endpoint = '';
          if (type === 'images') {
            endpoint = `/workspaces/${encodeURIComponent(workspacePath)}/selected-images?generated_dir=${encodeURIComponent(generatedDir)}`;
          } else if (type === 'videos') {
            endpoint = `/workspaces/${encodeURIComponent(workspacePath)}/selected-videos?generated_dir=${encodeURIComponent(generatedDir)}`;
          } else if (type === 'outlines') {
            endpoint = `/workspaces/${encodeURIComponent(workspacePath)}/selected-outlines?generated_dir=${encodeURIComponent(generatedDir)}`;
          }
          
          const resp = await fetch(`${API_BASE}${endpoint}`);
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          
          const data = await resp.json();
          
          // 合并后端数据（后端优先）
          if (type === 'images') {
            const indexes = data.indexes || {};
            set((state) => ({
              imageSelections: {
                ...state.imageSelections,
                [key]: { ...state.imageSelections[key], ...indexes },
              },
              loadedWorkspaces: {
                ...state.loadedWorkspaces,
                [key]: { ...state.loadedWorkspaces[key], images: true },
              },
            }));
          } else if (type === 'videos') {
            const indexes = data.indexes || {};
            set((state) => ({
              videoSelections: {
                ...state.videoSelections,
                [key]: { ...state.videoSelections[key], ...indexes },
              },
              loadedWorkspaces: {
                ...state.loadedWorkspaces,
                [key]: { ...state.loadedWorkspaces[key], videos: true },
              },
            }));
          } else if (type === 'outlines') {
            const urls = data.urls || {};
            set((state) => ({
              outlineSelections: {
                ...state.outlineSelections,
                [key]: { ...state.outlineSelections[key], ...urls },
              },
              loadedWorkspaces: {
                ...state.loadedWorkspaces,
                [key]: { ...state.loadedWorkspaces[key], outlines: true },
              },
            }));
          }
        } catch (err) {
          console.error(`加载 ${type} 选择数据失败:`, err);
          // 标记为已加载（使用本地缓存）
          set((state) => ({
            loadedWorkspaces: {
              ...state.loadedWorkspaces,
              [key]: { ...state.loadedWorkspaces[key], [type]: true },
            },
          }));
        }
      },
      
      // ===== 同步到后端 =====
      syncToBackend: async (workspacePath, generatedDir, type) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        
        try {
          let endpoint = '';
          let body: Record<string, unknown> = { generated_dir: generatedDir };
          
          if (type === 'images') {
            endpoint = `/workspaces/${encodeURIComponent(workspacePath)}/selected-images`;
            body.indexes = get().imageSelections[key] || {};
          } else if (type === 'videos') {
            endpoint = `/workspaces/${encodeURIComponent(workspacePath)}/selected-videos`;
            body.indexes = get().videoSelections[key] || {};
          } else if (type === 'outlines') {
            endpoint = `/workspaces/${encodeURIComponent(workspacePath)}/selected-outlines`;
            body.urls = get().outlineSelections[key] || {};
          }
          
          const resp = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          });
          
          if (!resp.ok) {
            throw new Error(`HTTP ${resp.status}`);
          }
          
          // 清除 pending
          set((state) => {
            const newPending = { ...state.pendingSync };
            if (newPending[type][key]) {
              delete newPending[type][key];
            }
            return { pendingSync: newPending };
          });
          
          return true;
        } catch (err) {
          console.error(`同步 ${type} 到后端失败:`, err);
          
          // 添加到 pending 队列
          set((state) => {
            const newPending = { ...state.pendingSync };
            if (type === 'images') {
              newPending.images[key] = get().imageSelections[key] || {};
            } else if (type === 'videos') {
              newPending.videos[key] = get().videoSelections[key] || {};
            } else if (type === 'outlines') {
              newPending.outlines[key] = get().outlineSelections[key] || {};
            }
            return { pendingSync: newPending };
          });
          
          return false;
        }
      },
      
      // ===== 重试 pending 同步 =====
      retryPendingSync: async () => {
        const pending = get().pendingSync;
        
        // 重试图片
        for (const key of Object.keys(pending.images)) {
          const [workspacePath, generatedDir] = key.split('::');
          await get().syncToBackend(workspacePath, generatedDir, 'images');
        }
        
        // 重试视频
        for (const key of Object.keys(pending.videos)) {
          const [workspacePath, generatedDir] = key.split('::');
          await get().syncToBackend(workspacePath, generatedDir, 'videos');
        }
        
        // 重试线稿
        for (const key of Object.keys(pending.outlines)) {
          const [workspacePath, generatedDir] = key.split('::');
          await get().syncToBackend(workspacePath, generatedDir, 'outlines');
        }
      },
      
      // ===== 检查是否已加载 =====
      isLoaded: (workspacePath, generatedDir, type) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        return get().loadedWorkspaces[key]?.[type] || false;
      },
      
      // ===== 清除 workspace 数据 =====
      clearWorkspace: (workspacePath, generatedDir) => {
        const key = get().getWorkspaceKey(workspacePath, generatedDir);
        
        set((state) => {
          const newImages = { ...state.imageSelections };
          const newVideos = { ...state.videoSelections };
          const newOutlines = { ...state.outlineSelections };
          const newLoaded = { ...state.loadedWorkspaces };
          
          delete newImages[key];
          delete newVideos[key];
          delete newOutlines[key];
          delete newLoaded[key];
          
          return {
            imageSelections: newImages,
            videoSelections: newVideos,
            outlineSelections: newOutlines,
            loadedWorkspaces: newLoaded,
          };
        });
      },
    }),
    {
      name: 'selection-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // 只持久化选择数据和 pending 队列
        imageSelections: state.imageSelections,
        videoSelections: state.videoSelections,
        outlineSelections: state.outlineSelections,
        pendingSync: state.pendingSync,
        // loadedWorkspaces 不持久化，每次刷新重新加载
      }),
    }
  )
);

// 页面加载时自动重试 pending 同步
if (typeof window !== 'undefined') {
  // 延迟执行，等待 store 初始化
  setTimeout(() => {
    const pending = useSelectionStore.getState().pendingSync;
    const hasP = Object.keys(pending.images).length > 0 
      || Object.keys(pending.videos).length > 0 
      || Object.keys(pending.outlines).length > 0;
    
    if (hasP) {
      console.log('[SelectionStore] 发现 pending 同步，开始重试...');
      useSelectionStore.getState().retryPendingSync();
    }
  }, 2000);
}
