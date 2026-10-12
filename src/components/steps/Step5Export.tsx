import React, { useState, useRef, useEffect } from 'react';
import { NovelProject, SubtitleStyle } from '../../types/project';
import { api } from '../../services/api';
import { exportToSrt, downloadFile, downloadBlob } from '../../utils/srt';
import { projectStorage } from '../../services/storage';
import {
  Video,
  Play,
  Pause,
  Download,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Layers,
  FileText,
  FileCheck,
  RefreshCw,
  Film,
  Smartphone,
  Eye,
  Sliders,
  RotateCcw,
  Volume2,
  VolumeX,
  ArrowLeft,
} from 'lucide-react';

interface Step5ExportProps {
  project: NovelProject;
  onUpdateProject: (updater: (prev: NovelProject) => NovelProject) => void;
  onPrev: () => void;
}

export const Step5Export: React.FC<Step5ExportProps> = ({
  project,
  onUpdateProject,
  onPrev,
}) => {
  const { scenes, audio, subtitles, subtitleStyle, script, novel, exportConfig } = project;

  // Player preview states
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [showDouyinSafeZone, setShowDouyinSafeZone] = useState(true);

  // Video Render States
  const [isRendering, setIsRendering] = useState(false);
  const [renderJobId, setRenderJobId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatusText, setRenderStatusText] = useState('准备开始合成...');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [downloadVideoUrl, setDownloadVideoUrl] = useState<string | null>(
    exportConfig.lastExportUrl || null
  );

  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const previewTimerRef = useRef<any>(null);

  const totalDuration = scenes.reduce((sum, s) => sum + (s.duration || 4), 0);

  // Pre-flight check validations
  const missingImageScenes = scenes.filter((s) => !s.imageUrl);
  const hasAudio = Boolean(audio.audioBase64 || audio.audioUrl);
  const canRender = scenes.length > 0 && missingImageScenes.length === 0 && hasAudio;

  // Active Subtitle for current time
  const currentSubtitle = subtitles.find(
    (sub) => currentTime >= sub.start && currentTime <= sub.end
  );

  // Track scene by current time
  useEffect(() => {
    let acc = 0;
    for (let i = 0; i < scenes.length; i++) {
      const dur = scenes[i].duration || 4;
      if (currentTime >= acc && currentTime < acc + dur) {
        setCurrentSceneIndex(i);
        break;
      }
      acc += dur;
    }
  }, [currentTime, scenes]);

  // Player ticker
  useEffect(() => {
    if (isPlaying) {
      if (audioPlayerRef.current && audio.audioUrl) {
        audioPlayerRef.current.currentTime = currentTime;
        audioPlayerRef.current.play().catch(() => {});
      }

      previewTimerRef.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + 0.1;
          if (next >= totalDuration) {
            setIsPlaying(false);
            if (audioPlayerRef.current) audioPlayerRef.current.pause();
            return 0;
          }
          return +next.toFixed(1);
        });
      }, 100);
    } else {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
      if (audioPlayerRef.current) audioPlayerRef.current.pause();
    }

    return () => {
      if (previewTimerRef.current) clearInterval(previewTimerRef.current);
    };
  }, [isPlaying, totalDuration, audio.audioUrl]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    if (audioPlayerRef.current && audio.audioUrl) {
      audioPlayerRef.current.currentTime = newTime;
    }
  };

  // ==========================================
  // Real Video Synthesis Trigger & Polling
  // ==========================================
  const handleStartRender = async () => {
    if (!canRender) return;

    setIsRendering(true);
    setRenderError(null);
    setRenderProgress(10);
    setRenderStatusText('正在准备场景图片与音频工程...');

    try {
      // 1. Submit render job to backend FFmpeg pipeline
      const { jobId } = await api.renderVideo({
        scenes: scenes.map((s) => ({
          id: s.id,
          order: s.order,
          duration: s.duration || 4,
          imageUrl: s.imageUrl || '',
        })),
        audioBase64: audio.audioBase64 || audio.audioUrl || '',
        subtitles,
        subtitleStyle,
        applyKenBurns: exportConfig.applyKenBurns,
      });

      setRenderJobId(jobId);

      // 2. Poll real progress from server
      const pollInterval = setInterval(async () => {
        try {
          const status = await api.getRenderStatus(jobId);
          setRenderProgress(status.progress);

          if (status.status === 'writing_assets') {
            setRenderStatusText('正在准备图片帧与音频流...');
          } else if (status.status === 'generating_subtitles') {
            setRenderStatusText('正在配置文泉驿中文字幕轨 (libass)...');
          } else if (status.status === 'encoding_video' || status.status === 'rendering') {
            setRenderStatusText(`FFmpeg 正在渲染 1080×1920 高清视频帧 (${status.progress}%)...`);
          } else if (status.status === 'completed') {
            clearInterval(pollInterval);
            setIsRendering(false);
            setRenderProgress(100);
            setRenderStatusText('视频合成完毕！');
            if (status.downloadUrl) {
              setDownloadVideoUrl(status.downloadUrl);
              onUpdateProject((prev) => ({
                ...prev,
                exportConfig: {
                  ...prev.exportConfig,
                  lastExportUrl: status.downloadUrl,
                  lastJobId: jobId,
                },
              }));
            }
          } else if (status.status === 'failed') {
            clearInterval(pollInterval);
            setIsRendering(false);
            setRenderError(status.error || '视频合成失败');
          }
        } catch (pollErr: any) {
          // keep trying
        }
      }, 1500);
    } catch (err: any) {
      setIsRendering(false);
      setRenderError(err.message || '提交视频合成任务失败');
    }
  };

  // Material Package Downloads
  const handleDownloadSrt = () => {
    const srt = exportToSrt(subtitles);
    downloadFile(srt, `${project.name || '推文'}.srt`);
  };

  const handleDownloadScriptTxt = () => {
    const textContent = `【作品】${novel.title || project.name}
【章节】${novel.chapter}
【短视频标题】${script.title}
【前3秒开头钩子】${script.hook}
【情绪曲线】${script.emotionArc}

【完整口播旁白】
${script.narration}

【结尾留钩子】
${script.endingHook}

【原著事实核对】
${script.factCheckNotes}
`;
    downloadFile(textContent, `${project.name || '推文'}_口播脚本.txt`);
  };

  const handleDownloadProjectBackup = () => {
    const jsonStr = projectStorage.exportProjectJson(project);
    downloadFile(jsonStr, `${project.name || '推文'}_工程备份.json`, 'application/json');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-stone-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-100 flex items-center gap-2">
            <Film className="w-5 h-5 text-amber-500" />
            第五步：9:16 竖屏视频预览与 MP4 真实合成
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            实时预览排版与画面动效。点击合成后，服务端原生 FFmpeg 将输出包含硬字幕、配音轨的高清 1080×1920 MP4。
          </p>
        </div>

        {/* Douyin Safe Area Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDouyinSafeZone(!showDouyinSafeZone)}
            className={`text-xs px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors ${
              showDouyinSafeZone
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-stone-900 text-stone-400 border-stone-800 hover:text-stone-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>抖音/快手短视频安全区参考线</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 9:16 Player Simulation Container (5 cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="relative w-full max-w-[340px] aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-stone-800 select-none">
            {/* Hidden audio element for preview */}
            {audio.audioUrl && (
              <audio ref={audioPlayerRef} src={audio.audioUrl} preload="auto" />
            )}

            {/* Scene Image Frame */}
            {scenes[currentSceneIndex]?.imageUrl ? (
              <div className="w-full h-full relative overflow-hidden">
                <img
                  src={scenes[currentSceneIndex].imageUrl}
                  alt="当前分镜画面"
                  className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                    isPlaying ? 'scale-105' : 'scale-100'
                  }`}
                />
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-stone-600 space-y-2 p-6 text-center">
                <Film className="w-12 h-12 stroke-1" />
                <span className="text-xs">该分镜尚未配置配图</span>
              </div>
            )}

            {/* Subtitle Overlay (Live Rendered) */}
            {currentSubtitle && (
              <div
                className="absolute inset-x-4 text-center pointer-events-none z-20 flex justify-center"
                style={{
                  bottom: `${Math.round((subtitleStyle.verticalMargin / 1920) * 100)}%`,
                }}
              >
                <span
                  style={{
                    fontSize: `${Math.round(subtitleStyle.fontSize * 0.42)}px`,
                    color: subtitleStyle.color,
                    textShadow: `-${subtitleStyle.outlineWidth}px -${subtitleStyle.outlineWidth}px 0 #000, ${subtitleStyle.outlineWidth}px -${subtitleStyle.outlineWidth}px 0 #000, -${subtitleStyle.outlineWidth}px ${subtitleStyle.outlineWidth}px 0 #000, ${subtitleStyle.outlineWidth}px ${subtitleStyle.outlineWidth}px 0 #000`,
                    fontWeight: 700,
                    lineHeight: 1.3,
                  }}
                  className="px-2"
                >
                  {currentSubtitle.text}
                </span>
              </div>
            )}

            {/* Douyin UI Safe Zone Overlay */}
            {showDouyinSafeZone && (
              <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 bg-gradient-to-b from-black/40 via-transparent to-black/60">
                {/* Top header simulation */}
                <div className="flex justify-between items-center text-[10px] text-white/70 font-semibold px-2 pt-1">
                  <span>关注</span>
                  <span className="text-white border-b-2 border-white pb-0.5">推荐</span>
                  <span>搜索</span>
                </div>

                {/* Right interaction column simulation */}
                <div className="self-end flex flex-col items-center gap-3 pr-1 pb-16 opacity-75">
                  <div className="w-8 h-8 rounded-full border border-white/60 bg-amber-500/80 flex items-center justify-center text-[10px] font-bold text-black">
                    作者
                  </div>
                  <div className="flex flex-col items-center text-[9px] text-white">
                    <span className="text-xs">❤️</span>
                    <span>12.8w</span>
                  </div>
                  <div className="flex flex-col items-center text-[9px] text-white">
                    <span className="text-xs">💬</span>
                    <span>4200</span>
                  </div>
                  <div className="flex flex-col items-center text-[9px] text-white">
                    <span className="text-xs">⭐</span>
                    <span>8900</span>
                  </div>
                  <div className="flex flex-col items-center text-[9px] text-white">
                    <span className="text-xs">↗️</span>
                    <span>分享</span>
                  </div>
                </div>

                {/* Bottom title & sound banner */}
                <div className="space-y-1 pb-2 px-1 text-white opacity-85">
                  <div className="text-[11px] font-bold">@{novel.title || '小说推文作者'}</div>
                  <div className="text-[10px] line-clamp-1 text-white/90">
                    {script.title || '精彩短剧小说推文'} #小说推文 #短剧解说
                  </div>
                  <div className="text-[9px] text-white/70 flex items-center gap-1">
                    <span>🎵 原声 - 小说推文旁白原声</span>
                  </div>
                </div>
              </div>
            )}

            {/* Play/Pause Center Trigger */}
            <div
              onClick={togglePlay}
              className="absolute inset-0 flex items-center justify-center cursor-pointer z-30 group"
            >
              {!isPlaying && (
                <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-2xl group-hover:scale-110 transition-transform">
                  <Play className="w-6 h-6 fill-white ml-1" />
                </div>
              )}
            </div>
          </div>

          {/* Player Timeline Bar */}
          <div className="w-full max-w-[340px] mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-stone-400 font-mono">
              <button
                onClick={togglePlay}
                className="flex items-center gap-1 text-amber-400 font-sans hover:text-amber-300"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-amber-400" />}
                <span>{isPlaying ? '暂停' : '播放预览'}</span>
              </button>
              <span>
                {currentTime.toFixed(1)}s / {totalDuration}s
              </span>
            </div>

            <input
              type="range"
              min="0"
              max={totalDuration || 1}
              step="0.1"
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>
        </div>

        {/* Right: Synthesis Center & Checklist (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Pre-flight Checklist Card */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2 pb-2 border-b border-stone-800">
              <FileCheck className="w-4 h-4 text-amber-500" />
              合成前数据完整性核对清单 (Pre-flight Checklist)
            </h3>

            <div className="space-y-2 text-xs">
              {/* Check 1: Scenes */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-stone-950 border border-stone-800/80">
                <div className="flex items-center gap-2">
                  {scenes.length > 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="text-stone-200">分镜场景列表</span>
                </div>
                <span className="text-stone-400">已就绪 {scenes.length} 个镜头</span>
              </div>

              {/* Check 2: Images */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-stone-950 border border-stone-800/80">
                <div className="flex items-center gap-2">
                  {missingImageScenes.length === 0 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="text-stone-200">分镜 9:16 配图</span>
                </div>
                {missingImageScenes.length === 0 ? (
                  <span className="text-emerald-400 font-semibold">全部配齐 (100%)</span>
                ) : (
                  <span className="text-rose-400">
                    尚缺 {missingImageScenes.length} 张图 (场景 {missingImageScenes.map((s) => s.order).join(',')})
                  </span>
                )}
              </div>

              {/* Check 3: Audio */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-stone-950 border border-stone-800/80">
                <div className="flex items-center gap-2">
                  {hasAudio ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                  )}
                  <span className="text-stone-200">旁白口播音频轨</span>
                </div>
                {hasAudio ? (
                  <span className="text-emerald-400 font-semibold">
                    已就绪 ({audio.duration}秒)
                  </span>
                ) : (
                  <span className="text-rose-400 font-semibold">
                    未配置（禁止合成无声伪造成片）
                  </span>
                )}
              </div>

              {/* Check 4: Subtitles */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-stone-950 border border-stone-800/80">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-stone-200">字幕时间轴与黑边描边</span>
                </div>
                <span className="text-stone-400">{subtitles.length} 条字幕</span>
              </div>
            </div>

            {!canRender && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2 leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  依据制作规范，若缺少配图或音频，系统将拦截合成，避免输出质量不合格的半成品。请返回第4步补全素材。
                </div>
              </div>
            )}
          </div>

          {/* Main Video Synthesis Action Box */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
                  <Video className="w-4 h-4 text-amber-500" />
                  服务端 FFmpeg 视频合成引擎
                </h3>
                <span className="text-[11px] text-stone-400">
                  规格：1080×1920 竖屏 · 30 FPS · H.264 + AAC · 硬字幕烧录
                </span>
              </div>
            </div>

            {/* Render Progress or Trigger */}
            {isRendering ? (
              <div className="p-5 rounded-xl bg-stone-950 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-amber-300 font-semibold flex items-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span>{renderStatusText}</span>
                  </span>
                  <span className="text-amber-400 font-mono font-bold">{renderProgress}%</span>
                </div>

                <div className="w-full bg-stone-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-2.5 rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                <p className="text-[11px] text-stone-400 text-center">
                  真实后台编码进程运行中，绝无虚假进度...
                </p>
              </div>
            ) : (
              <button
                onClick={handleStartRender}
                disabled={!canRender}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-lg shadow-amber-950/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>开始合成 1080×1920 高清 MP4 视频</span>
              </button>
            )}

            {renderError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center justify-between gap-2">
                <span>合成失败: {renderError}</span>
                <button
                  onClick={handleStartRender}
                  className="px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs shrink-0"
                >
                  重试
                </button>
              </div>
            )}

            {/* Completed Output Download & Video Playback */}
            {downloadVideoUrl && (
              <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>成片渲染成功，MP4 文件已就绪！</span>
                  </span>

                  <a
                    href={downloadVideoUrl}
                    download={`${project.name || '小说推文成片'}.mp4`}
                    className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-md"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>下载 MP4 视频</span>
                  </a>
                </div>

                {/* Direct HTML5 Video Player */}
                <div className="rounded-xl overflow-hidden border border-emerald-900 bg-black aspect-video flex items-center justify-center">
                  <video
                    src={downloadVideoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Material Package Download Grid */}
          <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-stone-200">
              工程素材包一键导出 (Material Bundle)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                onClick={handleDownloadSrt}
                className="p-3 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-left transition-colors space-y-1"
              >
                <div className="text-xs font-semibold text-stone-200 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>下载 SRT 字幕</span>
                </div>
                <div className="text-[11px] text-stone-500">标准时间轴字幕文件</div>
              </button>

              <button
                onClick={handleDownloadScriptTxt}
                className="p-3 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-left transition-colors space-y-1"
              >
                <div className="text-xs font-semibold text-stone-200 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>下载旁白文案 TXT</span>
                </div>
                <div className="text-[11px] text-stone-500">包含标题、钩子与备忘</div>
              </button>

              <button
                onClick={handleDownloadProjectBackup}
                className="p-3 rounded-xl bg-stone-950 hover:bg-stone-800 border border-stone-800 text-left transition-colors space-y-1"
              >
                <div className="text-xs font-semibold text-stone-200 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>下载完整工程 JSON</span>
                </div>
                <div className="text-[11px] text-stone-500">可随时重新导入复原</div>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="border-t border-stone-800 pt-4 flex items-center justify-between">
        <button
          onClick={onPrev}
          className="px-4 py-2 text-xs font-semibold text-stone-300 hover:text-stone-100 bg-stone-800 hover:bg-stone-700 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>返回第四步调整素材与配音</span>
        </button>

        <span className="text-xs text-stone-500">
          小说推文工坊 · 一站式制作闭环
        </span>
      </div>
    </div>
  );
};
