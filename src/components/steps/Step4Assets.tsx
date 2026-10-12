import React, { useState, useRef, useEffect } from 'react';
import { NovelProject, Character, Scene, SubtitleItem, SubtitleStyle, AudioState } from '../../types/project';
import { api } from '../../services/api';
import { exportToSrt, downloadFile } from '../../utils/srt';
import { generateCinematicSceneSVG, VISUAL_PRESETS } from '../../utils/visualPreset';
import {
  Users,
  Image as ImageIcon,
  Mic,
  Subtitles,
  Upload,
  Sparkles,
  Play,
  Pause,
  Trash2,
  Plus,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Volume2,
  VolumeX,
  FileAudio,
  Eye,
  Sliders,
} from 'lucide-react';

interface Step4AssetsProps {
  project: NovelProject;
  onUpdateCharacters: (characters: Character[]) => void;
  onUpdateScenes: (scenes: Scene[]) => void;
  onUpdateAudio: (audio: AudioState) => void;
  onUpdateSubtitles: (subtitles: SubtitleItem[]) => void;
  onUpdateSubtitleStyle: (style: SubtitleStyle) => void;
  onNext: () => void;
  onPrev: () => void;
  onOpenAiManagement?: () => void;
}

export const Step4Assets: React.FC<Step4AssetsProps> = ({
  project,
  onUpdateCharacters,
  onUpdateScenes,
  onUpdateAudio,
  onUpdateSubtitles,
  onUpdateSubtitleStyle,
  onNext,
  onPrev,
  onOpenAiManagement,
}) => {
  const { characters, scenes, audio, subtitles, subtitleStyle, script, novel } = project;
  const [activeTab, setActiveTab] = useState<'characters' | 'images' | 'audio' | 'subtitles'>('images');

  // Character State
  const [isExtractingChars, setIsExtractingChars] = useState(false);
  const [charExtractError, setCharExtractError] = useState<string | null>(null);

  // Image State
  const [generatingSceneId, setGeneratingSceneId] = useState<string | null>(null);
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, string>>({});
  const fileUploadSceneRef = useRef<{ sceneId: string; input: HTMLInputElement | null }>({
    sceneId: '',
    input: null,
  });

  // Audio State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const [ttsVoice, setTtsVoice] = useState('male-qn-jingying');
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsNotice, setTtsNotice] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUploadInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize subtitles if empty
  useEffect(() => {
    if (subtitles.length === 0 && scenes.length > 0) {
      let cumulativeTime = 0;
      const initialSubs: SubtitleItem[] = [];

      scenes.forEach((scene, index) => {
        const text = scene.narration.trim();
        const duration = scene.duration || 4;
        const start = cumulativeTime;
        const end = cumulativeTime + duration;

        if (text) {
          initialSubs.push({
            id: `sub_${index + 1}`,
            order: index + 1,
            start: +start.toFixed(2),
            end: +end.toFixed(2),
            text,
          });
        }
        cumulativeTime += duration;
      });

      onUpdateSubtitles(initialSubs);
    }
  }, [scenes, subtitles.length]);

  // Sync Audio duration & playback
  useEffect(() => {
    if (audioRef.current && audio.audioUrl) {
      const el = audioRef.current;
      const updateTime = () => setAudioCurrentTime(el.currentTime);
      const onEnded = () => setIsPlayingAudio(false);
      el.addEventListener('timeupdate', updateTime);
      el.addEventListener('ended', onEnded);
      return () => {
        el.removeEventListener('timeupdate', updateTime);
        el.removeEventListener('ended', onEnded);
      };
    }
  }, [audio.audioUrl]);

  // ==========================================
  // Character Extraction & Management
  // ==========================================
  const handleExtractCharacters = async () => {
    setIsExtractingChars(true);
    setCharExtractError(null);
    try {
      const extracted = await api.extractCharacters(novel.text, script.narration);
      onUpdateCharacters(extracted);
    } catch (err: any) {
      setCharExtractError(err.message || '提取角色设定失败，请重试');
    } finally {
      setIsExtractingChars(false);
    }
  };

  const handleAddCharacter = () => {
    const newChar: Character = {
      id: `char_${Date.now()}`,
      name: '新人物',
      age: '20多岁青年',
      gender: '女',
      hairstyle: '黑色柔顺长发',
      facialFeatures: '清秀面容，眼神坚毅',
      clothing: '简约日常装束',
      temperament: '从容淡雅',
      distinctVisuals: '无特殊饰品',
    };
    onUpdateCharacters([...characters, newChar]);
  };

  const handleUpdateCharacter = (id: string, partial: Partial<Character>) => {
    onUpdateCharacters(characters.map((c) => (c.id === id ? { ...c, ...partial } : c)));
  };

  const handleDeleteCharacter = (id: string) => {
    onUpdateCharacters(characters.filter((c) => c.id !== id));
  };

  // Build character consistency context string for image prompts
  const characterConsistencyNotes = characters
    .map(
      (c) =>
        `${c.name}: ${c.gender}, ${c.age}, hairstyle: ${c.hairstyle}, face: ${c.facialFeatures}, clothes: ${c.clothing}, personality: ${c.temperament}`
    )
    .join('; ');

  // ==========================================
  // Image Generation & Upload
  // ==========================================
  const handleGenerateImageForScene = async (scene: Scene) => {
    setGeneratingSceneId(scene.id);
    setImageErrorMap((prev) => ({ ...prev, [scene.id]: '' }));

    try {
      const promptToUse = scene.englishPrompt || scene.visualDescription;
      const result = await api.generateImage({
        prompt: promptToUse,
        visualDescription: scene.visualDescription,
        characterNotes: characterConsistencyNotes,
      });

      const updated = scenes.map((s) =>
        s.id === scene.id
          ? {
              ...s,
              imageUrl: result.imageUrl,
              imageStatus: 'ready' as const,
              imageError: undefined,
            }
          : s
      );
      onUpdateScenes(updated);
    } catch (err: any) {
      const msg = err.message || '生成失败，请检查提示词或手动上传';
      setImageErrorMap((prev) => ({ ...prev, [scene.id]: msg }));
      const updated = scenes.map((s) =>
        s.id === scene.id
          ? {
              ...s,
              imageStatus: 'error' as const,
              imageError: msg,
            }
          : s
      );
      onUpdateScenes(updated);
    } finally {
      setGeneratingSceneId(null);
    }
  };

  const handleUploadImageForScene = (sceneId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      const updated = scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              imageUrl: base64Url,
              imageStatus: 'ready' as const,
              imageError: undefined,
            }
          : s
      );
      onUpdateScenes(updated);
    };
    reader.readAsDataURL(file);
  };

  const handleApplyPresetAtmosphereAll = (presetId: string) => {
    const updated = scenes.map((s) => ({
      ...s,
      imageUrl: generateCinematicSceneSVG(presetId, s.order, s.narration, s.composition),
      imageStatus: 'ready' as const,
    }));
    onUpdateScenes(updated);
  };

  // ==========================================
  // Audio Upload & Real TTS Generation
  // ==========================================
  const handleUploadAudio = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;

      // Extract duration via temp Audio element
      const tempAudio = new Audio(base64Url);
      tempAudio.addEventListener('loadedmetadata', () => {
        onUpdateAudio({
          audioUrl: base64Url,
          audioBase64: base64Url,
          fileName: file.name,
          duration: +tempAudio.duration.toFixed(2),
          sourceType: 'uploaded',
        });
      });
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateTTS = async () => {
    if (!script.narration || script.narration.trim().length === 0) {
      alert('旁白文案为空，请先在第二步输入旁白');
      return;
    }

    setIsGeneratingTTS(true);
    setTtsError(null);
    setTtsNotice(null);

    try {
      const res = await api.generateTTS(script.narration, ttsVoice);
      onUpdateAudio({
        audioUrl: res.audioUrl,
        audioBase64: res.audioUrl,
        duration: res.duration,
        sourceType: 'tts',
        ttsVoice: res.voiceName,
        fileName: `AI播音_${res.voiceName}.wav`,
      });
      if (res.fallbackNote) {
        setTtsNotice(res.fallbackNote);
      }
    } catch (err: any) {
      setTtsError(err.message || '生成配音失败，请稍后重试或上传本地录音');
    } finally {
      setIsGeneratingTTS(false);
    }
  };

  const togglePlayAudio = () => {
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.play();
      setIsPlayingAudio(true);
    }
  };

  // ==========================================
  // Subtitle Operations
  // ==========================================
  const handleExportSrt = () => {
    const srtContent = exportToSrt(subtitles);
    downloadFile(srtContent, `${project.name || '推文'}_字幕.srt`, 'text/plain;charset=utf-8');
  };

  const handleUpdateSubtitleItem = (id: string, partial: Partial<SubtitleItem>) => {
    onUpdateSubtitles(subtitles.map((sub) => (sub.id === id ? { ...sub, ...partial } : sub)));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header & Tabs */}
      <div className="border-b border-stone-800 pb-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <Sliders className="w-5 h-5 text-amber-500" />
            第四步：制作图片、角色视觉、配音与字幕
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            配置主要人物外貌基准、为每个分镜定制 9:16 竖屏原画、录入或生成真人感旁白音频、调整字幕样式。
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-900 border border-stone-800 rounded-xl">
          {[
            { id: 'images', name: '分镜配图', icon: ImageIcon, badge: `${scenes.filter((s) => s.imageUrl).length}/${scenes.length}` },
            { id: 'characters', name: '角色设定', icon: Users, badge: `${characters.length}人` },
            { id: 'audio', name: '音频配音', icon: Mic, badge: audio.sourceType !== 'none' ? '已就绪' : '未配置' },
            { id: 'subtitles', name: '字幕样式', icon: Subtitles, badge: `${subtitles.length}句` },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-amber-500 text-stone-950 shadow-sm font-bold'
                    : 'text-stone-300 hover:text-stone-100 hover:bg-stone-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-stone-950/20 text-stone-950' : 'bg-stone-800 text-stone-400'
                  }`}
                >
                  {tab.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: 分镜配图管理 (IMAGES)
      ========================================================================= */}
      {activeTab === 'images' && (
        <div className="space-y-4">
          {/* Top Quick Actions Bar */}
          <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-stone-300">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>一键填充电影感氛围底图：</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {VISUAL_PRESETS.map((vp) => (
                  <button
                    key={vp.id}
                    onClick={() => handleApplyPresetAtmosphereAll(vp.id)}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 text-[11px] transition-colors"
                  >
                    {vp.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-stone-400">
              已配图：
              <strong className="text-amber-400 font-mono ml-1">
                {scenes.filter((s) => s.imageUrl).length}
              </strong>
              /{scenes.length} 场景
            </div>
          </div>

          {/* Hidden file input for uploading to a specific scene */}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            id="scene-image-file-input"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && fileUploadSceneRef.current.sceneId) {
                handleUploadImageForScene(fileUploadSceneRef.current.sceneId, file);
              }
              e.target.value = '';
            }}
          />

          {/* Scenes Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenes.map((scene, idx) => {
              const isGeneratingThis = generatingSceneId === scene.id;
              const hasError = imageErrorMap[scene.id];

              return (
                <div
                  key={scene.id}
                  className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between group"
                >
                  {/* Top Image Preview Area (9:16 ratio) */}
                  <div className="relative aspect-[9/16] bg-stone-950 overflow-hidden flex items-center justify-center">
                    {scene.imageUrl ? (
                      <img
                        src={scene.imageUrl}
                        alt={`分镜 ${scene.order}`}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="p-4 text-center text-stone-600 space-y-2">
                        <ImageIcon className="w-12 h-12 mx-auto stroke-1 text-stone-700" />
                        <span className="text-xs">暂无配图</span>
                      </div>
                    )}

                    {/* Scene Tag Overlay */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm text-amber-400 font-bold text-[11px] border border-amber-500/40">
                        场景 #{scene.order}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm text-stone-300 text-[10px]">
                        {scene.duration}秒
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-0.5 rounded-full bg-black/75 backdrop-blur-sm text-stone-300 text-[10px]">
                        {scene.composition}
                      </span>
                    </div>

                    {/* Loading Overlay */}
                    {isGeneratingThis && (
                      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center space-y-2">
                        <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-amber-300 font-semibold">AI 正在绘制竖屏画面...</span>
                        <span className="text-[10px] text-stone-400">调用 9:16 构图模型</span>
                      </div>
                    )}
                  </div>

                  {/* Bottom Info & Action Area */}
                  <div className="p-3.5 space-y-2.5 bg-stone-900 border-t border-stone-800">
                    <div className="text-xs text-stone-200 font-medium line-clamp-2 leading-relaxed">
                      “{scene.narration}”
                    </div>

                    {/* Visual prompt snippet */}
                    <div className="text-[11px] text-stone-400 line-clamp-1">
                      视觉：{scene.visualDescription}
                    </div>

                    {/* Error Notice */}
                    {hasError && (
                      <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/80 text-rose-300 text-[11px] leading-tight">
                        {hasError}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <button
                        onClick={() => handleGenerateImageForScene(scene)}
                        disabled={isGeneratingThis}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center justify-center gap-1 transition-colors disabled:opacity-50"
                        title="调用 AI 图像生成"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI 生成</span>
                      </button>

                      <button
                        onClick={() => {
                          fileUploadSceneRef.current.sceneId = scene.id;
                          document.getElementById('scene-image-file-input')?.click();
                        }}
                        className="py-1.5 px-3 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-medium flex items-center gap-1 transition-colors"
                        title="上传本地图片文件"
                      >
                        <Upload className="w-3.5 h-3.5 text-stone-400" />
                        <span>上传本地图</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: 角色视觉设定 (CHARACTERS)
      ========================================================================= */}
      {activeTab === 'characters' && (
        <div className="space-y-4">
          <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                主要登场人物视觉设定
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                角色外貌属性（发型、脸型、服装、气质）将自动注入各分镜生图提示词中，最大程度保证跨场景人物视觉一致性。
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAddCharacter}
                className="text-xs px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition-colors flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>添加人物</span>
              </button>

              <button
                onClick={handleExtractCharacters}
                disabled={isExtractingChars}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 transition-colors flex items-center gap-1 font-semibold disabled:opacity-50"
              >
                {isExtractingChars ? (
                  <>
                    <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>AI 正在提炼原著角色...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI 一键提取书中角色</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {charExtractError && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{charExtractError}</span>
            </div>
          )}

          {characters.length === 0 ? (
            <div className="p-12 text-center bg-stone-900 border border-stone-800 rounded-2xl space-y-3">
              <Users className="w-10 h-10 text-stone-600 mx-auto" />
              <p className="text-sm text-stone-300 font-semibold">尚未配置人物设定</p>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                点击上方“AI 一键提取书中角色”或“添加人物”，为主要角色制定发型、服饰与气质基准。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {characters.map((char) => (
                <div
                  key={char.id}
                  className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-3"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                        {char.name.charAt(0)}
                      </span>
                      <input
                        type="text"
                        value={char.name}
                        onChange={(e) => handleUpdateCharacter(char.id, { name: e.target.value })}
                        placeholder="角色姓名"
                        className="bg-transparent font-bold text-sm text-stone-100 focus:outline-none focus:border-b border-amber-500 w-32"
                      />
                    </div>

                    <button
                      onClick={() => handleDeleteCharacter(char.id)}
                      className="text-stone-500 hover:text-rose-400 p-1"
                      title="删除角色"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-stone-400 text-[11px] block mb-1">年龄段</label>
                      <input
                        type="text"
                        value={char.age}
                        onChange={(e) => handleUpdateCharacter(char.id, { age: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-stone-400 text-[11px] block mb-1">性别</label>
                      <input
                        type="text"
                        value={char.gender}
                        onChange={(e) => handleUpdateCharacter(char.id, { gender: e.target.value })}
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-stone-400 text-[11px] block mb-1">发型与发色</label>
                      <input
                        type="text"
                        value={char.hairstyle}
                        onChange={(e) => handleUpdateCharacter(char.id, { hairstyle: e.target.value })}
                        placeholder="如：黑色微卷长发，发梢及腰"
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-stone-400 text-[11px] block mb-1">面容神态特征</label>
                      <input
                        type="text"
                        value={char.facialFeatures}
                        onChange={(e) => handleUpdateCharacter(char.id, { facialFeatures: e.target.value })}
                        placeholder="如：清冷凤眼，神态自若"
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-stone-400 text-[11px] block mb-1">标志性服饰穿搭</label>
                      <input
                        type="text"
                        value={char.clothing}
                        onChange={(e) => handleUpdateCharacter(char.id, { clothing: e.target.value })}
                        placeholder="如：米白色羊绒大衣，戴细致银镯"
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    <div>
                      <label className="text-stone-400 text-[11px] block mb-1">性格与气质</label>
                      <input
                        type="text"
                        value={char.temperament}
                        onChange={(e) => handleUpdateCharacter(char.id, { temperament: e.target.value })}
                        placeholder="如：隐忍清冷、反差极强"
                        className="w-full bg-stone-950 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: 音频与配音管理 (AUDIO)
      ========================================================================= */}
      {activeTab === 'audio' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Upload Custom Audio */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-bold text-stone-100">方式一：上传本地录制音频</h3>
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                如果您已有专业配音员录制或第三方软件生成的口播音频，可直接在此上传。支持 MP3、WAV、M4A 格式。
              </p>

              <input
                ref={audioUploadInputRef}
                type="file"
                accept="audio/mp3,audio/wav,audio/m4a,audio/*"
                onChange={handleUploadAudio}
                className="hidden"
              />

              <div
                onClick={() => audioUploadInputRef.current?.click()}
                className="border-2 border-dashed border-stone-800 hover:border-amber-500/50 rounded-xl p-8 text-center cursor-pointer transition-colors space-y-2 bg-stone-950/40"
              >
                <Upload className="w-8 h-8 text-stone-500 mx-auto" />
                <div className="text-xs font-semibold text-stone-200">点击上传音频文件</div>
                <div className="text-[11px] text-stone-500">支持 MP3, WAV, M4A</div>
              </div>
            </div>

            {/* Right: Real AI TTS Generation */}
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <h3 className="text-sm font-bold text-stone-100">方式二：真实 AI 旁白配音生成</h3>
                </div>
                {onOpenAiManagement && (
                  <button
                    onClick={onOpenAiManagement}
                    className="text-xs text-stone-400 hover:text-amber-400 flex items-center gap-1 transition-colors cursor-pointer"
                    title="管理语音模型与服务商"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>AI模型配置</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-400 leading-relaxed">
                依据「AI 管理中心」当前启用的语音服务商（默认 MiniMax Speech 高清音色或 Google Gemini 智能语音），一键合成短视频解说旁白。
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-stone-300 block mb-1">
                    选择解说音色
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'female-yujie', name: '御姐音 (推荐)', desc: '知性冷艳 · 豪门/悬疑/复仇' },
                      { id: 'female-tianmei', name: '甜美音', desc: '灵动轻快 · 言情/温馨/日常' },
                      { id: 'male-qn-qingse', name: '青年音', desc: '朝气蓬勃 · 爽文/逆袭/热血' },
                      { id: 'male-qn-jingying', name: '精英男声', desc: '磁性抓人 · 商战/反转/沉稳' },
                    ].map((v) => (
                      <button
                        key={v.id}
                        onClick={() => setTtsVoice(v.id)}
                        className={`p-2.5 rounded-xl text-left border transition-all ${
                          ttsVoice === v.id
                            ? 'bg-amber-500/15 border-amber-500/70 text-amber-300'
                            : 'bg-stone-950 border-stone-800 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        <div className="text-xs font-semibold">{v.name}</div>
                        <div className="text-[10px] text-stone-500 mt-0.5">{v.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {ttsNotice && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2 animate-in fade-in">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed text-[11px]">{ttsNotice}</div>
                  </div>
                )}

                {ttsError && (
                  <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs space-y-2">
                    <div className="font-semibold leading-relaxed">{ttsError}</div>
                    {onOpenAiManagement && (
                      <button
                        onClick={onOpenAiManagement}
                        className="px-2.5 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-white text-[11px] font-bold cursor-pointer transition-all flex items-center gap-1.5"
                      >
                        <Sliders className="w-3 h-3" />
                        <span>前往 AI 管理中心配置有效密钥或切换为 Gemini 引擎</span>
                      </button>
                    )}
                  </div>
                )}

                <button
                  onClick={handleGenerateTTS}
                  disabled={isGeneratingTTS || !script.narration}
                  className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-amber-500 hover:bg-amber-400 text-stone-950 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isGeneratingTTS ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-stone-950 border-t-transparent rounded-full animate-spin" />
                      <span>AI 引擎正在合成配音...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <span>合成全篇旁白配音（约 {Math.round(script.narration.length / 4)} 秒）</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Current Audio Player & Status */}
          <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-300 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-amber-400" />
                当前项目音频轨道状态
              </span>

              {audio.sourceType !== 'none' ? (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>音频已配齐 ({audio.sourceType === 'tts' ? 'AI配音' : '本地上传'})</span>
                </span>
              ) : (
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>尚未配置音频（合成前必须配置）</span>
                </span>
              )}
            </div>

            {audio.audioUrl ? (
              <div className="p-3 bg-stone-950 border border-stone-800 rounded-xl flex items-center justify-between gap-4">
                <audio ref={audioRef} src={audio.audioUrl} preload="auto" />

                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlayAudio}
                    className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-400 text-stone-950 flex items-center justify-center shadow-md cursor-pointer"
                  >
                    {isPlayingAudio ? (
                      <Pause className="w-4 h-4 fill-stone-950" />
                    ) : (
                      <Play className="w-4 h-4 fill-stone-950 ml-0.5" />
                    )}
                  </button>

                  <div className="text-xs">
                    <div className="font-semibold text-stone-200">
                      {audio.fileName || '已就绪口播音频'}
                    </div>
                    <div className="text-stone-400 text-[11px] font-mono">
                      时长: {audio.duration} 秒
                    </div>
                  </div>
                </div>

                <button
                  onClick={() =>
                    onUpdateAudio({
                      duration: 0,
                      sourceType: 'none',
                      audioUrl: undefined,
                      audioBase64: undefined,
                    })
                  }
                  className="text-stone-400 hover:text-rose-400 text-xs px-2.5 py-1 rounded bg-stone-900 border border-stone-800"
                >
                  移除音频
                </button>
              </div>
            ) : (
              <div className="p-3 text-center text-xs text-stone-500 bg-stone-950/60 rounded-xl">
                依据短视频成片标准，必须具有旁白音频后方可合成完整视频。请从上方上传本地音频或点击 AI 合成。
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: 字幕编辑与样式 (SUBTITLES)
      ========================================================================= */}
      {activeTab === 'subtitles' && (
        <div className="space-y-4">
          <div className="p-4 bg-stone-900 border border-stone-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-amber-500" />
                字幕列表与爆款样式设定
              </h3>
              <p className="text-xs text-stone-400 mt-0.5">
                支持微调单句字幕起止时间轴、文字大小与描边，点击右侧可一键下载标准 SRT 字幕。
              </p>
            </div>

            <button
              onClick={handleExportSrt}
              className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>导出标准 .SRT 文件</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Subtitle Style Controls (4 cols) */}
            <div className="lg:col-span-4 bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-stone-200 pb-2 border-b border-stone-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>字幕视觉样式调节</span>
              </h4>

              {/* Font Size */}
              <div>
                <div className="flex justify-between text-xs text-stone-300 mb-1">
                  <span>字幕字号</span>
                  <span className="font-mono text-amber-400">{subtitleStyle.fontSize} px</span>
                </div>
                <input
                  type="range"
                  min="28"
                  max="56"
                  step="2"
                  value={subtitleStyle.fontSize}
                  onChange={(e) =>
                    onUpdateSubtitleStyle({ ...subtitleStyle, fontSize: parseInt(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Font Colors */}
              <div>
                <label className="text-xs text-stone-300 block mb-1.5">字体颜色</label>
                <div className="flex items-center gap-2">
                  {[
                    { color: '#FFFFFF', name: '纯白' },
                    { color: '#FDE047', name: '亮黄' },
                    { color: '#F59E0B', name: '黄金' },
                    { color: '#38BDF8', name: '青蓝' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      onClick={() => onUpdateSubtitleStyle({ ...subtitleStyle, color: c.color })}
                      className={`flex-1 py-1 rounded-lg text-xs font-medium border flex items-center justify-center gap-1 ${
                        subtitleStyle.color === c.color
                          ? 'border-amber-400 bg-stone-800'
                          : 'border-stone-800 bg-stone-950 text-stone-400'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stroke */}
              <div>
                <div className="flex justify-between text-xs text-stone-300 mb-1">
                  <span>文字黑边描边粗细</span>
                  <span className="font-mono text-amber-400">{subtitleStyle.outlineWidth} px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="6"
                  value={subtitleStyle.outlineWidth}
                  onChange={(e) =>
                    onUpdateSubtitleStyle({ ...subtitleStyle, outlineWidth: parseInt(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Vertical Margin (Safe Area) */}
              <div>
                <div className="flex justify-between text-xs text-stone-300 mb-1">
                  <span>底部安全距离 (避开抖音文案与底栏)</span>
                  <span className="font-mono text-amber-400">{subtitleStyle.verticalMargin} px</span>
                </div>
                <input
                  type="range"
                  min="160"
                  max="420"
                  step="20"
                  value={subtitleStyle.verticalMargin}
                  onChange={(e) =>
                    onUpdateSubtitleStyle({
                      ...subtitleStyle,
                      verticalMargin: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              {/* Live Preview Sample */}
              <div className="pt-2">
                <span className="text-[11px] text-stone-400 block mb-1.5">样式实时预览：</span>
                <div className="p-4 bg-stone-950 rounded-xl border border-stone-800 flex items-center justify-center text-center">
                  <span
                    style={{
                      fontSize: `${Math.round(subtitleStyle.fontSize * 0.45)}px`,
                      color: subtitleStyle.color,
                      textShadow: `-${subtitleStyle.outlineWidth}px -${subtitleStyle.outlineWidth}px 0 #000, ${subtitleStyle.outlineWidth}px -${subtitleStyle.outlineWidth}px 0 #000, -${subtitleStyle.outlineWidth}px ${subtitleStyle.outlineWidth}px 0 #000, ${subtitleStyle.outlineWidth}px ${subtitleStyle.outlineWidth}px 0 #000`,
                      fontWeight: 700,
                    }}
                  >
                    回到林家的第三年，我才明白
                  </span>
                </div>
              </div>
            </div>

            {/* Subtitles Timeline List (8 cols) */}
            <div className="lg:col-span-8 bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-sm space-y-3">
              <div className="text-xs font-bold text-stone-300 flex items-center justify-between pb-1 border-b border-stone-800">
                <span>分句字幕时间轴 ({subtitles.length})</span>
                <span className="text-[11px] text-stone-400">
                  可直接点击文本进行微调
                </span>
              </div>

              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {subtitles.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="p-3 bg-stone-950 border border-stone-800 rounded-xl flex items-start gap-3 text-xs"
                  >
                    <span className="w-5 h-5 rounded bg-stone-800 text-stone-400 font-mono text-[11px] flex items-center justify-center shrink-0 mt-1">
                      {idx + 1}
                    </span>

                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={sub.text}
                        onChange={(e) => handleUpdateSubtitleItem(sub.id, { text: e.target.value })}
                        className="w-full bg-stone-900 border border-stone-800 rounded-lg px-2.5 py-1.5 text-stone-200 focus:outline-none focus:border-amber-500 font-sans"
                      />

                      <div className="flex items-center gap-3 text-[11px] text-stone-400 font-mono">
                        <div className="flex items-center gap-1">
                          <span>起始:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={sub.start}
                            onChange={(e) =>
                              handleUpdateSubtitleItem(sub.id, { start: parseFloat(e.target.value) || 0 })
                            }
                            className="w-14 bg-stone-900 border border-stone-800 rounded px-1.5 py-0.5 text-stone-200"
                          />
                          <span>秒</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <span>结束:</span>
                          <input
                            type="number"
                            step="0.5"
                            value={sub.end}
                            onChange={(e) =>
                              handleUpdateSubtitleItem(sub.id, { end: parseFloat(e.target.value) || 0 })
                            }
                            className="w-14 bg-stone-900 border border-stone-800 rounded px-1.5 py-0.5 text-stone-200"
                          />
                          <span>秒</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer */}
      <div className="border-t border-stone-800 pt-4 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-stone-300 hover:text-stone-100 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回第三步修改分镜</span>
        </button>

        <button
          onClick={onNext}
          className="px-6 py-2.5 text-xs font-bold text-stone-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all shadow-md shadow-amber-950/40 flex items-center gap-2 cursor-pointer"
        >
          <span>进入第五步：竖屏预览与视频合成</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
