import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  RuntimeConfig,
  ProviderType,
  InvocationLog,
  ConnectionTestResult,
} from '../types/aiConfig';
import {
  Settings,
  Cpu,
  Key,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Server,
  Zap,
  Activity,
  Sliders,
  Eye,
  EyeOff,
  Trash2,
  Layers,
  ArrowRightLeft,
  X,
  Radio,
  Clock,
  ExternalLink,
  ChevronRight,
  Database,
  Lock,
} from 'lucide-react';

interface AiManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AiManagementModal: React.FC<AiManagementModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'providers' | 'models' | 'params' | 'logs'>('providers');
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [logs, setLogs] = useState<InvocationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Key Edit inputs per provider: { deepseek: 'sk-...' }
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [keyInputVisible, setKeyInputVisible] = useState<Record<string, boolean>>({});
  const [isSavingKey, setIsSavingKey] = useState<Record<string, boolean>>({});
  const [isTestingProvider, setIsTestingProvider] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});

  // Confirm delete key state
  const [confirmDeleteProvider, setConfirmDeleteProvider] = useState<ProviderType | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadLogs();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const data = await api.getAiSettings();
      if (data.config) {
        setConfig(data.config);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '加载 AI 设置失败');
    } finally {
      setIsLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const data = await api.getAiLogs();
      if (data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.warn('Failed to load logs', err);
    }
  };

  const handleSaveKey = async (provider: ProviderType) => {
    const rawKey = keyInputs[provider];
    if (!rawKey || !rawKey.trim()) {
      setErrorMsg('请输入有效的 API Key');
      return;
    }

    setIsSavingKey((prev) => ({ ...prev, [provider]: true }));
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await api.saveProviderKey(provider, rawKey.trim());
      if (res.config) {
        setConfig(res.config);
      }
      setSuccessMsg(`服务商 ${provider} 密钥已安全加密存储`);
      // clear input field for security
      setKeyInputs((prev) => ({ ...prev, [provider]: '' }));
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || '保存密钥失败');
    } finally {
      setIsSavingKey((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleDeleteKey = async (provider: ProviderType) => {
    try {
      const res = await api.deleteProviderKey(provider);
      if (res.config) {
        setConfig(res.config);
      }
      setConfirmDeleteProvider(null);
      setSuccessMsg(`已成功清除 ${provider} 的 API 密钥`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || '清除密钥失败');
    }
  };

  const handleTestConnection = async (provider: ProviderType) => {
    setIsTestingProvider((prev) => ({ ...prev, [provider]: true }));
    setErrorMsg(null);
    const candidateKey = keyInputs[provider]?.trim();

    try {
      const res = await api.testProviderConnection(provider, candidateKey || undefined);
      setTestResults((prev) => ({ ...prev, [provider]: res }));
      if (res.success) {
        setSuccessMsg(`${provider} 真实连接测试成功 (延迟: ${res.latencyMs}ms)`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
      // Reload config to sync test badge
      loadSettings();
    } catch (err: any) {
      setErrorMsg(err.message || '测试连接失败');
    } finally {
      setIsTestingProvider((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleToggleProvider = async (provider: ProviderType, currentEnabled: boolean) => {
    if (!config) return;
    try {
      const updatedProviders = {
        ...config.providers,
        [provider]: {
          ...config.providers[provider],
          enabled: !currentEnabled,
        },
      };
      const res = await api.updateAiSettings({ providers: updatedProviders });
      if (res.config) setConfig(res.config);
    } catch (err: any) {
      setErrorMsg(err.message || '切换状态失败');
    }
  };

  const handleUpdateActiveModel = async (
    category: 'text' | 'image' | 'voice',
    provider: ProviderType,
    model: string
  ) => {
    if (!config) return;
    try {
      const patch: any = {};
      if (category === 'text') {
        patch.activeTextProvider = provider;
        patch.activeTextModel = model;
      } else if (category === 'image') {
        patch.activeImageProvider = provider;
        patch.activeImageModel = model;
      } else if (category === 'voice') {
        patch.activeVoiceProvider = provider;
        patch.activeVoiceModel = model;
      }

      const res = await api.updateAiSettings(patch);
      if (res.config) {
        setConfig(res.config);
        setSuccessMsg(`已将 ${category === 'text' ? '文本' : category === 'image' ? '图像' : '语音'} 默认模型切换为 ${model}`);
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '切换模型失败');
    }
  };

  const handleToggleFallback = async (category: 'text' | 'image' | 'voice') => {
    if (!config) return;
    try {
      const patch: any = {};
      if (category === 'text') {
        patch.enableFallbackText = !config.enableFallbackText;
      } else if (category === 'image') {
        patch.enableFallbackImage = !config.enableFallbackImage;
      } else if (category === 'voice') {
        patch.enableFallbackVoice = !config.enableFallbackVoice;
      }

      const res = await api.updateAiSettings(patch);
      if (res.config) setConfig(res.config);
    } catch (err: any) {
      setErrorMsg(err.message || '更新备用模型配置失败');
    }
  };

  const handleClearLogs = async () => {
    try {
      await api.clearAiLogs();
      setLogs([]);
      setSuccessMsg('调用审计日志已清空');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || '清空日志失败');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-700/80 rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-800 flex items-center justify-between bg-stone-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-stone-100">AI 管理中心</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  AES-256-GCM 安全保险库
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                直接管理 DeepSeek、火山引擎 Ark、MiniMax 与 Gemini 密钥、实时测试连通性与模型降级策略
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Alerts */}
        {errorMsg && (
          <div className="px-6 py-2.5 bg-rose-950/50 border-b border-rose-800/80 text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="px-6 py-2.5 bg-emerald-950/50 border-b border-emerald-800/80 text-emerald-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-200">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-6 border-b border-stone-800 bg-stone-900/60 flex items-center gap-2 pt-2">
          {[
            { id: 'providers', label: '供应商管理', icon: Key },
            { id: 'models', label: '模型与降级', icon: Layers },
            { id: 'params', label: '生成参数', icon: Sliders },
            { id: 'logs', label: '调用审计与日志', icon: Activity, count: logs.length },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                  active
                    ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-stone-400 hover:text-stone-200 hover:bg-stone-800/40'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-stone-800 text-stone-400 font-mono">
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading || !config ? (
            <div className="py-16 text-center space-y-3">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-stone-400">正在与安全配置保险库同步状态...</p>
            </div>
          ) : (
            <>
              {/* ========================================================= */}
              {/* TAB 1: 供应商独立配置卡片 (PROVIDERS)                     */}
              {/* ========================================================= */}
              {activeTab === 'providers' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-stone-200">AI 供应商列表</h3>
                      <p className="text-xs text-stone-400">
                        管理 API Key、Base URL 与连通性校验。Key 加密存储于服务端内存与受保护卷，前端仅展示脱敏掩码。
                      </p>
                    </div>
                    <button
                      onClick={loadSettings}
                      className="px-2.5 py-1 text-xs font-medium text-stone-400 hover:text-stone-200 bg-stone-800/70 rounded-lg flex items-center gap-1.5 border border-stone-700/60"
                      title="刷新配置状态"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>刷新</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(config.providers).map((prov) => {
                      const hasKey = prov.hasApiKey;
                      const isTesting = isTestingProvider[prov.id];
                      const isSaving = isSavingKey[prov.id];
                      const testRes = testResults[prov.id];

                      return (
                        <div
                          key={prov.id}
                          className={`bg-stone-950/60 border rounded-xl p-4 space-y-3 transition-all ${
                            prov.enabled
                              ? 'border-stone-800 hover:border-stone-700'
                              : 'border-stone-800/40 opacity-70'
                          }`}
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between pb-2 border-b border-stone-800/60">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-lg bg-stone-800 flex items-center justify-center text-xs font-bold text-amber-400 border border-stone-700">
                                {prov.name.charAt(0)}
                              </span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs text-stone-200">{prov.name}</span>
                                  {prov.id === 'deepseek' && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                      默认文本
                                    </span>
                                  )}
                                  {prov.id === 'volcengine' && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                      默认生图
                                    </span>
                                  )}
                                  {prov.id === 'minimax' && (
                                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-500/15 text-purple-400 border border-purple-500/30">
                                      默认语音
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-stone-500 font-mono truncate max-w-[200px] block">
                                  {prov.baseUrl}
                                </span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleToggleProvider(prov.id, prov.enabled)}
                              className={`text-[10px] px-2.5 py-1 rounded-full font-bold transition-all cursor-pointer ${
                                prov.enabled
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                  : 'bg-stone-800 text-stone-400 border border-stone-700'
                              }`}
                            >
                              {prov.enabled ? '已启用' : '已停用'}
                            </button>
                          </div>

                          {/* Key Status & Mask */}
                          <div className="bg-stone-900/70 rounded-lg p-2.5 border border-stone-800 space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-stone-400 flex items-center gap-1.5">
                                <Key className="w-3.5 h-3.5 text-stone-500" />
                                <span>API Key 状态:</span>
                              </span>
                              {hasKey ? (
                                <span className="text-emerald-400 font-mono text-[11px] flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                  <span>{prov.apiKeyMasked}</span>
                                </span>
                              ) : (
                                <span className="text-amber-400 text-[11px] flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>未配置密钥</span>
                                </span>
                              )}
                            </div>

                            {/* Key Input Box */}
                            <div className="flex items-center gap-1.5">
                              <div className="relative flex-1">
                                <input
                                  type={keyInputVisible[prov.id] ? 'text' : 'password'}
                                  placeholder={hasKey ? '输入新 Key 以覆盖更新' : '输入供应商 API Key'}
                                  value={keyInputs[prov.id] || ''}
                                  onChange={(e) =>
                                    setKeyInputs((prev) => ({ ...prev, [prov.id]: e.target.value }))
                                  }
                                  className="w-full bg-stone-950 border border-stone-800 rounded-lg pl-2.5 pr-8 py-1 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500 font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setKeyInputVisible((prev) => ({
                                      ...prev,
                                      [prov.id]: !prev[prov.id],
                                    }))
                                  }
                                  className="absolute right-2 top-1.5 text-stone-500 hover:text-stone-300"
                                >
                                  {keyInputVisible[prov.id] ? (
                                    <EyeOff className="w-3 h-3" />
                                  ) : (
                                    <Eye className="w-3 h-3" />
                                  )}
                                </button>
                              </div>

                              <button
                                onClick={() => handleSaveKey(prov.id)}
                                disabled={isSaving || !keyInputs[prov.id]?.trim()}
                                className="px-2.5 py-1 text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-stone-950 rounded-lg transition-colors cursor-pointer shrink-0"
                              >
                                {isSaving ? '保存中' : '保存'}
                              </button>

                              {hasKey && (
                                <button
                                  onClick={() => setConfirmDeleteProvider(prov.id)}
                                  className="p-1.5 text-stone-500 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors"
                                  title="删除此密钥"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Test Connection Button & Result */}
                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={() => handleTestConnection(prov.id)}
                              disabled={isTesting || (!hasKey && !keyInputs[prov.id]?.trim())}
                              className="px-3 py-1 text-xs font-medium text-stone-200 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 rounded-lg transition-colors border border-stone-700 flex items-center gap-1.5 cursor-pointer"
                            >
                              {isTesting ? (
                                <>
                                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                                  <span>正在连通测试...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3 h-3 text-amber-400" />
                                  <span>测试 API 连接</span>
                                </>
                              )}
                            </button>

                            {/* Status Badge */}
                            {prov.lastTestStatus && (
                              <div className="text-[11px] flex items-center gap-1 font-medium">
                                {prov.lastTestStatus === 'success' ? (
                                  <span className="text-emerald-400 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>正常</span>
                                  </span>
                                ) : (
                                  <span className="text-rose-400 flex items-center gap-1" title={prov.lastTestMessage}>
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>失败</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* MiniMax Specific Documentation & Troubleshooting Guide */}
                          {prov.id === 'minimax' && (
                            <div className="text-[11px] bg-stone-900/80 rounded-lg p-3 border border-purple-500/25 text-stone-300 space-y-1.5">
                              <div className="font-semibold text-purple-300 flex items-center justify-between">
                                <span>MiniMax 官方鉴权指引 (platform.minimax.cn)</span>
                                <a
                                  href="https://platform.minimax.cn/user-center/basic-information/interface-key"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[10px]"
                                >
                                  <span>打开开放平台获取 Key</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              </div>
                              <ul className="list-disc pl-3.5 space-y-1 text-[10.5px] leading-relaxed text-stone-400">
                                <li>
                                  <strong className="text-stone-200">必须使用按量付费 Key</strong>：请前往「账户管理 &gt; 接口密钥」创建 API Key。请勿填入「订阅管理 &gt; M Plan」的订阅 Key（M Plan 仅限文本，不支持语音合成 T2A 会报 1004）。
                                </li>
                                <li>
                                  <strong className="text-stone-200">确保账户有余额</strong>：在「账户管理 &gt; 余额」确认账户拥有可用额度；新创建的 Key 请等待约 1 分钟网关生效。
                                </li>
                                <li>
                                  <strong className="text-stone-200">内置高保真 Gemini 语音</strong>：若暂未充值或 Key 未生效，可在「模型管理」开启【语音自动降级】，系统将自动使用 Google Gemini 精英男声 (Charon) 顺畅完成旁白！
                                </li>
                              </ul>
                            </div>
                          )}

                          {/* Last Test Message Output */}
                          {prov.lastTestMessage && (
                            <div
                              className={`p-2 rounded text-[11px] font-mono leading-tight whitespace-pre-line ${
                                prov.lastTestStatus === 'success'
                                  ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-900/40'
                                  : 'bg-rose-950/30 text-rose-300 border border-rose-900/40'
                              }`}
                            >
                              {prov.lastTestMessage}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 2: 模型切换与备用降级 (MODELS)                          */}
              {/* ========================================================= */}
              {activeTab === 'models' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-stone-200">默认模型与备用降级机制</h3>
                    <p className="text-xs text-stone-400">
                      独立配置各业务能力的默认模型。只有当您显式开启“自动降级”时，主模型故障才会自动调用备用模型。
                    </p>
                  </div>

                  {/* 1. TEXT SECTION */}
                  <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-amber-400">文本生成与推理 (小说分析 / 脚本 / 分镜)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400">故障备用模型降级:</span>
                        <button
                          onClick={() => handleToggleFallback('text')}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold cursor-pointer transition-all ${
                            config.enableFallbackText
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-stone-800 text-stone-500 border border-stone-700'
                          }`}
                        >
                          {config.enableFallbackText ? '已开启' : '已关闭'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Active Text Model */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-stone-400 block font-medium">当前默认服务商与模型</label>
                        <div className="p-3 bg-stone-900 rounded-lg border border-amber-500/40 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-amber-300">
                              {config.providers[config.activeTextProvider]?.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                              生效中
                            </span>
                          </div>
                          <select
                            value={config.activeTextModel}
                            onChange={(e) =>
                              handleUpdateActiveModel('text', config.activeTextProvider, e.target.value)
                            }
                            className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500 font-mono"
                          >
                            {config.providers[config.activeTextProvider]?.availableModels.map((m) => (
                              <option key={m} value={m}>
                                {m === 'deepseek-flash'
                                  ? 'deepseek-flash (最新·V4.1 Flash 极速推荐)'
                                  : m === 'deepseek-v4-pro'
                                  ? 'deepseek-v4-pro (最新·V4 Pro 高精度)'
                                  : m === 'deepseek-chat'
                                  ? 'deepseek-chat (通用·V3 旗舰)'
                                  : m === 'deepseek-reasoner'
                                  ? 'deepseek-reasoner (R1 深度思考)'
                                  : m}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Switch provider dropdown */}
                      <div className="space-y-1.5">
                        <label className="text-xs text-stone-400 block font-medium">切换主服务商</label>
                        <div className="p-3 bg-stone-900 rounded-lg border border-stone-800 space-y-2">
                          <div className="text-xs text-stone-400">选择服务商:</div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleUpdateActiveModel('text', 'deepseek', 'deepseek-flash')}
                              className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                                config.activeTextProvider === 'deepseek'
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                              }`}
                            >
                              DeepSeek (推荐)
                            </button>
                            <button
                              onClick={() => handleUpdateActiveModel('text', 'gemini', 'gemini-3.8-flash')}
                              className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                                config.activeTextProvider === 'gemini'
                                  ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                  : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                              }`}
                            >
                              Gemini 3.8
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. IMAGE SECTION */}
                  <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                      <span className="text-xs font-bold text-blue-400">图片生成 (分镜原画插图)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400">自动备用降级:</span>
                        <button
                          onClick={() => handleToggleFallback('image')}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold cursor-pointer transition-all ${
                            config.enableFallbackImage
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-stone-800 text-stone-500 border border-stone-700'
                          }`}
                        >
                          {config.enableFallbackImage ? '已开启' : '已关闭'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-stone-900 rounded-lg border border-blue-500/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-blue-300">
                            {config.providers[config.activeImageProvider]?.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 font-mono">
                            生效中
                          </span>
                        </div>
                        <select
                          value={config.activeImageModel}
                          onChange={(e) =>
                            handleUpdateActiveModel('image', config.activeImageProvider, e.target.value)
                          }
                          className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-blue-500 font-mono"
                        >
                          {config.providers[config.activeImageProvider]?.availableModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="p-3 bg-stone-900 rounded-lg border border-stone-800 space-y-2">
                        <div className="text-xs text-stone-400">切换生图服务商:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              handleUpdateActiveModel('image', 'volcengine', 'doubao-seedream-5-0-flash-260915')
                            }
                            className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                              config.activeImageProvider === 'volcengine'
                                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            火山引擎 Seedream (推荐)
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateActiveModel('image', 'gemini', 'gemini-3.1-flash-lite-image')
                            }
                            className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                              config.activeImageProvider === 'gemini'
                                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            Gemini Image
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. VOICE SECTION */}
                  <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                      <span className="text-xs font-bold text-purple-400">语音合成 (推文旁白口播配音)</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-400">自动备用降级:</span>
                        <button
                          onClick={() => handleToggleFallback('voice')}
                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold cursor-pointer transition-all ${
                            config.enableFallbackVoice
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-stone-800 text-stone-500 border border-stone-700'
                          }`}
                        >
                          {config.enableFallbackVoice ? '已开启' : '已关闭'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-3 bg-stone-900 rounded-lg border border-purple-500/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-purple-300">
                            {config.providers[config.activeVoiceProvider]?.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 font-mono">
                            生效中
                          </span>
                        </div>
                        <select
                          value={config.activeVoiceModel}
                          onChange={(e) =>
                            handleUpdateActiveModel('voice', config.activeVoiceProvider, e.target.value)
                          }
                          className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-purple-500 font-mono"
                        >
                          {config.providers[config.activeVoiceProvider]?.availableModels.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="p-3 bg-stone-900 rounded-lg border border-stone-800 space-y-2">
                        <div className="text-xs text-stone-400">切换配音服务商:</div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              handleUpdateActiveModel('voice', 'minimax', 'speech-2.8-hd')
                            }
                            className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                              config.activeVoiceProvider === 'minimax'
                                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            MiniMax Speech (推荐)
                          </button>
                          <button
                            onClick={() =>
                              handleUpdateActiveModel('voice', 'gemini', 'gemini-3.8-flash-lite-tts')
                            }
                            className={`p-2 rounded-lg text-xs font-semibold border transition-all ${
                              config.activeVoiceProvider === 'gemini'
                                ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                                : 'bg-stone-950 border-stone-800 text-stone-400 hover:text-stone-200'
                            }`}
                          >
                            Gemini TTS
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 3: 参数细调 (PARAMS)                                   */}
              {/* ========================================================= */}
              {activeTab === 'params' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-stone-200">各模态模型运行参数</h3>
                    <p className="text-xs text-stone-400">
                      仅针对具体支持该参数的供应商生效，避免将不兼容参数传递给其他模型。
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Text Params */}
                    <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5" />
                        <span>文本生成参数</span>
                      </span>

                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="flex justify-between text-stone-400 mb-1">
                            <span>Temperature:</span>
                            <span className="font-mono text-amber-400">{config.textParams.temperature}</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="1.5"
                            step="0.05"
                            value={config.textParams.temperature}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                textParams: { ...config.textParams, temperature: parseFloat(e.target.value) },
                              })
                            }
                            className="w-full accent-amber-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-stone-400 mb-1">
                            <span>Max Tokens:</span>
                            <span className="font-mono text-stone-200">{config.textParams.maxTokens}</span>
                          </div>
                          <input
                            type="number"
                            value={config.textParams.maxTokens}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                textParams: { ...config.textParams, maxTokens: parseInt(e.target.value) || 2048 },
                              })
                            }
                            className="w-full bg-stone-950 border border-stone-800 rounded px-2 py-1 text-stone-200 font-mono text-xs"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-stone-400 mb-1">
                            <span>Top P:</span>
                            <span className="font-mono text-stone-200">{config.textParams.topP}</span>
                          </div>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={config.textParams.topP}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                textParams: { ...config.textParams, topP: parseFloat(e.target.value) || 0.95 },
                              })
                            }
                            className="w-full bg-stone-950 border border-stone-800 rounded px-2 py-1 text-stone-200 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Image Params */}
                    <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5" />
                        <span>图像渲染参数</span>
                      </span>

                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-stone-400 block mb-1">默认画布比例</label>
                          <select
                            value={config.imageParams.aspectRatio}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                imageParams: { ...config.imageParams, aspectRatio: e.target.value },
                              })
                            }
                            className="w-full bg-stone-950 border border-stone-800 rounded px-2 py-1 text-stone-200"
                          >
                            <option value="9:16">9:16 (短视频竖屏最佳)</option>
                            <option value="16:9">16:9 (横屏微电影)</option>
                            <option value="1:1">1:1 (方形卡片)</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-stone-400 block mb-1">宽度 (px)</label>
                            <input
                              type="number"
                              value={config.imageParams.width}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  imageParams: { ...config.imageParams, width: parseInt(e.target.value) || 1080 },
                                })
                              }
                              className="w-full bg-stone-950 border border-stone-800 rounded px-2 py-1 text-stone-200 font-mono"
                            />
                          </div>
                          <div>
                            <label className="text-stone-400 block mb-1">高度 (px)</label>
                            <input
                              type="number"
                              value={config.imageParams.height}
                              onChange={(e) =>
                                setConfig({
                                  ...config,
                                  imageParams: { ...config.imageParams, height: parseInt(e.target.value) || 1920 },
                                })
                              }
                              className="w-full bg-stone-950 border border-stone-800 rounded px-2 py-1 text-stone-200 font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Voice Params */}
                    <div className="bg-stone-950/60 border border-stone-800 rounded-xl p-4 space-y-3">
                      <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5" />
                        <span>配音音频参数</span>
                      </span>

                      <div className="space-y-2 text-xs">
                        <div>
                          <div className="flex justify-between text-stone-400 mb-1">
                            <span>语速 (Speed):</span>
                            <span className="font-mono text-purple-400">{config.voiceParams.speed}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={config.voiceParams.speed}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                voiceParams: { ...config.voiceParams, speed: parseFloat(e.target.value) },
                              })
                            }
                            className="w-full accent-purple-500"
                          />
                        </div>

                        <div>
                          <div className="flex justify-between text-stone-400 mb-1">
                            <span>音量 (Volume):</span>
                            <span className="font-mono text-stone-200">{config.voiceParams.volume}x</span>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="1.5"
                            step="0.1"
                            value={config.voiceParams.volume}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                voiceParams: { ...config.voiceParams, volume: parseFloat(e.target.value) },
                              })
                            }
                            className="w-full accent-purple-500"
                          />
                        </div>

                        <div>
                          <label className="text-stone-400 block mb-1">默认音色 ID (MiniMax)</label>
                          <select
                            value={config.voiceParams.voiceId}
                            onChange={(e) =>
                              setConfig({
                                ...config,
                                voiceParams: { ...config.voiceParams, voiceId: e.target.value },
                              })
                            }
                            className="w-full bg-stone-950 border border-stone-800 rounded px-2 py-1 text-stone-200 text-xs"
                          >
                            <option value="female-yujie">female-yujie (御姐音 · 悬疑/豪门)</option>
                            <option value="female-tianmei">female-tianmei (甜美音 · 现代言情)</option>
                            <option value="male-qn-qingse">male-qn-qingse (青年青涩 · 校园/逆袭)</option>
                            <option value="male-qn-jingying">male-qn-jingying (青年精英 · 悬念反转)</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={async () => {
                        const res = await api.updateAiSettings({
                          textParams: config.textParams,
                          imageParams: config.imageParams,
                          voiceParams: config.voiceParams,
                        });
                        if (res.config) setConfig(res.config);
                        setSuccessMsg('生成参数已成功保存并实时生效');
                        setTimeout(() => setSuccessMsg(null), 3000);
                      }}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer"
                    >
                      保存全部参数修改
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* TAB 4: 调用审计与日志 (LOGS)                                */}
              {/* ========================================================= */}
              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-stone-200">最近 AI 调用审计记录</h3>
                      <p className="text-xs text-stone-400">
                        记录实际调用的供应商、模型、执行时长与备用自动降级轨迹。
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={loadLogs}
                        className="px-2.5 py-1 text-xs text-stone-300 bg-stone-800 hover:bg-stone-700 rounded-lg flex items-center gap-1.5 border border-stone-700 cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>刷新日志</span>
                      </button>

                      {logs.length > 0 && (
                        <button
                          onClick={handleClearLogs}
                          className="px-2.5 py-1 text-xs text-rose-300 bg-rose-950/40 hover:bg-rose-900/60 rounded-lg flex items-center gap-1.5 border border-rose-800/60 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>清空日志</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {logs.length === 0 ? (
                    <div className="p-12 text-center bg-stone-950/40 border border-stone-800 rounded-xl space-y-2">
                      <Activity className="w-8 h-8 text-stone-600 mx-auto" />
                      <p className="text-xs text-stone-400">暂无 AI 调用记录</p>
                      <p className="text-[11px] text-stone-600">在工作台生成推文脚本、分镜或配音后将自动产生审计追踪</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[500px] overflow-y-auto">
                      {logs.map((log) => {
                        const isSuccess = log.status === 'success';
                        const isFallback = log.status === 'fallback_triggered';
                        return (
                          <div
                            key={log.id}
                            className={`p-3 rounded-xl border text-xs space-y-1.5 font-mono ${
                              isSuccess
                                ? 'bg-stone-950/70 border-stone-800'
                                : isFallback
                                ? 'bg-amber-950/20 border-amber-800/50'
                                : 'bg-rose-950/30 border-rose-800/60'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`px-1.5 py-0.2 rounded font-bold uppercase text-[10px] ${
                                    log.category === 'text'
                                      ? 'bg-amber-500/20 text-amber-400'
                                      : log.category === 'image'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-purple-500/20 text-purple-400'
                                  }`}
                                >
                                  {log.category}
                                </span>
                                <span className="font-bold text-stone-200">{log.action}</span>
                                <span className="text-stone-500">
                                  {new Date(log.timestamp).toLocaleTimeString()}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className="text-stone-400">{log.durationMs}ms</span>
                                {isSuccess && (
                                  <span className="text-emerald-400 flex items-center gap-1 font-sans">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>成功</span>
                                  </span>
                                )}
                                {isFallback && (
                                  <span className="text-amber-400 flex items-center gap-1 font-sans">
                                    <ArrowRightLeft className="w-3.5 h-3.5" />
                                    <span>降级生效</span>
                                  </span>
                                )}
                                {!isSuccess && !isFallback && (
                                  <span className="text-rose-400 flex items-center gap-1 font-sans">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>失败</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-stone-400 text-[11px]">
                              <span>服务商: <b className="text-stone-200">{log.provider}</b></span>
                              <span>·</span>
                              <span>模型: <b className="text-stone-200">{log.model}</b></span>
                              {log.fallbackUsed && (
                                <>
                                  <span>·</span>
                                  <span className="text-amber-400">
                                    备用已调用: {log.fallbackProvider}/{log.fallbackModel}
                                  </span>
                                </>
                              )}
                            </div>

                            {log.promptSnippet && (
                              <div className="text-[10px] text-stone-500 truncate bg-stone-900/60 p-1 rounded">
                                输入: {log.promptSnippet}
                              </div>
                            )}

                            {log.error && (
                              <div className="text-[10px] text-rose-300 bg-rose-950/40 p-1.5 rounded border border-rose-900/40">
                                错误详情: {log.error}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-stone-800 bg-stone-950 flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-stone-400" />
            <span>配置与加密凭据存储于安全卷: /tmp/novel_ai_config</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-stone-300 hover:text-stone-100 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors cursor-pointer"
          >
            关闭管理中心
          </button>
        </div>
      </div>

      {/* Delete Key Confirmation Dialog */}
      {confirmDeleteProvider && (
        <div className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="w-5 h-5" />
              <h4 className="text-sm font-bold text-stone-100">确认删除 API Key</h4>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              确定要删除服务商 <b className="text-amber-400">{confirmDeleteProvider}</b> 的 API Key 吗？
              删除后，调用该供应商的生成任务将无法执行，除非重新配置。
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteProvider(null)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 bg-stone-800 rounded-lg cursor-pointer"
              >
                取消
              </button>
              <button
                onClick={() => handleDeleteKey(confirmDeleteProvider)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg cursor-pointer"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
