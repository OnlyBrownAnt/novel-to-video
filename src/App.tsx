import React, { useState, useEffect, useRef } from 'react';
import { NovelProject, Character, Scene, SubtitleItem, SubtitleStyle, AudioState, NovelState, ScriptState } from './types/project';
import { ChapterSliceSelection } from './types/novelLibrary';
import { projectStorage, createDefaultProject, PRESET_PROJECTS } from './services/storage';
import { api } from './services/api';
import { Header } from './components/Header';
import { StepNav } from './components/StepNav';
import { Step1Import } from './components/steps/Step1Import';
import { Step2Script } from './components/steps/Step2Script';
import { Step3Storyboard } from './components/steps/Step3Storyboard';
import { Step4Assets } from './components/steps/Step4Assets';
import { Step5Export } from './components/steps/Step5Export';
import { NovelLibraryModal } from './components/library/NovelLibraryModal';
import { AiManagementModal } from './components/AiManagementModal';
import { generateCinematicSceneSVG } from './utils/visualPreset';
import { downloadFile } from './utils/srt';

export default function App() {
  const [project, setProject] = useState<NovelProject>(() => createDefaultProject());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Novel Library Modal State
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryCount, setLibraryCount] = useState(0);

  // AI Management Center Modal State
  const [isAiManagementOpen, setIsAiManagementOpen] = useState(false);

  // Loading states for asynchronous AI operations
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isSplittingScenes, setIsSplittingScenes] = useState(false);

  // Hidden JSON import input
  const jsonImportInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Initial Load from IndexedDB
  useEffect(() => {
    (async () => {
      try {
        // Load active project
        const lastProject = await projectStorage.getLastActiveProject();
        if (lastProject) {
          setProject(lastProject);
        } else {
          // initialize with first preset as friendly default if completely empty
          const defaultProj = createDefaultProject('豪门千金的反击');
          const p = PRESET_PROJECTS[0];
          defaultProj.novel.title = p.title;
          defaultProj.novel.chapter = p.chapter;
          defaultProj.novel.text = p.sampleText;
          defaultProj.novel.wordCount = p.sampleText.length;
          defaultProj.novel.targetDuration = p.duration;
          defaultProj.novel.narrativeStyle = p.style;
          defaultProj.novel.pov = p.pov;
          setProject(defaultProj);
          await projectStorage.saveProject(defaultProj);
        }

        // Count novels in library
        const libraryNovels = await projectStorage.getAllLibraryNovels();
        setLibraryCount(libraryNovels.length);
      } catch (err) {
        console.error('Failed to load project from IndexedDB:', err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Update library count whenever library is opened/closed
  const refreshLibraryCount = async () => {
    const list = await projectStorage.getAllLibraryNovels();
    setLibraryCount(list.length);
  };

  // 2. Debounced Auto-save to IndexedDB
  useEffect(() => {
    if (!isLoaded) return;

    setIsSaving(true);
    const timer = setTimeout(async () => {
      try {
        await projectStorage.saveProject(project);
        setLastSavedAt(Date.now());
      } catch (err) {
        console.error('Auto save error:', err);
      } finally {
        setIsSaving(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [project, isLoaded]);

  // Project updater helper
  const handleUpdateProject = (updater: (prev: NovelProject) => NovelProject) => {
    setProject((prev) => updater(prev));
  };

  // Step Select
  const handleSelectStep = (step: number) => {
    setProject((prev) => ({ ...prev, currentStep: step }));
  };

  // ==========================================
  // Core AI Actions
  // ==========================================
  const handleGenerateScript = async () => {
    if (!project.novel.text || project.novel.text.trim().length < 10) {
      alert('请先输入至少 10 字的小说正文片段');
      return;
    }

    setIsGeneratingScript(true);
    try {
      const res = await api.generateScript({
        novelText: project.novel.text,
        novelTitle: project.novel.title,
        chapterTitle: project.novel.chapter,
        contextSummary: project.novel.contextSummary,
        targetDuration: project.novel.targetDuration,
        narrativeStyle: project.novel.narrativeStyle,
        pov: project.novel.pov,
        hookStrength: project.novel.hookStrength,
        adaptationDegree: project.novel.adaptationDegree,
        customInstructions: project.novel.customInstructions,
      });

      setProject((prev) => ({
        ...prev,
        currentStep: 2,
        script: {
          ...prev.script,
          title: res.title,
          hook: res.hook,
          narration: res.narration,
          estimatedDuration: res.estimatedDuration,
          emotionArc: res.emotionArc,
          endingHook: res.endingHook,
          factCheckNotes: res.factCheckNotes,
          isModifiedByUser: false,
        },
      }));
    } catch (err: any) {
      alert(`生成脚本失败: ${err.message || '网络或接口异常'}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleSplitScenes = async () => {
    if (!project.script.narration || project.script.narration.trim().length < 10) {
      alert('旁白文案为空，请先在第二步完成脚本编辑');
      return;
    }

    setIsSplittingScenes(true);
    try {
      const newScenes = await api.splitScenes(project.script.narration, project.characters);

      // Pre-fill high-aesthetic preset SVGs so images are never blank
      const scenesWithImages = newScenes.map((s, idx) => ({
        ...s,
        imageUrl: s.imageUrl || generateCinematicSceneSVG('noir_rain', idx + 1, s.narration, s.composition),
        imageStatus: 'ready' as const,
      }));

      setProject((prev) => ({
        ...prev,
        scenes: scenesWithImages,
        currentStep: 3,
      }));
    } catch (err: any) {
      alert(`拆分分镜失败: ${err.message || '网络或接口异常'}`);
    } finally {
      setIsSplittingScenes(false);
    }
  };

  // ==========================================
  // Create Project from Novel Library Selection
  // ==========================================
  const handleSelectForCreation = async (selection: ChapterSliceSelection) => {
    const newProj = createDefaultProject(`《${selection.novelTitle}》· ${selection.chapterTitle}`);
    newProj.novel = {
      ...newProj.novel,
      title: selection.novelTitle,
      chapter: selection.chapterTitle,
      text: selection.selectedText,
      wordCount: selection.wordCount,
      sourceNovelId: selection.novelId,
      sourceChapterId: selection.chapterId,
      sourceChapterIndex: selection.chapterIndex,
      includeContextBackground: selection.includeContextBackground,
      contextSummary: selection.contextSummary,
    };

    setProject(newProj);
    await projectStorage.saveProject(newProj);
    await refreshLibraryCount();
  };

  // ==========================================
  // Project Import / Export / Preset
  // ==========================================
  const handleExportJson = () => {
    const jsonStr = projectStorage.exportProjectJson(project);
    downloadFile(jsonStr, `${project.name || '推文项目'}_工程备份.json`, 'application/json');
  };

  const handleImportJson = () => {
    jsonImportInputRef.current?.click();
  };

  const handleJsonFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const imported = await projectStorage.importProjectJson(text);
        setProject(imported);
        alert('工程文件导入成功！');
      } catch (err: any) {
        alert(`导入失败: ${err.message || '格式无效'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadPreset = (index: number) => {
    const p = PRESET_PROJECTS[index];
    if (p) {
      const newProj = createDefaultProject(`《${p.title}》推文`);
      newProj.novel = {
        ...newProj.novel,
        title: p.title,
        chapter: p.chapter,
        text: p.sampleText,
        wordCount: p.sampleText.length,
        targetDuration: p.duration,
        narrativeStyle: p.style,
        pov: p.pov,
      };
      setProject(newProj);
    }
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center text-stone-300 space-y-3">
        <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-semibold">正在载入小说推文工坊工作区...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-stone-950 text-stone-100 font-sans">
      {/* Hidden file input for importing project JSON */}
      <input
        ref={jsonImportInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleJsonFileChange}
        className="hidden"
      />

      {/* Top Header */}
      <Header
        project={project}
        onUpdateProject={handleUpdateProject}
        onExportJson={handleExportJson}
        onImportJson={handleImportJson}
        onLoadPreset={handleLoadPreset}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onOpenAiManagement={() => setIsAiManagementOpen(true)}
        libraryCount={libraryCount}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
      />

      {/* AI Management Center Modal */}
      <AiManagementModal
        isOpen={isAiManagementOpen}
        onClose={() => setIsAiManagementOpen(false)}
      />

      {/* Novel Library Management Modal */}
      <NovelLibraryModal
        isOpen={isLibraryOpen}
        onClose={() => {
          setIsLibraryOpen(false);
          refreshLibraryCount();
        }}
        onSelectForCreation={handleSelectForCreation}
      />

      {/* Main Workbench Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Step Navigation */}
        <StepNav
          project={project}
          currentStep={project.currentStep}
          onSelectStep={handleSelectStep}
        />

        {/* Center Main Step Workspace */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {project.currentStep === 1 && (
            <Step1Import
              project={project}
              onUpdateNovel={(partial) =>
                handleUpdateProject((prev) => ({
                  ...prev,
                  novel: { ...prev.novel, ...partial },
                }))
              }
              onNext={() => handleSelectStep(2)}
              onGenerateScript={handleGenerateScript}
              onOpenLibrary={() => setIsLibraryOpen(true)}
              isGenerating={isGeneratingScript}
            />
          )}

          {project.currentStep === 2 && (
            <Step2Script
              project={project}
              onUpdateScript={(partial) =>
                handleUpdateProject((prev) => ({
                  ...prev,
                  script: { ...prev.script, ...partial },
                }))
              }
              onNext={() => {
                // If scenes are not split yet, auto trigger split
                if (project.scenes.length === 0) {
                  handleSplitScenes();
                } else {
                  handleSelectStep(3);
                }
              }}
              onPrev={() => handleSelectStep(1)}
              onRegenerate={handleGenerateScript}
              isGenerating={isGeneratingScript}
            />
          )}

          {project.currentStep === 3 && (
            <Step3Storyboard
              project={project}
              onUpdateScenes={(scenes) =>
                handleUpdateProject((prev) => ({
                  ...prev,
                  scenes,
                }))
              }
              onNext={() => handleSelectStep(4)}
              onPrev={() => handleSelectStep(2)}
              onSplitScenes={handleSplitScenes}
              isSplitting={isSplittingScenes}
            />
          )}

          {project.currentStep === 4 && (
            <Step4Assets
              project={project}
              onUpdateCharacters={(characters) =>
                handleUpdateProject((prev) => ({
                  ...prev,
                  characters,
                }))
              }
              onUpdateScenes={(scenes) =>
                handleUpdateProject((prev) => ({
                  ...prev,
                  scenes,
                }))
              }
              onUpdateAudio={(audio) =>
                handleUpdateProject((prev) => ({
                  ...prev,
                  audio,
                }))
              }
              onUpdateSubtitles={(subtitles) =>
                handleUpdateProject((prev) => ({
                  ...prev,
                  subtitles,
                }))
              }
              onUpdateSubtitleStyle={(subtitleStyle) =>
                handleUpdateProject((prev) => ({
                  ...prev,
                  subtitleStyle,
                }))
              }
              onNext={() => handleSelectStep(5)}
              onPrev={() => handleSelectStep(3)}
              onOpenAiManagement={() => setIsAiManagementOpen(true)}
            />
          )}

          {project.currentStep === 5 && (
            <Step5Export
              project={project}
              onUpdateProject={handleUpdateProject}
              onPrev={() => handleSelectStep(4)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
