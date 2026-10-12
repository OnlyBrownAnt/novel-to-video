import React from 'react';
import { NovelProject } from '../types/project';
import {
  FileText,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Video,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface StepNavProps {
  project: NovelProject;
  currentStep: number;
  onSelectStep: (step: number) => void;
}

export const StepNav: React.FC<StepNavProps> = ({
  project,
  currentStep,
  onSelectStep,
}) => {
  const steps = [
    {
      id: 1,
      name: '第一步：导入小说',
      icon: FileText,
      status: project.novel.text.trim().length > 0 ? 'completed' : 'empty',
      info: project.novel.text.trim().length > 0
        ? `${project.novel.text.length} 字 · ${project.novel.targetDuration}秒`
        : '待输入原文',
    },
    {
      id: 2,
      name: '第二步：推文脚本',
      icon: Sparkles,
      status: project.script.narration.trim().length > 0 ? 'completed' : 'empty',
      info: project.script.narration.trim().length > 0
        ? `旁白 ${project.script.narration.length} 字`
        : '待生成/编辑',
    },
    {
      id: 3,
      name: '第三步：分镜拆解',
      icon: Layers,
      status: project.scenes.length > 0 ? 'completed' : 'empty',
      info: project.scenes.length > 0
        ? `${project.scenes.length} 个分镜`
        : '待拆解场景',
    },
    {
      id: 4,
      name: '第四步：素材配音',
      icon: ImageIcon,
      status:
        project.scenes.length > 0 &&
        project.scenes.every((s) => s.imageUrl) &&
        project.audio.sourceType !== 'none'
          ? 'completed'
          : 'in_progress',
      info: (() => {
        const total = project.scenes.length;
        const imgCount = project.scenes.filter((s) => s.imageUrl).length;
        const hasAudio = project.audio.sourceType !== 'none';
        return `图 ${imgCount}/${total} · ${hasAudio ? '音频已配' : '未配音'}`;
      })(),
    },
    {
      id: 5,
      name: '第五步：合成导出',
      icon: Video,
      status: project.exportConfig.lastExportUrl ? 'completed' : 'idle',
      info: project.exportConfig.lastExportUrl ? '已生成 MP4' : '竖屏预览与导出',
    },
  ];

  return (
    <nav className="w-full lg:w-64 bg-stone-900/90 border-r border-stone-800 p-4 shrink-0 flex flex-col justify-between">
      <div className="space-y-2">
        <div className="px-2 pb-2 text-[11px] font-bold text-stone-400 uppercase tracking-wider flex items-center justify-between">
          <span>工作流步骤</span>
          <span className="text-amber-400 font-mono">
            {currentStep}/5
          </span>
        </div>

        <div className="space-y-1.5">
          {steps.map((step) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = step.status === 'completed';

            return (
              <button
                key={step.id}
                onClick={() => onSelectStep(step.id)}
                className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 relative border ${
                  isActive
                    ? 'bg-amber-500/15 border-amber-500/50 text-stone-100 shadow-md shadow-amber-950/20'
                    : 'bg-stone-800/40 hover:bg-stone-800/80 border-stone-800/80 text-stone-300 hover:text-stone-100'
                }`}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-1 bg-amber-500 rounded-r" />
                )}

                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 font-extrabold'
                      : isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-stone-800 text-stone-400 border border-stone-700'
                  }`}
                >
                  {isCompleted && !isActive ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <span>{step.id}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate leading-tight">
                    {step.name.split('：')[1]}
                  </div>
                  <div className="text-[11px] text-stone-400 truncate mt-0.5 font-normal">
                    {step.info}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Workflow Tips Card */}
      <div className="mt-6 p-3.5 rounded-xl bg-stone-950/60 border border-stone-800 text-[11px] text-stone-400 space-y-1.5 hidden lg:block">
        <div className="font-semibold text-stone-300 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
          <span>推文创作规范</span>
        </div>
        <p className="leading-relaxed text-stone-400">
          严格尊重原著因果，黄金前3秒设置核心悬念；视频合成前请确保每个分镜均配置图片与旁白音频。
        </p>
      </div>
    </nav>
  );
};
