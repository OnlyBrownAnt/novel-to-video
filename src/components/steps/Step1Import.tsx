import React, { useState, useRef } from 'react';
import { NovelProject, NovelState } from '../../types/project';
import { api } from '../../services/api';
import {
  FileText,
  Upload,
  Clock,
  Sparkles,
  AlertTriangle,
  BookOpen,
  Sliders,
  CheckCircle2,
  HelpCircle,
  FileCode,
  Library,
  Bookmark,
} from 'lucide-react';
import { PRESET_PROJECTS } from '../../services/storage';

interface Step1ImportProps {
  project: NovelProject;
  onUpdateNovel: (novel: Partial<NovelState>) => void;
  onNext: () => void;
  onGenerateScript: () => void;
  onOpenLibrary?: () => void;
  isGenerating: boolean;
}

export const Step1Import: React.FC<Step1ImportProps> = ({
  project,
  onUpdateNovel,
  onNext,
  onGenerateScript,
  onOpenLibrary,
  isGenerating,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { novel } = project;
  const wordCount = novel.text.trim().length;
  // Estimate reading time at ~240 words per minute
  const estimatedReadTimeSec = Math.round((wordCount / 4));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const parsed = await api.parseFile(file);
      onUpdateNovel({
        text: parsed.text,
        wordCount: parsed.wordCount,
        sourceFileName: file.name,
        title: novel.title || parsed.suggestedTitle || file.name.replace(/\.[^/.]+$/, ''),
      });
    } catch (err: any) {
      setUploadError(err.message || '解析文档失败，请检查文件格式');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handlePresetSelect = (presetIndex: number) => {
    const p = PRESET_PROJECTS[presetIndex];
    if (p) {
      onUpdateNovel({
        title: p.title,
        chapter: p.chapter,
        text: p.sampleText,
        wordCount: p.sampleText.length,
        targetDuration: p.duration,
        narrativeStyle: p.style,
        pov: p.pov,
      });
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Step Header */}
      <div className="border-b border-stone-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            第一步：导入小说原文与设定推文参数
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            粘贴或上传小说正文片段，设定目标视频时长与改编风格，AI 将提取核心冲突并提炼出爆款旁白口播稿。
          </p>
        </div>

        {/* Quick Presets pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-stone-400 hidden sm:inline">快捷样例：</span>
          {PRESET_PROJECTS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handlePresetSelect(idx)}
              className="text-xs px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 hover:border-amber-500/40 transition-colors"
            >
              {preset.title.slice(0, 4)}...
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Text Input & File Upload (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-stone-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" />
                小说正文片段
                <span className="text-rose-400 text-xs">*必填</span>
              </label>

              {/* Action triggers */}
              <div className="flex items-center gap-2">
                {onOpenLibrary && (
                  <button
                    onClick={onOpenLibrary}
                    className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors font-semibold"
                    title="从长篇小说资料库直接选取章节制作"
                  >
                    <Library className="w-3.5 h-3.5 text-amber-400" />
                    <span>从小说资料库选章</span>
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.epub,.txt,.md,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/epub+zip,text/plain,text/markdown"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors disabled:opacity-50"
                  title="上传 DOCX, EPUB, TXT 或 MD 文件"
                >
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isUploading ? '解析中...' : '上传文档'}</span>
                </button>
              </div>
            </div>

            {/* Library Chapter Origin Card */}
            {novel.sourceNovelId && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="truncate">
                    已关联资料库长篇：《{novel.title}》· {novel.chapter || '选定章节'}
                  </span>
                </div>
                {onOpenLibrary && (
                  <button
                    onClick={onOpenLibrary}
                    className="text-amber-400 hover:text-amber-300 font-bold text-[11px] shrink-0 underline ml-2"
                  >
                    切换章节
                  </button>
                )}
              </div>
            )}

            {/* Background Context Summary Card */}
            {novel.contextSummary && (
              <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 text-[11px] text-stone-400 space-y-1">
                <div className="font-semibold text-stone-300 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>已挂载长篇上下文背景（AI 生成脚本时将参考此信息以保证因果与人物一致）：</span>
                </div>
                <div className="line-clamp-2 text-stone-400 italic">
                  {novel.contextSummary}
                </div>
              </div>
            )}

            {uploadError && (
              <div className="p-2.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}

            {novel.sourceFileName && !novel.sourceNovelId && (
              <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-stone-800/60 border border-stone-700/60 text-xs text-stone-300">
                <div className="flex items-center gap-2 truncate">
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span className="truncate">来源文件：{novel.sourceFileName}</span>
                </div>
                <button
                  onClick={() => onUpdateNovel({ sourceFileName: undefined })}
                  className="text-stone-400 hover:text-stone-200 text-[11px]"
                >
                  清除标记
                </button>
              </div>
            )}

            <div className="relative">
              <textarea
                value={novel.text}
                onChange={(e) =>
                  onUpdateNovel({
                    text: e.target.value,
                    wordCount: e.target.value.length,
                  })
                }
                placeholder="在此直接粘贴小说原文片段（建议 500 ~ 3000 字），包含主要人物对话、核心矛盾冲突与反转悬念点..."
                rows={14}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3.5 text-stone-200 text-sm focus:outline-none focus:border-amber-500/70 transition-colors font-sans leading-relaxed resize-y"
              />

              {/* Word count footer indicator */}
              <div className="flex items-center justify-between pt-1 text-xs text-stone-400 px-1">
                <div className="flex items-center gap-3">
                  <span>
                    字数统计：
                    <strong className={wordCount > 0 ? 'text-amber-400 font-mono' : 'text-stone-500'}>
                      {wordCount}
                    </strong>
                    字
                  </span>
                  {wordCount > 0 && (
                    <span className="text-stone-400">
                      原文朗读预估约 {Math.floor(estimatedReadTimeSec / 60)}分{estimatedReadTimeSec % 60}秒
                    </span>
                  )}
                </div>

                {wordCount > 6000 && (
                  <span className="text-amber-400 text-[11px] flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    建议截取精炼情节片段
                  </span>
                )}
              </div>
            </div>

            {/* Warning if overly long text */}
            {wordCount > 8000 && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <div className="font-semibold">文本长度温馨提示：</div>
                  您输入的正文已超过 8000 字。为保证短视频黄金节拍与精准剧作因果，建议精选单章高潮切片（如真假身份曝光、退婚当场对峙等关键场景）分批制作。
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Novel Info & Adaptation Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2 pb-2 border-b border-stone-800">
              <Sliders className="w-4 h-4 text-amber-500" />
              推文制作与改编参数
            </h3>

            {/* Novel Title & Chapter */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  作品书名
                </label>
                <input
                  type="text"
                  value={novel.title}
                  onChange={(e) => onUpdateNovel({ title: e.target.value })}
                  placeholder="例如：《豪门千金归来》"
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  章节标识
                </label>
                <input
                  type="text"
                  value={novel.chapter}
                  onChange={(e) => onUpdateNovel({ chapter: e.target.value })}
                  placeholder="例如：第一卷 绝地反击"
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Target Duration */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-2">
                目标短视频时长
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { sec: 30, label: '30秒', desc: '约120字' },
                  { sec: 60, label: '60秒', desc: '约240字' },
                  { sec: 90, label: '90秒', desc: '约360字' },
                  { sec: 120, label: '120秒', desc: '约480字' },
                ].map((item) => (
                  <button
                    key={item.sec}
                    onClick={() => onUpdateNovel({ targetDuration: item.sec })}
                    className={`py-2 px-1 text-center rounded-xl border transition-all ${
                      novel.targetDuration === item.sec
                        ? 'bg-amber-500 text-stone-950 font-bold border-amber-400 shadow-sm'
                        : 'bg-stone-950 text-stone-300 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-xs">{item.label}</div>
                    <div className="text-[10px] opacity-75">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Narrative Style */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-2">
                叙事调性与风格
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: '悬念反转', desc: '高能铺垫、层层反转' },
                  { id: '情绪叙事', desc: '代入感强、情绪共鸣' },
                  { id: '现实情感', desc: '扎实细腻、克制有深度' },
                  { id: '剧情解说', desc: '紧凑抓人、节奏凌厉' },
                ].map((style) => (
                  <button
                    key={style.id}
                    onClick={() => onUpdateNovel({ narrativeStyle: style.id })}
                    className={`p-2 rounded-xl text-left border transition-all ${
                      novel.narrativeStyle === style.id
                        ? 'bg-amber-500/15 border-amber-500/70 text-amber-300'
                        : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-xs font-semibold">{style.id}</div>
                    <div className="text-[10px] text-stone-400 mt-0.5">{style.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* POV & Hook Strength */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  叙述视角
                </label>
                <select
                  value={novel.pov}
                  onChange={(e) => onUpdateNovel({ pov: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="第一人称">第一人称（“我”）</option>
                  <option value="第三人称">第三人称（上帝解说）</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-300 mb-1">
                  开头黄金前3秒
                </label>
                <select
                  value={novel.hookStrength}
                  onChange={(e) => onUpdateNovel({ hookStrength: e.target.value })}
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="强钩子">强钩子（直击高能冲突）</option>
                  <option value="自然铺垫">自然铺垫（渐进式悬念）</option>
                </select>
              </div>
            </div>

            {/* Custom Instructions */}
            <div>
              <label className="block text-xs font-medium text-stone-300 mb-1 flex items-center justify-between">
                <span>改编补充要求（可选）</span>
                <span className="text-[11px] text-stone-400">比如：凸显女主清冷性格</span>
              </label>
              <input
                type="text"
                value={novel.customInstructions}
                onChange={(e) => onUpdateNovel({ customInstructions: e.target.value })}
                placeholder="例如：着重突出女主的反击手腕，不要泄露最终底牌"
                className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Next Action Buttons */}
            <div className="pt-2">
              <button
                onClick={onGenerateScript}
                disabled={wordCount < 10 || isGenerating}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                    <span>AI 正在研读原著并生成短视频脚本...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>生成推文脚本（进入第二步）</span>
                  </>
                )}
              </button>

              {wordCount < 10 && (
                <p className="text-[11px] text-stone-400 text-center mt-2">
                  * 请先在左侧输入或粘贴小说正文（至少 10 字）
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
