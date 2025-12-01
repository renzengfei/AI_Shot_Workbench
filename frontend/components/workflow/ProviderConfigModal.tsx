'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Pencil, Trash2, Check, Loader2, Eye, EyeOff, Rabbit, Candy } from 'lucide-react';
import { ImageProvider, ProviderType, ProviderCreateRequest, PROVIDER_TYPE_CONFIG } from '@/types/provider';

interface ProviderConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderChange?: () => void;
}

type ViewMode = 'list' | 'form';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export function ProviderConfigModal({ isOpen, onClose, onProviderChange }: ProviderConfigModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [providers, setProviders] = useState<ImageProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProviderCreateRequest>({
    name: '',
    type: 'rabbit',
    api_key: '',
    endpoint: '',
    model: '',
    is_default: false,
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Fetch providers
  const fetchProviders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/providers`);
      if (!res.ok) throw new Error('获取供应商列表失败');
      const data = await res.json();
      setProviders(data.providers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
      setViewMode('list');
    }
  }, [isOpen, fetchProviders]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      type: 'rabbit',
      api_key: '',
      endpoint: PROVIDER_TYPE_CONFIG.rabbit.defaultEndpoint,
      model: PROVIDER_TYPE_CONFIG.rabbit.defaultModel,
      is_default: false,
    });
    setEditingId(null);
    setShowApiKey(false);
  };

  // Handle type change - auto fill defaults
  const handleTypeChange = (type: ProviderType) => {
    const config = PROVIDER_TYPE_CONFIG[type];
    setFormData(prev => ({
      ...prev,
      type,
      endpoint: prev.endpoint || config.defaultEndpoint,
      model: prev.model || config.defaultModel,
    }));
  };

  // Open form for new provider
  const handleAddNew = () => {
    resetForm();
    setViewMode('form');
  };

  // Open form for editing
  const handleEdit = (provider: ImageProvider) => {
    setFormData({
      name: provider.name,
      type: provider.type,
      api_key: '', // Don't fill API key for security
      endpoint: provider.endpoint,
      model: provider.model,
      is_default: provider.is_default,
    });
    setEditingId(provider.id);
    setViewMode('form');
  };

  // Save provider
  const handleSave = async () => {
    if (!formData.name || !formData.endpoint || !formData.model) {
      setError('请填写所有必填字段');
      return;
    }
    if (!editingId && !formData.api_key) {
      setError('请填写 API Key');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url = editingId 
        ? `${API_BASE}/api/providers/${editingId}`
        : `${API_BASE}/api/providers`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      // For update, only send changed fields
      const body = editingId
        ? {
            name: formData.name,
            endpoint: formData.endpoint,
            model: formData.model,
            is_default: formData.is_default,
            ...(formData.api_key ? { api_key: formData.api_key } : {}),
          }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || '保存失败');
      }

      await fetchProviders();
      onProviderChange?.();
      setViewMode('list');
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // Delete provider
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/providers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('删除失败');
      await fetchProviders();
      onProviderChange?.();
      setDeleteConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败');
    }
  };

  // Set default provider
  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/providers/${id}/set-default`, { method: 'POST' });
      if (!res.ok) throw new Error('设置失败');
      await fetchProviders();
      onProviderChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : '设置默认失败');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            {viewMode === 'list' ? '生图模型配置' : (editingId ? '编辑供应商' : '添加供应商')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {viewMode === 'list' ? (
            // List View
            <div className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                </div>
              ) : providers.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p className="mb-4">暂无配置的供应商</p>
                  <button
                    onClick={handleAddNew}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                  >
                    <Plus size={18} />
                    添加第一个供应商
                  </button>
                </div>
              ) : (
                <>
                  {providers.map(provider => (
                    <div
                      key={provider.id}
                      className={`p-4 rounded-xl border transition-all ${
                        provider.is_default
                          ? 'border-blue-400/50 bg-blue-50/50 dark:bg-blue-900/20'
                          : 'border-slate-200/50 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${
                            provider.type === 'rabbit' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-pink-100 dark:bg-pink-900/30'
                          }`}>
                            {provider.type === 'rabbit' ? (
                              <Rabbit size={20} className="text-orange-600 dark:text-orange-400" />
                            ) : (
                              <Candy size={20} className="text-pink-600 dark:text-pink-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-800 dark:text-slate-100">{provider.name}</span>
                              {provider.is_default && (
                                <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500 text-white">默认</span>
                              )}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                              <p>类型: {PROVIDER_TYPE_CONFIG[provider.type].label}</p>
                              <p>模型: {provider.model}</p>
                              <p className="truncate max-w-xs">端点: {provider.endpoint}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {!provider.is_default && (
                            <button
                              onClick={() => handleSetDefault(provider.id)}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="设为默认"
                            >
                              <Check size={16} className="text-slate-400 hover:text-green-500" />
                            </button>
                          )}
                          <button
                            onClick={() => handleEdit(provider)}
                            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="编辑"
                          >
                            <Pencil size={16} className="text-slate-400 hover:text-blue-500" />
                          </button>
                          {deleteConfirm === provider.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(provider.id)}
                                className="px-2 py-1 text-xs rounded bg-red-500 text-white hover:bg-red-600"
                              >
                                确认
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-1 text-xs rounded bg-slate-200 dark:bg-slate-700 hover:bg-slate-300"
                              >
                                取消
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(provider.id)}
                              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="删除"
                            >
                              <Trash2 size={16} className="text-slate-400 hover:text-red-500" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handleAddNew}
                    className="w-full p-4 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 hover:border-blue-400 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    添加供应商
                  </button>
                </>
              )}
            </div>
          ) : (
            // Form View
            <div className="space-y-5">
              {/* Provider Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  供应商类型 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['rabbit', 'candy'] as ProviderType[]).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleTypeChange(type)}
                      disabled={!!editingId}
                      className={`p-4 rounded-xl border-2 transition-all text-left ${
                        formData.type === type
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      } ${editingId ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {type === 'rabbit' ? (
                          <Rabbit size={18} className="text-orange-500" />
                        ) : (
                          <Candy size={18} className="text-pink-500" />
                        )}
                        <span className="font-medium">{PROVIDER_TYPE_CONFIG[type].label}</span>
                      </div>
                      <p className="text-xs text-slate-500">{PROVIDER_TYPE_CONFIG[type].description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="例如: 公司内部 Rabbit"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* API Key */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  API Key {!editingId && <span className="text-red-500">*</span>}
                  {editingId && <span className="text-slate-400 text-xs ml-2">(留空则不修改)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={formData.api_key}
                    onChange={e => setFormData(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder={editingId ? '留空则保持原有 Key' : '输入 API Key'}
                    className="w-full px-4 py-3 pr-12 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                  >
                    {showApiKey ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Endpoint */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  端点 (Endpoint) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.endpoint}
                  onChange={e => setFormData(prev => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Model */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  模型名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={e => setFormData(prev => ({ ...prev, model: e.target.value }))}
                  placeholder="例如: gemini-3-pro"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              {/* Is Default */}
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={e => setFormData(prev => ({ ...prev, is_default: e.target.checked }))}
                  className="w-5 h-5 rounded border-slate-300 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">设为默认供应商</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200/50 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
          {viewMode === 'form' ? (
            <>
              <button
                onClick={() => { setViewMode('list'); resetForm(); }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 rounded-xl bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editingId ? '保存修改' : '添加'}
              </button>
            </>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
