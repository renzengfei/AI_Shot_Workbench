'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Eye, EyeOff, Loader2, CheckCircle, AlertCircle, Video } from 'lucide-react';

interface VideoConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (config: VideoGenConfig) => void;
}

export interface VideoGenConfig {
  mode: 'yunwu';
  apiKey: string;
  model: string;
  size: string;
  aspectRatio: string;
  videosPerShot: number;
  concurrency: number;
  pollInterval: number;
}

const DEFAULT_CONFIG: VideoGenConfig = {
  mode: 'yunwu',
  apiKey: '',
  model: 'grok-video-3',
  size: '1080P',
  aspectRatio: '9:16',
  videosPerShot: 3,
  concurrency: 3,
  pollInterval: 10,
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000';

export function VideoConfigModal({ isOpen, onClose, onSave }: VideoConfigModalProps) {
  const [config, setConfig] = useState<VideoGenConfig>(DEFAULT_CONFIG);
  const [showApiKey, setShowApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load config on open
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/video-gen/config`);
      if (res.ok) {
        const data = await res.json();
        setConfig({ ...DEFAULT_CONFIG, ...data });
      }
    } catch {
      // Use default config if fetch fails
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      setTestResult(null);
      setError(null);
    }
  }, [isOpen, loadConfig]);

  // Test API connection
  const handleTestConnection = async () => {
    if (!config.apiKey) {
      setError('请输入 API Key');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/yunwu/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: config.apiKey }),
      });
      if (res.ok) {
        setTestResult('success');
      } else {
        const data = await res.json();
        setError(data.detail || '连接失败');
        setTestResult('error');
      }
    } catch (e) {
      setError('网络错误');
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  };

  // Save config
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/video-gen/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        onSave?.(config);
        onClose();
      } else {
        const data = await res.json();
        setError(data.detail || '保存失败');
      }
    } catch {
      setError('保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Video size={20} className="text-blue-500" />
            <h2 className="text-lg font-semibold text-slate-800">生视频配置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* 云雾 API 配置 */}
              {/* API Key */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">API Key</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={config.apiKey}
                      onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                      placeholder="sk-..."
                      className="w-full px-3 py-2.5 pr-10 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={testing || !config.apiKey}
                    className="px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {testing ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : testResult === 'success' ? (
                      <CheckCircle size={14} className="text-green-500" />
                    ) : testResult === 'error' ? (
                      <AlertCircle size={14} className="text-red-500" />
                    ) : null}
                    测试
                  </button>
                </div>
              </div>

              {/* Model & Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">模型</label>
                  <select
                    value={config.model}
                    onChange={(e) => setConfig({ ...config, model: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  >
                    <option value="grok-video-3">grok-video-3</option>
                    <option value="grok-video-2">grok-video-2</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">尺寸</label>
                  <select
                    value={config.size}
                    onChange={(e) => setConfig({ ...config, size: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
                  >
                    <option value="720P">720P</option>
                    <option value="1080P">1080P</option>
                  </select>
                </div>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">比例</label>
                <div className="flex gap-2">
                  {['9:16', '16:9', '1:1'].map((ratio) => (
                    <button
                      key={ratio}
                      onClick={() => setConfig({ ...config, aspectRatio: ratio })}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition border ${
                        config.aspectRatio === ratio
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
              </div>

          {/* Common Settings */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              并发数 <span className="text-slate-400">({config.concurrency})</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={config.concurrency}
              onChange={(e) => setConfig({ ...config, concurrency: Number(e.target.value) })}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Poll Interval */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">轮询间隔（秒）</label>
            <input
              type="number"
              min={5}
              max={60}
              value={config.pollInterval}
              onChange={(e) => setConfig({ ...config, pollInterval: Number(e.target.value) })}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-200 transition"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            保存配置
          </button>
        </div>
      </div>
    </div>
  );
}
