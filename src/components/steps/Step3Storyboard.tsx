import React, { useState } from 'react';
import { NovelProject, Scene } from '../../types/project';
import {
  Layers,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Camera,
  Clock,
  User,
  MapPin,
  Smile,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Eye,
  X,
} from 'lucide-react';
import { generateCinematicSceneSVG } from '../../utils/visualPreset';

interface Step3StoryboardProps {
  project: NovelProject;
  onUpdateScenes: (scenes: Scene[]) => void;
  onNext: () => void;
  onPrev: () => void;
  onSplitScenes: () => void;
  isSplitting: boolean;
}

export const Step3Storyboard: React.FC<Step3StoryboardProps> = ({
  project,
  onUpdateScenes,
  onNext,
  onPrev,
  onSplitScenes,
  isSplitting,
}) => {
  const { scenes, script } = project;
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    scenes.length > 0 ? scenes[0].id : null
  );

  const selectedScene = scenes.find((s) => s.id === selectedSceneId) || scenes[0];

  // Narration check: does concatenation cover the full script?
  const combinedSceneNarration = scenes.map((s) => s.narration).join('');
  const cleanFullScript = script.narration.replace(/\s+/g, '');
  const cleanCombined = combinedSceneNarration.replace(/\s+/g, '');
  const isNarrationConsistent = cleanFullScript.length > 0 && Math.abs(cleanCombined.length - cleanFullScript.length) <= 5;

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 4), 0);

  // Scene Operations
  const handleMoveScene = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === scenes.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newScenes = [...scenes];
    const temp = newScenes[index];
    newScenes[index] = newScenes[targetIndex];
    newScenes[targetIndex] = temp;

    // re-order
    const updated = newScenes.map((s, idx) => ({ ...s, order: idx + 1 }));
    onUpdateScenes(updated);
  };

  const handleDuplicateScene = (index: number) => {
    const src = scenes[index];
    const newScene: Scene = {
      ...src,
      id: `scene_${Date.now()}_copy`,
      order: index + 2,
    };
    const newScenes = [...scenes];
    newScenes.splice(index + 1, 0, newScene);
    const updated = newScenes.map((s, idx) => ({ ...s, order: idx + 1 }));
    onUpdateScenes(updated);
    setSelectedSceneId(newScene.id);
  };

  const handleDeleteScene = (index: number) => {
    if (scenes.length <= 1) {
      alert('至少需要保留一个场景分镜');
      return;
    }
    const newScenes = scenes.filter((_, idx) => idx !== index);
    const updated = newScenes.map((s, idx) => ({ ...s, order: idx + 1 }));
    onUpdateScenes(updated);
    if (selectedSceneId === scenes[index].id) {
      setSelectedSceneId(updated[Math.max(0, index - 1)].id);
    }
  };

  const handleAddScene = () => {
    const newOrder = scenes.length + 1;
    const newScene: Scene = {
      id: `scene_${Date.now()}_new`,
      order: newOrder,
      narration: '新场景台词旁白...',
      visualDescription: '角色身处室内，情绪凝重，特写镜头。',
      englishPrompt: 'cinematic close up shot, dramatic expression, 9:16 portrait',
      characters: [],
      actions: '若有所思',
      environment: '室内柔和漫射光',
      mood: '悬念/沉重',
      composition: '中景',
      duration: 4,
      imageStatus: 'idle',
      imageUrl: generateCinematicSceneSVG('noir_rain', newOrder, '新分镜', '中景'),
    };
    const updated = [...scenes, newScene];
    onUpdateScenes(updated);
    setSelectedSceneId(newScene.id);
  };

  const handleUpdateSingleScene = (id: string, partial: Partial<Scene>) => {
    const updated = scenes.map((s) => (s.id === id ? { ...s, ...partial } : s));
    onUpdateScenes(updated);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-stone-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            第三步：拆分短视频分镜 (Storyboard)
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            将推文旁白按语义与镜头画面拆解为连续分镜。每个分镜承载一段台词、视觉画面描述与预估时长。
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-stone-400 flex items-center gap-3 px-3 py-1.5 bg-stone-900 border border-stone-800 rounded-xl">
            <span>
              总场景：<strong className="text-amber-400 font-mono">{scenes.length}</strong> 个
            </span>
            <span>
              总时长：<strong className="text-stone-200 font-mono">{totalDuration}</strong> 秒
            </span>
          </div>

          <button
            onClick={onSplitScenes}
            disabled={isSplitting}
            className="text-xs px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isSplitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                <span>分镜智能拆解中...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{scenes.length > 0 ? '重新智能拆解' : 'AI 智能拆解分镜'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Script Consistency Alert */}
      {scenes.length > 0 && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            isNarrationConsistent
              ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
              : 'bg-amber-950/25 border-amber-800/50 text-amber-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {isNarrationConsistent ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
            <span>
              {isNarrationConsistent
                ? '分镜台词完整性校验通过：所有分镜旁白与第2步确认的脚本完全吻合。'
                : `分镜字数与总脚本略有差异（总脚本 ${cleanFullScript.length} 字，当前分镜合计 ${cleanCombined.length} 字），可点击下方单场景随时微调。`}
            </span>
          </div>
          <span className="text-[11px] opacity-80">
            支持自由增删与调整顺序
          </span>
        </div>
      )}

      {/* Main Split: Scene List (Left 6 cols) & Scene Detail Inspector (Right 6 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Scene Timeline Cards */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-stone-300">
              分镜时间轴序列 ({scenes.length})
            </span>
            <button
              onClick={handleAddScene}
              className="text-xs flex items-center gap-1 text-amber-400 hover:text-amber-300 bg-stone-900 border border-stone-800 px-2 py-1 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>添加新场景</span>
            </button>
          </div>

          {scenes.length === 0 ? (
            <div className="p-12 text-center bg-stone-900 border border-stone-800 rounded-2xl space-y-3">
              <Layers className="w-10 h-10 text-stone-600 mx-auto" />
              <p className="text-sm text-stone-300 font-semibold">尚未拆分场景分镜</p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                点击上方“AI 智能拆解分镜”，Gemini 将把推文旁白转换为精炼的 9:16 镜头序列。
              </p>
              <button
                onClick={onSplitScenes}
                disabled={isSplitting}
                className="mt-2 px-5 py-2 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all"
              >
                立即拆解分镜
              </button>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[720px] overflow-y-auto pr-1">
              {scenes.map((scene, index) => {
                const isSelected = selectedScene?.id === scene.id;

                return (
                  <div
                    key={scene.id}
                    onClick={() => setSelectedSceneId(scene.id)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative group ${
                      isSelected
                        ? 'bg-stone-900 border-amber-500/80 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/30'
                        : 'bg-stone-900/60 hover:bg-stone-900 border-stone-800 hover:border-stone-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Order badge & duration */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                            isSelected
                              ? 'bg-amber-500 text-stone-950'
                              : 'bg-stone-800 text-stone-400'
                          }`}
                        >
                          {index + 1}
                        </span>

                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-800 text-stone-300">
                          {scene.duration || 4}秒
                        </span>

                        <span className="text-[11px] px-2 py-0.5 rounded bg-stone-800/80 text-amber-400">
                          {scene.composition || '中景'}
                        </span>
                      </div>

                      {/* Move / Dup / Delete tools */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveScene(index, 'up');
                          }}
                          disabled={index === 0}
                          className="p-1 text-stone-400 hover:text-stone-200 disabled:opacity-20"
                          title="上移"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveScene(index, 'down');
                          }}
                          disabled={index === scenes.length - 1}
                          className="p-1 text-stone-400 hover:text-stone-200 disabled:opacity-20"
                          title="下移"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicateScene(index);
                          }}
                          className="p-1 text-stone-400 hover:text-amber-400"
                          title="复制此场景"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteScene(index);
                          }}
                          className="p-1 text-stone-400 hover:text-rose-400"
                          title="删除场景"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Narration line */}
                    <div className="mt-2 text-xs font-medium text-stone-200 line-clamp-2 leading-relaxed">
                      “{scene.narration}”
                    </div>

                    {/* Visual Description preview */}
                    <div className="mt-1.5 text-[11px] text-stone-400 line-clamp-1 flex items-center gap-1">
                      <Camera className="w-3 h-3 text-stone-500 shrink-0" />
                      <span>{scene.visualDescription}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Single Scene Inspector & Editor */}
        <div className="lg:col-span-6 space-y-4">
          {selectedScene ? (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-4 sticky top-24">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center">
                    {selectedScene.order}
                  </span>
                  <h3 className="text-sm font-bold text-stone-100">
                    编辑场景 #{selectedScene.order} 详细设定
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-400">镜头时长：</span>
                  <div className="flex items-center gap-1">
                    {[3, 4, 5, 6].map((sec) => (
                      <button
                        key={sec}
                        onClick={() => handleUpdateSingleScene(selectedScene.id, { duration: sec })}
                        className={`text-xs px-2 py-0.5 rounded font-mono ${
                          selectedScene.duration === sec
                            ? 'bg-amber-500 text-stone-950 font-bold'
                            : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Narration */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                  <span>本分镜对应旁白台词</span>
                  <span className="text-[11px] text-stone-400 font-normal">（影响字幕与配音对齐）</span>
                </label>
                <textarea
                  value={selectedScene.narration}
                  onChange={(e) =>
                    handleUpdateSingleScene(selectedScene.id, { narration: e.target.value })
                  }
                  rows={3}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
                />
              </div>

              {/* Visual Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  <span>画面导演描述（中文视觉要点）</span>
                </label>
                <textarea
                  value={selectedScene.visualDescription}
                  onChange={(e) =>
                    handleUpdateSingleScene(selectedScene.id, { visualDescription: e.target.value })
                  }
                  rows={3}
                  className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Camera Composition & Mood & Environment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-400 mb-1 block">
                    镜头景别
                  </label>
                  <select
                    value={selectedScene.composition || '中景'}
                    onChange={(e) =>
                      handleUpdateSingleScene(selectedScene.id, { composition: e.target.value })
                    }
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="特写 (Close-up)">特写 (Close-up)</option>
                    <option value="中景 (Medium Shot)">中景 (Medium Shot)</option>
                    <option value="全景/远景 (Wide Shot)">全景/远景 (Wide Shot)</option>
                    <option value="俯拍 (Overhead)">俯拍 (Overhead)</option>
                    <option value="低角度仰拍 (Low Angle)">低角度仰拍 (Low Angle)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-stone-400 mb-1 block">
                    情绪氛围
                  </label>
                  <input
                    type="text"
                    value={selectedScene.mood || ''}
                    onChange={(e) =>
                      handleUpdateSingleScene(selectedScene.id, { mood: e.target.value })
                    }
                    placeholder="如：紧张对峙、压抑冷酷"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Actions & Environment */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-stone-400 mb-1 block">
                    人物动作与表情
                  </label>
                  <input
                    type="text"
                    value={selectedScene.actions || ''}
                    onChange={(e) =>
                      handleUpdateSingleScene(selectedScene.id, { actions: e.target.value })
                    }
                    placeholder="如：眼神冷漠、微微冷笑"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-stone-400 mb-1 block">
                    场景环境与光影
                  </label>
                  <input
                    type="text"
                    value={selectedScene.environment || ''}
                    onChange={(e) =>
                      handleUpdateSingleScene(selectedScene.id, { environment: e.target.value })
                    }
                    placeholder="如：昏暗宴会厅、窗外大雨"
                    className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* English Prompt for Image Gen */}
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-stone-400 flex items-center justify-between">
                  <span>AI 生图优化英文 Prompt（可定制）</span>
                  <span className="text-[10px] text-amber-500/80">9:16 vertical cinema illustration</span>
                </label>
                <input
                  type="text"
                  value={selectedScene.englishPrompt || ''}
                  onChange={(e) =>
                    handleUpdateSingleScene(selectedScene.id, { englishPrompt: e.target.value })
                  }
                  className="w-full bg-stone-950 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-stone-500 bg-stone-900 border border-stone-800 rounded-2xl">
              请从左侧选择一个场景分镜进行详细设置
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
          <span>返回修改脚本</span>
        </button>

        <button
          onClick={onNext}
          disabled={scenes.length === 0}
          className="px-6 py-2.5 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all shadow-md shadow-amber-950/40 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>进入角色与素材配音制作（第四步）</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
