import React, { useState } from 'react';
import { NovelProject } from '../types/project';
import {
  Film,
  Download,
  Upload,
  PlusCircle,
  Sparkles,
  CheckCircle2,
  Clock,
  Edit2,
  Check,
  RotateCcw,
  Library,
  Cpu,
} from 'lucide-react';
import { PRESET_PROJECTS, createDefaultProject } from '../services/storage';

interface HeaderProps {
  project: NovelProject;
  onUpdateProject: (updater: (prev: NovelProject) => NovelProject) => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onLoadPreset: (presetIndex: number) => void;
  onOpenLibrary: () => void;
  onOpenAiManagement: () => void;
  libraryCount?: number;
  isSaving: boolean;
  lastSavedAt: number | null;
}

export const Header: React.FC<HeaderProps> = ({
  project,
  onUpdateProject,
  onExportJson,
  onImportJson,
  onLoadPreset,
  onOpenLibrary,
  onOpenAiManagement,
  libraryCount = 0,
  isSaving,
  lastSavedAt,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(project.name);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showNewConfirm, setShowNewConfirm] = useState(false);

  const handleSaveTitle = () => {
    if (titleInput.trim()) {
      onUpdateProject((prev) => ({ ...prev, name: titleInput.trim() }));
    }
    setIsEditingTitle(false);
  };

  const handleCreateNew = () => {
    const newProj = createDefaultProject('新推文项目');
    onUpdateProject(() => newProj);
    setShowNewConfirm(false);
  };

  return (
    <header className="bg-stone-900 border-b border-stone-800 text-stone-200 sticky top-0 z-40 select-none shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left: Brand & Project Name */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-stone-950 font-bold shadow-lg shadow-amber-950/40">
              <Film className="w-5 h-5 text-stone-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-wide text-stone-100">
                  小说推文工坊
                </span>
                <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Novel2Video
                </span>
              </div>
              <p className="text-xs text-stone-400 font-normal">
                一站式短视频推文制作工作台
              </p>
            </div>
          </div>

          <div className="h-6 w-px bg-stone-800 hidden sm:block" />

          {/* Project Title Editor */}
          <div className="hidden sm:flex items-center gap-2">
            {isEditingTitle ? (
              <div className="flex items-center gap-1.5 bg-stone-800/90 rounded-lg px-2 py-1 border border-amber-500/50">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                  autoFocus
                  className="bg-transparent text-sm font-medium text-stone-100 focus:outline-none w-44"
                />
                <button
                  onClick={handleSaveTitle}
                  className="p-1 text-emerald-400 hover:text-emerald-300"
                  title="保存名称"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => {
                  setTitleInput(project.name);
                  setIsEditingTitle(true);
                }}
                className="group flex items-center gap-2 cursor-pointer hover:bg-stone-800/60 px-2.5 py-1 rounded-lg transition-colors border border-transparent hover:border-stone-700"
                title="点击修改项目名称"
              >
                <span className="text-sm font-medium text-stone-200 max-w-[180px] truncate">
                  {project.name}
                </span>
                <Edit2 className="w-3 h-3 text-stone-500 group-hover:text-amber-400 transition-colors" />
              </div>
            )}

            {/* Save Status */}
            <div className="flex items-center gap-1.5 text-xs text-stone-400 pl-1">
              {isSaving ? (
                <>
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                  <span>自动保存中...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>已自动保存</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* AI Management Center Button */}
          <button
            onClick={onOpenAiManagement}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-stone-200 bg-stone-800 hover:bg-stone-750 hover:text-amber-300 border border-stone-750 hover:border-amber-500/40 rounded-lg transition-all shadow-sm cursor-pointer"
            title="配置 DeepSeek、火山引擎、MiniMax 密钥与默认模型"
          >
            <Cpu className="w-3.5 h-3.5 text-amber-400" />
            <span>AI 管理中心</span>
          </button>

          {/* Novel Library Button */}
          <button
            onClick={onOpenLibrary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg transition-all shadow-md shadow-amber-950/30 cursor-pointer"
            title="打开长篇小说资料库与章节管理"
          >
            <Library className="w-3.5 h-3.5 text-amber-950" />
            <span>小说资料库</span>
            {libraryCount > 0 && (
              <span className="text-[10px] bg-amber-900/40 text-amber-950 font-mono px-1.5 py-0.2 rounded-full font-extrabold">
                {libraryCount}
              </span>
            )}
          </button>

          {/* Preset Samples */}
          <button
            onClick={() => setShowPresetModal(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-all"
            title="加载精选小说推文范例"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden md:inline">范例</span>
          </button>

          {/* New Project */}
          <button
            onClick={() => setShowNewConfirm(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-300 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors border border-stone-800"
            title="新建推文项目"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">新建</span>
          </button>

          {/* Import JSON */}
          <button
            onClick={onImportJson}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-300 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors border border-stone-800"
            title="从本地 JSON 导入项目"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">导入工程</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={onExportJson}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-200 bg-stone-800 hover:bg-stone-700 rounded-lg transition-colors border border-stone-700 shadow-sm"
            title="导出当前项目全部素材与工程 JSON"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>导出工程</span>
          </button>
        </div>
      </div>

      {/* Preset Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-stone-100">选择经典推文范例</h3>
              </div>
              <button
                onClick={() => setShowPresetModal(false)}
                className="text-stone-400 hover:text-stone-200 text-sm"
              >
                关闭
              </button>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              载入高热度推文题材原文及预设改编参数，快速体验全套从小说到短视频分镜的完整闭环。
            </p>

            <div className="space-y-3">
              {PRESET_PROJECTS.map((preset, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    onLoadPreset(idx);
                    setShowPresetModal(false);
                  }}
                  className="p-3.5 rounded-xl bg-stone-800/70 hover:bg-stone-800 border border-stone-700 hover:border-amber-500/50 cursor-pointer transition-all space-y-1.5 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-stone-200 group-hover:text-amber-400 transition-colors">
                      《{preset.title}》
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      {preset.style} · {preset.duration}秒
                    </span>
                  </div>
                  <div className="text-xs text-stone-400 line-clamp-2">
                    {preset.sampleText}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* New Project Confirm Modal */}
      {showNewConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-amber-400">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-base font-bold text-stone-100">创建新项目确认</h3>
            </div>
            <p className="text-xs text-stone-300 leading-relaxed">
              创建新项目将清空当前工作区。当前项目已自动保存在本地，你可以随时通过“导出工程”备份到本地文件。
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowNewConfirm(false)}
                className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-200 bg-stone-800 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleCreateNew}
                className="px-4 py-1.5 text-xs font-semibold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-lg"
              >
                确认新建
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
