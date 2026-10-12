import React, { useState } from 'react';
import { NovelProject, ScriptState } from '../../types/project';
import { api } from '../../services/api';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Scissors,
  Maximize2,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  TrendingUp,
  History,
  Copy,
  Check,
  Edit3,
} from 'lucide-react';

interface Step2ScriptProps {
  project: NovelProject;
  onUpdateScript: (script: Partial<ScriptState>) => void;
  onNext: () => void;
  onPrev: () => void;
  onRegenerate: () => void;
  isGenerating: boolean;
}

export const Step2Script: React.FC<Step2ScriptProps> = ({
  project,
  onUpdateScript,
  onNext,
  onPrev,
  onRegenerate,
  isGenerating,
}) => {
  const { script, novel } = project;
  const [isRefining, setIsRefining] = useState(false);
  const [refineAction, setRefineAction] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const wordCount = script.narration.trim().length;
  // Standard Chinese voiceover speed: ~4 words per second
  const estimatedSeconds = Math.round(wordCount / 4.1);

  const handleRefine = async (action: 'rewrite_hook' | 'shorten' | 'expand' | 'polish') => {
    setIsRefining(true);
    setRefineAction(action);
    setRefineError(null);

    try {
      const result = await api.refineScript({
        action,
        currentScript: {
          title: script.title,
          hook: script.hook,
          narration: script.narration,
        },
        novelText: novel.text,
      });

      // Save previous version to history
      const historyItem = {
        timestamp: Date.now(),
        title: script.title,
        hook: script.hook,
        narration: script.narration,
        note: action === 'rewrite_hook' ? '重写开头前备份' : action === 'shorten' ? '缩短前备份' : '编辑前备份',
      };

      onUpdateScript({
        title: result.title,
        hook: result.hook,
        narration: result.narration,
        estimatedDuration: result.estimatedDuration,
        emotionArc: result.emotionArc,
        endingHook: result.endingHook,
        factCheckNotes: result.factCheckNotes,
        isModifiedByUser: true,
        history: [...(script.history || []), historyItem],
      });
    } catch (err: any) {
      setRefineError(err.message || '优化文案失败，请稍后重试');
    } finally {
      setIsRefining(false);
      setRefineAction(null);
    }
  };

  const handleSaveSnapshot = () => {
    const historyItem = {
      timestamp: Date.now(),
      title: script.title,
      hook: script.hook,
      narration: script.narration,
      note: '手动保存的版本快照',
    };
    onUpdateScript({
      history: [...(script.history || []), historyItem],
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(script.narration);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const triggerRegenerate = () => {
    if (script.isModifiedByUser) {
      setShowRegenConfirm(true);
    } else {
      onRegenerate();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="border-b border-stone-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            第二步：AI 生成与人工精修推文脚本
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            所有 AI 生成文案均允许自由修改。脚本严格忠于原著因果，采用适合中文短视频口播的节奏。
          </p>
        </div>

        {/* Refine Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleRefine('rewrite_hook')}
            disabled={isRefining || isGenerating || !script.narration}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="仅重新构思更抓人的黄金前3秒开头"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>重写开头</span>
          </button>

          <button
            onClick={() => handleRefine('shorten')}
            disabled={isRefining || isGenerating || !script.narration}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="压缩20%字数，加快节奏"
          >
            <Scissors className="w-3.5 h-3.5 text-sky-400" />
            <span>缩短文案</span>
          </button>

          <button
            onClick={() => handleRefine('expand')}
            disabled={isRefining || isGenerating || !script.narration}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            title="丰富动作神态与心理细节，增加20%字数"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span>扩写充实</span>
          </button>

          <button
            onClick={handleSaveSnapshot}
            disabled={!script.narration}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors flex items-center gap-1.5"
            title="保存当前文案快照到历史版本"
          >
            <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
            <span>{saveSuccess ? '已存快照' : '保存版本'}</span>
          </button>

          <button
            onClick={triggerRegenerate}
            disabled={isGenerating || isRefining}
            className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>重新生成</span>
          </button>
        </div>
      </div>

      {refineError && (
        <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{refineError}</span>
        </div>
      )}

      {isRefining && (
        <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800 text-amber-300 text-xs flex items-center gap-2 animate-pulse">
          <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
          <span>正在按指令调整文案（{refineAction === 'rewrite_hook' ? '重新构思开头' : refineAction === 'shorten' ? '精炼字数' : '充实细节'}）...</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Script Editor (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Title & Hook Card */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div>
              <label className="text-xs font-semibold text-stone-400 flex items-center gap-1.5 mb-1">
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                建议短视频标题（可直接修改）
              </label>
              <input
                type="text"
                value={script.title}
                onChange={(e) =>
                  onUpdateScript({
                    title: e.target.value,
                    isModifiedByUser: true,
                  })
                }
                placeholder="短视频吸睛标题..."
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-stone-100 font-bold text-sm focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-stone-400 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                黄金前3秒开头钩子 (Hook)
              </label>
              <input
                type="text"
                value={script.hook}
                onChange={(e) =>
                  onUpdateScript({
                    hook: e.target.value,
                    isModifiedByUser: true,
                  })
                }
                placeholder="前3秒直击冲突的钩子句子..."
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-amber-300 font-medium text-xs focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Full Narration Body */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-stone-200 flex items-center gap-2">
                完整短视频旁白口播正文
                <span className="text-xs font-normal text-stone-400">（支持直接编辑）</span>
              </label>

              <button
                onClick={handleCopy}
                className="text-xs flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 transition-colors"
                title="复制全部旁白文案"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? '已复制' : '复制文案'}</span>
              </button>
            </div>

            <textarea
              value={script.narration}
              onChange={(e) =>
                onUpdateScript({
                  narration: e.target.value,
                  isModifiedByUser: true,
                })
              }
              placeholder="短视频完整旁白口播文案..."
              rows={14}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-stone-100 text-sm focus:outline-none focus:border-amber-500/70 transition-colors font-sans leading-relaxed resize-y"
            />

            {/* Word & Duration Counter */}
            <div className="flex items-center justify-between text-xs text-stone-400 pt-1 border-t border-stone-800/80 px-1">
              <div className="flex items-center gap-4">
                <span>
                  口播字数：
                  <strong className="text-amber-400 font-mono font-bold text-sm ml-1">
                    {wordCount}
                  </strong>
                  字
                </span>
                <span>
                  正常语速约：
                  <strong className="text-stone-200 font-mono font-bold ml-1">
                    {estimatedSeconds}
                  </strong>
                  秒
                </span>
                <span className="text-stone-400">
                  （设定目标：{novel.targetDuration}秒）
                </span>
              </div>

              {Math.abs(estimatedSeconds - novel.targetDuration) > 20 && (
                <span className="text-amber-400 text-[11px] flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  时长偏差建议点击“缩短”或“扩写”微调
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Analysis & Fact Check (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Emotion Arc */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-2.5">
            <div className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
              <span>情绪递进曲线 (Emotion Arc)</span>
            </div>
            <div className="p-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-amber-300/90 leading-relaxed">
              {script.emotionArc || '等待生成情绪曲线分析...'}
            </div>
          </div>

          {/* Ending Hook */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-2.5">
            <div className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-400" />
              <span>片尾留悬念钩子 (Ending Hook)</span>
            </div>
            <textarea
              value={script.endingHook}
              onChange={(e) =>
                onUpdateScript({
                  endingHook: e.target.value,
                  isModifiedByUser: true,
                })
              }
              rows={3}
              placeholder="结尾引导观众点赞、追更或看下一集的反问与悬念..."
              className="w-full bg-stone-950 border border-stone-800 rounded-xl p-2.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500 leading-relaxed"
            />
          </div>

          {/* Fact Check Notes (Strict compliance) */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-2.5">
            <div className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>原著事实核对与改编备忘</span>
            </div>
            <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-300 leading-relaxed max-h-48 overflow-y-auto">
              {script.factCheckNotes || '严格忠实原著因果逻辑，无擅自虚构的情节。'}
            </div>
          </div>

          {/* History Snapshots */}
          {script.history && script.history.length > 0 && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-2.5">
              <div className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-stone-400" />
                <span>历史版本备份 ({script.history.length})</span>
              </div>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {script.history.map((h, i) => (
                  <div
                    key={i}
                    className="p-2 rounded-lg bg-stone-950 border border-stone-800 text-[11px] flex items-center justify-between"
                  >
                    <div>
                      <span className="text-stone-300">{h.note || `版本 ${i + 1}`}</span>
                      <span className="text-stone-400 ml-2 font-mono">
                        {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        onUpdateScript({
                          title: h.title,
                          hook: h.hook,
                          narration: h.narration,
                          isModifiedByUser: true,
                        });
                      }}
                      className="text-amber-400 hover:text-amber-300 text-[11px]"
                    >
                      恢复此版
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="border-t border-stone-800 pt-4 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-stone-300 hover:text-stone-100 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回第一步修改原著</span>
        </button>

        <button
          onClick={onNext}
          disabled={!script.narration || script.narration.trim().length < 10}
          className="px-6 py-2.5 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all shadow-md shadow-amber-950/40 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>确认脚本并拆分分镜（进入第三步）</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Regenerate Confirmation Modal to protect manual edits */}
      {showRegenConfirm && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5" />
              <h3 className="text-base font-bold text-stone-100">覆盖确认提示</h3>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              您已对当前脚本进行了手工修改。重新生成将调用 AI 重新创作文案，并覆盖当前内容。我们会先为您将当前版本保存到“历史版本备份”中。是否确认继续？
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRegenConfirm(false)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 bg-stone-800 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={() => {
                  handleSaveSnapshot();
                  setShowRegenConfirm(false);
                  onRegenerate();
                }}
                className="px-4 py-1.5 text-xs font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-lg"
              >
                备份并重新生成
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
